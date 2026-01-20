// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Example demonstrating PAS SDK usage with the SDK v2.0 $extend pattern
 */

const assetType = '0x49ed5cdd7e8b784c077b1bb21bc947b824c8597f454410f39e258db4cdf90fb1::demo_usd::DEMO_USD';

import { SuiGrpcClient } from '@mysten/sui/grpc';
import { pas } from '../../pas/dist/index.mjs';

async function main(): Promise<void> {
	const client = new SuiGrpcClient({
		network: 'devnet',
		baseUrl: 'https://fullnode.testnet.sui.io:443',
	}).$extend(pas());

	const ruleId = client.pas.deriveRuleAddress(assetType);

	console.log('Rule ID:', ruleId);
}

main().catch((error) => {
	console.error('❌ Error:', error);
});
