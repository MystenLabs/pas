module pas::transfer_funds;

use pas::{keys::transfer_funds_action, request::{Self, Request}, policy::Policy};
use sui::balance::{Self, Balance};

/// A transfer request that is generated once a Permissioned Funds Transfer is initiated.
///
/// A hot potato that is issued when a transfer is initiated.
/// It can only be resolved by presenting a witness `U` that is the witness of `Policy<T>`
///
/// This enables the `resolve` function of each smart contract to
/// be flexible and implement its own mechanisms for validation.
/// The individual resolution module can:
///   - Check whitelists/blacklists
///   - Enforce holding periods
///   - Collect fees
///   - Emit regulatory events
///   - Handle dividends/distributions
///   - Implement any jurisdiction-specific rules
public struct TransferFunds<phantom T> {
    /// `sender` is the wallet OR object address, NOT the chest address
    sender: address,
    /// `recipient` is the wallet OR object address, NOT the chest address
    recipient: address,
    /// The ID of the chest the funds are coming from
    sender_chest_id: ID,
    /// The ID of the chest the funds are going to
    recipient_chest_id: ID,
    /// The amount being transferred (original)
    amount: u64,
    /// The actual balance being transferred
    balance: Balance<T>,
}

public fun sender<T>(request: &TransferFunds<T>): address { request.sender }

public fun recipient<T>(request: &TransferFunds<T>): address { request.recipient }

public fun sender_chest_id<T>(request: &TransferFunds<T>): ID { request.sender_chest_id }

public fun recipient_chest_id<T>(request: &TransferFunds<T>): ID {
    request.recipient_chest_id
}

public fun amount<T>(request: &TransferFunds<T>): u64 { request.amount }

public(package) fun new<T>(
    sender: address,
    recipient: address,
    sender_chest_id: ID,
    recipient_chest_id: ID,
    balance: Balance<T>,
): Request<TransferFunds<T>> {
    request::new(TransferFunds {
        sender,
        recipient,
        sender_chest_id,
        recipient_chest_id,
        amount: balance.value(),
        balance,
    })
}

/// resolve a transfer request, if funds management is enabled & there are enough approvals.
public fun resolve<T>(request: Request<TransferFunds<T>>, policy: &Policy<T>) {
    policy.versioning().assert_is_valid_version();
    policy.assert_is_fund_management_enabled();
    let data = request.resolve(policy.required_approvals(transfer_funds_action()));

    let TransferFunds { balance, recipient_chest_id, .. } = data;
    balance::send_funds(balance, recipient_chest_id.to_address());
}
