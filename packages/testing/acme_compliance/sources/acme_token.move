/// ACME_TOKEN currency type definition and creation.
module acme_compliance::acme_token;

use sui::coin_registry;

public struct ACME_TOKEN has drop {}

fun init(otw: ACME_TOKEN, ctx: &mut TxContext) {
    let (initializer, cap) = coin_registry::new_currency_with_otw(
        otw,
        6,
        b"ACME".to_string(),
        b"Acme Token".to_string(),
        b"Acme security token".to_string(),
        b"https://acme.example".to_string(),
        ctx,
    );
    let metadata = initializer.finalize(ctx);

    transfer::public_transfer(cap, ctx.sender());
    transfer::public_transfer(metadata, ctx.sender());
}
