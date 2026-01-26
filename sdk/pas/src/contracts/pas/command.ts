/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/

/**
 * This module is only used for off-chain metadata.
 *
 * It enables SDKs to discover how to resolve a custom transfer request for any
 * arbitrary T, as long as the creator has set the appropriate ruleset here.
 *
 * WARNING: The existence of a Command provides NO guarantees that this will be
 * functional, but offers a discoverable way for PTB building.
 */

import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';

import {
	MoveEnum,
	MoveStruct,
	MoveTuple,
	normalizeMoveArguments,
	type RawTransactionArgument,
} from '../utils/index.js';
import * as type_name from './deps/std/type_name.js';
import * as vec_set from './deps/sui/vec_set.js';

const $moduleName = '@mysten/pas::command';
/** A contract address can be a static address, or a MVR name. */
export const ContractAddress = new MoveEnum({
	name: `${$moduleName}::ContractAddress`,
	fields: {
		Address: bcs.Address,
		Mvr: bcs.string(),
	},
});
/**
 * The acceptable arguments for a contract are:
 *
 * - Immutable reference of a shared object
 * - Mutable reference of a shared object
 * - Reference of an immutable object
 * - Payment of a specific type and amount
 * - App specific arguments / placeholders (like the known vaults, the rule, the
 *   transfer request)
 */
export const Argument = new MoveEnum({
	name: `${$moduleName}::Argument`,
	fields: {
		/**
		 * This is recommended to be a shared or immutable object, that can be referenced
		 * by anyone in a TX. If this is an owned or party object, resolution of the
		 * command will be limited to the owner of that object.
		 */
		Object: bcs.Address,
		/** Expect a payment of `type` and `amount`. */
		Balance: new MoveTuple({ name: `Argument.Balance`, fields: [type_name.TypeName, bcs.u64()] }),
		/** The sender's vault (sender) */
		SenderVault: null,
		/** The recipients vault (for transfer commands) */
		ReceiverVault: null,
		/** The rule object placeholder (can be auto-discovered by the clients) */
		Rule: null,
		/** The request object placeholder (as returned by different operations) */
		Request: null,
		/** Currently not supported but reserved for `T` cases for NFTs. */
		Asset: null,
		/** Currently not supported but added for future cases. */
		ObjectWithType: type_name.TypeName,
		/**
		 * Custom arguments that can be modified depending on the implementation. Currently
		 * none are supported but are here for future-proofness.
		 */
		Custom: bcs.string(),
		/**
		 * A custom argument, which also has a "value" (in bytes format), in case we want
		 * to encode any specific metadata in the future.
		 */
		CustomWithValue: new MoveTuple({
			name: `Argument.CustomWithValue`,
			fields: [bcs.string(), bcs.vector(bcs.u8())],
		}),
	},
});
/**
 * A type argument can be a System (the `T` of the token or the NFT), generally T
 * is derived from `Rule<T>`, or any explicit typename.
 */
export const TypeArgument = new MoveEnum({
	name: `${$moduleName}::TypeArgument`,
	fields: {
		System: null,
		TypeName: type_name.TypeName,
	},
});
export const Command = new MoveStruct({
	name: `${$moduleName}::Command`,
	fields: {
		address: ContractAddress,
		module_name: bcs.string(),
		function_name: bcs.string(),
		arguments: vec_set.VecSet(Argument),
		type_arguments: vec_set.VecSet(TypeArgument),
	},
});
export const CommandBuilder = new MoveTuple({
	name: `${$moduleName}::CommandBuilder`,
	fields: [Command],
});
export interface NewArguments {
	address: RawTransactionArgument<string>;
	moduleName: RawTransactionArgument<string>;
	functionName: RawTransactionArgument<string>;
}
export interface NewOptions {
	package?: string;
	arguments:
		| NewArguments
		| [
				address: RawTransactionArgument<string>,
				moduleName: RawTransactionArgument<string>,
				functionName: RawTransactionArgument<string>,
		  ];
}
/** Create a new "Command", builder-style pattern. */
export function _new(options: NewOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [
		`${packageAddress}::command::ContractAddress`,
		'0x0000000000000000000000000000000000000000000000000000000000000001::ascii::String',
		'0x0000000000000000000000000000000000000000000000000000000000000001::ascii::String',
	] satisfies string[];
	const parameterNames = ['address', 'moduleName', 'functionName'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'command',
			function: 'new',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
		});
}
export interface NewAddressArguments {
	address: RawTransactionArgument<string>;
}
export interface NewAddressOptions {
	package?: string;
	arguments: NewAddressArguments | [address: RawTransactionArgument<string>];
}
export function newAddress(options: NewAddressOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = ['address'] satisfies string[];
	const parameterNames = ['address'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'command',
			function: 'new_address',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
		});
}
export interface NewMvrAddressArguments {
	mvr: RawTransactionArgument<string>;
}
export interface NewMvrAddressOptions {
	package?: string;
	arguments: NewMvrAddressArguments | [mvr: RawTransactionArgument<string>];
}
export function newMvrAddress(options: NewMvrAddressOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [
		'0x0000000000000000000000000000000000000000000000000000000000000001::ascii::String',
	] satisfies string[];
	const parameterNames = ['mvr'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'command',
			function: 'new_mvr_address',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
		});
}
export interface NewTypeArgOptions {
	package?: string;
	arguments?: [];
	typeArguments: [string];
}
/** Create a new type argument for an explicit type `T`. */
export function newTypeArg(options: NewTypeArgOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'command',
			function: 'new_type_arg',
			typeArguments: options.typeArguments,
		});
}
export interface NewSystemTypeArgOptions {
	package?: string;
	arguments?: [];
}
/**
 * Create a new type argument for the system type `T` This must match the `T`
 * generic used for `Rule<T>`.
 *
 * E.g. for `Coin<SUI>`, this would fill `SUI` (0x2::sui::SUI)
 */
export function newSystemTypeArg(options: NewSystemTypeArgOptions = {}) {
	const packageAddress = options.package ?? '@mysten/pas';
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'command',
			function: 'new_system_type_arg',
		});
}
export interface NewSenderVaultArgOptions {
	package?: string;
	arguments?: [];
}
export function newSenderVaultArg(options: NewSenderVaultArgOptions = {}) {
	const packageAddress = options.package ?? '@mysten/pas';
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'command',
			function: 'new_sender_vault_arg',
		});
}
export interface NewReceiverVaultArgOptions {
	package?: string;
	arguments?: [];
}
export function newReceiverVaultArg(options: NewReceiverVaultArgOptions = {}) {
	const packageAddress = options.package ?? '@mysten/pas';
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'command',
			function: 'new_receiver_vault_arg',
		});
}
export interface NewRuleArgOptions {
	package?: string;
	arguments?: [];
}
export function newRuleArg(options: NewRuleArgOptions = {}) {
	const packageAddress = options.package ?? '@mysten/pas';
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'command',
			function: 'new_rule_arg',
		});
}
export interface NewRequestArgOptions {
	package?: string;
	arguments?: [];
}
export function newRequestArg(options: NewRequestArgOptions = {}) {
	const packageAddress = options.package ?? '@mysten/pas';
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'command',
			function: 'new_request_arg',
		});
}
export interface NewObjectArgArguments {
	id: RawTransactionArgument<string>;
}
export interface NewObjectArgOptions {
	package?: string;
	arguments: NewObjectArgArguments | [id: RawTransactionArgument<string>];
}
export function newObjectArg(options: NewObjectArgOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [
		'0x0000000000000000000000000000000000000000000000000000000000000002::object::ID',
	] satisfies string[];
	const parameterNames = ['id'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'command',
			function: 'new_object_arg',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
		});
}
export interface NewBalanceArgArguments {
	amount: RawTransactionArgument<number | bigint>;
}
export interface NewBalanceArgOptions {
	package?: string;
	arguments: NewBalanceArgArguments | [amount: RawTransactionArgument<number | bigint>];
	typeArguments: [string];
}
export function newBalanceArg(options: NewBalanceArgOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = ['u64'] satisfies string[];
	const parameterNames = ['amount'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'command',
			function: 'new_balance_arg',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
			typeArguments: options.typeArguments,
		});
}
export interface SetArgsArguments {
	builder: RawTransactionArgument<string>;
	arguments: RawTransactionArgument<string[]>;
}
export interface SetArgsOptions {
	package?: string;
	arguments:
		| SetArgsArguments
		| [builder: RawTransactionArgument<string>, arguments: RawTransactionArgument<string[]>];
}
/** Set the arguments to be the supplied ones */
export function setArgs(options: SetArgsOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [
		`${packageAddress}::command::CommandBuilder`,
		`vector<${packageAddress}::command::Argument>`,
	] satisfies string[];
	const parameterNames = ['builder', 'arguments'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'command',
			function: 'set_args',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
		});
}
export interface AddArgArguments {
	builder: RawTransactionArgument<string>;
	argument: RawTransactionArgument<string>;
}
export interface AddArgOptions {
	package?: string;
	arguments:
		| AddArgArguments
		| [builder: RawTransactionArgument<string>, argument: RawTransactionArgument<string>];
}
/** Add an argument to the command */
export function addArg(options: AddArgOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [
		`${packageAddress}::command::CommandBuilder`,
		`${packageAddress}::command::Argument`,
	] satisfies string[];
	const parameterNames = ['builder', 'argument'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'command',
			function: 'add_arg',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
		});
}
export interface AddTypeArgArguments {
	builder: RawTransactionArgument<string>;
	typeArgument: RawTransactionArgument<string>;
}
export interface AddTypeArgOptions {
	package?: string;
	arguments:
		| AddTypeArgArguments
		| [builder: RawTransactionArgument<string>, typeArgument: RawTransactionArgument<string>];
}
/** Add a type argument to the command */
export function addTypeArg(options: AddTypeArgOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [
		`${packageAddress}::command::CommandBuilder`,
		`${packageAddress}::command::TypeArgument`,
	] satisfies string[];
	const parameterNames = ['builder', 'typeArgument'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'command',
			function: 'add_type_arg',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
		});
}
export interface SetTypeArgsArguments {
	builder: RawTransactionArgument<string>;
	typeArguments: RawTransactionArgument<string[]>;
}
export interface SetTypeArgsOptions {
	package?: string;
	arguments:
		| SetTypeArgsArguments
		| [builder: RawTransactionArgument<string>, typeArguments: RawTransactionArgument<string[]>];
}
/** Set the type arguments to be the supplied ones */
export function setTypeArgs(options: SetTypeArgsOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [
		`${packageAddress}::command::CommandBuilder`,
		`vector<${packageAddress}::command::TypeArgument>`,
	] satisfies string[];
	const parameterNames = ['builder', 'typeArguments'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'command',
			function: 'set_type_args',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
		});
}
export interface BuildArguments {
	builder: RawTransactionArgument<string>;
}
export interface BuildOptions {
	package?: string;
	arguments: BuildArguments | [builder: RawTransactionArgument<string>];
}
/** Build the command, validate no duplicate inputs, and minor other things. */
export function build(options: BuildOptions) {
	const packageAddress = options.package ?? '@mysten/pas';
	const argumentsTypes = [`${packageAddress}::command::CommandBuilder`] satisfies string[];
	const parameterNames = ['builder'];
	return (tx: Transaction) =>
		tx.moveCall({
			package: packageAddress,
			module: 'command',
			function: 'build',
			arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
		});
}
