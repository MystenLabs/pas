/// Example: Securities compliance with PAS.
///
/// Demonstrates two common compliance rules for tokenized securities:
/// 1. Accredited investor checks (both sender and recipient must be accredited)
/// 2. Holding limits (min/max balance per investor)
///
/// Balance tracking is maintained internally because PAS stores balances inside
/// Chests using Sui's address balances, which the compliance contract cannot
/// read directly during approval.
module acme_compliance::acme_compliance;

use pas::clawback_funds::ClawbackFunds;
use pas::request::Request;
use pas::send_funds::SendFunds;
use sui::balance::Balance;
use sui::table::Table;
use acme_compliance::acme_token::ACME_TOKEN;

// ==== Error Codes ====

#[error]
const ENotWhitelisted: vector<u8> = b"Address is not in the investor registry";
#[error]
const ENotAccredited: vector<u8> = b"Investor is not accredited";
#[error]
const EBelowMinBalance: vector<u8> = b"Balance would fall below minimum holding requirement";
#[error]
const EAboveMaxBalance: vector<u8> = b"Balance would exceed maximum holding limit";

// ==== Witness ====

/// Witness stamp for approved transfers.
public struct TransferApproval() has drop;

/// Witness stamp for approved clawbacks (burn).
public struct ClawbackApproval() has drop;

// ==== Structs ====

/// On-chain registry of investor status and balances.
public struct InvestorRegistry has key {
    id: UID,
    investors: Table<address, InvestorProfile>,
    /// Minimum balance per investor (0 = no minimum)
    min_balance: u64,
    /// Maximum balance per investor (0 = no maximum)
    max_balance: u64,
}

public struct InvestorProfile has drop, store {
    accredited: bool,
    balance: u64,
}

/// Admin capability for managing the registry
public struct RegistryCap has key, store { id: UID }

// ==== Init ====

fun init(ctx: &mut TxContext) {
    transfer::share_object(InvestorRegistry {
        id: object::new(ctx),
        investors: sui::table::new(ctx),
        min_balance: 0,
        max_balance: 0,
    });
    transfer::transfer(RegistryCap { id: object::new(ctx) }, ctx.sender());
}

// ==== Approval Functions ====

/// Validates accreditation and holding limits for both parties,
/// updates internal balance tracking, then stamps the request.
public fun approve_transfer(
    registry: &mut InvestorRegistry,
    request: &mut Request<SendFunds<Balance<ACME_TOKEN>>>,
) {
    let sender = request.data().sender();
    let recipient = request.data().recipient();
    let amount = request.data().funds().value();

    assert_eligible(registry, sender);
    assert_eligible(registry, recipient);

    // Check sender's remaining balance meets minimum (if non-zero after transfer)
    let sender_balance_after = registry.investors.borrow(sender).balance - amount;
    if (sender_balance_after > 0 && registry.min_balance > 0) {
        assert!(sender_balance_after >= registry.min_balance, EBelowMinBalance);
    };

    // Check recipient's new balance within limits
    let recipient_balance_after = registry.investors.borrow(recipient).balance + amount;
    assert_within_limits(registry, recipient_balance_after);

    // Update internal balance tracking
    registry.investors.borrow_mut(sender).balance = sender_balance_after;
    registry.investors.borrow_mut(recipient).balance = recipient_balance_after;

    request.approve(TransferApproval());
}

/// Validates accreditation and holding limits for a clawback,
/// updates internal balance tracking, then stamps the request.
public(package) fun approve_clawback(
    registry: &mut InvestorRegistry,
    request: &mut Request<ClawbackFunds<Balance<ACME_TOKEN>>>,
) {
    let investor = request.data().owner();
    let amount = request.data().funds().value();

    assert_eligible(registry, investor);

    // Allow burning to zero, otherwise check minimum
    let new_balance = registry.investors.borrow(investor).balance - amount;
    if (new_balance > 0 && registry.min_balance > 0) {
        assert!(new_balance >= registry.min_balance, EBelowMinBalance);
    };

    registry.investors.borrow_mut(investor).balance = new_balance;
    request.approve(ClawbackApproval());
}

/// Validates accreditation and holding limits for minting,
/// updates internal balance tracking.
public(package) fun validate_mint(
    registry: &mut InvestorRegistry,
    _cap: &RegistryCap,
    investor: address,
    amount: u64,
) {
    assert_eligible(registry, investor);

    let new_balance = registry.investors.borrow(investor).balance + amount;
    assert_within_limits(registry, new_balance);

    registry.investors.borrow_mut(investor).balance = new_balance;
}

// ==== Permits ====

/// Permit for TransferApproval (only this module can create it).
public(package) fun transfer_approval_permit(): internal::Permit<TransferApproval> {
    internal::permit()
}

/// Permit for ClawbackApproval (only this module can create it).
public(package) fun clawback_approval_permit(): internal::Permit<ClawbackApproval> {
    internal::permit()
}

// ==== Admin ====

/// Register or update an investor's accreditation status.
public fun set_investor(
    registry: &mut InvestorRegistry,
    _cap: &RegistryCap,
    investor: address,
    accredited: bool,
) {
    if (registry.investors.contains(investor)) {
        registry.investors.borrow_mut(investor).accredited = accredited;
    } else {
        registry
            .investors
            .add(
                investor,
                InvestorProfile {
                    accredited,
                    balance: 0,
                },
            );
    }
}

/// Configure holding limits.
public fun set_holding_limits(
    registry: &mut InvestorRegistry,
    _cap: &RegistryCap,
    min_balance: u64,
    max_balance: u64,
) {
    registry.min_balance = min_balance;
    registry.max_balance = max_balance;
}

// ==== Internal ====

/// Assert investor is registered and accredited.
fun assert_eligible(registry: &InvestorRegistry, investor: address) {
    assert!(registry.investors.contains(investor), ENotWhitelisted);
    assert!(registry.investors.borrow(investor).accredited, ENotAccredited);
}

/// Assert balance is within configured min/max limits.
fun assert_within_limits(registry: &InvestorRegistry, balance: u64) {
    if (registry.min_balance > 0) {
        assert!(balance >= registry.min_balance, EBelowMinBalance);
    };
    if (registry.max_balance > 0) {
        assert!(balance <= registry.max_balance, EAboveMaxBalance);
    };
}
