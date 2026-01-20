// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { ClientWithCoreApi } from '@mysten/sui/client';

import {
	DEVNET_PAS_PACKAGE_CONFIG,
	MAINNET_PAS_PACKAGE_CONFIG,
	TESTNET_PAS_PACKAGE_CONFIG,
} from './constants.js';
import { PASClientError } from './error.js';
import type { PASClientConfig, PASOptions, PASPackageConfig } from './types.js';

export function pas<const Name extends string = 'pas'>({
	packageConfig,
	name = 'pas' as Name,
	...options
}: PASOptions<Name> = {}): {
	name: Name;
	register: (client: ClientWithCoreApi) => PASClient;
} {
	return {
		name,
		register: (client: ClientWithCoreApi): PASClient => {
			const network = client.network;

			// TODO: This should only be mainnet,testnet. We use devnet as there's no testnet addr balances temporarily.
			if (network !== 'mainnet' && network !== 'testnet' && network !== 'devnet') {
				throw new PASClientError('PAS client only supports mainnet, testnet and devnet');
			}

			return new PASClient(
				packageConfig
					? {
							packageConfig,
							suiClient: client,
							...options,
						}
					: {
							suiClient: client,
							...options,
						},
			);
		},
	};
}

export class PASClient {
	#packageConfig: PASPackageConfig;
	#suiClient: ClientWithCoreApi;

	constructor(config: PASClientConfig) {
		const network = config.suiClient.network;
		if (network && !config.packageConfig) {
			switch (network) {
				case 'testnet':
					this.#packageConfig = TESTNET_PAS_PACKAGE_CONFIG;
					break;
				case 'mainnet':
					this.#packageConfig = MAINNET_PAS_PACKAGE_CONFIG;
					break;
				case 'devnet':
					this.#packageConfig = DEVNET_PAS_PACKAGE_CONFIG;
					break;
				default:
					throw new PASClientError(`Unsupported network: ${network}`);
			}
		} else {
			this.#packageConfig = config.packageConfig!;
		}

		this.#suiClient = config.suiClient;
	}

	/**
	 * Get the package configuration
	 */
	getPackageConfig() {
		return this.#packageConfig;
	}

	/**
	 * Get the Sui client instance
	 */
	getSuiClient(): ClientWithCoreApi {
		return this.#suiClient;
	}

	// TODO: Add PAS-specific methods here
	// Example methods you might want to implement:
	// - createPermissionedAsset()
	// - grantPermission()
	// - revokePermission()
	// - transferPermissionedAsset()
	// - checkPermission()
}
