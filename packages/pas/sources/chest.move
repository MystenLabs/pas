/// Chest logic
module pas::chest;

use pas::{
    clawback_funds::{Self, ClawbackFunds},
    keys,
    namespace::{Self, Namespace},
    request::Request,
    send_funds::{Self, SendFunds},
    unlock_funds::{Self, UnlockFunds},
    versioning::Versioning
};
use sui::{balance::{Self, Balance}, derived_object};

use fun balance::withdraw_funds_from_object as UID.withdraw_funds_from_object;
#[error(code = 0)]
const ENotOwner: vector<u8> = b"The owner is not valid for the chest.";
#[error(code = 1)]
const EChestAlreadyExists: vector<u8> = b"The chest already exists.";

/// There is only one Chest per address (guaranteed by derived objects).
/// - Balances can only be transferred from Chest A to Chest B.
/// - Chests are shared by default.
/// - Chests creation is permission-less
/// - A `UID` (object) can also own a chest
public struct Chest has key {
    id: UID,
    /// The owner of the chest (address or object)
    owner: address,
    /// The ID of the namespace that created this chest.
    /// There's ONLY ONE namespace in the system, but this helps us avoid having
    /// `&Namespace` inputs in all functions that need to derive the IDs.
    namespace_id: ID,
    /// Block versions to break backwards compatibility -- only used in case of emergency.
    versioning: Versioning,
}

/// A proof that address has authenticated. This allows for uniform access control between both
/// `UID` and `ctx.sender()` (keeping a single API for both).
public struct Auth(address) has drop;

/// Create a new chest for `owner`. This is a permission-less action.
public fun create(namespace: &mut Namespace, owner: address): Chest {
    assert!(!namespace.chest_exists(owner), EChestAlreadyExists);

    let versioning = namespace.versioning();
    versioning.assert_is_valid_version();

    Chest {
        id: derived_object::claim(namespace.uid_mut(), keys::chest_key(owner)),
        owner,
        namespace_id: object::id(namespace),
        versioning,
    }
}

/// The only way to finalize the TX is by sharing the chest.
/// All chests are shared by default.
public fun share(chest: Chest) {
    transfer::share_object(chest);
}

/// Create and share a chest in a single step.
public fun create_and_share(namespace: &mut Namespace, owner: address) {
    create(namespace, owner).share()
}

/// Enables a fund unlock flow.
/// This is useful for assets that are not managed by a Policy within the system, or
/// if there's a special case where an issuer allows balances to flow out of the system.
public fun unlock_balance<C>(
    chest: &mut Chest,
    auth: &Auth,
    amount: u64,
    _ctx: &mut TxContext,
): Request<UnlockFunds<Balance<C>>> {
    auth.assert_is_valid_for_chest!(chest);
    chest.versioning.assert_is_valid_version();
    unlock_funds::new(chest.owner, chest.id.to_inner(), chest.withdraw_balance<C>(amount))
}

/// Initiate a transfer from chest A to chest B.
public fun send_balance<C>(
    from: &mut Chest,
    auth: &Auth,
    to: &Chest,
    amount: u64,
    _ctx: &mut TxContext,
): Request<SendFunds<Balance<C>>> {
    auth.assert_is_valid_for_chest!(from);
    from.versioning.assert_is_valid_version();
    from.internal_send_balance<C>(to.owner, amount)
}

/// Initiate a clawback request for an amount of funds.
/// This takes no `Auth`, as it's an admin action.
///
/// This can only ever finalize if clawback is enabled in the policy.
public fun clawback_balance<C>(
    from: &mut Chest,
    amount: u64,
    _ctx: &mut TxContext,
): Request<ClawbackFunds<Balance<C>>> {
    from.versioning.assert_is_valid_version();
    clawback_funds::new(from.owner, from.id.to_inner(), from.withdraw_balance<C>(amount))
}

/// Transfer `amount` from chest to an address. This unlocks transfers to a chest before it has been created.
///
/// It's marked as `unsafe_` as it's easy to accidentally pick the wrong recipient address.
public fun unsafe_send_balance<C>(
    from: &mut Chest,
    auth: &Auth,
    // Recipients should always be the wallet or object address, not the chest ID.
    // It's recommended to use `transfer` instead for safer transfers.
    recipient_address: address,
    amount: u64,
    _ctx: &mut TxContext,
): Request<SendFunds<Balance<C>>> {
    auth.assert_is_valid_for_chest!(from);
    from.versioning.assert_is_valid_version();
    from.internal_send_balance<C>(recipient_address, amount)
}

/// Generate an ownership proof from the sender of the transaction.
public fun new_auth(ctx: &TxContext): Auth {
    Auth(ctx.sender())
}

/// Generate an ownership proof from a `UID` object, to allow objects to own chests.
public fun new_auth_as_object(uid: &mut UID): Auth {
    Auth(uid.to_inner().to_address())
}

public fun owner(chest: &Chest): address {
    chest.owner
}

public fun deposit_balance<C>(chest: &Chest, balance: Balance<C>) {
    chest.versioning.assert_is_valid_version();
    balance::send_funds(balance, object::id(chest).to_address());
}

/// Permission-less operation to bring versioning up-to-date with the namespace.
public fun sync_versioning(chest: &mut Chest, namespace: &Namespace) {
    chest.versioning = namespace.versioning();
}

public(package) fun withdraw_balance<C>(chest: &mut Chest, amount: u64): Balance<C> {
    chest.versioning.assert_is_valid_version();
    balance::redeem_funds(chest.id.withdraw_funds_from_object(amount))
}

public(package) fun versioning(chest: &Chest): Versioning {
    chest.versioning
}

/// Verify that the ownership proof matches the chests owner.
macro fun assert_is_valid_for_chest($proof: &Auth, $chest: &Chest) {
    let proof = $proof;
    let chest = $chest;
    assert!(&proof.0 == &chest.owner, ENotOwner);
}

/// The internal implementation for transferring `amount` from Chest towards another address.
///
/// INTERNAL WARNING: Callers must verify that `to` is the user address, NOT the chest address.
/// Failure to do so can cause assets to move out of the closed loop, breaking the system assurances
fun internal_send_balance<C>(
    from: &mut Chest,
    to: address,
    amount: u64,
): Request<SendFunds<Balance<C>>> {
    let funds = from.withdraw_balance<C>(amount);
    let recipient_chest_id = namespace::chest_address_from_id(from.namespace_id, to);

    send_funds::new(
        from.owner,
        to,
        from.id.to_inner(),
        recipient_chest_id.to_id(),
        funds,
    )
}
