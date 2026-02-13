#[test_only, allow(unused_variable, unused_mut_ref, dead_code)]
module pas::clawback_tests;

use pas::{clawback_funds_request, e2e::{test_tx, a_witness, A, b_witness, B}, vault};
use std::unit_test::assert_eq;
use sui::balance;

#[test]
fun clawback_managed_assets() {
    test_tx!(@0x1, |namespace, managed_rule, _unmanaged_rule, scenario| {
        scenario.next_tx(@0x1);
        let mut vault = vault::create(namespace, @0x1);
        vault.deposit_funds(balance::create_for_testing<A>(100));

        let mut clawback_request = vault.clawback_funds<A>(50, scenario.ctx());
        clawback_request.approve(a_witness());

        let balance = clawback_funds_request::resolve(clawback_request, managed_rule);

        assert_eq!(balance.value(), 50);

        vault.share();

        balance.send_funds(@0x10);
    });
}

#[test, expected_failure(abort_code = ::pas::clawback_funds_request::EClawbackNotAllowed)]
fun try_to_clawback_unmanaged_assets() {
    test_tx!(@0x1, |namespace, _managed_rule, unmanaged_rule, scenario| {
        scenario.next_tx(@0x1);
        let mut vault = vault::create(namespace, @0x1);
        vault.deposit_funds(balance::create_for_testing<B>(100));

        let mut clawback_request = vault.clawback_funds<B>(50, scenario.ctx());
        clawback_request.approve(b_witness());

        let _balance = clawback_funds_request::resolve(clawback_request, unmanaged_rule);

        abort
    });
}
