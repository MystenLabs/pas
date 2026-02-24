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
	packageId: '0x21a8b1be60fda387f43e184668f2148b513b007b6b42f9aaa8aa671fd792b23f',
	namespaceId: '0x8157c8b4d94aa659acf942551451bac7dee76c40c45cf81e81be0633ee1a7029',
};
