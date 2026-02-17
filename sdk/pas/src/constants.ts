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
	packageId: '0xcb8c93eab81b9a4f0cb48382962cdac0f16767a23ae81e5f7c4c44690afd4f2a',
	namespaceId: '0xf7cb5378eefb861af87eaa9c621e29d7f061a6f3919d241502dc1549b7718a1c',
};
