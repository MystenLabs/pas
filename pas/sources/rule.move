module pas::rule;

use pas::{
    command::Command,
    namespace::Namespace,
    transfer_funds_request::TransferFundsRequest,
    vault::{Self, Vault}
};
use std::type_name::{Self, TypeName};
use sui::{balance::{Self, Balance}, derived_object, vec_map::{Self, VecMap}};

#[error(code = 0)]
const EInvalidProof: vector<u8> =
    b"The authorization witness does not match the rule's expected witness type.";
#[error(code = 1)]
const EClawbackNotAllowed: vector<u8> =
    b"Attempted to clawback tokens when clawback is not enabled for this rule.";
#[error(code = 3)]
const ERuleAlreadyExists: vector<u8> = b"A rule for this token type already exists.";

/// A rule is set by the owner of `T`, and points to a `TypeName` that needs
/// to be verified by the entity's contract.
///
/// This is derived from `namespace, TypeName<T>`
public struct Rule<phantom T> has key {
    id: UID,
    /// If the rule has clawback, the owner can arbitrarily clawback balances or assets from vaults.
    /// This is only set on registration and cannot be updated in the future.
    clawback_allowed: bool,
    /// The typename used to prove that the "smart contract" agrees with an action for a given `T`.
    /// Initially, this only means it approves "transfers", "clawbacks" and "mints (managed scenario)".
    /// In the future, there might be NFT version of these rules.
    auth_witness: TypeName,
    // TODO: Align on the `MoveCommand` architecture for making it easy to SDKs to resolve actions.
    // `TypeName` is the "action". E.g. `TransferFundsRequest`.
    // We make it a VecMap to allow expanding to support further actions in the standard.
    resolution_info: VecMap<TypeName, Command>,
}

/// Key for deriving `Rule<T>` from the namespace
public struct RuleKey<phantom T>() has copy, drop, store;

/// Create a new `Rule` without making the  the `TreasuryCap`.
public fun new<T, U: drop>(
    namespace: &mut Namespace,
    _: internal::Permit<T>,
    clawback_allowed: bool,
    _auth_witness: U,
) {
    assert!(!namespace.exists(RuleKey<T>()), ERuleAlreadyExists);

    transfer::share_object(Rule<T> {
        id: derived_object::claim(namespace.uid_mut(), RuleKey<T>()),
        clawback_allowed,
        auth_witness: type_name::with_defining_ids<U>(),
        resolution_info: vec_map::empty(),
    });
}

/// Resolve a transfer request by verifying the authorization witness and finalizing the transfer.
/// Aborts with `EInvalidProof` if the witness does not match the rule's authorization witness.
public fun resolve_transfer_funds<T, U: drop>(
    rule: &Rule<T>,
    request: TransferFundsRequest<T>,
    _stamp: U,
) {
    rule.assert_is_valid_creator_proof<_, U>();
    // destructuring the request to finalize the transfer.
    request.resolve();
}

/// Deposit existing token balance directly into the specified vault.
/// Aborts with `EInvalidProof` if the witness does not match the rule's authorization witness.
public fun deposit_funds<T, U: drop>(
    rule: &Rule<T>,
    vault: &Vault,
    balance: Balance<T>,
    _stamp: U,
) {
    rule.assert_is_valid_creator_proof<_, U>();
    vault.deposit_funds(balance)
}

/// This function deposits to an address (or object).
/// THIS MUST NOT BE THE VAULT ID. The ID of the vault is derived within the function.
///
/// This is marked as `unsafe_` because if the supplied address is invalid, the funds might end up
/// in a wrong vault. They remain recoverable.
public fun unsafe_deposit_funds<T, U: drop>(
    rule: &Rule<T>,
    namespace: &Namespace,
    balance: Balance<T>,
    to: address,
    _stamp: U,
    _ctx: &mut TxContext,
) {
    rule.assert_is_valid_creator_proof<_, U>();
    balance::send_funds(balance, vault::vault_address(object::id(namespace), to));
}

/// TODO: Introduce `UnlockFundsRequest` too.
///
/// Clawbacks `amount` of balance from a Vault, returning `Balance<T>` by value.
///
/// WARNING: This does not guarantee that the funds will not go out of the controlled system.
/// Use with caution.
public fun clawback_funds<T, U: drop>(
    rule: &Rule<T>,
    from: &mut Vault,
    amount: u64,
    _stamp: U,
): Balance<T> {
    assert!(rule.clawback_allowed, EClawbackNotAllowed);
    rule.assert_is_valid_creator_proof<_, U>();

    from.withdraw<T>(amount)
}

// ========== Action Management ==========

/// Set the move command for a specific action type.
/// NOTE: If the action type already exists, it will be replaced.
public fun set_action_command<T, U: drop, A>(
    rule: &mut Rule<T>,
    command: Command,
    _auth_witness: U,
) {
    rule.assert_is_valid_creator_proof<_, U>();
    let action_type = type_name::with_defining_ids<A>();

    // Remove if already exists (as this is a setter).
    if (rule.resolution_info.contains(&action_type)) {
        rule.resolution_info.remove(&action_type);
    };

    rule.resolution_info.insert(action_type, command);
}

public fun auth_witness<T>(rule: &Rule<T>): TypeName { rule.auth_witness }

fun assert_is_valid_creator_proof<T, U: drop>(rule: &Rule<T>) {
    assert!(type_name::with_defining_ids<U>() == rule.auth_witness, EInvalidProof);
}
