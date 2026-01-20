/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.js';
import * as balance from './deps/sui/balance.js';

const $moduleName = '@local-pkg/pas::transfer_funds_request';
export const TransferFundsRequest = new MoveStruct({
	name: `${$moduleName}::TransferFundsRequest`,
	fields: {
		/** `from` is the wallet OR object address, NOT the vault address */
		from: bcs.Address,
		/** `to` is the wallet OR object address, NOT the vault address */
		to: bcs.Address,
		/** The ID of the vault the funds are coming from */
		from_vault_id: bcs.Address,
		/** The ID of the vault the funds are going to */
		to_vault_id: bcs.Address,
		/** The amount being transferred (original) */
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
	const packageAddress = options.package ?? '@local-pkg/pas';
	const argumentsTypes = [
		`${packageAddress}::transfer_funds_request::TransferFundsRequest<${options.typeArguments[0]}>`,
	] satisfies string[];
	const parameterNames = ['request'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'transfer_funds_request',
			function: 'from',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
export interface ToArguments {
	request: RawTransactionArgument<string>;
}
export interface ToOptions {
	package?: string;
	arguments: ToArguments | [request: RawTransactionArgument<string>];
	typeArguments: [string];
}
export function to(options: ToOptions) {
	const packageAddress = options.package ?? '@local-pkg/pas';
	const argumentsTypes = [
		`${packageAddress}::transfer_funds_request::TransferFundsRequest<${options.typeArguments[0]}>`,
	] satisfies string[];
	const parameterNames = ['request'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'transfer_funds_request',
			function: 'to',
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
	const packageAddress = options.package ?? '@local-pkg/pas';
	const argumentsTypes = [
		`${packageAddress}::transfer_funds_request::TransferFundsRequest<${options.typeArguments[0]}>`,
	] satisfies string[];
	const parameterNames = ['request'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'transfer_funds_request',
			function: 'from_vault_id',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
export interface ToVaultIdArguments {
	request: RawTransactionArgument<string>;
}
export interface ToVaultIdOptions {
	package?: string;
	arguments: ToVaultIdArguments | [request: RawTransactionArgument<string>];
	typeArguments: [string];
}
export function toVaultId(options: ToVaultIdOptions) {
	const packageAddress = options.package ?? '@local-pkg/pas';
	const argumentsTypes = [
		`${packageAddress}::transfer_funds_request::TransferFundsRequest<${options.typeArguments[0]}>`,
	] satisfies string[];
	const parameterNames = ['request'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'transfer_funds_request',
			function: 'to_vault_id',
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
	const packageAddress = options.package ?? '@local-pkg/pas';
	const argumentsTypes = [
		`${packageAddress}::transfer_funds_request::TransferFundsRequest<${options.typeArguments[0]}>`,
	] satisfies string[];
	const parameterNames = ['request'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'transfer_funds_request',
			function: 'amount',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
