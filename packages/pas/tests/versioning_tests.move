#[test_only, allow(unused_variable, unused_mut_ref, dead_code)]
module pas::versioning_tests;

use pas::{
    e2e::{package_id, test_tx, A},
    namespace::{Self, Namespace},
    vault,
    versioning::breaking_version
};
use ptb::ptb::Command;
use std::unit_test::assert_eq;
use sui::{package::UpgradeCap, test_scenario::Scenario};

#[test, expected_failure(abort_code = ::pas::namespace::EUpgradeCapAlreadySet)]
fun tries_to_setup_namespace_twice() {
    let mut scenario = sui::test_scenario::begin(@0x0);
    namespace::init_for_testing(scenario.ctx());
    scenario.next_tx(@0x0);

    let mut namespace = scenario.take_shared<Namespace>();

    let package_id = package_id<Namespace>();

    let upgrade_cap = sui::package::test_publish(package_id, scenario.ctx());
    namespace.setup(&upgrade_cap);
    namespace.setup(&upgrade_cap);

    abort
}

#[test, expected_failure(abort_code = ::pas::namespace::EUpgradeCapPackageMismatch)]
fun tries_to_setup_namespace_with_invalid_upgrade_cap() {
    let mut scenario = sui::test_scenario::begin(@0x0);
    namespace::init_for_testing(scenario.ctx());
    scenario.next_tx(@0x0);

    let mut namespace = scenario.take_shared<Namespace>();

    // create the upgrade cap from a type coming from a dependency.
    let package_id = package_id<Command>();

    let upgrade_cap = sui::package::test_publish(package_id, scenario.ctx());
    namespace.setup(&upgrade_cap);

    abort
}

#[test, expected_failure(abort_code = ::pas::namespace::EUpgradeCapPackageMismatch)]
fun tries_to_block_version_with_invalid_upgrade_cap() {
    test_tx!(@0x1, |namespace, managed_rule, _unmanaged_rule, scenario| {
        scenario.next_tx(@0x1);

        let upgrade_cap = sui::package::test_publish(package_id<Command>(), scenario.ctx());
        namespace.block_version(&upgrade_cap, 1);

        abort
    });
}

#[test, expected_failure(abort_code = ::pas::namespace::EUpgradeCapPackageMismatch)]
fun tries_to_unblock_version_with_invalid_upgrade_cap() {
    test_tx!(@0x1, |namespace, managed_rule, _unmanaged_rule, scenario| {
        scenario.next_tx(@0x1);

        let upgrade_cap = sui::package::test_publish(package_id<Command>(), scenario.ctx());
        namespace.unblock_version(&upgrade_cap, 1);

        abort
    });
}

#[test]
fun block_unblock_versions_and_sync_with_vaults_and_rules() {
    test_tx!(@0x1, |namespace, managed_rule, _unmanaged_rule, scenario| {
        scenario.next_tx(@0x1);
        let upgrade_cap = scenario.take_from_sender<UpgradeCap>();

        let mut vault = vault::create(namespace, @0x1);

        namespace.block_version(&upgrade_cap, 1);
        assert!(!namespace.versioning().is_valid_version(1));
        vault.sync_versioning(namespace);
        managed_rule.sync_versioning(namespace);
        assert_eq!(vault.versioning(), namespace.versioning());
        assert!(!vault.versioning().is_valid_version(1));
        assert!(!managed_rule.versioning().is_valid_version(1));

        namespace.unblock_version(&upgrade_cap, 1);
        vault.sync_versioning(namespace);
        managed_rule.sync_versioning(namespace);
        assert!(namespace.versioning().is_valid_version(1));
        assert!(vault.versioning().is_valid_version(1));
        assert!(managed_rule.versioning().is_valid_version(1));

        vault.share();
        scenario.return_to_sender(upgrade_cap);
    });
}

#[test, expected_failure(abort_code = ::pas::versioning::EInvalidVersion)]
fun try_to_create_vault_with_invalid_version() {
    test_tx!(@0x1, |namespace, managed_rule, _unmanaged_rule, scenario| {
        namespace.block_current_version(scenario);

        let _vault = vault::create(namespace, @0x1);
        abort
    });
}

#[test, expected_failure(abort_code = ::pas::versioning::EInvalidVersion)]
fun try_unlock_funds_invalid_version_on_vault() {
    test_tx!(@0x1, |namespace, managed_rule, _unmanaged_rule, scenario| {
        let mut vault = vault::create(namespace, @0x1);

        namespace.block_current_version(scenario);
        vault.sync_versioning(namespace);
        let auth = vault::new_auth(scenario.ctx());
        let req = vault.unlock_funds<A>(&auth, 50, scenario.ctx());
        abort
    });
}

use fun block_current_version as Namespace.block_current_version;

fun block_current_version(namespace: &mut Namespace, scenario: &Scenario) {
    let upgrade_cap = scenario.take_from_sender<UpgradeCap>();
    namespace.block_version(&upgrade_cap, breaking_version!());
    scenario.return_to_sender(upgrade_cap);
}
