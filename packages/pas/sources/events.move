module pas::events;

use sui::event;

public struct FundsSent<phantom T> has copy, drop, store {
    from: address,
    to: address,
    amount: u64,
}

public struct FundsClawback<phantom T> has copy, drop, store {
    owner: address,
    amount: u64,
}

public struct FundsUnlocked<phantom T> has copy, drop, store {
    owner: address,
    amount: u64,
}

public(package) fun emit_funds_sent<T>(from: address, to: address, amount: u64) {
    event::emit(FundsSent<T> { from, to, amount });
}

public(package) fun emit_funds_clawback<T>(owner: address, amount: u64) {
    event::emit(FundsClawback<T> { owner, amount });
}

public(package) fun emit_funds_unlocked<T>(owner: address, amount: u64) {
    event::emit(FundsUnlocked<T> { owner, amount });
}
