// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { SuiClientTypes } from '@mysten/sui/client';
import { Inputs, TransactionCommands } from '@mysten/sui/transactions';
import type {
	Argument,
	CallArg,
	Command as SdkCommand,
} from '@mysten/sui/transactions';
import { type Transaction, type TransactionObjectArgument } from '@mysten/sui/transactions';
import { normalizeStructTag } from '@mysten/sui/utils';

import { Field } from './bcs.js';
import { TypeName } from './contracts/pas/deps/std/type_name.js';
import { Rule } from './contracts/pas/rule.js';
import { Command, MoveCall } from './contracts/ptb/ptb.js';
import { PASClientError } from './error.js';

const OBJECT_BY_ID_EXT = 'object_by_id';
const OBJECT_BY_TYPE_EXT = 'object_by_type';
const RECEIVING_BY_ID_EXT = 'receiving_by_id';

/**
 * Supported PAS action types that can be resolved via Rules.
 */
export enum PASActionType {
	/** Transfer funds between vaults */
	TransferFunds = 'transfer_funds',
	/** Unlock funds from a vault */
	UnlockFunds = 'unlock_funds',
	/** Clawback funds from a vault */
	ClawbackFunds = 'clawback_funds',
}

/**
 * Parses the Rule object to extract the required approval type names for a given action.
 *
 * The Rule's `required_approvals` is a `VecMap<String, VecSet<TypeName>>` where:
 * - Key is the action name (e.g., "transfer_funds")
 * - Value is a set of approval TypeNames that must be satisfied
 *
 * @param ruleObject - The Rule object fetched with content
 * @returns The list of approval TypeName strings for the given action, or undefined if not found
 */
export function getRequiredApprovals(
	ruleObject: SuiClientTypes.Object<{ content: true }>,
	actionType: PASActionType,
): string[] | undefined {
	const rule = Rule.parse(ruleObject.content);

	const entry = rule.required_approvals.contents.find((e) => e.key === actionType);

	if (!entry) return undefined;

	return entry.value.contents.map((tn) => tn.name);
}

/**
 * Parses a Command from a Template dynamic field object.
 *
 * Each Template DF is a `Field<TypeName, Command>` where:
 * - TypeName is the approval type (e.g., the `with_defining_ids` of `TransferApproval`)
 * - Command is the move call instruction to execute for that approval
 *
 * @param templateDF - The Template DF object fetched with content
 * @returns The parsed Command, or undefined if parsing fails
 */
export function getCommandFromTemplateDF(
	templateDF: SuiClientTypes.Object<{ content: true }>,
): ReturnType<typeof parseCommand> {
	const df = Field(TypeName, Command).parse(templateDF.content);
	return parseCommand(df.value);
}

// TODO: Discuss why this is interpreted as `(number | number[])[])` instead of `[number, number[]]`
// and if there's a way to solve that.
export function parseCommand([key, cmd]: ReturnType<typeof Command.parse>) {
	// Support only `Command` for now.
	if (key !== 0) throw new Error(`Unknown command type: ${key}`);

	// TODO: switch to support more commands like `TransferObjects` etc.
	return MoveCall.parse(new Uint8Array(cmd as number[]));
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
	command: ReturnType<typeof parseCommand>,
	context: CommandBuildContext,
) {
	const { tx } = context;

	// Resolve arguments
	const resolvedArgs: TransactionObjectArgument[] = [];

	for (const arg of command.arguments) {
		if (arg.Ext) throw new PASClientError(`There are no supported ext arguments in this client.`);
		else if (arg.GasCoin) resolvedArgs.push(tx.gas);
		else if (arg.NestedResult)
			resolvedArgs.push({
				$kind: 'NestedResult',
				NestedResult: [arg.NestedResult[0], arg.NestedResult[1]],
			});
		else if (arg.Result) resolvedArgs.push({ $kind: 'Result', Result: arg.Result });
		else if (arg.Input) {
			if (arg.Input.Pure) resolvedArgs.push(tx.pure(new Uint8Array(arg.Input.Pure)));
			else if (arg.Input.Object) {
				switch (arg.Input.Object.$kind) {
					case 'ImmOrOwnedObject':
						resolvedArgs.push(
							tx.objectRef({
								objectId: arg.Input.Object.ImmOrOwnedObject.object_id,
								version: arg.Input.Object.ImmOrOwnedObject.sequence_number,
								digest: arg.Input.Object.ImmOrOwnedObject.digest,
							}),
						);
						break;
					case 'SharedObject':
						resolvedArgs.push(
							tx.sharedObjectRef({
								objectId: arg.Input.Object.SharedObject.object_id,
								initialSharedVersion: arg.Input.Object.SharedObject.initial_shared_version,
								mutable: arg.Input.Object.SharedObject.is_mutable,
							}),
						);
						break;
					case 'Receiving':
						resolvedArgs.push(
							tx.receivingRef({
								objectId: arg.Input.Object.Receiving.object_id,
								version: arg.Input.Object.Receiving.sequence_number,
								digest: arg.Input.Object.Receiving.digest,
							}),
						);
						break;
					case 'Ext':
						const [kind, value] = arg.Input.Object.Ext.split(':');

						switch (kind) {
							case OBJECT_BY_ID_EXT:
							case RECEIVING_BY_ID_EXT:
								resolvedArgs.push(tx.object(value));
								break;
							case OBJECT_BY_TYPE_EXT:
								throw new PASClientError(
									`There are no supported object by type arguments in this client.`,
								);
							default:
								throw new PASClientError(`Unknown external object argument: ${kind}`);
						}
						break;
					default:
						throw new PASClientError(
							`Not supported object argument: ${JSON.stringify(arg.Input.Object)}`,
						);
				}
			} else if (arg.Input.Ext) {
				resolvedArgs.push(resolvePasRequest(context, arg.Input.Ext));
			} else {
				throw new PASClientError(`Unsupported input kind: ${arg.Input.$kind}`);
			}
		}
	}

	// Resolve type arguments
	const typeArgs: string[] = [];
	for (const typeArg of command.type_arguments)
		typeArgs.push(normalizeStructTag(typeArg).toString());

	// Build the moveCall
	if (!command.module_name || !command.function)
		throw new PASClientError(
			'Module name or function name is missing from the on-chain rule. This means that the issuer has not set up the rule correctly.',
		);

	return tx.moveCall({
		target: `${command.package_id}::${command.module_name}::${command.function}`,
		arguments: resolvedArgs,
		typeArguments: typeArgs.length > 0 ? typeArgs : [],
	});
}

/// Handle the special resolvers for PAS.
/// This includes the `rul`, the `request`, the `sender_vault` as well as the `receiver_vault`.
function resolvePasRequest(context: CommandBuildContext, value: string) {
	switch (value) {
		case 'pas:request':
			if (!context.request) throw new PASClientError(`Request is not set in the context.`);
			return context.request;
		case 'pas:rule':
			if (!context.rule) throw new PASClientError(`Rule is not set in the context.`);
			return context.rule;
		case 'pas:sender_vault':
			if (!context.senderVault) throw new PASClientError(`Sender vault is not set in the context.`);
			return context.senderVault;
		case 'pas:receiver_vault':
			if (!context.receiverVault)
				throw new PASClientError(`Receiver vault is not set in the context.`);
			return context.receiverVault;
		default:
			throw new PASClientError(`Unknown pas request: ${value}`);
	}
}

// ---------------------------------------------------------------------------
// Raw Command builder (for use with TransactionDataBuilder / replaceCommand)
// ---------------------------------------------------------------------------

/**
 * Arguments for building a raw MoveCall Command from a template, without
 * requiring a Transaction object. Used by the intent resolver which works
 * directly with TransactionDataBuilder.
 */
export interface RawCommandBuildArgs {
	/** Adds an input to the parent transaction and returns the Argument ref. */
	addInput: (type: 'object' | 'pure', arg: CallArg) => Argument;
	/** The sender vault argument (already resolved) */
	senderVault?: Argument;
	/** The receiver vault argument (already resolved) */
	receiverVault?: Argument;
	/** The rule argument (already resolved) */
	rule?: Argument;
	/** The request argument (already resolved) */
	request?: Argument;
	/** The system type T (e.g., "0x2::sui::SUI") */
	systemType?: string;
}

/**
 * Builds a raw `Command` (TransactionCommands.MoveCall) from a parsed template
 * command. This is the low-level equivalent of `addMoveCallFromCommand` that
 * works without a `Transaction` object, suitable for use with
 * `transactionData.replaceCommand()`.
 *
 * @param command - The parsed MoveCall from a template DF
 * @param args - The resolved arguments and addInput helper
 * @returns A raw Command object ready for `replaceCommand`
 */
export function buildMoveCallCommandFromTemplate(
	command: ReturnType<typeof parseCommand>,
	args: RawCommandBuildArgs,
): SdkCommand {
	const resolvedArgs: Argument[] = [];

	for (const arg of command.arguments) {
		if (arg.Ext) throw new PASClientError(`There are no supported ext arguments in this client.`);
		else if (arg.GasCoin) resolvedArgs.push({ $kind: 'GasCoin', GasCoin: true });
		else if (arg.NestedResult)
			resolvedArgs.push({
				$kind: 'NestedResult',
				NestedResult: [arg.NestedResult[0], arg.NestedResult[1]],
			});
		else if (arg.Result) resolvedArgs.push({ $kind: 'Result', Result: arg.Result });
		else if (arg.Input) {
			if (arg.Input.Pure)
				resolvedArgs.push(args.addInput('pure', Inputs.Pure(new Uint8Array(arg.Input.Pure))));
			else if (arg.Input.Object) {
				switch (arg.Input.Object.$kind) {
					case 'ImmOrOwnedObject':
						resolvedArgs.push(
							args.addInput(
								'object',
								Inputs.ObjectRef({
									objectId: arg.Input.Object.ImmOrOwnedObject.object_id,
									version: arg.Input.Object.ImmOrOwnedObject.sequence_number,
									digest: arg.Input.Object.ImmOrOwnedObject.digest,
								}),
							),
						);
						break;
					case 'SharedObject':
						resolvedArgs.push(
							args.addInput(
								'object',
								Inputs.SharedObjectRef({
									objectId: arg.Input.Object.SharedObject.object_id,
									initialSharedVersion:
										arg.Input.Object.SharedObject.initial_shared_version,
									mutable: arg.Input.Object.SharedObject.is_mutable,
								}),
							),
						);
						break;
					case 'Receiving':
						resolvedArgs.push(
							args.addInput(
								'object',
								Inputs.ReceivingRef({
									objectId: arg.Input.Object.Receiving.object_id,
									version: arg.Input.Object.Receiving.sequence_number,
									digest: arg.Input.Object.Receiving.digest,
								}),
							),
						);
						break;
					case 'Ext':
						const [kind, value] = arg.Input.Object.Ext.split(':');

						switch (kind) {
							case OBJECT_BY_ID_EXT:
							case RECEIVING_BY_ID_EXT:
								resolvedArgs.push(
									args.addInput('object', {
										$kind: 'UnresolvedObject',
										UnresolvedObject: { objectId: value },
									} as CallArg),
								);
								break;
							case OBJECT_BY_TYPE_EXT:
								throw new PASClientError(
									`There are no supported object by type arguments in this client.`,
								);
							default:
								throw new PASClientError(`Unknown external object argument: ${kind}`);
						}
						break;
					default:
						throw new PASClientError(
							`Not supported object argument: ${JSON.stringify(arg.Input.Object)}`,
						);
				}
			} else if (arg.Input.Ext) {
				resolvedArgs.push(resolveRawPasRequest(args, arg.Input.Ext));
			} else {
				throw new PASClientError(`Unsupported input kind: ${arg.Input.$kind}`);
			}
		}
	}

	const typeArgs: string[] = [];
	for (const typeArg of command.type_arguments)
		typeArgs.push(normalizeStructTag(typeArg).toString());

	if (!command.module_name || !command.function)
		throw new PASClientError(
			'Module name or function name is missing from the on-chain rule. This means that the issuer has not set up the rule correctly.',
		);

	return TransactionCommands.MoveCall({
		package: command.package_id,
		module: command.module_name,
		function: command.function,
		arguments: resolvedArgs,
		typeArguments: typeArgs.length > 0 ? typeArgs : [],
	});
}

function resolveRawPasRequest(args: RawCommandBuildArgs, value: string): Argument {
	switch (value) {
		case 'pas:request':
			if (!args.request) throw new PASClientError(`Request is not set in the context.`);
			return args.request;
		case 'pas:rule':
			if (!args.rule) throw new PASClientError(`Rule is not set in the context.`);
			return args.rule;
		case 'pas:sender_vault':
			if (!args.senderVault) throw new PASClientError(`Sender vault is not set in the context.`);
			return args.senderVault;
		case 'pas:receiver_vault':
			if (!args.receiverVault)
				throw new PASClientError(`Receiver vault is not set in the context.`);
			return args.receiverVault;
		default:
			throw new PASClientError(`Unknown pas request: ${value}`);
	}
}
