/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';

import {
	MoveStruct,
	MoveTuple,
	normalizeMoveArguments,
	type RawTransactionArgument,
} from '../utils/index.js';
import * as type_name from './deps/std/type_name.js';
import * as vec_map from './deps/sui/vec_map.js';
import * as vec_set from './deps/sui/vec_set.js';
import * as versioning from './versioning.js';

const $moduleName = '@mysten/pas::rule';
export const Rule = new MoveStruct({
	name: `${$moduleName}::Rule`,
	fields: {
		id: bcs.Address,
		/**
		 * The required approvals per request type. The key must be one of the request
		 * types (e.g. `transfer_funds`, `unlock_funds` or `clawback_funds`).
		 *
		 * The value is a vector of approvals that need to be gather to resolve the
		 * request.
		 */
		required_approvals: vec_map.VecMap(bcs.string(), vec_set.VecSet(type_name.TypeName)),
		/**
		 * Block versions to break backwards compatibility -- only used in case of
		 * emergency.
		 */
		versioning: versioning.Versioning,
	},
});
export const RuleCap = new MoveStruct({
	name: `${$moduleName}::RuleCap`,
	fields: {
		id: bcs.Address,
	},
});
export const RuleCapKey = new MoveTuple({
	name: `${$moduleName}::RuleCapKey`,
	fields: [bcs.bool()],
});
export const FundsClawbackState = new MoveTuple({
	name: `${$moduleName}::FundsClawbackState`,
	fields: [bcs.bool()],
});
export interface NewArguments {
	namespace: RawTransactionArgument<string>;
	_: RawTransactionArgument<string>;
}
export interface NewOptions {
	package?: string;
	arguments:
		| NewArguments
		| [namespace: RawTransactionArgument<string>, _: RawTransactionArgument<string>];
	typeArguments: [string];
}
/**
 * Create a new `Rule` for `T`. We use `Permit<T>` as the proof of ownership for
 * `T`.
 */
export function _new(options: NewOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null, null] satisfies (string | null)[];
	const parameterNames = ['namespace', '_'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'rule',
			function: 'new',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
export interface ShareArguments {
	rule: RawTransactionArgument<string>;
}
export interface ShareOptions {
	package?: string;
	arguments: ShareArguments | [rule: RawTransactionArgument<string>];
	typeArguments: [string];
}
export function share(options: ShareOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null] satisfies (string | null)[];
	const parameterNames = ['rule'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'rule',
			function: 'share',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
export interface EnableFundsManagementArguments {
	rule: RawTransactionArgument<string>;
	_: RawTransactionArgument<string>;
	clawbackAllowed: RawTransactionArgument<boolean>;
}
export interface EnableFundsManagementOptions {
	package?: string;
	arguments:
		| EnableFundsManagementArguments
		| [
				rule: RawTransactionArgument<string>,
				_: RawTransactionArgument<string>,
				clawbackAllowed: RawTransactionArgument<boolean>,
		  ];
	typeArguments: [string];
}
/**
 * Enables funds management for a given `T`, adding a DF that tracks the clawback
 * status (true/false). This can only be called once. After calling it, the
 * clawback status can never change!
 */
export function enableFundsManagement(options: EnableFundsManagementOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null, null, 'bool'] satisfies (string | null)[];
	const parameterNames = ['rule', '_', 'clawbackAllowed'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'rule',
			function: 'enable_funds_management',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
export interface RequiredApprovalsArguments {
	rule: RawTransactionArgument<string>;
	actionType: RawTransactionArgument<string>;
}
export interface RequiredApprovalsOptions {
	package?: string;
	arguments:
		| RequiredApprovalsArguments
		| [rule: RawTransactionArgument<string>, actionType: RawTransactionArgument<string>];
	typeArguments: [string];
}
/** Get the set of required approvals for a given action. */
export function requiredApprovals(options: RequiredApprovalsOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null, '0x1::string::String'] satisfies (string | null)[];
	const parameterNames = ['rule', 'actionType'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'rule',
			function: 'required_approvals',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
export interface SetRequiredApprovalArguments {
	rule: RawTransactionArgument<string>;
	cap: RawTransactionArgument<string>;
	action: RawTransactionArgument<string>;
}
export interface SetRequiredApprovalOptions {
	package?: string;
	arguments:
		| SetRequiredApprovalArguments
		| [
				rule: RawTransactionArgument<string>,
				cap: RawTransactionArgument<string>,
				action: RawTransactionArgument<string>,
		  ];
	typeArguments: [string, string];
}
export function setRequiredApproval(options: SetRequiredApprovalOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null, null, '0x1::string::String'] satisfies (string | null)[];
	const parameterNames = ['rule', 'cap', 'action'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'rule',
			function: 'set_required_approval',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
export interface RemoveActionApprovalArguments {
	rule: RawTransactionArgument<string>;
	_: RawTransactionArgument<string>;
	action: RawTransactionArgument<string>;
}
export interface RemoveActionApprovalOptions {
	package?: string;
	arguments:
		| RemoveActionApprovalArguments
		| [
				rule: RawTransactionArgument<string>,
				_: RawTransactionArgument<string>,
				action: RawTransactionArgument<string>,
		  ];
	typeArguments: [string];
}
/**
 * Remove the action approval for a given action (this will make all requests not
 * resolve).
 */
export function removeActionApproval(options: RemoveActionApprovalOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null, null, '0x1::string::String'] satisfies (string | null)[];
	const parameterNames = ['rule', '_', 'action'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'rule',
			function: 'remove_action_approval',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
export interface IsFundClawbackAllowedArguments {
	rule: RawTransactionArgument<string>;
}
export interface IsFundClawbackAllowedOptions {
	package?: string;
	arguments: IsFundClawbackAllowedArguments | [rule: RawTransactionArgument<string>];
	typeArguments: [string];
}
/**
 * Check if clawback is allowed or not. Aborts early if the management for funds
 * has not been enabled for `T`.
 */
export function isFundClawbackAllowed(options: IsFundClawbackAllowedOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null] satisfies (string | null)[];
	const parameterNames = ['rule'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'rule',
			function: 'is_fund_clawback_allowed',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
export interface SyncVersioningArguments {
	rule: RawTransactionArgument<string>;
	namespace: RawTransactionArgument<string>;
}
export interface SyncVersioningOptions {
	package?: string;
	arguments:
		| SyncVersioningArguments
		| [rule: RawTransactionArgument<string>, namespace: RawTransactionArgument<string>];
	typeArguments: [string];
}
/**
 * Allows syncing the versioning of a rule to the namespace's versioning. This is
 * permission-less and can be done
 */
export function syncVersioning(options: SyncVersioningOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null, null] satisfies (string | null)[];
	const parameterNames = ['rule', 'namespace'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'rule',
			function: 'sync_versioning',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
export interface AssertIsFundManagementEnabledArguments {
	rule: RawTransactionArgument<string>;
}
export interface AssertIsFundManagementEnabledOptions {
	package?: string;
	arguments: AssertIsFundManagementEnabledArguments | [rule: RawTransactionArgument<string>];
	typeArguments: [string];
}
export function assertIsFundManagementEnabled(options: AssertIsFundManagementEnabledOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null] satisfies (string | null)[];
	const parameterNames = ['rule'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'rule',
			function: 'assert_is_fund_management_enabled',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
