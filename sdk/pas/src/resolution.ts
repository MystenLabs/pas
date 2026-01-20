// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { ClientWithCoreApi } from '@mysten/sui/client';
import type { Transaction, TransactionObjectArgument } from '@mysten/sui/transactions';

import type { PASClient } from './client.js';
import * as Command from './contracts/pas/command.js';
import { Rule } from './contracts/pas/rule.js';
import { PASClientError } from './error.js';
import type { PASPackageConfig } from './types.js';

export type Rule = ReturnType<typeof Rule.parse>;

/**
 * Supported PAS action types that can be resolved via Rules.
 */
export enum PASActionType {
	/** Transfer funds between vaults */
	TransferFunds = 'TransferFunds',
	/** Unlock funds from a vault */
	UnlockFunds = 'UnlockFunds',
}

/**
 * Builds the full typename for a PAS action.
 *
 * @param actionType - The action type (TransferFunds or UnlockFunds)
 * @param assetType - The asset type (e.g., "0x2::sui::SUI")
 * @param packageConfig - PAS package configuration
 * @returns The full typename (e.g., "0x123::transfer_funds_request::TransferFundsRequest<0x2::sui::SUI>")
 */
export function buildActionTypeName(
	actionType: PASActionType,
	assetType: string,
	packageConfig: PASPackageConfig,
): string {
	const { packageId } = packageConfig;

	switch (actionType) {
		case PASActionType.TransferFunds:
			return `${packageId}::transfer_funds_request::TransferFundsRequest<${assetType}>`;
		case PASActionType.UnlockFunds:
			return `${packageId}::unlock_funds_request::UnlockFundsRequest<${assetType}>`;
		default:
			throw new PASClientError(`Unknown action type: ${actionType}`);
	}
}

/**
 * Fetches a Rule object and returns the parsed Rule data.
 *
 * The Rule contains a `resolution_info` VecMap that maps action types to Commands.
 *
 * @param client - The Sui client instance
 * @param ruleId - The ID of the rule object
 * @returns The parsed Rule object
 */
export async function fetchRule(client: ClientWithCoreApi, ruleId: string): Promise<Rule> {
	const { object } = await client.core.getObject({
		objectId: ruleId,
		include: {
			content: true,
		},
	});

	if (!object.content) throw new PASClientError(`Rule object ${ruleId} has no content`);

	return Rule.parse(object.content);
}

/**
 * Resolves a Command from a Rule's resolution_info map.
 *
 * The resolution_info is a VecMap<TypeName, Command> where:
 * - TypeName is the action type (e.g., "0x123::transfer_funds_request::TransferFundsRequest<0x2::sui::SUI>")
 * - Command is the move call instruction to execute for that action
 *
 * @param rule - The parsed Rule object
 * @param actionType - The full typename of the action (e.g., "0x123::transfer_funds_request::TransferFundsRequest<0x2::sui::SUI>")
 * @returns The Command object for this action type, or undefined if not found
 */
export function getCommandFromRule(
	rule: Rule,
	actionType: string,
): ReturnType<typeof Command.Command.parse> | undefined {
	// The resolution_info is a VecMap<TypeName, Command>
	// VecMap has a 'contents' field which is an array of { key: TypeName, value: Command }
	for (const entry of rule.resolution_info.contents) {
		// TypeName has a 'name' field
		if (entry.key.name === actionType) {
			return entry.value;
		}
	}

	return undefined;
}

/**
 * Context provided when building a PTB from a command
 */
export interface CommandBuildContext {
	/** The transaction builder */
	tx: Transaction;
	/** The sender vault (for transfers/unlocks) */
	senderVault?: TransactionObjectArgument;
	/** The receiver vault (for transfers) */
	receiverVault?: TransactionObjectArgument;
	/** The rule object */
	rule?: TransactionObjectArgument;
	/** The transfer/unlock request */
	request?: TransactionObjectArgument;
	/** The system type T (e.g., "0x2::sui::SUI") */
	systemType?: string;
	/** Additional custom arguments */
	customArgs?: Map<string, TransactionObjectArgument>;
}

/**
 * Builds a PTB from a resolved Command.
 *
 * This function translates the Command structure into actual moveCall operations
 * in the transaction, resolving placeholders like "sender_vault", "receiver_vault", etc.
 *
 * @param command - The parsed Command object
 * @param context - The build context with required objects
 * @returns The result of the moveCall
 */
export function buildPTBFromCommand(
	command: ReturnType<typeof Command.Command.parse>,
	context: CommandBuildContext,
) {
	const { tx } = context;

	// Resolve the contract address
	const packageAddress =
		'Address' in command.address
			? command.address.Address
			: (() => {
					throw new PASClientError('MVR address resolution not yet implemented');
				})();

	// Resolve arguments
	const resolvedArgs: TransactionObjectArgument[] = [];
	for (const arg of command.arguments.contents) {
		if ('Object' in arg && arg.Object) {
			// Direct object reference
			resolvedArgs.push(tx.object(arg.Object));
		} else if ('Custom' in arg && arg.Custom) {
			// Custom placeholder
			const placeholder = arg.Custom;
			const resolved = resolveCustomArgument(placeholder, context);
			if (!resolved) {
				throw new PASClientError(`Unable to resolve custom argument: ${placeholder}`);
			}
			resolvedArgs.push(resolved);
		} else if ('Balance' in arg) {
			// Payment of specific type and amount
			// TODO: Implement balance splitting
			throw new PASClientError('Balance argument resolution not yet implemented');
		} else if ('CustomWithValue' in arg) {
			// Custom argument with encoded value
			throw new PASClientError('CustomWithValue argument not yet implemented');
		} else {
			throw new PASClientError(`Unknown argument type: ${JSON.stringify(arg)}`);
		}
	}

	// Resolve type arguments
	const typeArgs: string[] = [];
	for (const typeArg of command.type_arguments.contents) {
		if ('System' in typeArg && typeArg.System === null) {
			// Use the system type T
			if (!context.systemType) {
				throw new PASClientError('System type T not provided in context');
			}
			typeArgs.push(context.systemType);
		} else if ('TypeName' in typeArg && typeArg.TypeName) {
			// Explicit type name
			const typeName = typeArg.TypeName;
			// The TypeName struct has a "name" field
			if (typeof typeName === 'object' && 'name' in typeName) {
				typeArgs.push((typeName as { name: string }).name);
			} else {
				throw new PASClientError(`Invalid TypeName: ${JSON.stringify(typeName)}`);
			}
		} else {
			throw new PASClientError(`Unknown type argument: ${JSON.stringify(typeArg)}`);
		}
	}

	// Build the moveCall
	return tx.moveCall({
		target: `${packageAddress}::${command.module_name ?? 'unknown'}::${command.function_name ?? 'unknown'}`,
		arguments: resolvedArgs,
		typeArguments: typeArgs.length > 0 ? typeArgs : undefined,
	});
}

/**
 * Resolves a custom argument placeholder to an actual transaction argument.
 *
 * Supported placeholders:
 * - "sender_vault": The vault sending funds
 * - "receiver_vault": The vault receiving funds
 * - "rule": The Rule<T> object
 * - "transfer_request": The TransferFundsRequest<T>
 * - "unlock_request": The UnlockFundsRequest<T>
 *
 * @param placeholder - The placeholder name
 * @param context - The build context
 * @returns The resolved transaction argument, or undefined if not found
 */
function resolveCustomArgument(
	placeholder: string,
	context: CommandBuildContext,
): TransactionObjectArgument | undefined {
	switch (placeholder) {
		case 'sender_vault':
			return context.senderVault;
		case 'receiver_vault':
			return context.receiverVault;
		case 'rule':
			return context.rule;
		case 'transfer_request':
		case 'request':
			return context.request;
		case 'unlock_request':
			return context.request;
		default:
			// Check custom args map
			return context.customArgs?.get(placeholder);
	}
}

/**
 * Helper to create a transfer request and resolve it using a command from the rule.
 *
 * NOTE: This is a high-level helper that combines vault operations with command resolution.
 * It requires implementing fetchCommand first.
 *
 * @param pasClient - The PAS client instance
 * @param tx - The transaction builder
 * @param senderVaultId - ID of the sender vault
 * @param receiverVaultId - ID of the receiver vault
 * @param ruleId - ID of the rule
 * @param auth - The vault auth object
 * @param amount - Amount to transfer
 * @param assetType - The full asset type (e.g., "0x2::sui::SUI")
 */
export async function resolveTransfer(
	_pasClient: PASClient,
	_tx: Transaction,
	_senderVaultId: string,
	_receiverVaultId: string,
	_ruleId: string,
	_auth: TransactionObjectArgument,
	_amount: number | bigint,
	_assetType: string,
): Promise<void> {
	throw new PASClientError('resolveTransfer not yet implemented - requires fetchCommand');
}

/**
 * Helper to create an unlock request and resolve it using a command from the rule.
 *
 * NOTE: This is a high-level helper that combines vault operations with command resolution.
 * It requires implementing fetchCommand first.
 *
 * @param pasClient - The PAS client instance
 * @param tx - The transaction builder
 * @param vaultId - ID of the vault
 * @param ruleId - ID of the rule
 * @param auth - The vault auth object
 * @param amount - Amount to unlock
 * @param assetType - The full asset type (e.g., "0x2::sui::SUI")
 * @returns The unlocked balance
 */
export async function resolveUnlock(
	_pasClient: PASClient,
	_tx: Transaction,
	_vaultId: string,
	_ruleId: string,
	_auth: TransactionObjectArgument,
	_amount: number | bigint,
	_assetType: string,
): Promise<TransactionObjectArgument> {
	throw new PASClientError('resolveUnlock not yet implemented - requires fetchCommand');
}
