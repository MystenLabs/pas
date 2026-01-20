// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { SuiClient } from '@mysten/sui/client';

import { PASClient } from '../src/index.js';

/**
 * Basic example showing how to initialize and use the PAS client
 */
async function main() {
	// Create a Sui client
	const suiClient = new SuiClient({ url: 'https://fullnode.testnet.sui.io' });

	// Create a PAS client
	const pasClient = new PASClient({
		suiClient,
		network: 'testnet',
	});

	// Get the package configuration
	const config = pasClient.getPackageConfig();
	console.log('PAS Package ID:', config.packageId);

	// TODO: Add more examples as the SDK develops
	// - Creating permissioned assets
	// - Granting permissions
	// - Revoking permissions
	// - Transferring permissioned assets
	// - Checking permissions
}

main().catch(console.error);
