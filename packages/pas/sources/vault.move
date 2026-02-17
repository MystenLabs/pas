/// Vault logic
module pas::vault;

use pas::{
    clawback_funds::{Self, ClawbackFunds},
    keys,
    namespace::{Self, Namespace},
    request::Request,
    transfer_funds::{Self, TransferFunds},
    unlock_funds::{Self, UnlockFunds},
    versioning::Versioning
};
use sui::{balance::{Self, Balance}, derived_object};

use fun balance::withdraw_funds_from_object as UID.withdraw_funds_from_object;
#[error(code = 1)]
const ENotOwner: vector<u8> = b"The owner is not valid for the vault.";
#[error(code = 2)]
const EVaultAlreadyExists: vector<u8> = b"The vault already exists.";

/// There is only one Vault per address (guaranteed by derived objects).
/// - Balances can only be transferred from Vault A to Vault B.
/// - Vaults are shared by default.
/// - Vaults creation is permission-less
/// - A `UID` (object) can also own a vault
public struct Vault has key {
    id: UID,
    /// The owner of the vault (address or object)
    owner: address,
    /// The ID of the namespace that created this vault.
    /// There's ONLY ONE namespace in the system, but this helps us avoid having
    /// `&Namespace` inputs in all functions that need to derive the IDs.
    namespace_id: ID,
    /// Block versions to break backwards compatibility -- only used in case of emergency.
    versioning: Versioning,
}

/// A proof that address has authenticated. This allows for uniform access control between both
/// `UID` and `ctx.sender()` (keeping a single API for both).
public struct Auth(address) has drop;

/// Create a new vault for `owner`. This is a permission-less action.
public fun create(namespace: &mut Namespace, owner: address): Vault {
    assert!(!namespace.vault_exists(owner), EVaultAlreadyExists);

    let versioning = namespace.versioning();
    versioning.assert_is_valid_version();

    Vault {
        id: derived_object::claim(namespace.uid_mut(), keys::vault_key(owner)),
        owner,
        namespace_id: object::id(namespace),
        versioning,
    }
}

/// The only way to finalize the TX is by sharing the vault.
/// All vaults are shared by default.
public fun share(vault: Vault) {
    transfer::share_object(vault);
}

/// Create and share a vault in a single step.
public fun create_and_share(namespace: &mut Namespace, owner: address) {
    create(namespace, owner).share()
}

/// Enables a fund unlock flow.
/// This is useful for assets that are not managed by a Rule within the system, or
/// if there's a special case where an issuer allows balances to flow out of the system.
public fun unlock_funds<T>(
    vault: &mut Vault,
    auth: &Auth,
    amount: u64,
    _ctx: &mut TxContext,
): Request<UnlockFunds<T>> {
    auth.assert_is_valid_for_vault!(vault);
    vault.versioning.assert_is_valid_version();
    unlock_funds::new(vault.owner, vault.id.to_inner(), vault.withdraw(amount))
}

/// Initiate a transfer from vault A to vault B.
public fun transfer_funds<T>(
    from: &mut Vault,
    auth: &Auth,
    to: &Vault,
    amount: u64,
    _ctx: &mut TxContext,
): Request<TransferFunds<T>> {
    auth.assert_is_valid_for_vault!(from);
    from.versioning.assert_is_valid_version();
    from.internal_transfer_funds<T>(to.owner, amount)
}

/// Initiate a clawback request for an amount of funds.
/// This takes no `Auth`, as it's an admin action.
///
/// This can only ever finalize if clawback is enabled in the rule.
public fun clawback_funds<T>(
    from: &mut Vault,
    amount: u64,
    _ctx: &mut TxContext,
): Request<ClawbackFunds<T>> {
    from.versioning.assert_is_valid_version();
    clawback_funds::new(from.owner, from.id.to_inner(), from.withdraw(amount))
}

/// Transfer `amount` from vault to an address. This unlocks transfers to a vault before it has been created.
///
/// It's marked as `unsafe_` as it's easy to accidentally pick the wrong recipient address.
public fun unsafe_transfer_funds<T>(
    from: &mut Vault,
    auth: &Auth,
    // Recipients should always be the wallet or object address, not the vault ID.
    // It's recommended to use `transfer` instead for safer transfers.
    recipient_address: address,
    amount: u64,
    _ctx: &mut TxContext,
): Request<TransferFunds<T>> {
    auth.assert_is_valid_for_vault!(from);
    from.versioning.assert_is_valid_version();
    from.internal_transfer_funds<T>(recipient_address, amount)
}

/// Generate an ownership proof from the sender of the transaction.
public fun new_auth(ctx: &TxContext): Auth {
    Auth(ctx.sender())
}

/// Generate an ownership proof from a `UID` object, to allow objects to own vaults.
public fun new_auth_as_object(uid: &mut UID): Auth {
    Auth(uid.to_inner().to_address())
}

public fun owner(vault: &Vault): address {
    vault.owner
}

public fun deposit_funds<T>(vault: &Vault, balance: Balance<T>) {
    vault.versioning.assert_is_valid_version();
    balance::send_funds(balance, object::id(vault).to_address());
}

/// Permission-less operation to bring versioning up-to-date with the namespace.
public fun sync_versioning(vault: &mut Vault, namespace: &Namespace) {
    vault.versioning = namespace.versioning();
}

public(package) fun withdraw<T>(vault: &mut Vault, amount: u64): Balance<T> {
    vault.versioning.assert_is_valid_version();
    balance::redeem_funds(vault.id.withdraw_funds_from_object(amount))
}

public(package) fun versioning(vault: &Vault): Versioning {
    vault.versioning
}

/// Verify that the ownership proof matches the vaults owner.
macro fun assert_is_valid_for_vault($proof: &Auth, $vault: &Vault) {
    let proof = $proof;
    let vault = $vault;
    assert!(&proof.0 == &vault.owner, ENotOwner);
}

/// The internal implementation for transferring `amount` from Vault towards another address.
///
/// INTERNAL WARNING: Callers must verify that `to` is the user address, NOT the vault address.
/// Failure to do so can cause assets to move out of the closed loop, breaking the system assurances
fun internal_transfer_funds<T>(
    from: &mut Vault,
    to: address,
    amount: u64,
): Request<TransferFunds<T>> {
    let balance = from.withdraw<T>(amount);
    let recipient_vault_id = namespace::vault_address_from_id(from.namespace_id, to);

    transfer_funds::new(
        from.owner,
        to,
        from.id.to_inner(),
        recipient_vault_id.to_id(),
        balance,
    )
}
