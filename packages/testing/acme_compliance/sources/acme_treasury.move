/// Treasury operations for ACME_TOKEN.
///
/// Handles minting (deposit into Chest) and burning (clawback from Chest),
/// enforcing the same compliance rules as transfers: accreditation and
/// holding limits.
module acme_compliance::acme_treasury;

use acme_compliance::acme_compliance::{
    Self,
    InvestorRegistry,
    RegistryCap,
    TransferApproval,
    ClawbackApproval
};
use acme_compliance::acme_token::ACME_TOKEN;
use pas::chest::Chest;
use pas::clawback_funds::{Self, ClawbackFunds};
use pas::namespace::Namespace;
use pas::policy::{Self, Policy};
use pas::request::Request;
use pas::templates::Templates;
use ptb::ptb;
use std::type_name;
use sui::balance::Balance;
use sui::coin::TreasuryCap;

// ==== Setup ====

/// One-time setup: PAS policy + compliance template + holding limits.
/// Call after publishing (TreasuryCap is created in `acme_token::init`).
#[allow(lint(self_transfer), unused_mut_parameter)]
entry fun setup(
    namespace: &mut Namespace,
    templates: &mut Templates,
    registry: &mut InvestorRegistry,
    treasury_cap: &mut TreasuryCap<ACME_TOKEN>,
    registry_cap: &RegistryCap,
    ctx: &mut TxContext,
) {
    // 1. Create policy with clawback enabled
    let (mut policy, policy_cap) = policy::new_for_currency(
        namespace,
        treasury_cap,
        true, // clawback allowed (for burn)
    );

    // 2. Set required approvals per action
    policy.set_required_approval<_, TransferApproval>(&policy_cap, "send_funds");
    policy.set_required_approval<_, ClawbackApproval>(&policy_cap, "clawback_funds");

    // 3. Register template so the SDK can auto-construct approve_transfer calls
    let type_name = type_name::with_defining_ids<ACME_TOKEN>();

    let cmd = ptb::move_call(
        type_name.address_string().to_string(),
        "acme_compliance",
        "approve_transfer",
        vector[ptb::ext_input("pas:request"), ptb::object_by_type<InvestorRegistry>()],
        vector[(*type_name.as_string()).to_string()],
    );

    templates.set_template_command(acme_compliance::transfer_approval_permit(), cmd);

    policy.share();
    transfer::public_transfer(policy_cap, ctx.sender());

    // 4. Configure holding limits: min 100 tokens, max 1M tokens (6 decimals)
    registry.set_holding_limits(registry_cap, 100_000_000, 1_000_000_000_000);
}

// ==== Mint & Burn ====

/// Mint tokens and deposit into an investor's Chest.
entry fun mint(
    registry: &mut InvestorRegistry,
    to_chest: &Chest,
    cap: &mut TreasuryCap<ACME_TOKEN>,
    registry_cap: &RegistryCap,
    amount: u64,
) {
    registry.validate_mint(registry_cap, to_chest.owner(), amount);
    to_chest.deposit_balance(cap.mint_balance(amount));
}

/// Burn tokens from an investor's Chest via clawback.
entry fun burn(
    registry: &mut InvestorRegistry,
    policy: &Policy<Balance<ACME_TOKEN>>,
    cap: &mut TreasuryCap<ACME_TOKEN>,
    mut request: Request<ClawbackFunds<Balance<ACME_TOKEN>>>,
    ctx: &mut TxContext,
) {
    registry.approve_clawback(&mut request);
    let balance = clawback_funds::resolve(request, policy);
    cap.burn(balance.into_coin(ctx));
}
