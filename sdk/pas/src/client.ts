// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { ClientWithCoreApi } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

import {
	DEVNET_PAS_PACKAGE_CONFIG,
	MAINNET_PAS_PACKAGE_CONFIG,
	TESTNET_PAS_PACKAGE_CONFIG,
} from './constants.js';
import * as Vault from './contracts/pas/vault.js';
import { deriveRuleAddress, deriveVaultAddress } from './derivation.js';
import { PASClientError } from './error.js';
import {
	buildActionTypeName,
	buildPTBFromCommand,
	fetchRule,
	getCommandFromRule,
	PASActionType,
} from './resolution.js';
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

	/**
	 * Derives the vault address for a given owner address.
	 *
	 * @param owner - The owner address (can be a user address or object address)
	 * @returns The derived vault object ID
	 */
	deriveVaultAddress(owner: string): string {
		return deriveVaultAddress(owner, this.#packageConfig);
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
	 * Methods that create transactions without executing them
	 */
	tx = {
		/**
		 * Creates a transfer funds transaction.
		 *
		 * This follows the PAS transfer flow:
		 * 1. Creates an Auth proof from the transaction sender
		 * 2. Ensures recipient vault exists (creates if needed)
		 * 3. Creates a TransferFundsRequest by calling vault::transfer_funds
		 * 4. Fetches the Rule for the asset type
		 * 5. Resolves the Command for TransferFunds action from the Rule
		 * 6. Builds and executes the PTB from the Command
		 *
		 * @param options - Transfer options
		 * @param options.from - The sender's address (owner of the source vault)
		 * @param options.to - The receiver's address (owner of the destination vault)
		 * @param options.amount - The amount to transfer
		 * @param options.assetType - The full asset type (e.g., "0x2::sui::SUI")
		 * @returns An async thunk that takes a Transaction and executes the transfer
		 */
		transferFunds: (options: {
			from: string;
			to: string;
			amount: number | bigint;
			assetType: string;
		}) => {
			const { from, to, amount, assetType } = options;

			return async (tx: Transaction) => {
				// 1. Create auth proof from transaction sender
				const auth = Vault.newAuth({
					package: this.#packageConfig.packageId,
				})(tx);

				// 2. Derive vault addresses
				const fromVaultId = this.deriveVaultAddress(from);
				const toVaultId = this.deriveVaultAddress(to);

				// 3. Check if recipient vault exists, create if needed
				let toVault;
				let shouldShareVault = false;
				try {
					await this.#suiClient.core.getObject({
						objectId: toVaultId,
						include: { content: true },
					});
					// Vault exists, use the derived address
					toVault = tx.object(toVaultId);
				} catch {
					// Vault doesn't exist, create it
					toVault = Vault.create({
						package: this.#packageConfig.packageId,
						arguments: [this.#packageConfig.namespaceId, to],
					})(tx);
					shouldShareVault = true;
				}

				// 4. Create the transfer request using vault::transfer_funds
				const transferRequest = Vault.transferFunds({
					package: this.#packageConfig.packageId,
					arguments: [tx.object(fromVaultId), auth, toVault, amount],
					typeArguments: [assetType],
				})(tx);

				// 5. Fetch the rule
				const ruleId = this.deriveRuleAddress(assetType);
				const rule = await fetchRule(this.#suiClient, ruleId);

				// 6. Get the command for TransferFunds action
				const actionTypeName = buildActionTypeName(
					PASActionType.TransferFunds,
					assetType,
					this.#packageConfig,
				);
				const command = getCommandFromRule(rule, actionTypeName);

				if (!command) {
					throw new PASClientError(
						`No command found for TransferFunds action in Rule for ${assetType}`,
					);
				}

				// 7. Build the PTB from the command
				const result = buildPTBFromCommand(command, {
					tx,
					senderVault: tx.object(fromVaultId),
					receiverVault: toVault,
					rule: tx.object(ruleId),
					request: transferRequest,
					systemType: assetType,
				});

				// 8. Share the vault if it was just created
				if (shouldShareVault) {
					Vault.share({
						package: this.#packageConfig.packageId,
						arguments: [toVault],
					})(tx);
				}

				return result;
			};
		},
	};
}
