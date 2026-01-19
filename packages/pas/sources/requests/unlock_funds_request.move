module pas::unlock_funds_request;

use pas::namespace::Namespace;
use sui::balance::Balance;

#[error(code = 0)]
const ECannotResolveManagedAssets: vector<u8> =
    b"Cannot resolve managed assets without the issuer's permission.";

/// An unlock funds request that is generated once a Permissioned Funds Transfer is initiated.
///
/// This can be resolved in two ways:
/// 1. If the asset is `permissioned` (there's a `Rule<T>` for that asset), it can only be resolved by the creator
/// by calling `rule::resolve_unlock_funds`
/// 2. If the asset is not permissioned, it can be resolved by any address by calling `unlock_funds_request::resolve_non_managed`
public struct UnlockFundsRequest<phantom T> {
    /// `from` is the wallet OR object address, NOT the vault address
    from: address,
    /// The ID of the vault the funds are coming from
    from_vault_id: ID,
    /// The amount being transferred (initial amount)
    amount: u64,
    /// The actual balance being transferred
    balance: Balance<T>,
}

public fun from<T>(request: &UnlockFundsRequest<T>): address { request.from }

public fun from_vault_id<T>(request: &UnlockFundsRequest<T>): ID { request.from_vault_id }

public fun amount<T>(request: &UnlockFundsRequest<T>): u64 { request.amount }

/// This enables unlocking assets that are not managed by a Rule within the system.
/// If a `Rule<T>` exists, they can only be resolved from within the system.
public fun resolve_non_managed<T>(
    request: UnlockFundsRequest<T>,
    namespace: &Namespace,
): Balance<T> {
    assert!(!namespace.rule_exists<T>(), ECannotResolveManagedAssets);
    request.resolve()
}

public(package) fun new<T>(
    from: address,
    from_vault_id: ID,
    balance: Balance<T>,
): UnlockFundsRequest<T> {
    UnlockFundsRequest {
        from,
        from_vault_id,
        amount: balance.value(),
        balance,
    }
}

/// Internal function to resolve a transfer request.
/// WARNING: This must only be called by `rule.move` after verifying the witness,
/// it should never become public.
public(package) fun resolve<T>(request: UnlockFundsRequest<T>): Balance<T> {
    let UnlockFundsRequest { balance, .. } = request;
    balance
}
