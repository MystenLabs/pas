#[test_only, allow(unused_variable, unused_mut_ref, dead_code)]
module pas::rule_setup_tests;

use pas::{e2e::{test_tx, A}, rule::RuleCap, transfer_funds, chest};
use sui::balance;

public struct InvalidActionApproval() has drop;

public struct NewActionApproval() has drop;

#[test]
fun override_action_approval() {
    test_tx!(@0x1, |namespace, managed_rule, unmanaged_rule, scenario| {
        scenario.next_tx(@0x1);

        let rule_cap = scenario.take_from_sender<RuleCap<A>>();
        managed_rule.set_required_approval<_, NewActionApproval>(&rule_cap, "transfer_funds");

        // Do a test transfer to verify the override auth works
        {
            let mut chest = chest::create(namespace, @0x1);

            chest.deposit_funds(balance::create_for_testing<A>(100));

            let auth = chest::new_auth(scenario.ctx());
            let mut transfer_request = chest.unsafe_transfer_funds<A>(
                &auth,
                @0x2,
                50,
                scenario.ctx(),
            );
            transfer_request.approve(NewActionApproval());
            transfer_funds::resolve(transfer_request, managed_rule);

            chest.share();
        };

        scenario.return_to_sender(rule_cap);
    });
}

#[test, expected_failure(abort_code = ::pas::rule::EInvalidAction)]
fun set_invalid_action_approval() {
    test_tx!(@0x1, |namespace, managed_rule, unmanaged_rule, scenario| {
        scenario.next_tx(@0x1);

        let rule_cap = scenario.take_from_sender<RuleCap<A>>();
        managed_rule.set_required_approval<_, InvalidActionApproval>(&rule_cap, "invalid_action");

        abort
    });
}
