#[test_only, allow(unused_variable, unused_mut_ref, dead_code)]
module pas::chest_auth_tests;

use pas::{chest::{Self, Chest}, e2e::{test_tx, A}};
use std::unit_test::{assert_eq, destroy};
use sui::test_scenario::return_shared;

#[test]
fun authenticate_with_uid() {
    test_tx!(@0x1, |namespace, managed_policy, _unmanaged_policy, scenario| {
        let namespace_id = object::id(namespace);
        scenario.next_tx(@0x1);

        // create a UID.
        let mut uid = object::new(scenario.ctx());

        let uid_address = uid.to_inner().to_address();
        chest::create_and_share(namespace, uid_address);

        scenario.next_tx(@0x1);

        let mut chest = scenario.take_shared<Chest>();

        assert_eq!(chest.owner(), uid_address);
        assert_eq!(object::id(&chest).to_address(), namespace.chest_address(uid_address));

        let auth = chest::new_auth_as_object(&mut uid);

        let transfer_request = chest.unsafe_transfer_funds<A>(
            &auth,
            @0x2,
            50,
            scenario.ctx(),
        );

        assert_eq!(transfer_request.data().sender(), uid_address);
        assert_eq!(transfer_request.data().recipient(), @0x2);
        assert_eq!(
            transfer_request.data().sender_chest_id(),
            namespace.chest_address(uid_address).to_id(),
        );
        assert_eq!(
            transfer_request.data().recipient_chest_id(),
            namespace.chest_address(@0x2).to_id(),
        );
        assert_eq!(transfer_request.data().amount(), 50);

        destroy(transfer_request);

        return_shared(chest);
        uid.delete();
    });
}

#[test, expected_failure(abort_code = ::pas::chest::ENotOwner)]
fun try_to_auth_to_another_owners_chest() {
    test_tx!(@0x1, |namespace, managed_policy, _unmanaged_policy, scenario| {
        scenario.next_tx(@0x1);
        chest::create_and_share(namespace, @0x1);

        scenario.next_tx(@0x2);

        let mut chest = scenario.take_shared_by_id<Chest>(namespace
            .chest_address(
                @0x1,
            )
            .to_id());

        let auth = chest::new_auth(scenario.ctx());

        let _transfer_request = chest.unsafe_transfer_funds<A>(
            &auth,
            @0x2,
            50,
            scenario.ctx(),
        );

        abort
    });
}

#[test, expected_failure(abort_code = ::pas::chest::ENotOwner)]
fun try_to_auth_to_another_uid_chest() {
    test_tx!(@0x1, |namespace, managed_policy, _unmanaged_policy, scenario| {
        scenario.next_tx(@0x1);
        let mut chest = chest::create(namespace, @0x1);

        let mut uid = object::new(scenario.ctx());

        let auth = chest::new_auth_as_object(&mut uid);

        let transfer_request = chest.unlock_funds<A>(
            &auth,
            50,
            scenario.ctx(),
        );

        abort
    });
}

#[test, expected_failure(abort_code = ::pas::chest::EChestAlreadyExists)]
fun try_to_create_chest_with_same_owner() {
    test_tx!(@0x1, |namespace, managed_policy, _unmanaged_policy, scenario| {
        scenario.next_tx(@0x1);
        chest::create_and_share(namespace, @0x1);
        chest::create_and_share(namespace, @0x1);
        abort
    });
}
