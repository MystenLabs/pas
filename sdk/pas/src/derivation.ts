// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { bcs } from '@mysten/sui/bcs';
import { deriveDynamicFieldID, deriveObjectID, normalizeSuiAddress } from '@mysten/sui/utils';

import type { PASPackageConfig } from './types.js';

/**
 * Derives the vault address for a given owner address.
 *
 * Vaults are derived using the namespace UID and a VaultKey(owner).
 * The key structure in Move is: `VaultKey(address)`
 *
 * @param owner - The owner address (can be a user address or object address)
 * @param packageConfig - PAS package configuration
 * @returns The derived vault object ID
 */
export function deriveVaultAddress(owner: string, packageConfig: PASPackageConfig): string {
	const { packageId, namespaceId } = packageConfig;

	// Serialize the VaultKey(address) as the key
	// VaultKey is a struct with a single field: address
	const vaultKeyBcs = bcs.struct('VaultKey', {
		owner: bcs.Address,
	});

	const key = vaultKeyBcs.serialize({ owner: normalizeSuiAddress(owner) }).toBytes();

	// The type tag is the VaultKey type from the PAS package
	const typeTag = `${packageId}::keys::VaultKey`;

	return deriveObjectID(namespaceId, typeTag, key);
}

/**
 * Derives the rule address for a given asset type T.
 *
 * Rules are derived using the namespace UID and a RuleKey<T>().
 * The key structure in Move is: `RuleKey<phantom T>()`
 *
 * @param assetType - The full type of the asset (e.g., "0x2::sui::SUI")
 * @param packageConfig - PAS package configuration
 * @returns The derived rule object ID
 */
export function deriveRuleAddress(assetType: string, packageConfig: PASPackageConfig): string {
	const { packageId, namespaceId } = packageConfig;

	// RuleKey<T> is a phantom type with no fields, so the serialized key is empty
	// In BCS, an empty struct is serialized as 0 bytes
	const ruleKeyBcs = new Uint8Array([0]);

	// The type tag includes the asset type as a generic parameter
	const typeTag = `${packageId}::keys::RuleKey<${assetType}>`;
	return deriveObjectID(namespaceId, typeTag, ruleKeyBcs);
}

/**
 * Derives the templates object address for a given package configuration.
 *
 * Templates are derived using the namespace UID and a TemplateKey().
 * The key structure in Move is: `TemplateKey()`
 *
 * @param packageConfig - PAS package configuration
 * @returns The derived templates object ID
 */
export function deriveTemplateRegistryAddress(packageConfig: PASPackageConfig): string {
	const { packageId, namespaceId } = packageConfig;

	// The type tag is the TemplateKey type from the PAS package
	const typeTag = `${packageId}::keys::TemplateKey`;

	return deriveObjectID(namespaceId, typeTag, new Uint8Array([0]));
}

/**
 * Derives the dynamic field address for a template command on the Templates object.
 *
 * Templates store Commands as dynamic fields keyed by `TypeName` (the approval type's
 * `type_name::with_defining_ids` value). The DF key type is `std::type_name::TypeName`
 * which is a struct with a single `name: String` field.
 *
 * @param templatesId - The Templates object ID
 * @param approvalTypeName - The fully qualified approval type name (e.g., "0x123::demo_usd::TransferApproval")
 * @returns The derived dynamic field object ID
 */
export function deriveTemplateAddress(templatesId: string, approvalTypeName: string): string {
	// TypeName is a struct { name: String }, serialized as BCS string
	const key = bcs.string().serialize(approvalTypeName).toBytes();

	return deriveDynamicFieldID(templatesId, '0x1::type_name::TypeName', key);
}
