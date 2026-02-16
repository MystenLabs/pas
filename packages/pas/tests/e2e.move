#[test_only, allow(unused_variable, unused_mut_ref, dead_code)]
module pas::e2e;

use pas::{rule, transfer_funds, unlock_funds, vault::{Self, Vault}};
use std::unit_test::{assert_eq, destroy};
use sui::{balance::{Self, send_funds}, sui::SUI, test_scenario::return_shared};

public struct A has drop {}
public struct B has drop {}
public struct ExtUSD has drop {}

public struct AWitness() has drop;
public struct BWitness() has drop;

#[test]
fun e2e() {
    test_tx!(@0x1, |namespace, managed_rule, unmanaged_rule, scenario| {
        scenario.next_tx(@0x1);

        let namespace_id = object::id(namespace);

        // create vaults of 0x1 and 0x2
        let vault = vault::create(namespace, @0x1);
        let another_vault = vault::create(namespace, @0x2);

        // transfer some funds to both 0x1 and 0x2
        vault.deposit_funds(balance::create_for_testing<A>(100));

        balance::create_for_testing<B>(50).send_funds(namespace.vault_address(@0x2));

        vault.share();
        another_vault.share();

        scenario.next_tx(@0x1);

        let mut vault = scenario.take_shared_by_id<Vault>(namespace
            .vault_address(
                @0x1,
            )
            .to_id());
        let another_vault = scenario.take_shared_by_id<Vault>(namespace
            .vault_address(@0x2)
            .to_id());

        let auth = vault::new_auth(scenario.ctx());
        let mut transfer_request = vault.transfer_funds<A>(
            &auth,
            &another_vault,
            50,
            scenario.ctx(),
        );

        transfer_request.approve(AWitness());
        transfer_funds::resolve(transfer_request, managed_rule);

        return_shared(vault);
        return_shared(another_vault);
    });
}

#[test, expected_failure(abort_code = ::pas::request::EInsufficientApprovals)]
fun try_to_approve_transfer_with_invalid_witness() {
    test_tx!(@0x1, |namespace, managed_rule, _unmanaged_rule, scenario| {
        let namespace_id = object::id(namespace);
        scenario.next_tx(@0x1);
        vault::create_and_share(namespace, @0x1);

        scenario.next_tx(@0x1);

        let mut vault = scenario.take_shared_by_id<Vault>(namespace
            .vault_address(
                @0x1,
            )
            .to_id());

        let auth = vault::new_auth(scenario.ctx());
        let mut transfer_request = vault.unsafe_transfer_funds<A>(
            &auth,
            @0x2,
            50,
            scenario.ctx(),
        );

        // Add an invalid approval to the request
        transfer_request.approve(BWitness());
        transfer_funds::resolve(transfer_request, managed_rule);

        abort
    });
}

#[test]
fun test_address_and_derivation_matches() {
    test_tx!(@0x1, |namespace, managed_rule, _unmanaged_rule, scenario| {
        let user_one_vault_id = namespace.vault_address(@0x1).to_id();
        let user_two_vault_id = namespace.vault_address(@0x2).to_id();

        scenario.next_tx(@0x1);
        vault::create_and_share(namespace, @0x1);
        vault::create_and_share(namespace, @0x2);

        scenario.next_tx(@0x1);

        let mut user_one_vault = scenario.take_shared_by_id<Vault>(user_one_vault_id);
        let user_two_vault = scenario.take_shared_by_id<Vault>(user_two_vault_id);

        let auth = vault::new_auth(scenario.ctx());

        let transfer_request = user_one_vault.unsafe_transfer_funds<A>(
            &auth,
            @0x2,
            50,
            scenario.ctx(),
        );

        assert_eq!(transfer_request.data().sender(), @0x1);
        assert_eq!(transfer_request.data().recipient(), @0x2);
        assert_eq!(transfer_request.data().sender_vault_id(), user_one_vault_id);
        assert_eq!(transfer_request.data().recipient_vault_id(), user_two_vault_id);
        assert_eq!(transfer_request.data().amount(), 50);

        // Both scenarios must calculate the from/to equivalent.
        let safe_request = user_one_vault.transfer_funds<A>(
            &auth,
            &user_two_vault,
            50,
            scenario.ctx(),
        );
        assert_eq!(safe_request.data().sender(), @0x1);
        assert_eq!(safe_request.data().recipient(), @0x2);
        assert_eq!(safe_request.data().sender_vault_id(), user_one_vault_id);
        assert_eq!(safe_request.data().recipient_vault_id(), user_two_vault_id);
        assert_eq!(safe_request.data().amount(), 50);

        destroy(transfer_request);
        destroy(safe_request);

        return_shared(user_one_vault);
        return_shared(user_two_vault);
    });
}

#[test]
fun unlock_funds_successfully() {
    test_tx!(@0x1, |namespace, managed_rule, _unmanaged_rule, scenario| {
        scenario.next_tx(@0x1);
        let mut vault = vault::create(namespace, @0x1);
        vault.deposit_funds(balance::create_for_testing<A>(100));

        let auth = vault::new_auth(scenario.ctx());
        let mut unlock_request = vault.unlock_funds<A>(&auth, 50, scenario.ctx());

        unlock_request.approve(AWitness());
        let balance = unlock_funds::resolve(unlock_request, managed_rule);

        assert_eq!(balance.value(), 50);

        vault.share();
        balance.send_funds(@0x10);
    });
}

#[test, expected_failure(abort_code = ::pas::unlock_funds::ECannotResolveManagedAssets)]
fun try_to_resolve_unlock_funds_request_for_managed_assets() {
    test_tx!(@0x1, |namespace, managed_rule, _unmanaged_rule, scenario| {
        scenario.next_tx(@0x1);
        let mut vault = vault::create(namespace, @0x1);
        vault.deposit_funds(balance::create_for_testing<A>(100));

        let auth = vault::new_auth(scenario.ctx());
        let unlock_request = vault.unlock_funds<A>(&auth, 50, scenario.ctx());

        let _balance = unlock_funds::resolve_unrestricted(unlock_request, namespace);

        abort
    });
}

#[test]
fun unlock_non_managed_funds() {
    test_tx!(@0x1, |namespace, managed_rule, _unmanaged_rule, scenario| {
        scenario.next_tx(@0x1);
        let mut vault = vault::create(namespace, @0x1);
        vault.deposit_funds(balance::create_for_testing<SUI>(100));

        let auth = vault::new_auth(scenario.ctx());
        let unlock_request = vault.unlock_funds<SUI>(&auth, 100, scenario.ctx());
        let balance = unlock_funds::resolve_unrestricted(unlock_request, namespace);

        balance.send_funds(@0x1);

        vault.share();
    });
}

#[test, expected_failure(abort_code = ::pas::rule::EFundManagementAlreadyEnabled)]
fun try_to_disable_clawbacks_for_managed_assets() {
    test_tx!(@0x1, |namespace, managed_rule, _unmanaged_rule, scenario| {
        scenario.next_tx(@0x1);

        // Try to disable clawbacks.
        let mut cap = sui::coin::create_treasury_cap_for_testing<A>(scenario.ctx());
        managed_rule.enable_funds_management(&mut cap, false);

        abort
    });
}

#[test, expected_failure(abort_code = ::pas::rule::EFundManagementNotEnabled)]
fun try_to_transfer_unmanaged_assets() {
    test_tx!(@0x1, |namespace, managed_rule, _unmanaged_rule, scenario| {
        scenario.next_tx(@0x1);

        // create a rule but do not enable funds management.
        let (rule, cap) = rule::new(namespace, internal::permit<ExtUSD>());

        // somehow transfer balance<ExtUSD> to vault a
        let mut vault = vault::create(namespace, @0x1);
        vault.deposit_funds(balance::create_for_testing<ExtUSD>(100));

        // Try to authorize a transfer which cannot conclude until registration is finalized.
        let auth = vault::new_auth(scenario.ctx());

        let transfer_request = vault.unsafe_transfer_funds<ExtUSD>(
            &auth,
            @0x2,
            50,
            scenario.ctx(),
        );

        transfer_funds::resolve(transfer_request, &rule);
        abort
    });
}

#[test, expected_failure(abort_code = ::pas::rule::EFundManagementNotEnabled)]
fun try_to_unlock_unmanaged_assets() {
    test_tx!(@0x1, |namespace, managed_rule, _unmanaged_rule, scenario| {
        scenario.next_tx(@0x1);

        // create a rule but do not enable funds management.
        let (rule, cap) = rule::new(namespace, internal::permit<ExtUSD>());

        // somehow transfer balance<ExtUSD> to vault a
        let mut vault = vault::create(namespace, @0x1);
        vault.deposit_funds(balance::create_for_testing<ExtUSD>(100));

        // Try to authorize a transfer which cannot conclude until registration is finalized.
        let auth = vault::new_auth(scenario.ctx());
        let unlock_request = vault.unlock_funds<ExtUSD>(
            &auth,
            50,
            scenario.ctx(),
        );

        let _balance = unlock_funds::resolve(unlock_request, &rule);

        abort
    });
}

#[test]
fun derivation_is_consistent() {
    test_tx!(@0x1, |namespace, managed_rule, _unmanaged_rule, scenario| {
        scenario.next_tx(@0x1);
        let vault = vault::create(namespace, @0x1);

        assert_eq!(namespace.vault_address(@0x1), object::id(&vault).to_address());
        assert_eq!(namespace.rule_address<A>(), object::id(managed_rule).to_address());

        vault.share();
    });
}

#[test]
fun test_unlock_request_getters() {
    test_tx!(@0x1, |namespace, managed_rule, _unmanaged_rule, scenario| {
        scenario.next_tx(@0x1);
        let mut vault = vault::create(namespace, @0x1);
        vault.deposit_funds(balance::create_for_testing<A>(100));

        let auth = vault::new_auth(scenario.ctx());

        let unlock_request = vault.unlock_funds<A>(&auth, 50, scenario.ctx());

        assert_eq!(unlock_request.data().owner(), @0x1);
        assert_eq!(unlock_request.data().vault_id(), namespace.vault_address(@0x1).to_id());
        assert_eq!(unlock_request.data().amount(), 50);

        destroy(unlock_request);
        vault.share();
    });
}

#[test, expected_failure(abort_code = ::pas::rule::ERuleAlreadyExists)]
fun try_to_create_duplicate_rule() {
    test_tx!(@0x1, |namespace, managed_rule, _unmanaged_rule, scenario| {
        scenario.next_tx(@0x1);
        let (rule, rule_cap) = rule::new(namespace, internal::permit<A>());

        abort
    });
}

public fun package_id<T>(): ID {
    sui::address::from_ascii_bytes(std::type_name::with_defining_ids<T>()
        .address_string()
        .as_bytes()).to_id()
}

public fun a_permit(): internal::Permit<A> {
    internal::permit()
}

public fun b_permit(): internal::Permit<B> {
    internal::permit()
}

public fun a_witness(): AWitness {
    AWitness()
}

public fun b_witness(): BWitness {
    BWitness()
}

/// A test_tx already set up for convenience.
public macro fun test_tx(
    $admin: address,
    $f: |
        &mut pas::namespace::Namespace,
        &mut pas::rule::Rule<A>,
        &mut pas::rule::Rule<B>,
        &mut sui::test_scenario::Scenario,
    |,
) {
    let mut scenario = sui::test_scenario::begin($admin);

    pas::namespace::init_for_testing(scenario.ctx());

    scenario.next_tx($admin);

    let mut namespace = scenario.take_shared<pas::namespace::Namespace>();

    let package_id = pas::e2e::package_id<pas::namespace::Namespace>();

    let upgrade_cap = sui::package::test_publish(package_id, scenario.ctx());
    namespace.setup(&upgrade_cap);
    sui::transfer::public_transfer(upgrade_cap, $admin);

    pas::templates::setup(&mut namespace);

    let (mut rule_a, rule_cap_a) = pas::rule::new(&mut namespace, pas::e2e::a_permit());

    let mut treasury_cap_a = sui::coin::create_treasury_cap_for_testing<A>(scenario.ctx());
    rule_a.enable_funds_management(&mut treasury_cap_a, true);
    rule_a.set_required_approval<_, AWitness>(&rule_cap_a, "transfer_funds");
    rule_a.set_required_approval<_, AWitness>(&rule_cap_a, "unlock_funds");
    rule_a.set_required_approval<_, AWitness>(&rule_cap_a, "clawback_funds");
    // rule_a.
    sui::transfer::public_transfer(rule_cap_a, $admin);
    std::unit_test::destroy(treasury_cap_a);
    rule_a.share();

    let (mut rule_b, rule_cap_b) = pas::rule::new(&mut namespace, pas::e2e::b_permit());
    let mut treasury_cap_b = sui::coin::create_treasury_cap_for_testing<B>(scenario.ctx());

    rule_b.set_required_approval<_, BWitness>(&rule_cap_b, "transfer_funds");
    rule_b.set_required_approval<_, BWitness>(&rule_cap_b, "unlock_funds");

    rule_b.enable_funds_management(&mut treasury_cap_b, false);
    std::unit_test::destroy(treasury_cap_b);
    std::unit_test::destroy(rule_cap_b);
    rule_b.share();

    scenario.next_tx($admin);

    let mut managed_rule = scenario.take_shared<pas::rule::Rule<A>>();
    let mut unmanaged_rule = scenario.take_shared<pas::rule::Rule<B>>();

    $f(
        &mut namespace,
        &mut managed_rule,
        &mut unmanaged_rule,
        &mut scenario,
    );

    scenario.next_tx($admin);

    sui::test_scenario::return_shared(namespace);
    sui::test_scenario::return_shared(managed_rule);
    sui::test_scenario::return_shared(unmanaged_rule);
    scenario.end();
}
