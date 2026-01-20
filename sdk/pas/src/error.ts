// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Base error class for PAS client errors
 */
export class PASClientError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PASClientError';
	}
}

/**
 * Thrown when a permission check fails
 */
export class PermissionDeniedError extends PASClientError {
	constructor(message: string) {
		super(message);
		this.name = 'PermissionDeniedError';
	}
}

/**
 * Thrown when an asset is not found
 */
export class AssetNotFoundError extends PASClientError {
	constructor(message: string) {
		super(message);
		this.name = 'AssetNotFoundError';
	}
}

/**
 * Thrown when an invalid configuration is provided
 */
export class InvalidConfigError extends PASClientError {
	constructor(message: string) {
		super(message);
		this.name = 'InvalidConfigError';
	}
}
