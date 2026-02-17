/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';

import { MoveTuple, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.js';

const $moduleName = '@mysten/pas::keys';
export const RuleKey = new MoveTuple({ name: `${$moduleName}::RuleKey`, fields: [bcs.bool()] });
export const VaultKey = new MoveTuple({ name: `${$moduleName}::VaultKey`, fields: [bcs.Address] });
export const TemplateKey = new MoveTuple({
	name: `${$moduleName}::TemplateKey`,
	fields: [bcs.bool()],
});
export interface TransferFundsActionOptions {
	package?: string;
	arguments?: [];
}
export function transferFundsAction(options: TransferFundsActionOptions = {}) {
	const packageAddress = options.package ?? '@mysten/pas';
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'keys',
			function: 'transfer_funds_action',
		});
}
export interface UnlockFundsActionOptions {
	package?: string;
	arguments?: [];
}
export function unlockFundsAction(options: UnlockFundsActionOptions = {}) {
	const packageAddress = options.package ?? '@mysten/pas';
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'keys',
			function: 'unlock_funds_action',
		});
}
export interface ClawbackFundsActionOptions {
	package?: string;
	arguments?: [];
}
export function clawbackFundsAction(options: ClawbackFundsActionOptions = {}) {
	const packageAddress = options.package ?? '@mysten/pas';
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'keys',
			function: 'clawback_funds_action',
		});
}
export interface ActionsOptions {
	package?: string;
	arguments?: [];
}
export function actions(options: ActionsOptions = {}) {
	const packageAddress = options.package ?? '@mysten/pas';
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'keys',
			function: 'actions',
		});
}
export interface IsValidActionArguments {
	action: RawTransactionArgument<string>;
}
export interface IsValidActionOptions {
	package?: string;
	arguments: IsValidActionArguments | [action: RawTransactionArgument<string>];
}
export function isValidAction(options: IsValidActionOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = ['0x1::string::String'] satisfies (string | null)[];
	const parameterNames = ['action'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'keys',
			function: 'is_valid_action',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
		});
}
