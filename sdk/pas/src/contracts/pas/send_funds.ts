/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { bcs, type BcsType } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.js';

const $moduleName = '@mysten/pas::send_funds';
/**
 * A transfer request that is generated once a send funds request is initialized.
 *
 * A hot potato that is issued when a transfer is initiated. It can only be
 * resolved by presenting a witness `U` that is the witness of `Policy<T>`
 *
 * This enables the `resolve` function of each smart contract to be flexible and
 * implement its own mechanisms for validation. The individual resolution module
 * can:
 *
 * - Check whitelists/blacklists
 * - Enforce holding periods
 * - Collect fees
 * - Emit regulatory events
 * - Handle dividends/distributions
 * - Implement any jurisdiction-specific rules
 */
export function SendFunds<T extends BcsType<any>>(...typeParameters: [T]) {
	return new MoveStruct({
		name: `${$moduleName}::SendFunds<${typeParameters[0].name as T['name']}>`,
		fields: {
			/** `sender` is the wallet OR object address, NOT the chest address */
			sender: bcs.Address,
			/** `recipient` is the wallet OR object address, NOT the chest address */
			recipient: bcs.Address,
			/** The ID of the chest the funds are coming from */
			sender_chest_id: bcs.Address,
			/** The ID of the chest the funds are going to */
			recipient_chest_id: bcs.Address,
			/** The balance being transferred */
			funds: typeParameters[0],
		},
	});
}
export interface SenderArguments {
	request: RawTransactionArgument<string>;
}
export interface SenderOptions {
	package?: string;
	arguments: SenderArguments | [request: RawTransactionArgument<string>];
	typeArguments: [string];
}
export function sender(options: SenderOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null] satisfies (string | null)[];
	const parameterNames = ['request'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'send_funds',
			function: 'sender',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
export interface RecipientArguments {
	request: RawTransactionArgument<string>;
}
export interface RecipientOptions {
	package?: string;
	arguments: RecipientArguments | [request: RawTransactionArgument<string>];
	typeArguments: [string];
}
export function recipient(options: RecipientOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null] satisfies (string | null)[];
	const parameterNames = ['request'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'send_funds',
			function: 'recipient',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
export interface SenderChestIdArguments {
	request: RawTransactionArgument<string>;
}
export interface SenderChestIdOptions {
	package?: string;
	arguments: SenderChestIdArguments | [request: RawTransactionArgument<string>];
	typeArguments: [string];
}
export function senderChestId(options: SenderChestIdOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null] satisfies (string | null)[];
	const parameterNames = ['request'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'send_funds',
			function: 'sender_chest_id',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
export interface RecipientChestIdArguments {
	request: RawTransactionArgument<string>;
}
export interface RecipientChestIdOptions {
	package?: string;
	arguments: RecipientChestIdArguments | [request: RawTransactionArgument<string>];
	typeArguments: [string];
}
export function recipientChestId(options: RecipientChestIdOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null] satisfies (string | null)[];
	const parameterNames = ['request'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'send_funds',
			function: 'recipient_chest_id',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
export interface FundsArguments {
	request: RawTransactionArgument<string>;
}
export interface FundsOptions {
	package?: string;
	arguments: FundsArguments | [request: RawTransactionArgument<string>];
	typeArguments: [string];
}
export function funds(options: FundsOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null] satisfies (string | null)[];
	const parameterNames = ['request'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'send_funds',
			function: 'funds',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
export interface ResolveBalanceArguments {
	request: RawTransactionArgument<string>;
	policy: RawTransactionArgument<string>;
}
export interface ResolveBalanceOptions {
	package?: string;
	arguments:
		| ResolveBalanceArguments
		| [request: RawTransactionArgument<string>, policy: RawTransactionArgument<string>];
	typeArguments: [string];
}
/**
 * resolve a transfer request, if funds management is enabled & there are enough
 * approvals.
 */
export function resolveBalance(options: ResolveBalanceOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null, null] satisfies (string | null)[];
	const parameterNames = ['request', 'policy'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'send_funds',
			function: 'resolve_balance',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
