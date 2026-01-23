// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { Transaction, TransactionObjectArgument } from '@mysten/sui/transactions';
import { normalizeStructTag } from '@mysten/sui/utils';

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
		// TypeName has a 'name' field.
		// We actually normalize, because bcs omits `0x` prefix in the representation.
		if (
			normalizeStructTag(entry.key.name).toString() === normalizeStructTag(actionType).toString()
		) {
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
 * Adds the `tx.moveCall()` as it is resolved from `Command`.
 *
 * This function translates the Command structure into actual moveCall operations
 * in the transaction, resolving placeholders like "sender_vault", "receiver_vault", etc.
 *
 * @param command - The parsed Command object
 * @param context - The build context with required objects
 * @returns The result of the moveCall
 */
export function addMoveCallFromCommand(
	command: ReturnType<typeof Command.Command.parse>,
	context: CommandBuildContext,
) {
	const { tx } = context;

	// Resolve the contract address
	const packageAddress =
		'Address' in command.address ? command.address.Address : command.address.Mvr;

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
		if ('System' in typeArg && !!typeArg.System) {
			// Use the system type T
			if (!context.systemType) throw new PASClientError('System type T not provided in context');
			typeArgs.push(context.systemType);
		} else if ('TypeName' in typeArg && typeArg.TypeName) {
			// Explicit type name
			typeArgs.push(normalizeStructTag(typeArg.TypeName.name).toString());
		} else {
			throw new PASClientError(`Unknown type argument: ${JSON.stringify(typeArg)}`);
		}
	}

	// Build the moveCall
	if (!command.module_name || !command.function_name)
		throw new PASClientError(
			'Module name or function name is missing from the on-chain rule. This means that the issuer has not set up the rule correctly.',
		);

	return tx.moveCall({
		target: `${packageAddress}::${command.module_name}::${command.function_name}`,
		arguments: resolvedArgs,
		typeArguments: typeArgs.length > 0 ? typeArgs : [],
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
		case 'unlock_request':
			return context.request;
		default:
			// Check custom args map
			return context.customArgs?.get(placeholder);
	}
}
