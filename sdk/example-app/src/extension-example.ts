// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Example demonstrating PAS SDK usage with the SDK v2.0 $extend pattern
 */

import { SuiGrpcClient } from '@mysten/sui/grpc';
import { pas } from '../../pas/dist/index.mjs';

async function main(): Promise<void> {
	console.log('🚀 PAS SDK Extension Pattern Example (SDK v2.0)\n');

	// Create a Sui client and extend it with PAS functionality
	console.log('📡 Creating Sui client and extending with PAS...');
	const client = new SuiGrpcClient({
		network: 'testnet',
		baseUrl: 'https://fullnode.testnet.sui.io:443',
	});

	// Extend the client with PAS functionality using $extend
	const extendedClient = client.$extend(
		pas({
			network: 'testnet',
		}),
	);

	console.log('✓ Client extended with PAS\n');

	// Access the PAS client through the extended client
	console.log('🔐 Accessing PAS client through extended client...');
	const config = extendedClient.pas.getPackageConfig();
	console.log('📦 Package ID:', extendedClient.pas.getSuiClient().network);
	console.log('');

	// Example with custom package configuration
	console.log('🔧 Example with custom package config:');
	const customClient = new SuiGrpcClient({
		network: 'mainnet',
		baseUrl: 'https://fullnode.mainnet.sui.io:443',
	});

	const customExtendedClient = customClient.$extend(
		pas({
			name: 'myPas',
			packageConfig: {
				packageId: '0xYOUR_CUSTOM_PACKAGE_ID',
			},
		}),
	);

	console.log('   Custom Package ID:', customExtendedClient.myPas.getPackageConfig());
	console.log('');

	console.log('✅ Extension pattern example completed!');
	console.log('\n💡 Note: This uses the SDK v2.0 $extend pattern');
	console.log('   The PAS client is now available as a property on the extended client');
}

main().catch((error) => {
	console.error('❌ Error:', error);
});
