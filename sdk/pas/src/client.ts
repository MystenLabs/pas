// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { ClientWithCoreApi, SuiClientTypes } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

import {
	DEVNET_PAS_PACKAGE_CONFIG,
	MAINNET_PAS_PACKAGE_CONFIG,
	TESTNET_PAS_PACKAGE_CONFIG,
} from './constants.js';
import { resolve as resolveTransferFunds } from './contracts/pas/transfer_funds.js';
import {
	resolve as resolveUnlockFunds,
	resolveUnrestricted,
} from './contracts/pas/unlock_funds.js';
import * as Vault from './contracts/pas/vault.js';
import {
	deriveRuleAddress,
	deriveTemplateDFAddress,
	deriveTemplatesObjectAddress,
	deriveVaultAddress,
} from './derivation.js';
import { PASClientError, RuleNotFoundError, VaultNotFoundError } from './error.js';
import {
	addMoveCallFromCommand,
	getCommandFromTemplateDF,
	getRequiredApprovals,
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
	 * Derives the templates object address for a given package configuration.
	 *
	 * @returns The derived templates object ID
	 */
	deriveTemplatesAddress(): string {
		return deriveTemplatesObjectAddress(this.#packageConfig);
	}

	/**
	 * Derives the template DF address for a given approval type name.
	 *
	 * @param approvalTypeName - The fully qualified approval type name
	 * @returns The derived dynamic field object ID
	 */
	deriveTemplateAddress(approvalTypeName: string): string {
		return deriveTemplateDFAddress(this.deriveTemplatesAddress(), approvalTypeName);
	}

	call = {
		createVault: (owner: string) => {
			return (tx: Transaction) => {
				return Vault.create({
					package: this.#packageConfig.packageId,
					arguments: [this.#packageConfig.namespaceId, owner],
				})(tx);
			};
		},
		createAndShareVault: (owner: string) => {
			return (tx: Transaction) => {
				return Vault.createAndShare({
					package: this.#packageConfig.packageId,
					arguments: [this.#packageConfig.namespaceId, owner],
				})(tx);
			};
		},
	};

	/**
	 * Fetches the Rule object for a given asset type and extracts the required approval
	 * type names for the specified action. Then fetches the template DFs for each approval.
	 *
	 * @returns The list of parsed commands from the template DFs
	 */
	async #resolveTemplateCommands(
		ruleObject: SuiClientTypes.Object<{ content: true }>,
		actionType: PASActionType,
	) {
		const approvalTypeNames = getRequiredApprovals(ruleObject, actionType);

		if (!approvalTypeNames || approvalTypeNames.length === 0) {
			throw new PASClientError(
				`No required approvals found for action "${actionType}". The issuer has not configured this action.`,
			);
		}

		// Derive template DF addresses for each approval type
		const templateDFIds = approvalTypeNames.map((typeName) => this.deriveTemplateAddress(typeName));

		// Fetch all template DFs
		const { objects: templateDFs } = await this.#suiClient.core.getObjects({
			objectIds: templateDFIds,
			include: { content: true },
		});

		// Parse commands from each template DF
		const commands = [];
		for (let i = 0; i < approvalTypeNames.length; i++) {
			const templateDF = templateDFs[i];
			if (!templateDF || templateDF instanceof Error || !templateDF.content) {
				throw new PASClientError(
					`Template not found for approval type "${approvalTypeNames[i]}". The issuer has not set up the template command.`,
				);
			}
			commands.push(getCommandFromTemplateDF(templateDF));
		}

		return commands;
	}

	/**
	 * Methods that create transactions without executing them
	 */
	tx = {
		/**
		 * Creates a transfer funds transaction. It auto-resolves the creator's transfer function
		 * by reading the Rule's required approvals and fetching the corresponding template commands.
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
				// 1. Derive addresses
				const fromVaultId = this.deriveVaultAddress(from);
				const toVaultId = this.deriveVaultAddress(to);
				const ruleId = this.deriveRuleAddress(assetType);

				// 2. Fetch vaults and rule in a single batch call
				const { objects } = await this.#suiClient.core.getObjects({
					objectIds: [fromVaultId, toVaultId, ruleId],
					include: { content: true },
				});

				// 3. Find objects by ID
				const fromVaultResult = objects.find(
					(obj) => !(obj instanceof Error) && obj.objectId === fromVaultId,
				);
				const toVaultResult = objects.find(
					(obj) => !(obj instanceof Error) && obj.objectId === toVaultId,
				);
				const ruleResult = objects.find(
					(obj) => !(obj instanceof Error) && obj.objectId === ruleId,
				);

				if (!fromVaultResult || fromVaultResult instanceof Error || !fromVaultResult.content) {
					throw new VaultNotFoundError(from);
				}

				if (!ruleResult || ruleResult instanceof Error || !ruleResult.content) {
					throw new RuleNotFoundError(assetType);
				}

				// 4. Resolve template commands for the transfer action
				const templateCommands = await this.#resolveTemplateCommands(
					ruleResult as SuiClientTypes.Object<{ content: true }>,
					PASActionType.TransferFunds,
				);

				// 5. Check if recipient vault exists
				const toVaultExists =
					toVaultResult && !(toVaultResult instanceof Error) && toVaultResult.content !== null;

				// 6. Create auth proof from transaction sender
				const auth = Vault.newAuth({
					package: this.#packageConfig.packageId,
				})(tx);

				// 7. Create recipient vault if needed
				let toVault;
				let shouldShareVault = false;
				if (toVaultExists) {
					toVault = tx.object(toVaultId);
				} else {
					toVault = Vault.create({
						package: this.#packageConfig.packageId,
						arguments: [this.#packageConfig.namespaceId, to],
					})(tx);
					shouldShareVault = true;
				}

				// 8. Create the transfer request using vault::transfer_funds
				const transferRequest = Vault.transferFunds({
					package: this.#packageConfig.packageId,
					arguments: [tx.object(fromVaultId), auth, toVault, amount],
					typeArguments: [assetType],
				})(tx);

				// 9. Execute each template command (approval)
				for (const command of templateCommands) {
					addMoveCallFromCommand(command, {
						tx,
						senderVault: tx.object(fromVaultId),
						receiverVault: toVault,
						rule: tx.object(ruleId),
						request: transferRequest,
						systemType: assetType,
					});
				}

				// 10. Resolve the transfer request (consumes the request after all approvals)
				resolveTransferFunds({
					package: this.#packageConfig.packageId,
					arguments: [transferRequest, tx.object(ruleId)],
					typeArguments: [assetType],
				})(tx);

				// 11. Share the vault if it was just created
				if (shouldShareVault) {
					Vault.share({
						package: this.#packageConfig.packageId,
						arguments: [toVault],
					})(tx);
				}
			};
		},

		/**
		 * Creates an unlock funds transaction. It is quite likely that this won't succeed
		 * unless the issuer has specific circumstances under which they allow unlocks.
		 *
		 * @param options - Unlock options
		 * @param options.from - The sender's address (owner of the source vault)
		 * @param options.amount - The amount to unlock
		 * @param options.assetType - The full asset type (e.g., "0x2::sui::SUI")
		 * @returns An async thunk that takes a Transaction and executes the unlock
		 */
		unlockFunds: (options: { from: string; amount: number | bigint; assetType: string }) => {
			const { from, amount, assetType } = options;

			return async (tx: Transaction) => {
				// 1. Derive addresses
				const fromVaultId = this.deriveVaultAddress(from);
				const ruleId = this.deriveRuleAddress(assetType);

				// 2. Fetch vault and rule
				const { objects } = await this.#suiClient.core.getObjects({
					objectIds: [fromVaultId, ruleId],
					include: { content: true },
				});

				// 3. Find objects by ID
				const fromVaultResult = objects.find(
					(obj) => !(obj instanceof Error) && obj.objectId === fromVaultId,
				);
				const ruleResult = objects.find(
					(obj) => !(obj instanceof Error) && obj.objectId === ruleId,
				);

				if (!ruleResult || ruleResult instanceof Error || !ruleResult.content) {
					throw new PASClientError(
						`Rule does not exist for asset type ${assetType}. ` +
							`That means that the issuer has not yet enabled funds management for this asset. ` +
							`If this is a non-managed asset, you can use the unrestricted unlock flow by calling unlockUnrestrictedFunds() instead.`,
					);
				}

				if (!fromVaultResult || fromVaultResult instanceof Error || !fromVaultResult.content) {
					throw new VaultNotFoundError(from);
				}

				// 4. Resolve template commands for the unlock action
				const templateCommands = await this.#resolveTemplateCommands(
					ruleResult as SuiClientTypes.Object<{ content: true }>,
					PASActionType.UnlockFunds,
				);

				// 5. Create auth proof from transaction sender
				const auth = Vault.newAuth({
					package: this.#packageConfig.packageId,
				})(tx);

				// 6. Create the unlock request using vault::unlock_funds
				const unlockRequest = Vault.unlockFunds({
					package: this.#packageConfig.packageId,
					arguments: [tx.object(fromVaultId), auth, amount],
					typeArguments: [assetType],
				})(tx);

				// 7. Execute each template command (approval)
				for (const command of templateCommands) {
					addMoveCallFromCommand(command, {
						tx,
						senderVault: tx.object(fromVaultId),
						rule: tx.object(ruleId),
						request: unlockRequest,
						systemType: assetType,
					});
				}

				// 8. Resolve the unlock request (consumes the request after all approvals)
				return resolveUnlockFunds({
					package: this.#packageConfig.packageId,
					arguments: [unlockRequest, tx.object(ruleId)],
					typeArguments: [assetType],
				})(tx);
			};
		},

		/**
		 * Creates an unlock funds transaction for unrestricted assets.
		 * Unrestricted are assets that are not managed by the system, with this offering
		 * a way to unlock funds, when a rule does not exist.
		 *
		 * @param options - Unlock options
		 * @param options.from - The sender's address (owner of the source vault)
		 * @param options.amount - The amount to unlock
		 * @param options.assetType - The full asset type (e.g., "0x2::sui::SUI")
		 * @returns An async thunk that takes a Transaction and executes the unlock
		 */
		unlockUnrestrictedFunds: (options: {
			from: string;
			amount: number | bigint;
			assetType: string;
		}) => {
			const { from, amount, assetType } = options;

			return async (tx: Transaction) => {
				// 1. Derive addresses
				const fromVaultId = this.deriveVaultAddress(from);
				const ruleId = this.deriveRuleAddress(assetType);

				// 2. fetch objects
				const { objects } = await this.#suiClient.core.getObjects({
					objectIds: [ruleId, fromVaultId],
					include: { content: true },
				});

				// 3. Find objects by ID
				const ruleResult = objects.find(
					(obj) => !(obj instanceof Error) && obj.objectId === ruleId,
				);

				const fromVaultResult = objects.find(
					(obj) => !(obj instanceof Error) && obj.objectId === fromVaultId,
				);

				// If `from` vault does not exist, error out.
				if (!fromVaultResult || fromVaultResult instanceof Error || !fromVaultResult.content)
					throw new VaultNotFoundError(from);

				if (ruleResult) {
					throw new PASClientError(
						`A rule exists for asset type ${assetType}. That means that the issuer has enabled funds management for this asset and you can no longer use the unrestricted unlock flow.`,
					);
				}

				const auth = Vault.newAuth({
					package: this.#packageConfig.packageId,
				})(tx);

				// 4. Create the unlock request using vault::unlock_funds
				const unlockRequest = Vault.unlockFunds({
					package: this.#packageConfig.packageId,
					arguments: [tx.object(fromVaultId), auth, amount],
					typeArguments: [assetType],
				})(tx);

				return resolveUnrestricted({
					package: this.#packageConfig.packageId,
					arguments: [unlockRequest, this.#packageConfig.namespaceId],
					typeArguments: [assetType],
				})(tx);
			};
		},
	};
}
