// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Example demonstrating PAS SDK usage with the SDK v2.0 $extend pattern
 */

const assetType = '0x759f65e7da0fcc5e11a03e5fe34318e9eb6a0506d4bfeb38cbfe9cd8dfcdac9c::demo_usd::DEMO_USD';
const demoAssetFaucet = '0x449ff0b882fd1d3b91edbfe38e4ffbf34648ee7d4dd248855a48d7fd80e4af6d'

import { SuiGrpcClient } from '@mysten/sui/grpc';
import { decodeSuiPrivateKey, Signer } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { pas, PASClient } from '../../pas/dist/index.mjs';
import { Transaction } from '@mysten/sui/transactions';
import { ClientWithExtensions } from '@mysten/sui/client';
import { normalizeSuiAddress } from '@mysten/sui/utils';

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


	// const balances = await getBalancesForAddress(client, sender);
	// const x2balances = await getBalancesForAddress(client, '0x2');
	// console.log('balances for sender', balances);
	// console.log('balances for 0x2', x2balances);
	// await mintFromDemoFaucetAndTransferToVault(client, 5, sender);

	const tx = new Transaction();

	tx.add(client.pas.tx.transferFunds({
		from: sender, // sender here.
		to: '0x2', // receiver here.
		amount: 1_000_000, // 1 demoUSD
		assetType
	}));

	// tx.setSender(getActiveKeypair().toSuiAddress());
	// await tx.prepareForSerialization({client});
	// const result = await client.simulateTransaction({ transaction: tx })
	// console.log('result', result);

	await signAndExecute(client, tx);
}

main();

// Queries the balances for address (both the addr balance, and the vault's balance.)
async function getBalancesForAddress(client: PasClientType, address: string) {
	const addr = normalizeSuiAddress(address);
	const [addressBalance, vaultBalance] = await Promise.all([
		client.core.getBalance({
			owner: addr,
			coinType: assetType
		}), 
		client.core.getBalance({
			owner: client.pas.deriveVaultAddress(address),
			coinType: assetType
		})
	]);

	return { addressBalance, vaultBalance };
}

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
