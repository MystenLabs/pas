// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Example demonstrating PAS SDK usage with the SDK v2.0 $extend pattern
 */

const assetType = '0xeeea26aaa151e42e3b4aaab336f59d0bb391885070602144fbb6726280560bb9::demo_usd::DEMO_USD';
const demoAssetFaucet = '0x89e525b0e4ae9cc36549e3dcc6ad04b5545c27e13f0124928e4964638a726233'

import { SuiGrpcClient } from '@mysten/sui/grpc';
import { decodeSuiPrivateKey, Signer } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { pas, PASClient } from '../../pas/dist/index.mjs';
import { Transaction } from '@mysten/sui/transactions';
import { ClientWithExtensions } from '@mysten/sui/client';

type PasClientType = ClientWithExtensions<{ pas: PASClient }, SuiGrpcClient>;

async function main(): Promise<void> {
	const client = new SuiGrpcClient({
		network: 'devnet',
		baseUrl: 'https://fullnode.devnet.sui.io:443',
	}).$extend(pas());

	// Create vault for address
	// await createVaultForAddress(client, '0x2');
	// await finalizeTestAssetSetup(client);
	const sender = getActiveKeypair().toSuiAddress();

	// const senderVault = client.pas.deriveVaultAddress(sender);
	// console.log('senderVault', senderVault);

	// const balance = await client.core.getBalance({
	// 	owner: senderVault,
	// 	coinType: assetType
	// });
	// console.log('balance', balance);
	// await mintFromDemoFaucetAndTransferToVault(client, 5, sender);
	const tx = new Transaction();

	tx.add(client.pas.tx.transferFunds({
		from: sender, // sender here.
		to: '0x2', // receiver here.
		amount: 1_000_000, // 1 demoUSD
		assetType
	}));

	await signAndExecute(client, tx);
}

main().catch((error) => {
	console.error('❌ Error:', error);
});

async function mintFromDemoFaucetAndTransferToVault(client: PasClientType, amount: number, owner: string) { 
	const tx = new Transaction();

	const balance = tx.moveCall({
		target: `${assetType.split('::')[0]}::demo_usd::faucet_mint_balance`,
		arguments: [tx.object(demoAssetFaucet), tx.pure.u64(amount * 1_000_000)],
	});

	tx.moveCall({
		target: `0x2::balance::send_funds`,
		arguments: [balance, tx.pure.address(client.pas.deriveVaultAddress(owner))],
		typeArguments: [assetType]
	})

	await signAndExecute(client, tx);
} 

async function finalizeTestAssetSetup(client: PasClientType) { 
	const tx = new Transaction();

	tx.moveCall({
		target: assetType.split('::')[0] + '::demo_usd::setup',
		arguments: [tx.object(client.pas.getPackageConfig().namespaceId)]
	});

	await signAndExecute(client, tx);
}

async function createVaultForAddress(client: PasClientType, address: string) {
	const tx = new Transaction();
	tx.add(client.pas.call.createAndShareVault(address));
	return signAndExecute(client, tx);
}

async function signAndExecute(client: SuiGrpcClient, tx: Transaction) {
	const result = await client.signAndExecuteTransaction({
		transaction: tx,
		signer: getActiveKeypair(),
		include: {
			effects: true,
		}
	});

	console.dir(result, { depth: null });
	return result
}


function getActiveKeypair() {
	// @ts-ignore
	const env = process.env.PRIVATE_KEY;

	if (!env) throw new Error('Missing PRIVATE_KEY environment variable. This has to be a sui private key `suiprivkey...`');
	

	const keypair = decodeSuiPrivateKey(env);
	return Ed25519Keypair.fromSecretKey(keypair.secretKey);
}


// Helper to load an ENV key so we can run some TXs (resolve actually!)
