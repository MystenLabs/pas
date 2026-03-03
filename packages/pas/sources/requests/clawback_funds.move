module pas::clawback_funds;

use pas::{keys::clawback_funds_action, policy::Policy, request::{Self, Request}};

#[error(code = 1)]
const EClawbackNotAllowed: vector<u8> =
    b"Attempted to clawback tokens when clawback is not enabled for this policy.";

public struct ClawbackFunds<T: store> {
    /// `owner` is the wallet OR object address, NOT the chest address
    owner: address,
    /// The ID of the chest the funds are coming from
    chest_id: ID,
    /// The amount being clawed back (original)
    amount: u64,
    /// The balance that is being clawed back.
    balance: T,
}

public fun owner<T: store>(request: &ClawbackFunds<T>): address { request.owner }

public fun chest_id<T: store>(request: &ClawbackFunds<T>): ID { request.chest_id }

public fun amount<T: store>(request: &ClawbackFunds<T>): u64 { request.amount }

/// Resolve a clawback funds request by:
/// 1. Verify policy is valid
/// 2. Verify policy has clawback enabled
/// 3. Make sure policy has enabled clawback resolution
public fun resolve<T: store>(request: Request<ClawbackFunds<T>>, policy: &Policy<T>): T {
    policy.versioning().assert_is_valid_version();
    assert!(policy.is_clawback_allowed(), EClawbackNotAllowed);
    let data = request.resolve(policy.required_approvals(clawback_funds_action()));

    let ClawbackFunds { balance, .. } = data;
    balance
}

public(package) fun new<T: store>(
    owner: address,
    chest_id: ID,
    balance: T,
    amount: u64,
): Request<ClawbackFunds<T>> {
    request::new(ClawbackFunds {
        owner,
        chest_id,
        amount,
        balance,
    })
}
