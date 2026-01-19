/// This module is only used for off-chain metadata.
///
/// It enables SDKs to discover how to resolve a custom transfer request for any arbitrary T,
/// as long as the creator has set the appropriate ruleset here.
///
/// WARNING: The existence of a Command provides NO guarantees that this will be functional, but offers a
/// discoverable way for PTB building.
#[allow(unused_field)]
module pas::command;

use std::{ascii, type_name::{Self, TypeName}};
use sui::vec_set::{Self, VecSet};

#[error(code = 0)]
const EInvalidCustomArgument: vector<u8> = b"Invalid custom argument";

const VALID_CUSTOM_ARGUMENTS: vector<vector<u8>> = vector[
    b"sender_vault",
    b"receiver_vault",
    b"rule",
    b"transfer_request",
];

public struct CommandBuilder(Command) has drop;

public struct Command has copy, drop, store {
    address: ContractAddress,
    module_name: ascii::String,
    function_name: ascii::String,
    arguments: VecSet<Argument>,
    type_arguments: VecSet<TypeArgument>,
}

/// A contract address can be a static address, or a MVR name.
public enum ContractAddress has copy, drop, store {
    Address(address),
    Mvr(ascii::String),
}

/// A type argument can be a System (the `T` of the token or the NFT), generally T is derived from `Rule<T>`, or any explicit typename.
public enum TypeArgument has copy, drop, store {
    System,
    TypeName(TypeName),
}

/// The acceptable arguments for a contract are:
/// - Immutable reference of a shared object
/// - Mutable reference of a shared object
/// - Reference of an immutable object
/// - Payment of a specific type and amount
/// - App specific arguments / placeholders (like the known vaults, the rule, the transfer request)
public enum Argument has copy, drop, store {
    /// This is recommended to be a shared or immutable object, that can be referenced
    /// by anyone in a TX. If this is an owned or party object, resolution of the command
    /// will be limited to the owner of that object.
    Object(ID),
    /// Expect a payment of `type` and `amount`.
    Balance(TypeName, u64),
    /// Custom arguments that can be modified depending on the implementation.
    ///
    /// Examples of supported values for the vault system (for fungible tokens):
    /// - Custom("sender_vault")
    /// - Custom("receiver_vault")
    /// - Custom("rule")
    /// - Custom("transfer_request")
    Custom(ascii::String),
    /// A custom argument, which also has a "value" (in bytes format), in case we want to encode
    /// any specific metadata in the future.
    CustomWithValue(ascii::String, vector<u8>),
}

/// Create a new "Command", builder-style pattern.
public fun new(
    address: ContractAddress,
    module_name: ascii::String,
    function_name: ascii::String,
): CommandBuilder {
    CommandBuilder(Command {
        address,
        module_name,
        function_name,
        arguments: vec_set::empty(),
        type_arguments: vec_set::empty(),
    })
}

public fun new_address(address: address): ContractAddress {
    ContractAddress::Address(address)
}

// TODO: Validate MVR name (should we depend on MVR or do a custom smaller validator here?)
public fun new_mvr_address(mvr: ascii::String): ContractAddress {
    ContractAddress::Mvr(mvr)
}

/// Create a new type argument for an explicit type `T`.
public fun new_type_arg<T>(): TypeArgument {
    TypeArgument::TypeName(type_name::with_defining_ids<T>())
}

/// Create a new type argument for the system type `T`
/// This must match the `T` generic used for `Rule<T>`.
///
/// E.g. for `Coin<SUI>`, this would fill `SUI` (0x2::sui::SUI)
public fun new_system_type_arg(): TypeArgument {
    TypeArgument::System
}

/// Create a new custom argument
public fun new_custom_arg(name: ascii::String): Argument {
    let valid_args = VALID_CUSTOM_ARGUMENTS;
    assert!(valid_args.contains(name.as_bytes()), EInvalidCustomArgument);
    Argument::Custom(name)
}

public fun new_object_arg(id: ID): Argument {
    Argument::Object(id)
}

public fun new_balance_arg<T>(amount: u64): Argument {
    Argument::Balance(type_name::with_defining_ids<T>(), amount)
}

/// Set the arguments to be the supplied ones
public fun set_args(builder: &mut CommandBuilder, arguments: vector<Argument>) {
    builder.0.arguments = vec_set::from_keys(arguments);
}

/// Add an argument to the command
public fun add_arg(builder: &mut CommandBuilder, argument: Argument) {
    builder.0.arguments.insert(argument);
}

/// Add a type argument to the command
public fun add_type_arg(builder: &mut CommandBuilder, type_argument: TypeArgument) {
    builder.0.type_arguments.insert(type_argument);
}

/// Set the type arguments to be the supplied ones
public fun set_type_args(builder: &mut CommandBuilder, type_arguments: vector<TypeArgument>) {
    builder.0.type_arguments = vec_set::from_keys(type_arguments);
}

/// Build the command, validate no duplicate inputs, and minor other things.
public fun build(builder: CommandBuilder): Command {
    let CommandBuilder(command) = builder;
    // TODO: Do we need any other validation?
    command
}
