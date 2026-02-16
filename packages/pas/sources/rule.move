module pas::rule;

use pas::{keys, namespace::Namespace, versioning::Versioning};
use std::{string::String, type_name::{Self, TypeName}};
use sui::{
    coin::TreasuryCap,
    derived_object,
    dynamic_field,
    vec_map::{Self, VecMap},
    vec_set::{Self, VecSet}
};

#[error(code = 1)]
const ERuleAlreadyExists: vector<u8> = b"A rule for this token type already exists.";
#[error(code = 2)]
const EFundManagementNotEnabled: vector<u8> = b"Fund management is not enabled for this rule.";
#[error(code = 3)]
const EFundManagementAlreadyEnabled: vector<u8> =
    b"Fund management is already enabled for this rule.";
#[error(code = 4)]
const EInvalidAction: vector<u8> = b"Invalid action type.";
#[error(code = 5)]
const ENotSupportedAction: vector<u8> =
    b"The requested action type is not supported by the issuer.";

/// A rule is set by the owner of `T`, and points to a `TypeName` that needs
/// to be verified by the entity's contract.
///
/// This is derived from `namespace, TypeName<T>`
public struct Rule<phantom T> has key {
    id: UID,
    /// The required approvals per request type.
    /// The key must be one of the request types (e.g. `transfer_funds`, `unlock_funds` or `clawback_funds`).
    ///
    /// The value is a vector of approvals that need to be gather to resolve the request.
    required_approvals: VecMap<String, VecSet<TypeName>>,
    /// Block versions to break backwards compatibility -- only used in case of emergency.
    versioning: Versioning,
}

/// Capability for managing a `Rule<T>`. It's 1:1.
public struct RuleCap<phantom T> has key, store {
    id: UID,
}

/// Key that is used to derive the RuleCap ID from `Rule<T>`
public struct RuleCapKey() has copy, drop, store;

/// A flag saved as <FundsClawbackState(), bool> to check if claw-backs are enabled
/// for a given asset.
public struct FundsClawbackState() has copy, drop, store;

/// Create a new `Rule` for `T`.
/// We use `Permit<T>` as the proof of ownership for `T`.
public fun new<T>(namespace: &mut Namespace, _: internal::Permit<T>): (Rule<T>, RuleCap<T>) {
    assert!(!namespace.rule_exists<T>(), ERuleAlreadyExists);

    let versioning = namespace.versioning();
    versioning.assert_is_valid_version();

    let mut rule = Rule<T> {
        id: derived_object::claim(namespace.uid_mut(), keys::rule_key<T>()),
        required_approvals: vec_map::empty(),
        versioning,
    };

    let rule_cap = RuleCap<T> {
        id: derived_object::claim(&mut rule.id, RuleCapKey()),
    };

    (rule, rule_cap)
}

public fun share<T>(rule: Rule<T>) {
    transfer::share_object(rule);
}

/// Enables funds management for a given `T`, adding a DF that tracks the clawback status (true/false).
/// This can only be called once. After calling it, the clawback status can never change!
public fun enable_funds_management<T>(
    rule: &mut Rule<T>,
    _: &mut TreasuryCap<T>,
    clawback_allowed: bool,
) {
    assert!(!rule.is_fund_management_enabled(), EFundManagementAlreadyEnabled);
    rule.versioning.assert_is_valid_version();
    dynamic_field::add(&mut rule.id, FundsClawbackState(), clawback_allowed);
}

/// Get the set of required approvals for a given action.
public fun required_approvals<T>(rule: &Rule<T>, action_type: String): VecSet<TypeName> {
    assert!(rule.required_approvals.contains(&action_type), ENotSupportedAction);
    *rule.required_approvals.get(&action_type)
}

/// For a set of actions, set the approvals required to conclude the action.
///
/// Supported actions: ["transfer_funds", "unlock_funds", "clawback_funds"]
public(package) fun set_required_approvals<T>(
    rule: &mut Rule<T>,
    _: &RuleCap<T>,
    action: String,
    approvals: VecSet<TypeName>,
) {
    rule.versioning.assert_is_valid_version();
    assert!(keys::is_valid_action(action), EInvalidAction);
    rule.required_approvals.insert(action, approvals);
}

public fun set_required_approval<T, A: drop>(rule: &mut Rule<T>, cap: &RuleCap<T>, action: String) {
    rule.set_required_approvals(
        cap,
        action,
        vec_set::singleton(type_name::with_defining_ids<A>()),
    );
}

/// Check if clawback is allowed or not.
/// Aborts early if the management for funds has not been enabled for `T`.
public fun is_fund_clawback_allowed<T>(rule: &Rule<T>): bool {
    rule.assert_is_fund_management_enabled();
    rule.versioning.assert_is_valid_version();
    *dynamic_field::borrow(&rule.id, FundsClawbackState())
}

/// Allows syncing the versioning of a rule to the namespace's versioning.
/// This is permission-less and can be done
public fun sync_versioning<T>(rule: &mut Rule<T>, namespace: &Namespace) {
    rule.versioning = namespace.versioning();
}

/// Check if fund management is enabled for a given `T`.
public(package) fun is_fund_management_enabled<T>(rule: &Rule<T>): bool {
    dynamic_field::exists_(&rule.id, FundsClawbackState())
}

public(package) fun versioning<T>(rule: &Rule<T>): Versioning { rule.versioning }

public fun assert_is_fund_management_enabled<T>(rule: &Rule<T>) {
    assert!(rule.is_fund_management_enabled(), EFundManagementNotEnabled);
}
