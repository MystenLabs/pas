#[test_only, allow(unused_variable, unused_mut_ref, dead_code)]
module pas::e2e;

use pas::{chest::{Self, Chest}, policy::{Self, PolicyCap}, transfer_funds, unlock_funds};
use std::{type_name, unit_test::{assert_eq, destroy}};
use sui::{balance::{Self, send_funds}, sui::SUI, test_scenario::return_shared, vec_set};

public struct A has drop {}
public struct B has drop {}
public struct ExtUSD has drop {}

public struct AWitness() has drop;
public struct BWitness() has drop;

#[test]
fun e2e() {
    test_tx!(@0x1, |namespace, managed_policy, unmanaged_policy, scenario| {
        scenario.next_tx(@0x1);

        let namespace_id = object::id(namespace);

        // create chests of 0x1 and 0x2
        let chest = chest::create(namespace, @0x1);
        let another_chest = chest::create(namespace, @0x2);

        // transfer some funds to both 0x1 and 0x2
        chest.deposit_funds(balance::create_for_testing<A>(100));

        balance::create_for_testing<B>(50).send_funds(namespace.chest_address(@0x2));

        chest.share();
        another_chest.share();

        scenario.next_tx(@0x1);

        let mut chest = scenario.take_shared_by_id<Chest>(namespace
            .chest_address(
                @0x1,
            )
            .to_id());
        let another_chest = scenario.take_shared_by_id<Chest>(namespace
            .chest_address(@0x2)
            .to_id());

        let auth = chest::new_auth(scenario.ctx());
        let mut transfer_request = chest.transfer_funds<A>(
            &auth,
            &another_chest,
            50,
            scenario.ctx(),
        );

        transfer_request.approve(AWitness());
        transfer_funds::resolve(transfer_request, managed_policy);

        return_shared(chest);
        return_shared(another_chest);
    });
}

#[test, expected_failure(abort_code = ::pas::request::EInsufficientApprovals)]
fun try_to_approve_transfer_with_invalid_witness() {
    test_tx!(@0x1, |namespace, managed_policy, _unmanaged_policy, scenario| {
        let namespace_id = object::id(namespace);
        scenario.next_tx(@0x1);
        chest::create_and_share(namespace, @0x1);

        scenario.next_tx(@0x1);

        let mut chest = scenario.take_shared_by_id<Chest>(namespace
            .chest_address(
                @0x1,
            )
            .to_id());

        let auth = chest::new_auth(scenario.ctx());
        let mut transfer_request = chest.unsafe_transfer_funds<A>(
            &auth,
            @0x2,
            50,
            scenario.ctx(),
        );

        // Add an invalid approval to the request
        transfer_request.approve(BWitness());
        transfer_funds::resolve(transfer_request, managed_policy);

        abort
    });
}

#[test]
fun test_address_and_derivation_matches() {
    test_tx!(@0x1, |namespace, managed_policy, _unmanaged_policy, scenario| {
        let user_one_chest_id = namespace.chest_address(@0x1).to_id();
        let user_two_chest_id = namespace.chest_address(@0x2).to_id();

        scenario.next_tx(@0x1);
        chest::create_and_share(namespace, @0x1);
        chest::create_and_share(namespace, @0x2);

        scenario.next_tx(@0x1);

        let mut user_one_chest = scenario.take_shared_by_id<Chest>(user_one_chest_id);
        let user_two_chest = scenario.take_shared_by_id<Chest>(user_two_chest_id);

        let auth = chest::new_auth(scenario.ctx());

        let transfer_request = user_one_chest.unsafe_transfer_funds<A>(
            &auth,
            @0x2,
            50,
            scenario.ctx(),
        );

        assert_eq!(transfer_request.data().sender(), @0x1);
        assert_eq!(transfer_request.data().recipient(), @0x2);
        assert_eq!(transfer_request.data().sender_chest_id(), user_one_chest_id);
        assert_eq!(transfer_request.data().recipient_chest_id(), user_two_chest_id);
        assert_eq!(transfer_request.data().amount(), 50);

        // Both scenarios must calculate the from/to equivalent.
        let safe_request = user_one_chest.transfer_funds<A>(
            &auth,
            &user_two_chest,
            50,
            scenario.ctx(),
        );
        assert_eq!(safe_request.data().sender(), @0x1);
        assert_eq!(safe_request.data().recipient(), @0x2);
        assert_eq!(safe_request.data().sender_chest_id(), user_one_chest_id);
        assert_eq!(safe_request.data().recipient_chest_id(), user_two_chest_id);
        assert_eq!(safe_request.data().amount(), 50);

        destroy(transfer_request);
        destroy(safe_request);

        return_shared(user_one_chest);
        return_shared(user_two_chest);
    });
}

#[test]
fun unlock_funds_successfully() {
    test_tx!(@0x1, |namespace, managed_policy, _unmanaged_policy, scenario| {
        scenario.next_tx(@0x1);
        let mut chest = chest::create(namespace, @0x1);
        chest.deposit_funds(balance::create_for_testing<A>(100));

        let auth = chest::new_auth(scenario.ctx());
        let mut unlock_request = chest.unlock_funds<A>(&auth, 50, scenario.ctx());

        unlock_request.approve(AWitness());
        let balance = unlock_funds::resolve(unlock_request, managed_policy);

        assert_eq!(balance.value(), 50);

        chest.share();
        balance.send_funds(@0x10);
    });
}

#[test, expected_failure(abort_code = ::pas::unlock_funds::ECannotResolveManagedAssets)]
fun try_to_resolve_unlock_funds_request_for_managed_assets() {
    test_tx!(@0x1, |namespace, managed_policy, _unmanaged_policy, scenario| {
        scenario.next_tx(@0x1);
        let mut chest = chest::create(namespace, @0x1);
        chest.deposit_funds(balance::create_for_testing<A>(100));

        let auth = chest::new_auth(scenario.ctx());
        let unlock_request = chest.unlock_funds<A>(&auth, 50, scenario.ctx());

        let _balance = unlock_funds::resolve_unrestricted(unlock_request, namespace);

        abort
    });
}

#[test]
fun unlock_non_managed_funds() {
    test_tx!(@0x1, |namespace, managed_policy, _unmanaged_policy, scenario| {
        scenario.next_tx(@0x1);
        let mut chest = chest::create(namespace, @0x1);
        chest.deposit_funds(balance::create_for_testing<SUI>(100));

        let auth = chest::new_auth(scenario.ctx());
        let unlock_request = chest.unlock_funds<SUI>(&auth, 100, scenario.ctx());
        let balance = unlock_funds::resolve_unrestricted(unlock_request, namespace);

        balance.send_funds(@0x1);

        chest.share();
    });
}

#[test, expected_failure(abort_code = ::pas::policy::EFundManagementAlreadyEnabled)]
fun try_to_disable_clawbacks_for_managed_assets() {
    test_tx!(@0x1, |namespace, managed_policy, _unmanaged_policy, scenario| {
        scenario.next_tx(@0x1);

        // Try to disable clawbacks.
        let mut cap = sui::coin::create_treasury_cap_for_testing<A>(scenario.ctx());
        managed_policy.enable_funds_management(&mut cap, false);

        abort
    });
}

#[test, expected_failure(abort_code = ::pas::policy::EFundManagementNotEnabled)]
fun try_to_transfer_unmanaged_assets() {
    test_tx!(@0x1, |namespace, managed_policy, _unmanaged_policy, scenario| {
        scenario.next_tx(@0x1);

        // create a policy but do not enable funds management.
        let (policy, cap) = policy::new(namespace, internal::permit<ExtUSD>());

        // somehow transfer balance<ExtUSD> to chest a
        let mut chest = chest::create(namespace, @0x1);
        chest.deposit_funds(balance::create_for_testing<ExtUSD>(100));

        // Try to authorize a transfer which cannot conclude until registration is finalized.
        let auth = chest::new_auth(scenario.ctx());

        let transfer_request = chest.unsafe_transfer_funds<ExtUSD>(
            &auth,
            @0x2,
            50,
            scenario.ctx(),
        );

        transfer_funds::resolve(transfer_request, &policy);
        abort
    });
}

#[test, expected_failure(abort_code = ::pas::policy::EFundManagementNotEnabled)]
fun try_to_unlock_unmanaged_assets() {
    test_tx!(@0x1, |namespace, managed_policy, _unmanaged_policy, scenario| {
        scenario.next_tx(@0x1);

        // create a policy but do not enable funds management.
        let (policy, cap) = policy::new(namespace, internal::permit<ExtUSD>());

        // somehow transfer balance<ExtUSD> to chest a
        let mut chest = chest::create(namespace, @0x1);
        chest.deposit_funds(balance::create_for_testing<ExtUSD>(100));

        // Try to authorize a transfer which cannot conclude until registration is finalized.
        let auth = chest::new_auth(scenario.ctx());
        let unlock_request = chest.unlock_funds<ExtUSD>(
            &auth,
            50,
            scenario.ctx(),
        );

        let _balance = unlock_funds::resolve(unlock_request, &policy);

        abort
    });
}

#[test]
fun derivation_is_consistent() {
    test_tx!(@0x1, |namespace, managed_policy, _unmanaged_policy, scenario| {
        scenario.next_tx(@0x1);
        let chest = chest::create(namespace, @0x1);

        assert_eq!(namespace.chest_address(@0x1), object::id(&chest).to_address());
        assert_eq!(namespace.policy_address<A>(), object::id(managed_policy).to_address());

        chest.share();
    });
}

#[test]
fun test_unlock_request_getters() {
    test_tx!(@0x1, |namespace, managed_policy, _unmanaged_policy, scenario| {
        scenario.next_tx(@0x1);
        let mut chest = chest::create(namespace, @0x1);
        chest.deposit_funds(balance::create_for_testing<A>(100));

        let auth = chest::new_auth(scenario.ctx());

        let unlock_request = chest.unlock_funds<A>(&auth, 50, scenario.ctx());

        assert_eq!(unlock_request.data().owner(), @0x1);
        assert_eq!(unlock_request.data().chest_id(), namespace.chest_address(@0x1).to_id());
        assert_eq!(unlock_request.data().amount(), 50);

        destroy(unlock_request);
        chest.share();
    });
}

#[test, expected_failure(abort_code = ::pas::policy::EPolicyAlreadyExists)]
fun try_to_create_duplicate_policy() {
    test_tx!(@0x1, |namespace, managed_policy, _unmanaged_policy, scenario| {
        scenario.next_tx(@0x1);
        let (policy, policy_cap) = policy::new(namespace, internal::permit<A>());

        abort
    });
}

#[test]
fun multiple_approvals_required() {
    test_tx!(@0x1, |namespace, managed_policy, unmanaged_policy, scenario| {
        scenario.next_tx(@0x1);

        let namespace_id = object::id(namespace);
        let policy_cap = scenario.take_from_sender<PolicyCap<A>>();

        let mut approvals = vec_set::empty();
        approvals.insert(type_name::with_defining_ids<AWitness>());
        approvals.insert(type_name::with_defining_ids<BWitness>());

        managed_policy.set_required_approvals(&policy_cap, "transfer_funds", approvals);

        scenario.return_to_sender(policy_cap);

        // create chests of 0x1 and 0x2
        let chest = chest::create(namespace, @0x1);

        // transfer some funds to both 0x1 and 0x2
        chest.deposit_funds(balance::create_for_testing<A>(100));
        chest.share();

        scenario.next_tx(@0x1);

        let mut chest = scenario.take_shared_by_id<Chest>(namespace
            .chest_address(
                @0x1,
            )
            .to_id());

        let auth = chest::new_auth(scenario.ctx());
        let mut transfer_request = chest.unsafe_transfer_funds<A>(
            &auth,
            @0x2,
            50,
            scenario.ctx(),
        );

        transfer_request.approve(AWitness());
        transfer_request.approve(BWitness());
        transfer_funds::resolve(transfer_request, managed_policy);

        return_shared(chest);
    });
}

#[test, expected_failure(abort_code = ::pas::request::EInsufficientApprovals)]
fun multiple_approvals_invalid_order_failure() {
    test_tx!(@0x1, |namespace, managed_policy, unmanaged_policy, scenario| {
        scenario.next_tx(@0x1);

        let namespace_id = object::id(namespace);
        let policy_cap = scenario.take_from_sender<PolicyCap<A>>();

        let mut approvals = vec_set::empty();
        approvals.insert(type_name::with_defining_ids<AWitness>());
        approvals.insert(type_name::with_defining_ids<BWitness>());

        managed_policy.set_required_approvals(&policy_cap, "transfer_funds", approvals);

        scenario.return_to_sender(policy_cap);

        // create chests of 0x1 and 0x2
        let chest = chest::create(namespace, @0x1);

        // transfer some funds to both 0x1 and 0x2
        chest.deposit_funds(balance::create_for_testing<A>(100));
        chest.share();

        scenario.next_tx(@0x1);

        let mut chest = scenario.take_shared_by_id<Chest>(namespace
            .chest_address(
                @0x1,
            )
            .to_id());

        let auth = chest::new_auth(scenario.ctx());
        let mut transfer_request = chest.unsafe_transfer_funds<A>(
            &auth,
            @0x2,
            50,
            scenario.ctx(),
        );
        transfer_request.approve(BWitness());
        transfer_request.approve(AWitness());

        transfer_funds::resolve(transfer_request, managed_policy);
        abort
    });
}

#[test, expected_failure(abort_code = ::pas::request::EInvalidNumberOfApprovals)]
fun cannot_have_extra_approvals() {
    test_tx!(@0x1, |namespace, managed_policy, unmanaged_policy, scenario| {
        scenario.next_tx(@0x1);

        let namespace_id = object::id(namespace);

        // create chests of 0x1 and 0x2
        let chest = chest::create(namespace, @0x1);

        // transfer some funds to both 0x1 and 0x2
        chest.deposit_funds(balance::create_for_testing<A>(100));
        chest.share();

        scenario.next_tx(@0x1);

        let mut chest = scenario.take_shared_by_id<Chest>(namespace
            .chest_address(
                @0x1,
            )
            .to_id());

        let auth = chest::new_auth(scenario.ctx());
        let mut transfer_request = chest.unsafe_transfer_funds<A>(
            &auth,
            @0x2,
            50,
            scenario.ctx(),
        );
        transfer_request.approve(BWitness());
        transfer_request.approve(AWitness());

        transfer_funds::resolve(transfer_request, managed_policy);
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
        &mut pas::policy::Policy<A>,
        &mut pas::policy::Policy<B>,
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

    let (mut policy_a, policy_cap_a) = pas::policy::new(&mut namespace, pas::e2e::a_permit());

    let mut treasury_cap_a = sui::coin::create_treasury_cap_for_testing<A>(scenario.ctx());
    policy_a.enable_funds_management(&mut treasury_cap_a, true);
    policy_a.set_required_approval<_, AWitness>(&policy_cap_a, "transfer_funds");
    policy_a.set_required_approval<_, AWitness>(&policy_cap_a, "unlock_funds");
    policy_a.set_required_approval<_, AWitness>(&policy_cap_a, "clawback_funds");
    // policy_a.
    sui::transfer::public_transfer(policy_cap_a, $admin);
    std::unit_test::destroy(treasury_cap_a);
    policy_a.share();

    let (mut policy_b, policy_cap_b) = pas::policy::new(&mut namespace, pas::e2e::b_permit());
    let mut treasury_cap_b = sui::coin::create_treasury_cap_for_testing<B>(scenario.ctx());

    policy_b.set_required_approval<_, BWitness>(&policy_cap_b, "transfer_funds");
    policy_b.set_required_approval<_, BWitness>(&policy_cap_b, "unlock_funds");

    policy_b.enable_funds_management(&mut treasury_cap_b, false);
    std::unit_test::destroy(treasury_cap_b);
    std::unit_test::destroy(policy_cap_b);
    policy_b.share();

    scenario.next_tx($admin);

    let mut managed_policy = scenario.take_shared<pas::policy::Policy<A>>();
    let mut unmanaged_policy = scenario.take_shared<pas::policy::Policy<B>>();

    $f(
        &mut namespace,
        &mut managed_policy,
        &mut unmanaged_policy,
        &mut scenario,
    );

    scenario.next_tx($admin);

    sui::test_scenario::return_shared(namespace);
    sui::test_scenario::return_shared(managed_policy);
    sui::test_scenario::return_shared(unmanaged_policy);
    scenario.end();
}
