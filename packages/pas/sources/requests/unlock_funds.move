module pas::unlock_funds;

use pas::{keys::unlock_funds_action, namespace::Namespace, request::{Self, Request}, rule::Rule};
use sui::{balance::Balance, vec_set};

#[error(code = 0)]
const ECannotResolveManagedAssets: vector<u8> =
    b"Cannot resolve managed assets without the issuer's permission.";

/// An unlock funds request that is generated once a Permissioned Funds Transfer is initiated.
///
/// This can be resolved in two ways:
/// 1. If the asset is `permissioned` (there's a `Rule<T>` for that asset), it can only be resolved by the creator
/// by calling `rule::resolve_unlock_funds`
/// 2. If the asset is not permissioned, it can be resolved by any address by calling `unlock_funds::resolve_unrestricted`
public struct UnlockFunds<phantom T> {
    /// `from` is the wallet OR object address, NOT the vault address
    owner: address,
    /// The ID of the vault the funds are coming from
    vault_id: ID,
    /// The amount being transferred (initial amount)
    amount: u64,
    /// The actual balance being transferred
    balance: Balance<T>,
}

public fun owner<T>(request: &UnlockFunds<T>): address { request.owner }

public fun vault_id<T>(request: &UnlockFunds<T>): ID { request.vault_id }

public fun amount<T>(request: &UnlockFunds<T>): u64 { request.amount }

/// This enables unlocking assets that are not managed by a Rule within the system.
/// If a `Rule<T>` exists, they can only be resolved from within the system.
///
/// For example, `SUI` will never be a managed asset, so the owner needs to be able
/// to withdraw if anyone transfers some to their vault.
public fun resolve_unrestricted<T>(
    request: Request<UnlockFunds<T>>,
    namespace: &Namespace,
): Balance<T> {
    assert!(!namespace.rule_exists<T>(), ECannotResolveManagedAssets);
    namespace.versioning().assert_is_valid_version();
    let data = request.resolve(vec_set::empty());
    let UnlockFunds { balance, .. } = data;
    balance
}

public(package) fun new<T>(
    owner: address,
    vault_id: ID,
    balance: Balance<T>,
): Request<UnlockFunds<T>> {
    request::new(UnlockFunds {
        owner,
        vault_id,
        amount: balance.value(),
        balance,
    })
}

/// Resolve an unlock funds request as long as funds management is enabled and
/// there are enough valid approvals.
public fun resolve<T>(request: Request<UnlockFunds<T>>, rule: &Rule<T>): Balance<T> {
    rule.versioning().assert_is_valid_version();
    rule.assert_is_fund_management_enabled();
    let data = request.resolve(rule.required_approvals(unlock_funds_action()));

    let UnlockFunds { balance, .. } = data;
    balance
}
