/// Module: ptb
module ptb::ptb;

use std::{bcs, string::String, type_name::TypeName};

public struct Transaction has copy, drop, store {
    inputs: vector<CallArg>,
    commands: vector<Command>,
    input_idx: u16,
    command_idx: u16,
}

public enum Argument has copy, drop, store {
    GasCoin,
    Input(u16),
    Result(u16),
    NestedResult(u16, u16),
}

public enum Command has copy, drop, store {
    MoveCall {
        package: ID,
        module_name: String,
        function: String,
        arguments: vector<Argument>,
        type_arguments: vector<TypeName>,
    },
    TransferObjects(vector<Argument>, Argument),
    SplitCoins(Argument, vector<Argument>),
    MergeCoins(Argument, vector<Argument>),
    Publish(vector<vector<u8>>, vector<ID>),
    MakeMoveVec(Option<TypeName>, vector<Argument>),
    Upgrade(vector<vector<u8>>, vector<ID>, ID, Argument),
}

public enum CallArg has copy, drop, store {
    Pure(vector<u8>),
    Object(ObjectArg),
    FundsWithdrawal {
        amount: u64,
        type_name: TypeName,
        withdraw_from: WithdrawFrom,
    },
}

public enum ObjectArg has copy, drop, store {
    ObjectByID(ID),
    ObjectByType(TypeName),
    Receiving(ID),
}

public enum WithdrawFrom has copy, drop, store {
    Sender,
    Sponsor,
}

public fun new(): Transaction {
    Transaction {
        inputs: vector[],
        commands: vector[],
        input_idx: 0,
        command_idx: 0,
    }
}

public fun new_with_idx(input_idx: u16, command_idx: u16): Transaction {
    Transaction {
        inputs: vector[],
        commands: vector[],
        input_idx,
        command_idx,
    }
}

// === System Objects ===

public fun random(self: &mut Transaction): Argument {
    self.input(CallArg::Object(ObjectArg::ObjectByID(@0x8.to_id())))
}

public fun clock(self: &mut Transaction): Argument {
    self.input(CallArg::Object(ObjectArg::ObjectByID(@0x6.to_id())))
}

public fun display(self: &mut Transaction): Argument {
    self.input(CallArg::Object(ObjectArg::ObjectByID(@0xD.to_id())))
}

// === Inputs ===

public fun pure<T: drop>(self: &mut Transaction, value: T): Argument {
    self.input(CallArg::Pure(bcs::to_bytes(&value)))
}

public fun input(self: &mut Transaction, arg: CallArg): Argument {
    let idx = self.input_idx;
    self.inputs.push_back(arg);
    Argument::Input(idx)
}

public fun object_by_type(self: &mut Transaction, type_name: TypeName): Argument {
    self.input(CallArg::Object(ObjectArg::ObjectByType(type_name)))
}

public fun object_by_id(self: &mut Transaction, id: ID): Argument {
    self.input(CallArg::Object(ObjectArg::ObjectByID(id)))
}

public fun command(self: &mut Transaction, command: Command): Argument {
    let idx = self.command_idx;
    self.commands.push_back(command);
    Argument::Result(idx)
}

// === Transfer Objects ===

public fun transfer_objects(objects: vector<Argument>, to: Argument): Command {
    Command::TransferObjects(objects, to)
}

// === Split Coins ===

public fun split_coins(coin: Argument, amounts: vector<Argument>): Command {
    Command::SplitCoins(coin, amounts)
}

// === Merge Coins ===

public fun merge_coins(coin: Argument, coins: vector<Argument>): Command {
    Command::MergeCoins(coin, coins)
}

// === Publish ===

public fun publish(package: vector<vector<u8>>, dependencies: vector<ID>): Command {
    Command::Publish(package, dependencies)
}

// === Make Move Vec ===

public fun make_move_vec(element_type: Option<TypeName>, elements: vector<Argument>): Command {
    Command::MakeMoveVec(element_type, elements)
}

// === Upgrade ===

public fun upgrade(
    package: vector<vector<u8>>,
    dependencies: vector<ID>,
    object_id: ID,
    upgrade_ticket: Argument,
): Command {
    Command::Upgrade(package, dependencies, object_id, upgrade_ticket)
}

// === Move Call Features ===

public fun move_call(package: ID, module_name: String, function: String): Command {
    Command::MoveCall {
        package: package,
        module_name: module_name,
        function: function,
        arguments: vector[],
        type_arguments: vector[],
    }
}

public fun with_arguments(mut self: Command, command_arguments: vector<Argument>): Command {
    match (&mut self) {
        Command::MoveCall { arguments, .. } => {
            *arguments = command_arguments;
        },
        _ => abort,
    };

    self
}

public fun with_type_arguments(
    mut self: Command,
    command_type_arguments: vector<TypeName>,
): Command {
    match (&mut self) {
        Command::MoveCall { type_arguments, .. } => {
            *type_arguments = command_type_arguments;
        },
        _ => abort,
    };

    self
}

public struct Account()

#[test]
fun test_ptb_builder() {
    let mut ptb = Self::new();
    let clock = ptb.clock();
    let bytes = ptb.pure("Hello, world!");
    let random = ptb.random();

    let result = ptb.command(Command::MoveCall {
        package: @0x2.to_id(),
        module_name: "clock",
        function: "timestamp_ms",
        arguments: vector[clock],
        type_arguments: vector[],
    });
}

#[allow(unused_function)]
fun new_go_game(size: u8, account_id: Option<ID>) {
    let mut ptb = Self::new();

    let package_id = @0x0.to_id();
    let account = account_id.map!(|id| ptb.object_by_id(id)).destroy_or!({
        ptb.command(Self::move_call(package_id, "game", "new_account"))
    });

    let size_arg = ptb.pure(size);

    ptb.command(Self::move_call(package_id, "game", "new").with_arguments(vector[
        account,
        size_arg,
    ]));

    if (account_id.is_some()) {
        ptb.command(Self::move_call(package_id, "game", "keep").with_arguments(vector[account]));
    }
}

#[allow(unused_function)]
fun make_move_go_game(game_id: ID, account_id: ID, x: u8, y: u8) {
    let mut ptb = Self::new();
    let game_arg = ptb.object_by_id(game_id);
    let account_arg = ptb.object_by_id(account_id);
    let move_call = Self::move_call(@0x0.to_id(), "game", "play").with_arguments(vector[
        game_arg,
        account_arg,
        ptb.pure(x),
        ptb.pure(y),
        ptb.clock(),
    ]);

    ptb.command(move_call);
}

#[allow(unused_function)]
fun join_go_game(game_id: ID, account_id: Option<ID>) {
    let mut ptb = Self::new();

    let account = account_id.map!(|id| ptb.object_by_id(id)).destroy_or!({
        ptb.command(Self::move_call(@0x2.to_id(), "game", "new_account"))
    });

    let game_arg = ptb.object_by_id(game_id);

    ptb.command(Self::move_call(@0x0.to_id(), "game", "join").with_arguments(vector[
        game_arg,
        account,
    ]));

    if (account_id.is_some()) {
        ptb.command(Self::move_call(@0x0.to_id(), "game", "keep").with_arguments(vector[account]));
    }
}
