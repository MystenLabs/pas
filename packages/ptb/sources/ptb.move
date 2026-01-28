/// Module: ptb
module ptb::ptb;

use std::bcs;
use std::string::String;
use std::type_name;

public struct Transaction has copy, drop, store {
    inputs: vector<CallArg>,
    commands: vector<Command>,
}

/// Defines a simplified `Argument` type for the `Transaction`.
public enum Argument has copy, drop, store {
    GasCoin,
    Input(CallArg), // thing about using CallArg here
    Result(u16),
    NestedResult(u16, u16),
    /// Extended arguments for off-chain resolution.
    /// Cannot be constructed directly, only through future extensions.
    Ext(vector<u8>),
}

public enum Command has copy, drop, store {
    MoveCall {
        package: String,
        module_name: String,
        function: String,
        arguments: vector<Argument>,
        type_arguments: vector<String>,
    },
    TransferObjects(vector<Argument>, Argument),
    SplitCoins(Argument, vector<Argument>),
    MergeCoins(Argument, vector<Argument>),
    Publish(vector<vector<u8>>, vector<ID>),
    MakeMoveVec(Option<String>, vector<Argument>),
    Upgrade(vector<vector<u8>>, vector<ID>, ID, Argument),
    Ext(vector<u8>),
}

/// Defines a simplified `CallArg` type for `Transaction`.
///
/// Differences with canonical Sui `CallArg` type:
/// - ObjectArg is a simplified, unresolved representation of Object arguments;
/// - Ext(...) is a custom extension for the `CallArg` which allows off-chain
///   resolvers to convert them into the appropriate values for context.
public enum CallArg has copy, drop, store {
    Pure(vector<u8>),
    Object(ObjectArg),
    FundsWithdrawal {
        amount: u64,
        type_name: String,
        withdraw_from: WithdrawFrom,
    },
    /// Extended arguments for off-chain resolution.
    /// Can be created and registered in a transaction through `ext_input`.
    Ext(String),
}

/// Defines a simplified `ObjectArg` type for the `Transaction`.
///
/// Differences with canonical Sui `ObjectArg` type:
/// - Uses `address` type as a fixed-length sequence of bytes without length prefix.
/// - Extends the number of variants to support off-chain resolution.
public enum ObjectArg has copy, drop, store {
    ImmOrOwnedObject {
        object_id: ID,
        sequence_number: u64,
        digest: address,
    },
    SharedObject {
        object_id: ID,
        initial_shared_version: u64,
        is_mutable: bool,
    },
    Receiving {
        object_id: ID,
        sequence_number: u64,
        digest: address,
    },
    ObjectByID(ID),
    ObjectByType(String),
    ReceivingByID(ID),
    Ext(String),
}

public enum WithdrawFrom has copy, drop, store {
    Sender,
    Sponsor,
}

/// Create a new Transaction builder.
public fun new(): Transaction {
    Transaction { inputs: vector[], commands: vector[] }
}

// === System Objects ===

/// Shorthand for `object_by_id` with `0x6` (Clock).
public fun clock(): Argument {
    Argument::Input(CallArg::Object(ObjectArg::ObjectByID(@0x6.to_id())))
}

/// Shorthand for `object_by_id` with `0x8` (Random).
public fun random(): Argument {
    Argument::Input(CallArg::Object(ObjectArg::ObjectByID(@0x8.to_id())))
}

/// Shorthand for `object_by_id` with `0xD` (DisplayRegistry).
public fun display(): Argument {
    Argument::Input(CallArg::Object(ObjectArg::ObjectByID(@0xD.to_id())))
}

// === Inputs ===

/// Create a pure input.
public fun pure<T: drop>(value: T): Argument {
    Argument::Input(CallArg::Pure(bcs::to_bytes(&value)))
}

/// Create a fully-resolved immutable or owned object argument.
/// Should be used with caution, yet for immutable or owned objects refs can be stored.
/// For automatic version resolution, use `object_by_id`.
public fun object_ref(object_id: ID, sequence_number: u64, digest: address): Argument {
    Argument::Input(
        CallArg::Object(ObjectArg::ImmOrOwnedObject {
            object_id,
            sequence_number,
            digest,
        }),
    )
}

/// Create a fully-resolved shared object argument.
/// Should be used with caution, yet for shared objects refs can be stored.
/// For automatic version resolution, use `shared_object_by_id`.
public fun shared_object_ref(
    object_id: ID,
    initial_shared_version: u64,
    is_mutable: bool,
): Argument {
    Argument::Input(
        CallArg::Object(ObjectArg::SharedObject {
            object_id,
            initial_shared_version,
            is_mutable,
        }),
    )
}

/// Create a fully-resolved receiving object argument.
/// Should be used with caution, since the version of the object is dynamic. For
/// automatic version resolution, use `object_by_id`.
public fun receiving_object_ref(object_id: ID, sequence_number: u64, digest: address): Argument {
    Argument::Input(
        CallArg::Object(ObjectArg::Receiving {
            object_id,
            sequence_number,
            digest,
        }),
    )
}

// === Extended Object Args ===

/// Create an off-chain input handler for a given type T.
public fun object_by_type<T: key>(): Argument {
    Argument::Input(
        CallArg::Object(
            ObjectArg::ObjectByType((*type_name::with_defining_ids<T>().as_string()).to_string()),
        ),
    )
}

/// Create an off-chain input handler for a given type as a String.
public fun object_by_type_string(type_name: String): Argument {
    Argument::Input(CallArg::Object(ObjectArg::ObjectByType(type_name)))
}

/// Create an off-chain input handler for an object with a specific ID.
public fun object_by_id(id: ID): Argument {
    Argument::Input(CallArg::Object(ObjectArg::ObjectByID(id)))
}

/// Create an off-chain input handler for a receiving object with a specific ID.
public fun receiving_object_by_id(id: ID): Argument {
    Argument::Input(CallArg::Object(ObjectArg::ReceivingByID(id)))
}

/// Create an external input handler.
/// Expected to be understood by the off-chain tooling.
public fun ext_input(name: String): Argument {
    Argument::Input(CallArg::Ext(name))
}

/// Register a command in the Transaction builder. Returns the Argument, which
/// is treated as the `Result(idx)` of the command, and can be turned into a nested
/// result `NestedResult(idx, idx)`.
public fun command(self: &mut Transaction, command: Command): Argument {
    let idx = self.commands.length() as u16;
    self.commands.push_back(command);
    Argument::Result(idx)
}

/// Spawn a nested result out of a (just) `Result`.
/// Simple result is a command output.
public fun nested(self: &Argument, sub_idx: u16): Argument {
    match (self) {
        Argument::Result(idx) => Argument::NestedResult(*idx, sub_idx),
        _ => abort,
    }
}

// === Transfer Objects ===

/// Create a `TransferObjects` command
/// Expects a vector of arguments to transfer and an address value for destination.
public fun transfer_objects(objects: vector<Argument>, to: Argument): Command {
    Command::TransferObjects(objects, to)
}

// === Split Coins ===

/// Create a `SplitCoins` command.
public fun split_coins(coin: Argument, amounts: vector<Argument>): Command {
    Command::SplitCoins(coin, amounts)
}

// === Merge Coins ===

/// Create a `MergeCoins` command.
/// Takes a Coin Argument and a vector of other coin arguments to merge into it.
public fun merge_coins(coin: Argument, coins: vector<Argument>): Command {
    Command::MergeCoins(coin, coins)
}

// === Publish ===

/// Create a `Publish` command.
/// Takes a vector of modules' bytes and a vector of dependencies.
public fun publish(package: vector<vector<u8>>, dependencies: vector<ID>): Command {
    Command::Publish(package, dependencies)
}

// === Make Move Vec ===

/// Create a `MakeMoveVec` command.
/// Takes an optional element type and a vector of elements to make into a vector.
public fun make_move_vec(element_type: Option<String>, elements: vector<Argument>): Command {
    Command::MakeMoveVec(element_type, elements)
}

// === Upgrade ===

/// Create a `Upgrade` command.
/// Takes a vector of modules' bytes, a vector of dependencies, an updated package
/// ID, and an upgrade ticket.
public fun upgrade(
    package: vector<vector<u8>>,
    dependencies: vector<ID>,
    object_id: ID,
    upgrade_ticket: Argument,
): Command {
    Command::Upgrade(package, dependencies, object_id, upgrade_ticket)
}

// === Move Call Features ===

public fun move_call(
    package: String,
    module_name: String,
    function: String,
    arguments: vector<Argument>,
    type_arguments: vector<String>,
): Command {
    Command::MoveCall {
        package,
        module_name,
        function,
        arguments,
        type_arguments,
    }
}

// === Test Features ===

#[test_only]
public use fun argument_idx as Argument.idx;

#[test_only]
public fun argument_idx(self: &Argument): u16 {
    match (self) {
        Argument::Result(idx) => *idx,
        Argument::NestedResult(idx, _) => *idx,
        // Argument::Input(idx) => *idx,
        _ => abort,
    }
}
