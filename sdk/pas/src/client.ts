// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { ClientWithCoreApi } from '@mysten/sui/client';

import {
	DEVNET_PAS_PACKAGE_CONFIG,
	MAINNET_PAS_PACKAGE_CONFIG,
	TESTNET_PAS_PACKAGE_CONFIG,
} from './constants.js';
import {
	deriveChestAddress,
	deriveRuleAddress,
	deriveTemplateAddress,
	deriveTemplateRegistryAddress,
} from './derivation.js';
import { PASClientError } from './error.js';
import {
	chestForAddressIntent,
	transferFundsIntent,
	unlockFundsIntent,
	unlockUnrestrictedFundsIntent,
} from './intents.js';
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
			if (
				network !== 'mainnet' &&
				network !== 'testnet' &&
				network !== 'devnet' &&
				!packageConfig
			) {
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

	/**
	 * Derives the chest address for a given owner address.
	 *
	 * @param owner - The owner address (can be a user address or object address)
	 * @returns The derived chest object ID
	 */
	deriveChestAddress(owner: string): string {
		return deriveChestAddress(owner, this.#packageConfig);
	}

	/**
	 * Derives the rule address for a given asset type T.
	 *
	 * @param assetType - The full type of the asset (e.g., "0x2::sui::SUI")
	 * @returns The derived rule object ID
	 */
	deriveRuleAddress(assetType: string): string {
		return deriveRuleAddress(assetType, this.#packageConfig);
	}

	/**
	 * Derives the templates object address for a given package configuration.
	 *
	 * @returns The derived templates object ID
	 */
	deriveTemplateRegistryAddress(): string {
		return deriveTemplateRegistryAddress(this.#packageConfig);
	}

	/**
	 * Derives the template DF address for a given approval type name.
	 *
	 * @param approvalTypeName - The fully qualified approval type name
	 * @returns The derived dynamic field object ID
	 */
	deriveTemplateAddress(approvalTypeName: string): string {
		return deriveTemplateAddress(this.deriveTemplateRegistryAddress(), approvalTypeName);
	}

	/**
	 * Intent-based transaction builders. Each method returns a synchronous closure
	 * that registers a `$Intent` placeholder in the transaction. The actual PTB commands
	 * are resolved lazily at `tx.build()` time via the shared PAS resolver plugin.
	 */
	get tx() {
		return {
			/**
			 * Creates a transfer funds intent. At build time, it auto-resolves the issuer's
			 * approval template commands by reading the Rule and Templates objects on-chain.
			 * If the recipient chest does not exist, it will be created and shared automatically.
			 *
			 * @param options - Transfer options
			 * @param options.from - The sender's address (owner of the source chest)
			 * @param options.to - The receiver's address (owner of the destination chest)
			 * @param options.amount - The amount to transfer
			 * @param options.assetType - The full asset type (e.g., "0x2::sui::SUI")
			 * @returns A sync closure `(tx: Transaction) => TransactionResult`
			 */
			transferFunds: transferFundsIntent(this.#packageConfig),

			/**
			 * Creates an unlock funds intent. At build time, it resolves the issuer's
			 * approval template commands. This will fail if the issuer has not configured
			 * unlock approvals for the asset type.
			 *
			 * @param options - Unlock options
			 * @param options.from - The sender's address (owner of the source chest)
			 * @param options.amount - The amount to unlock
			 * @param options.assetType - The full asset type (e.g., "0x2::sui::SUI")
			 * @returns A sync closure `(tx: Transaction) => TransactionResult`
			 */
			unlockFunds: unlockFundsIntent(this.#packageConfig),

			/**
			 * Creates an unlock funds intent for unrestricted (non-managed) assets.
			 * Use this when no Rule exists for the asset type (e.g., SUI).
			 *
			 * @param options - Unlock options
			 * @param options.from - The sender's address (owner of the source chest)
			 * @param options.amount - The amount to unlock
			 * @param options.assetType - The full asset type (e.g., "0x2::sui::SUI")
			 * @returns A sync closure `(tx: Transaction) => TransactionResult`
			 */
			unlockUnrestrictedFunds: unlockUnrestrictedFundsIntent(this.#packageConfig),

			/**
			 * Returns a chest object for the given address. At build time, if the chest
			 * already exists on-chain it resolves to an object reference; otherwise it
			 * creates the chest and shares it.
			 *
			 * @param owner - The owner address
			 * @returns A sync closure `(tx: Transaction) => TransactionResult` (the chest)
			 */
			chestForAddress: chestForAddressIntent(this.#packageConfig),
		};
	}
}
