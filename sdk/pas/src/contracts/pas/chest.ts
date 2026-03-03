/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/

/** Chest logic */

import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';

import {
	MoveStruct,
	MoveTuple,
	normalizeMoveArguments,
	type RawTransactionArgument,
} from '../utils/index.js';
import * as versioning from './versioning.js';

const $moduleName = '@mysten/pas::chest';
export const Chest = new MoveStruct({
	name: `${$moduleName}::Chest`,
	fields: {
		id: bcs.Address,
		/** The owner of the chest (address or object) */
		owner: bcs.Address,
		/**
		 * The ID of the namespace that created this chest. There's ONLY ONE namespace in
		 * the system, but this helps us avoid having `&Namespace` inputs in all functions
		 * that need to derive the IDs.
		 */
		namespace_id: bcs.Address,
		/**
		 * Block versions to break backwards compatibility -- only used in case of
		 * emergency.
		 */
		versioning: versioning.Versioning,
	},
});
export const Auth = new MoveTuple({ name: `${$moduleName}::Auth`, fields: [bcs.Address] });
export interface CreateArguments {
	namespace: RawTransactionArgument<string>;
	owner: RawTransactionArgument<string>;
}
export interface CreateOptions {
	package?: string;
	arguments:
		| CreateArguments
		| [namespace: RawTransactionArgument<string>, owner: RawTransactionArgument<string>];
}
/** Create a new chest for `owner`. This is a permission-less action. */
export function create(options: CreateOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null, 'address'] satisfies (string | null)[];
	const parameterNames = ['namespace', 'owner'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'chest',
			function: 'create',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
		});
}
export interface ShareArguments {
	chest: RawTransactionArgument<string>;
}
export interface ShareOptions {
	package?: string;
	arguments: ShareArguments | [chest: RawTransactionArgument<string>];
}
/**
 * The only way to finalize the TX is by sharing the chest. All chests are shared
 * by default.
 */
export function share(options: ShareOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null] satisfies (string | null)[];
	const parameterNames = ['chest'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'chest',
			function: 'share',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
		});
}
export interface CreateAndShareArguments {
	namespace: RawTransactionArgument<string>;
	owner: RawTransactionArgument<string>;
}
export interface CreateAndShareOptions {
	package?: string;
	arguments:
		| CreateAndShareArguments
		| [namespace: RawTransactionArgument<string>, owner: RawTransactionArgument<string>];
}
/** Create and share a chest in a single step. */
export function createAndShare(options: CreateAndShareOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null, 'address'] satisfies (string | null)[];
	const parameterNames = ['namespace', 'owner'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'chest',
			function: 'create_and_share',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
		});
}
export interface UnlockBalanceArguments {
	chest: RawTransactionArgument<string>;
	auth: RawTransactionArgument<string>;
	amount: RawTransactionArgument<number | bigint>;
}
export interface UnlockBalanceOptions {
	package?: string;
	arguments:
		| UnlockBalanceArguments
		| [
				chest: RawTransactionArgument<string>,
				auth: RawTransactionArgument<string>,
				amount: RawTransactionArgument<number | bigint>,
		  ];
	typeArguments: [string];
}
/**
 * Enables a fund unlock flow. This is useful for assets that are not managed by a
 * Policy within the system, or if there's a special case where an issuer allows
 * balances to flow out of the system.
 */
export function unlockBalance(options: UnlockBalanceOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null, null, 'u64'] satisfies (string | null)[];
	const parameterNames = ['chest', 'auth', 'amount'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'chest',
			function: 'unlock_balance',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
export interface SendBalanceArguments {
	from: RawTransactionArgument<string>;
	auth: RawTransactionArgument<string>;
	to: RawTransactionArgument<string>;
	amount: RawTransactionArgument<number | bigint>;
}
export interface SendBalanceOptions {
	package?: string;
	arguments:
		| SendBalanceArguments
		| [
				from: RawTransactionArgument<string>,
				auth: RawTransactionArgument<string>,
				to: RawTransactionArgument<string>,
				amount: RawTransactionArgument<number | bigint>,
		  ];
	typeArguments: [string];
}
/** Initiate a transfer from chest A to chest B. */
export function sendBalance(options: SendBalanceOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null, null, null, 'u64'] satisfies (string | null)[];
	const parameterNames = ['from', 'auth', 'to', 'amount'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'chest',
			function: 'send_balance',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
export interface ClawbackBalanceArguments {
	from: RawTransactionArgument<string>;
	amount: RawTransactionArgument<number | bigint>;
}
export interface ClawbackBalanceOptions {
	package?: string;
	arguments:
		| ClawbackBalanceArguments
		| [from: RawTransactionArgument<string>, amount: RawTransactionArgument<number | bigint>];
	typeArguments: [string];
}
/**
 * Initiate a clawback request for an amount of funds. This takes no `Auth`, as
 * it's an admin action.
 *
 * This can only ever finalize if clawback is enabled in the policy.
 */
export function clawbackBalance(options: ClawbackBalanceOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null, 'u64'] satisfies (string | null)[];
	const parameterNames = ['from', 'amount'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'chest',
			function: 'clawback_balance',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
export interface UnsafeSendBalanceArguments {
	from: RawTransactionArgument<string>;
	auth: RawTransactionArgument<string>;
	recipientAddress: RawTransactionArgument<string>;
	amount: RawTransactionArgument<number | bigint>;
}
export interface UnsafeSendBalanceOptions {
	package?: string;
	arguments:
		| UnsafeSendBalanceArguments
		| [
				from: RawTransactionArgument<string>,
				auth: RawTransactionArgument<string>,
				recipientAddress: RawTransactionArgument<string>,
				amount: RawTransactionArgument<number | bigint>,
		  ];
	typeArguments: [string];
}
/**
 * Transfer `amount` from chest to an address. This unlocks transfers to a chest
 * before it has been created.
 *
 * It's marked as `unsafe_` as it's easy to accidentally pick the wrong recipient
 * address.
 */
export function unsafeSendBalance(options: UnsafeSendBalanceOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null, null, 'address', 'u64'] satisfies (string | null)[];
	const parameterNames = ['from', 'auth', 'recipientAddress', 'amount'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'chest',
			function: 'unsafe_send_balance',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
export interface NewAuthOptions {
	package?: string;
	arguments?: [];
}
/** Generate an ownership proof from the sender of the transaction. */
export function newAuth(options: NewAuthOptions = {}) {
	const packageAddress = options.package ?? '@mysten/pas';
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'chest',
			function: 'new_auth',
		});
}
export interface NewAuthAsObjectArguments {
	uid: RawTransactionArgument<string>;
}
export interface NewAuthAsObjectOptions {
	package?: string;
	arguments: NewAuthAsObjectArguments | [uid: RawTransactionArgument<string>];
}
/** Generate an ownership proof from a `UID` object, to allow objects to own chests. */
export function newAuthAsObject(options: NewAuthAsObjectOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = ['0x2::object::ID'] satisfies (string | null)[];
	const parameterNames = ['uid'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'chest',
			function: 'new_auth_as_object',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
		});
}
export interface OwnerArguments {
	chest: RawTransactionArgument<string>;
}
export interface OwnerOptions {
	package?: string;
	arguments: OwnerArguments | [chest: RawTransactionArgument<string>];
}
export function owner(options: OwnerOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null] satisfies (string | null)[];
	const parameterNames = ['chest'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'chest',
			function: 'owner',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
		});
}
export interface DepositBalanceArguments {
	chest: RawTransactionArgument<string>;
	balance: RawTransactionArgument<string>;
}
export interface DepositBalanceOptions {
	package?: string;
	arguments:
		| DepositBalanceArguments
		| [chest: RawTransactionArgument<string>, balance: RawTransactionArgument<string>];
	typeArguments: [string];
}
export function depositBalance(options: DepositBalanceOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null, null] satisfies (string | null)[];
	const parameterNames = ['chest', 'balance'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'chest',
			function: 'deposit_balance',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
export interface SyncVersioningArguments {
	chest: RawTransactionArgument<string>;
	namespace: RawTransactionArgument<string>;
}
export interface SyncVersioningOptions {
	package?: string;
	arguments:
		| SyncVersioningArguments
		| [chest: RawTransactionArgument<string>, namespace: RawTransactionArgument<string>];
}
/** Permission-less operation to bring versioning up-to-date with the namespace. */
export function syncVersioning(options: SyncVersioningOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [null, null] satisfies (string | null)[];
	const parameterNames = ['chest', 'namespace'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'chest',
			function: 'sync_versioning',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
		});
}
