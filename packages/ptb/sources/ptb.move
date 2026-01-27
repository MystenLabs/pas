/// Module: ptb
module ptb::ptb;

use std::bcs;
use std::string::String;
use std::type_name;

public struct Transaction has copy, drop, store {
    // inputs: vector<CallArg>,
    commands: vector<Command>,
    // input_idx: u16, // consider removing in favor of inlined CallArg in Argument
    command_idx: u16,
}

public enum Argument has copy, drop, store {
    GasCoin,
    Input(CallArg), // thing about using CallArg here
    Result(u16),
    NestedResult(u16, u16),
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

public enum CallArg has copy, drop, store {
    Pure(vector<u8>),
    Object(ObjectArg),
    FundsWithdrawal {
        amount: u64,
        type_name: String,
        withdraw_from: WithdrawFrom,
    },
    Ext(String),
}

public enum ObjectArg has copy, drop, store {
    ObjectByID(ID),
    ObjectByType(String),
    Receiving(ID),
    Ext(String),
}

public enum WithdrawFrom has copy, drop, store {
    Sender,
    Sponsor,
}

public fun new(): Transaction {
    Transaction {
        // inputs: vector[],
        commands: vector[],
        // input_idx: 0,
        command_idx: 0,
    }
}

public fun new_with_offset(command_idx: u16): Transaction {
    Transaction {
        commands: vector[],
        command_idx,
    }
}

// === System Objects ===

public fun random(): Argument {
    Argument::Input(CallArg::Object(ObjectArg::ObjectByID(@0x8.to_id())))
}

public fun clock(): Argument {
    Argument::Input(CallArg::Object(ObjectArg::ObjectByID(@0x6.to_id())))
}

public fun display(): Argument {
    Argument::Input(CallArg::Object(ObjectArg::ObjectByID(@0xD.to_id())))
}

// === Inputs ===

public fun ext_input(name: String): Argument {
    Argument::Input(CallArg::Ext(name))
}

public fun pure<T: drop>(value: T): Argument {
    Argument::Input(CallArg::Pure(bcs::to_bytes(&value)))
}

public fun object_by_type<T: key>(): Argument {
    Argument::Input(
        CallArg::Object(
            ObjectArg::ObjectByType((*type_name::with_defining_ids<T>().as_string()).to_string()),
        ),
    )
}

public fun object_by_type_string(type_name: String): Argument {
    Argument::Input(CallArg::Object(ObjectArg::ObjectByType(type_name)))
}

public fun object_by_id(id: ID): Argument {
    Argument::Input(CallArg::Object(ObjectArg::ObjectByID(id)))
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

public fun make_move_vec(element_type: Option<String>, elements: vector<Argument>): Command {
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

public fun move_call(package: String, module_name: String, function: String): Command {
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
            // TODO: consider maybe, really maybe check against the same ObjectID used twice?
            // TODO: pray that we forget about it
            *arguments = command_arguments;
        },
        _ => abort,
    };

    self
}

public fun with_type_arguments(mut self: Command, command_type_arguments: vector<String>): Command {
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
    let clock = Self::clock();
    let _ = ptb.command(Command::MoveCall {
        package: @0x2.to_string(),
        module_name: "clock",
        function: "timestamp_ms",
        arguments: vector[clock],
        type_arguments: vector[],
    });
}

#[allow(unused_function)]
fun new_go_game(size: u8, account_id: Option<ID>) {
    let mut ptb = Self::new();

    let package_id = @0x0.to_string();
    let account = account_id.map!(|id| Self::object_by_id(id)).destroy_or!({
        ptb.command(Self::move_call(package_id, "game", "new_account"))
    });

    let size_arg = Self::pure(size);

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
    let game_arg = Self::object_by_id(game_id);
    let account_arg = Self::object_by_id(account_id);
    let move_call = Self::move_call(@0x0.to_string(), "game", "play").with_arguments(vector[
        game_arg,
        account_arg,
        Self::pure(x),
        Self::pure(y),
        Self::clock(),
    ]);

    ptb.command(move_call);
}

#[allow(unused_function)]
fun join_go_game(game_id: ID, account_id: Option<ID>) {
    let mut ptb = Self::new();

    let account = account_id.map!(|id| Self::object_by_id(id)).destroy_or!({
        ptb.command(Self::move_call(@0x2.to_string(), "game", "new_account"))
    });

    let game_arg = Self::object_by_id(game_id);

    ptb.command(Self::move_call(@0x0.to_string(), "game", "join").with_arguments(vector[
        game_arg,
        account,
    ]));

    if (account_id.is_some()) {
        ptb.command(Self::move_call(@0x0.to_string(), "game", "keep").with_arguments(vector[
            account,
        ]));
    }
}

#[test]
#[allow(unused_function)]
fun speak() {
    let mc = move_call(
        @0x0.to_string(),
        "demo_usd",
        "resolve_transfer",
    )
        .with_type_arguments(vector["magic::usdc_app::DEMO_USDC"])
        .with_arguments(vector[
            Self::ext_input("request"),
            Self::ext_input("rule_arg"),
            Self::clock(),
        ]);

    std::debug::print(&mc);
}
