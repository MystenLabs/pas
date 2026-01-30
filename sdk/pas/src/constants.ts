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

// TODO: Remove devnet when going live with the client.
export const DEVNET_PAS_PACKAGE_CONFIG: PASPackageConfig = {
	packageId: '0xa6ac6620d7ad4794b573f6d30570b8dee22006ddccbde2e9e3d1943b40ee0940',
	namespaceId: '0x8f73f108964b4db603602a84b6ce50c20328ad5803372bc74365d94319eb5cd2',
};
