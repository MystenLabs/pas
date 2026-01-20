/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.js';
import * as balance from './deps/sui/balance.js';

const $moduleName = '@mysten/pas::unlock_funds_request';
export const UnlockFundsRequest = new MoveStruct({
	name: `${$moduleName}::UnlockFundsRequest`,
	fields: {
		/** `from` is the wallet OR object address, NOT the vault address */
		from: bcs.Address,
		/** The ID of the vault the funds are coming from */
		from_vault_id: bcs.Address,
		/** The amount being transferred (initial amount) */
		amount: bcs.u64(),
		/** The actual balance being transferred */
		balance: balance.Balance,
	},
});
export interface FromArguments {
	request: RawTransactionArgument<string>;
}
export interface FromOptions {
	package?: string;
	arguments: FromArguments | [request: RawTransactionArgument<string>];
	typeArguments: [string];
}
export function _from(options: FromOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [
		`${packageAddress}::unlock_funds_request::UnlockFundsRequest<${options.typeArguments[0]}>`,
	] satisfies string[];
	const parameterNames = ['request'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'unlock_funds_request',
			function: 'from',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
export interface FromVaultIdArguments {
	request: RawTransactionArgument<string>;
}
export interface FromVaultIdOptions {
	package?: string;
	arguments: FromVaultIdArguments | [request: RawTransactionArgument<string>];
	typeArguments: [string];
}
export function fromVaultId(options: FromVaultIdOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [
		`${packageAddress}::unlock_funds_request::UnlockFundsRequest<${options.typeArguments[0]}>`,
	] satisfies string[];
	const parameterNames = ['request'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'unlock_funds_request',
			function: 'from_vault_id',
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
	const argumentsTypes = [
		`${packageAddress}::unlock_funds_request::UnlockFundsRequest<${options.typeArguments[0]}>`,
	] satisfies string[];
	const parameterNames = ['request'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'unlock_funds_request',
			function: 'amount',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
export interface ResolveUnrestrictedArguments {
	request: RawTransactionArgument<string>;
	namespace: RawTransactionArgument<string>;
}
export interface ResolveUnrestrictedOptions {
	package?: string;
	arguments:
		| ResolveUnrestrictedArguments
		| [request: RawTransactionArgument<string>, namespace: RawTransactionArgument<string>];
	typeArguments: [string];
}
/**
 * This enables unlocking assets that are not managed by a Rule within the system.
 * If a `Rule<T>` exists, they can only be resolved from within the system.
 *
 * For example, `SUI` will never be a managed asset, so the owner needs to be able
 * to withdraw if anyone transfers some to their vault.
 */
export function resolveUnrestricted(options: ResolveUnrestrictedOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [
		`${packageAddress}::unlock_funds_request::UnlockFundsRequest<${options.typeArguments[0]}>`,
		`${packageAddress}::namespace::Namespace`,
	] satisfies string[];
	const parameterNames = ['request', 'namespace'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'unlock_funds_request',
			function: 'resolve_unrestricted',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
