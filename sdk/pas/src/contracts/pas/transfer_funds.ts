/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.js';
import * as balance from './deps/sui/balance.js';

const $moduleName = '@mysten/pas::transfer_funds';
export const TransferFunds = new MoveStruct({
	name: `${$moduleName}::TransferFunds`,
	fields: {
		/** `sender` is the wallet OR object address, NOT the chest address */
		sender: bcs.Address,
		/** `recipient` is the wallet OR object address, NOT the chest address */
		recipient: bcs.Address,
		/** The ID of the chest the funds are coming from */
		sender_chest_id: bcs.Address,
		/** The ID of the chest the funds are going to */
		recipient_chest_id: bcs.Address,
		/** The amount being transferred (original) */
		amount: bcs.u64(),
		/** The actual balance being transferred */
		balance: balance.Balance,
	},
});
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
			module: 'transfer_funds',
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
			module: 'transfer_funds',
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
			module: 'transfer_funds',
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
			module: 'transfer_funds',
			function: 'recipient_chest_id',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
export interface AmountArguments {
	request: RawTransactionArgument<string>;
}
export interface AmountOptions {
	package?: string;
	arguments: AmountArguments | [request: RawTransactionArgument<string>];
	typeArguments: [string];
}
export function amount(options: AmountOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null] satisfies (string | null)[];
	const parameterNames = ['request'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'transfer_funds',
			function: 'amount',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
export interface ResolveArguments {
	request: RawTransactionArgument<string>;
	rule: RawTransactionArgument<string>;
}
export interface ResolveOptions {
	package?: string;
	arguments:
		| ResolveArguments
		| [request: RawTransactionArgument<string>, rule: RawTransactionArgument<string>];
	typeArguments: [string];
}
/**
 * resolve a transfer request, if funds management is enabled & there are enough
 * approvals.
 */
export function resolve(options: ResolveOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null, null] satisfies (string | null)[];
	const parameterNames = ['request', 'rule'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'transfer_funds',
			function: 'resolve',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
