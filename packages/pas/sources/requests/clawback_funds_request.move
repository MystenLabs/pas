module pas::clawback_funds_request;

use pas::{keys::clawback_funds_action, request::{Self, Request}, rule::Rule};
use sui::balance::Balance;

#[error(code = 1)]
const EClawbackNotAllowed: vector<u8> =
    b"Attempted to clawback tokens when clawback is not enabled for this rule.";

public struct ClawbackFundsRequest<phantom T> {
    /// `owner` is the wallet OR object address, NOT the vault address
    owner: address,
    /// The ID of the vault the funds are coming from
    vault_id: ID,
    /// The balance that is being clawed back.
    balance: Balance<T>,
}

public fun owner<T>(request: &ClawbackFundsRequest<T>): address { request.owner }

public fun vault_id<T>(request: &ClawbackFundsRequest<T>): ID { request.vault_id }

public fun amount<T>(request: &ClawbackFundsRequest<T>): u64 { request.balance.value() }

public(package) fun new<T>(
    owner: address,
    vault_id: ID,
    balance: Balance<T>,
): Request<ClawbackFundsRequest<T>> {
    request::new(ClawbackFundsRequest {
        owner,
        vault_id,
        balance,
    })
}

/// Resolve a clawback funds request by:
/// 1. Verify rule is valid
/// 2. Verify rule has clawback enabled
/// 3. Make sure rule has enabled clawback resolution
public fun resolve<T>(request: Request<ClawbackFundsRequest<T>>, rule: &Rule<T>): Balance<T> {
    rule.versioning().assert_is_valid_version();
    assert!(rule.is_fund_clawback_allowed(), EClawbackNotAllowed);
    let data = request.resolve(rule.required_approvals(clawback_funds_action()));

    let ClawbackFundsRequest { balance, .. } = data;
    balance
}
