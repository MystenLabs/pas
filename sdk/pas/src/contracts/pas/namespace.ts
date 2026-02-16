/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/

/**
 * The Namespace module.
 *
 * Namespace is responsible for creating objects that are easy to query & find:
 *
 * 1.  Vaults
 * 2.  Rules ... any other module we might add in the future
 */

import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.js';
import * as versioning from './versioning.js';

const $moduleName = '@mysten/pas::namespace';
export const Namespace = new MoveStruct({
	name: `${$moduleName}::Namespace`,
	fields: {
		id: bcs.Address,
		/**
		 * The UpgradeCap of the package, used as the "ownership" capability, mainly to
		 * block versions of the package in case of emergency.
		 */
		upgrade_cap_id: bcs.option(bcs.Address),
		/** Enables "blocking" versions of the package */
		versioning: versioning.Versioning,
	},
});
export interface SetupArguments {
	namespace: RawTransactionArgument<string>;
	cap: RawTransactionArgument<string>;
}
export interface SetupOptions {
	package?: string;
	arguments:
		| SetupArguments
		| [namespace: RawTransactionArgument<string>, cap: RawTransactionArgument<string>];
}
/**
 * Setup the namespace (links the `UpgradeCap`) once after publishing. This makes
 * the UpgradeCap the "admin" capability (which can set the blocked versions of a
 * package).
 */
export function setup(options: SetupOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null, null] satisfies (string | null)[];
	const parameterNames = ['namespace', 'cap'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'namespace',
			function: 'setup',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
		});
}
export interface BlockVersionArguments {
	namespace: RawTransactionArgument<string>;
	cap: RawTransactionArgument<string>;
	version: RawTransactionArgument<number | bigint>;
}
export interface BlockVersionOptions {
	package?: string;
	arguments:
		| BlockVersionArguments
		| [
				namespace: RawTransactionArgument<string>,
				cap: RawTransactionArgument<string>,
				version: RawTransactionArgument<number | bigint>,
		  ];
}
/**
 * Allows the package admin to block a version of the package.
 *
 * This is only used in case of emergency (e.g. security consideration), or if
 * there is a breaking change
 */
export function blockVersion(options: BlockVersionOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null, null, 'u64'] satisfies (string | null)[];
	const parameterNames = ['namespace', 'cap', 'version'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'namespace',
			function: 'block_version',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
		});
}
export interface UnblockVersionArguments {
	namespace: RawTransactionArgument<string>;
	cap: RawTransactionArgument<string>;
	version: RawTransactionArgument<number | bigint>;
}
export interface UnblockVersionOptions {
	package?: string;
	arguments:
		| UnblockVersionArguments
		| [
				namespace: RawTransactionArgument<string>,
				cap: RawTransactionArgument<string>,
				version: RawTransactionArgument<number | bigint>,
		  ];
}
/** Allows the package admin to unblock a version of the package. */
export function unblockVersion(options: UnblockVersionOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null, null, 'u64'] satisfies (string | null)[];
	const parameterNames = ['namespace', 'cap', 'version'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'namespace',
			function: 'unblock_version',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
		});
}
export interface RuleExistsArguments {
	namespace: RawTransactionArgument<string>;
}
export interface RuleExistsOptions {
	package?: string;
	arguments: RuleExistsArguments | [namespace: RawTransactionArgument<string>];
	typeArguments: [string];
}
/** Check if `Rule<T>` exists in the namespace */
export function ruleExists(options: RuleExistsOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null] satisfies (string | null)[];
	const parameterNames = ['namespace'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'namespace',
			function: 'rule_exists',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
export interface RuleAddressArguments {
	namespace: RawTransactionArgument<string>;
}
export interface RuleAddressOptions {
	package?: string;
	arguments: RuleAddressArguments | [namespace: RawTransactionArgument<string>];
	typeArguments: [string];
}
/** The derived address for `Rule<T>` */
export function ruleAddress(options: RuleAddressOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null] satisfies (string | null)[];
	const parameterNames = ['namespace'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'namespace',
			function: 'rule_address',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
export interface VaultExistsArguments {
	namespace: RawTransactionArgument<string>;
	owner: RawTransactionArgument<string>;
}
export interface VaultExistsOptions {
	package?: string;
	arguments:
		| VaultExistsArguments
		| [namespace: RawTransactionArgument<string>, owner: RawTransactionArgument<string>];
}
export function vaultExists(options: VaultExistsOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null, 'address'] satisfies (string | null)[];
	const parameterNames = ['namespace', 'owner'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'namespace',
			function: 'vault_exists',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
		});
}
export interface VaultAddressArguments {
	namespace: RawTransactionArgument<string>;
	owner: RawTransactionArgument<string>;
}
export interface VaultAddressOptions {
	package?: string;
	arguments:
		| VaultAddressArguments
		| [namespace: RawTransactionArgument<string>, owner: RawTransactionArgument<string>];
}
export function vaultAddress(options: VaultAddressOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null, 'address'] satisfies (string | null)[];
	const parameterNames = ['namespace', 'owner'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'namespace',
			function: 'vault_address',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
		});
}
