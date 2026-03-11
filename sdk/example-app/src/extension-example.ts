// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Example demonstrating PAS SDK usage with the SDK v2.0 $extend pattern
 */

const assetType = '0xbcd1cffae40317c7870e55c65af7fc20a8c46ce0ed1a1b24b1edf576480e2fa8::demo_usd::DEMO_USD';
const demoAssetFaucet = '0x9d1fb399a8748a6afdd687a93c4c9303e6f7787c860d5e705136f7b979a3b4d7'

import { SuiGrpcClient } from '@mysten/sui/grpc';
import { decodeSuiPrivateKey, Signer } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { pas, PASClient } from '../../pas/dist/index.mjs';
import { Transaction } from '@mysten/sui/transactions';
import { ClientWithExtensions } from '@mysten/sui/client';
import { normalizeSuiAddress } from '@mysten/sui/utils';

type PasClientType = ClientWithExtensions<{ pas: PASClient }, SuiGrpcClient>;

async function main(): Promise<void> {
	const sender = getActiveKeypair().toSuiAddress();

	const client = new SuiGrpcClient({
		network: 'devnet',
		baseUrl: 'https://fullnode.devnet.sui.io:443',
	}).$extend(pas());

	// await finalizeTestAssetSetup(client);
	// console.log(await getBalancesForAddress(client, sender));

	// await createAccountForAddress(client, sender);
	// await createAccountForAddress(client, '0x2');

	// console.log(client.pas.deriveAccountAddress(sender));
	// await mintFromDemoFaucetAndTransferToAccount(client, 10, sender);

	const tx = new Transaction();

	tx.add(client.pas.tx.sendBalance({
		from: sender, // sender here.
		to: '0x2', // receiver here.
		amount: 1_000_000, // 1 demoUSD
		assetType
	}));

	await signAndExecute(client, tx);
}

main();

// Queries the balances for address (both the addr balance, and the account's balance.)
async function getBalancesForAddress(client: PasClientType, address: string) {
	const addr = normalizeSuiAddress(address);
	const [addressBalance, accountBalance] = await Promise.all([
		client.core.getBalance({
			owner: addr,
			coinType: assetType
		}), 
		client.core.getBalance({
			owner: client.pas.deriveAccountAddress(address),
			coinType: assetType
		})
	]);

	return { addressBalance, accountBalance };
}

async function mintFromDemoFaucetAndTransferToAccount(client: PasClientType, amount: number, owner: string) { 
	const tx = new Transaction();

	const balance = tx.moveCall({
		target: `${assetType.split('::')[0]}::demo_usd::faucet_mint_balance`,
		arguments: [tx.object(demoAssetFaucet), tx.pure.u64(amount * 1_000_000)],
	});

	tx.moveCall({
		target: `0x2::balance::send_funds`,
		arguments: [balance, tx.pure.address(client.pas.deriveAccountAddress(owner))],
		typeArguments: [assetType]
	})

	await signAndExecute(client, tx);
} 

async function finalizeTestAssetSetup(client: PasClientType) { 
	const tx = new Transaction();

	tx.moveCall({
		target: assetType.split('::')[0] + '::demo_usd::setup',
		arguments: [tx.object(client.pas.getPackageConfig().namespaceId), tx.object(client.pas.deriveTemplateRegistryAddress()), tx.object(demoAssetFaucet)]
	});

	await signAndExecute(client, tx);
}

async function createAccountForAddress(client: PasClientType, address: string) {
	const tx = new Transaction();
	tx.add(client.pas.tx.accountForAddress(address));
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
