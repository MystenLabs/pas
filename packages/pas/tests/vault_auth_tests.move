#[test_only, allow(unused_variable, unused_mut_ref, dead_code)]
module pas::vault_auth_tests;

use pas::{e2e::{test_tx, A}, vault::{Self, Vault}};
use std::unit_test::{assert_eq, destroy};
use sui::test_scenario::return_shared;

#[test]
fun authenticate_with_uid() {
    test_tx!(@0x1, |namespace, managed_rule, _unmanaged_rule, scenario| {
        let namespace_id = object::id(namespace);
        scenario.next_tx(@0x1);

        // create a UID.
        let mut uid = object::new(scenario.ctx());

        let uid_address = uid.to_inner().to_address();
        vault::create_and_share(namespace, uid_address);

        scenario.next_tx(@0x1);

        let mut vault = scenario.take_shared<Vault>();

        assert_eq!(vault.owner(), uid_address);
        assert_eq!(object::id(&vault).to_address(), namespace.vault_address(uid_address));

        let auth = vault::new_auth_as_object(&mut uid);

        let transfer_request = vault.unsafe_transfer_funds<A>(
            &auth,
            @0x2,
            50,
            scenario.ctx(),
        );

        assert_eq!(transfer_request.data().sender(), uid_address);
        assert_eq!(transfer_request.data().recipient(), @0x2);
        assert_eq!(
            transfer_request.data().sender_vault_id(),
            namespace.vault_address(uid_address).to_id(),
        );
        assert_eq!(
            transfer_request.data().recipient_vault_id(),
            namespace.vault_address(@0x2).to_id(),
        );
        assert_eq!(transfer_request.data().amount(), 50);

        destroy(transfer_request);

        return_shared(vault);
        uid.delete();
    });
}

#[test, expected_failure(abort_code = ::pas::vault::ENotOwner)]
fun try_to_auth_to_another_owners_vault() {
    test_tx!(@0x1, |namespace, managed_rule, _unmanaged_rule, scenario| {
        scenario.next_tx(@0x1);
        vault::create_and_share(namespace, @0x1);

        scenario.next_tx(@0x2);

        let mut vault = scenario.take_shared_by_id<Vault>(namespace
            .vault_address(
                @0x1,
            )
            .to_id());

        let auth = vault::new_auth(scenario.ctx());

        let _transfer_request = vault.unsafe_transfer_funds<A>(
            &auth,
            @0x2,
            50,
            scenario.ctx(),
        );

        abort
    });
}

#[test, expected_failure(abort_code = ::pas::vault::EVaultAlreadyExists)]
fun try_to_create_vault_with_same_owner() {
    test_tx!(@0x1, |namespace, managed_rule, _unmanaged_rule, scenario| {
        scenario.next_tx(@0x1);
        vault::create_and_share(namespace, @0x1);
        vault::create_and_share(namespace, @0x1);
        abort
    });
}
