module pas::keys;

use std::string::String;
use sui::vec_set::{Self, VecSet};

/// Key for deriving `Rule<T>` from the namespace
public struct RuleKey<phantom T>() has copy, drop, store;

/// Key for deriving `Vault` from the namespace
public struct VaultKey(address) has copy, drop, store;

/// Key for deriving `Templates` from the namespace
public struct TemplateKey() has copy, drop, store;

/// WARNING: these should only be used internally.
public(package) fun rule_key<T>(): RuleKey<T> { RuleKey<T>() }

public(package) fun vault_key(owner: address): VaultKey { VaultKey(owner) }

public(package) fun template_key(): TemplateKey { TemplateKey() }

const TRANSFER_FUNDS_ACTION_TYPE: vector<u8> = b"transfer_funds";
const UNLOCK_FUNDS_ACTION_TYPE: vector<u8> = b"unlock_funds";
const CLAWBACK_FUNDS_ACTION_TYPE: vector<u8> = b"clawback_funds";

public fun transfer_funds_action(): String { TRANSFER_FUNDS_ACTION_TYPE.to_string() }

public fun unlock_funds_action(): String { UNLOCK_FUNDS_ACTION_TYPE.to_string() }

public fun clawback_funds_action(): String { CLAWBACK_FUNDS_ACTION_TYPE.to_string() }

public fun actions(): VecSet<String> {
    vec_set::from_keys(vector[
        TRANSFER_FUNDS_ACTION_TYPE.to_string(),
        UNLOCK_FUNDS_ACTION_TYPE.to_string(),
        CLAWBACK_FUNDS_ACTION_TYPE.to_string(),
    ])
}

public fun is_valid_action(action: String): bool {
    actions().contains(&action)
}
