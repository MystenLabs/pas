/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { bcs, type BcsType } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.js';

const $moduleName = '@mysten/pas::clawback_funds';
export function ClawbackFunds<T extends BcsType<any>>(...typeParameters: [T]) {
	return new MoveStruct({
		name: `${$moduleName}::ClawbackFunds<${typeParameters[0].name as T['name']}>`,
		fields: {
			/** `owner` is the wallet OR object address, NOT the chest address */
			owner: bcs.Address,
			/** The ID of the chest the funds are coming from */
			chest_id: bcs.Address,
			/** The balance that is being clawed back. */
			funds: typeParameters[0],
		},
	});
}
export interface OwnerArguments {
	request: RawTransactionArgument<string>;
}
export interface OwnerOptions {
	package?: string;
	arguments: OwnerArguments | [request: RawTransactionArgument<string>];
	typeArguments: [string];
}
export function owner(options: OwnerOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null] satisfies (string | null)[];
	const parameterNames = ['request'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'clawback_funds',
			function: 'owner',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
export interface ChestIdArguments {
	request: RawTransactionArgument<string>;
}
export interface ChestIdOptions {
	package?: string;
	arguments: ChestIdArguments | [request: RawTransactionArgument<string>];
	typeArguments: [string];
}
export function chestId(options: ChestIdOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null] satisfies (string | null)[];
	const parameterNames = ['request'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'clawback_funds',
			function: 'chest_id',
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
			module: 'clawback_funds',
			function: 'funds',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
export interface ResolveArguments {
	request: RawTransactionArgument<string>;
	policy: RawTransactionArgument<string>;
}
export interface ResolveOptions {
	package?: string;
	arguments:
		| ResolveArguments
		| [request: RawTransactionArgument<string>, policy: RawTransactionArgument<string>];
	typeArguments: [string];
}
/**
 * Resolve a clawback funds request by:
 *
 * 1.  Verify policy is valid
 * 2.  Verify policy has clawback enabled
 * 3.  Make sure policy has enabled clawback resolution
 */
export function resolve(options: ResolveOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null, null] satisfies (string | null)[];
	const parameterNames = ['request', 'policy'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'clawback_funds',
			function: 'resolve',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
