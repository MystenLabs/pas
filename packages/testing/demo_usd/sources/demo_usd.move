// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/// Demo USD asset for testing the PAS SDK.
///
/// This module defines a DEMO_USD witness type that gets registered in the PAS system
/// during package initialization. It sets up a Rule with resolution commands for
/// TransferFunds and UnlockFunds actions.
module demo_usd::demo_usd;

use pas::command;
use pas::namespace::Namespace;
use pas::rule::{Self, Rule};
use pas::transfer_funds_request::TransferFundsRequest;
use std::type_name;
use sui::balance::Balance;
use sui::coin::TreasuryCap;
use sui::coin_registry::{Self, MetadataCap};

#[error(code = 0)]
const EInvalidAmount: vector<u8> = b"Any amount over 10K is not allowed in this demo.";
#[error(code = 1)]
const ECannotSelfTransfer: vector<u8> =
    b"Transfers cannot be made to the same address as the sender.";

/// One-time witness for the demo_usd package
public struct DEMO_USD has drop {}

/// Create a 'faucet' to allow free mints for testing
public struct Faucet has key {
    id: UID,
    cap: TreasuryCap<DEMO_USD>,
    metadata: MetadataCap<DEMO_USD>,
}
/// Stamp used in PAS for authorizing any admin action.
public struct ActionStamp() has drop;

public fun faucet_mint_balance(faucet: &mut Faucet, amount: u64): Balance<DEMO_USD> {
    faucet.cap.mint_balance(amount)
}

/// Package initialization - creates DEMO_USD currency
fun init(otw: DEMO_USD, ctx: &mut TxContext) {
    let (initializer, cap) = coin_registry::new_currency_with_otw(
        otw,
        6,
        b"DEMO_USD".to_string(),
        b"Demo USD".to_string(),
        b"Demo USD for testing".to_string(),
        b"https://demo.usd".to_string(),
        ctx,
    );

    let metadata = initializer.finalize(ctx);

    transfer::share_object(Faucet {
        id: object::new(ctx),
        cap,
        metadata,
    });
}

entry fun setup(namespace: &mut Namespace) {
    let mut rule = rule::new(namespace, internal::permit<DEMO_USD>(), ActionStamp());

    let type_name = type_name::with_defining_ids<DEMO_USD>();

    let mut command = command::new(
        command::new_address(sui::address::from_ascii_bytes(type_name.address_string().as_bytes())),
        b"demo_usd".to_ascii_string(),
        b"resolve_transfer".to_ascii_string(),
    );

    // the only type arg of the PTB is `T` == (DEMO_USDC).
    command.add_type_arg(command::new_system_type_arg());

    // Add the "args"
    command.add_arg(command::new_custom_arg(b"transfer_request".to_ascii_string()));
    command.add_arg(command::new_custom_arg(b"rule".to_ascii_string()));

    let cmd = command.build();

    rule.set_action_command<_, _, TransferFundsRequest<DEMO_USD>>(cmd, ActionStamp());

    // Eanble funds management (with clawbacks!)
    rule.enable_funds_management(ActionStamp(), true);
    rule.share();
}

/// Resolver function for transfer requests - simply approves all transfers
public fun resolve_transfer<T>(request: TransferFundsRequest<T>, rule: &Rule<T>) {
    // We only allow transfers with value less than 10K.
    // NOTE: This is only for testing, this is not really enforceable like this as you could batch multiple in a PTB.
    assert!(request.amount() < 10_000 * 1_000_000, EInvalidAmount);
    assert!(request.from() != request.to(), ECannotSelfTransfer);

    // Resolve the transfer!
    rule.resolve_transfer_funds(request, ActionStamp())
}
