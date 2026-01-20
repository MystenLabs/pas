// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { PASPackageConfig } from './types.js';

export const TESTNET_PAS_PACKAGE_CONFIG: PASPackageConfig = {
	packageId: '0x0', // TODO: Replace with actual testnet package ID
	namespaceId: '0x0', // TODO: Replace with actual testnet namespace ID
};

export const MAINNET_PAS_PACKAGE_CONFIG: PASPackageConfig = {
	packageId: '0x0', // TODO: Replace with actual mainnet package ID
	namespaceId: '0x0', // TODO: Replace with actual mainnet namespace ID
};

export const DEVNET_PAS_PACKAGE_CONFIG: PASPackageConfig = {
	packageId: '0xfd38b6939ca071af351c861226d507787080f1f218d097a895d007abcc671966', // TODO: Replace with actual devnet package ID
	namespaceId: '0xf514e5619e53d79e8f04651dfd4b0602266e1891f4fc83b93a08186cca570803', // TODO: Replace with actual devnet namespace ID
};
