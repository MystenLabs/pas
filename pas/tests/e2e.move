#[test_only, allow(unused_variable, unused_mut_ref, dead_code)]
module pas::e2e;

use pas::vault::{Self, Vault};
use sui::{balance::{Self, send_funds}, test_scenario::return_shared};

public struct MANAGED has drop {}
public struct UNMANAGED has drop {}

public struct ManagedWitness() has drop;
public struct UnmanagedWitness() has drop;

#[test]
fun e2e() {
    test_tx!(@0x1, |namespace, managed_rule, unmanaged_rule, scenario| {
        scenario.next_tx(@0x1);

        // create vaults of 0x1 and 0x2
        let vault = vault::create(namespace, @0x1);
        let another_vault = vault::create(namespace, @0x2);

        // transfer some funds to both 0x1 and 0x2
        managed_rule.mint(&vault, 100, ManagedWitness());

        balance::send_funds(
            balance::create_for_testing<UNMANAGED>(50),
            vault::vault_address(namespace, @0x2),
        );

        vault.share();
        another_vault.share();

        scenario.next_tx(@0x1);

        let mut vault = scenario.take_shared_by_id<Vault>(vault::vault_address(
            namespace,
            @0x1,
        ).to_id());
        let another_vault = scenario.take_shared_by_id<Vault>(vault::vault_address(
            namespace,
            @0x2,
        ).to_id());

        let auth = vault::new_auth(scenario.ctx());
        let transfer_request = vault.transfer<MANAGED>(&auth, &another_vault, 50, scenario.ctx());

        // Stamp the request (authorized action)
        managed_rule.resolve_transfer(transfer_request, ManagedWitness());

        return_shared(vault);
        return_shared(another_vault);
    });
}

#[test, expected_failure(abort_code = ::pas::rule::EInvalidProof)]
fun try_to_approve_transfer_with_invalid_witness() {
    test_tx!(@0x1, |namespace, managed_rule, _unmanaged_rule, scenario| {
        scenario.next_tx(@0x1);
        vault::create_and_share(namespace, @0x1);

        scenario.next_tx(@0x1);

        let mut vault = scenario.take_shared_by_id<Vault>(vault::vault_address(
            namespace,
            @0x1,
        ).to_id());

        let auth = vault::new_auth(scenario.ctx());
        let transfer_request = vault.unsafe_transfer<MANAGED>(
            &auth,
            namespace,
            @0x2,
            50,
            scenario.ctx(),
        );

        // Stamp the request (authorized action)
        managed_rule.resolve_transfer(transfer_request, UnmanagedWitness());
        abort
    });
}

#[test, expected_failure(abort_code = ::pas::vault::ENotOwner)]
fun try_to_auth_to_another_owners_vault() {
    test_tx!(@0x1, |namespace, managed_rule, _unmanaged_rule, scenario| {
        scenario.next_tx(@0x1);
        vault::create_and_share(namespace, @0x1);

        scenario.next_tx(@0x2);

        let mut vault = scenario.take_shared_by_id<Vault>(vault::vault_address(
            namespace,
            @0x1,
        ).to_id());

        let auth = vault::new_auth(scenario.ctx());

        let transfer_request = vault.unsafe_transfer<MANAGED>(
            &auth,
            namespace,
            @0x2,
            50,
            scenario.ctx(),
        );

        abort
    });
}


/// A test_tx already set up for convenience.
public macro fun test_tx(
    $admin: address,
    $f: |
        &mut pas::namespace::Namespace,
        &mut pas::rule::Rule<MANAGED>,
        &mut pas::rule::Rule<UNMANAGED>,
        &mut sui::test_scenario::Scenario,
    |,
) {
    let mut scenario = sui::test_scenario::begin($admin);

    pas::namespace::init_for_testing(scenario.ctx());

    scenario.next_tx($admin);

    let mut namespace = scenario.take_shared<pas::namespace::Namespace>();

    let managed_treasury_cap = sui::coin::create_treasury_cap_for_testing<MANAGED>(scenario.ctx());
    let unmanaged_treasury_cap = sui::coin::create_treasury_cap_for_testing<
        UNMANAGED,
    >(scenario.ctx());

    pas::rule::new_managed_treasury(
        &mut namespace,
        managed_treasury_cap,
        true,
        ManagedWitness(),
    );

    pas::rule::new(
        &mut namespace,
        &unmanaged_treasury_cap,
        false,
        UnmanagedWitness(),
    );

    scenario.next_tx($admin);

    let mut managed_rule = scenario.take_shared<pas::rule::Rule<MANAGED>>();
    let mut unmanaged_rule = scenario.take_shared<pas::rule::Rule<UNMANAGED>>();

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
    std::unit_test::destroy(unmanaged_treasury_cap);
    scenario.end();
}
