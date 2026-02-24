module pas::clawback_funds;

use pas::{keys::clawback_funds_action, policy::Policy, request::{Self, Request}};
use sui::balance::Balance;

#[error(code = 1)]
const EClawbackNotAllowed: vector<u8> =
    b"Attempted to clawback tokens when clawback is not enabled for this policy.";

public struct ClawbackFunds<phantom T> {
    /// `owner` is the wallet OR object address, NOT the chest address
    owner: address,
    /// The ID of the chest the funds are coming from
    chest_id: ID,
    /// The balance that is being clawed back.
    balance: Balance<T>,
}

public fun owner<T>(request: &ClawbackFunds<T>): address { request.owner }

public fun chest_id<T>(request: &ClawbackFunds<T>): ID { request.chest_id }

public fun amount<T>(request: &ClawbackFunds<T>): u64 { request.balance.value() }

public(package) fun new<T>(
    owner: address,
    chest_id: ID,
    balance: Balance<T>,
): Request<ClawbackFunds<T>> {
    request::new(ClawbackFunds {
        owner,
        chest_id,
        balance,
    })
}

/// Resolve a clawback funds request by:
/// 1. Verify policy is valid
/// 2. Verify policy has clawback enabled
/// 3. Make sure policy has enabled clawback resolution
public fun resolve<T>(request: Request<ClawbackFunds<T>>, policy: &Policy<T>): Balance<T> {
    policy.versioning().assert_is_valid_version();
    assert!(policy.is_fund_clawback_allowed(), EClawbackNotAllowed);
    let data = request.resolve(policy.required_approvals(clawback_funds_action()));

    let ClawbackFunds { balance, .. } = data;
    balance
}
