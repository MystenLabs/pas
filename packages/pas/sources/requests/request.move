module pas::request;

use std::type_name::{Self, TypeName};
use sui::vec_set::{Self, VecSet};

#[error(code = 0)]
const EInsufficientApprovals: vector<u8> =
    b"Cannot resolve request: insufficient approvals received.";

/// A base request type.
/// Examples:
/// `Request<TransferFunds<T>>`
/// `Request<UnlockFunds<T>>`
public struct Request<K> {
    /// The collected approvals for this request
    approvals: VecSet<TypeName>,
    data: K,
}

/// Adds an approval to a request. Can be called to resolve rules
public fun approve<K, U: drop>(request: &mut Request<K>, _approval: U) {
    request.approvals.insert(type_name::with_defining_ids<U>());
}

public fun data<K>(request: &Request<K>): &K {
    &request.data
}

public(package) fun new<K>(data: K): Request<K> {
    Request {
        approvals: vec_set::empty(),
        data,
    }
}

/// An internal function to resolve a request.
public(package) fun resolve<K>(request: Request<K>, required_approvals: VecSet<TypeName>): K {
    required_approvals.keys().do_ref!(|approval| {
        assert!(request.approvals.contains(approval), EInsufficientApprovals);
    });
    let Request { data, .. } = request;
    data
}
