import { Transaction } from '@mysten/sui/transactions';
import { normalizeStructTag, normalizeSuiAddress } from '@mysten/sui/utils';
import { describe, expect, it } from 'vitest';

import { DemoUsdTestHelpers } from './demoUsd.ts';
import { setupToolbox, simulateFailingTransaction, type TestToolbox } from './setup.ts';

async function expectBalances(
	toolbox: TestToolbox,
	expected: { vault: string; asset: string; amount: number }[],
) {
	const balances = await Promise.all(
		expected.map(({ vault, asset }) => toolbox.getBalance(vault, asset)),
	);
	for (let i = 0; i < expected.length; i++) {
		expect(Number(balances[i].balance.balance)).toBe(expected[i].amount * 1_000_000);
	}
}

describe.concurrent(
	'e2e tests with isolated PAS Package (each test runs in its own PAS package)',
	() => {
		it('unlocks non-managed funds (e.g. SUI), but only through the unrestricted unlock flow', async () => {
			const toolbox = await setupToolbox();
			const vaultId = toolbox.client.pas.deriveVaultAddress(toolbox.address());

			const suiTypeName = normalizeStructTag('0x2::sui::SUI').toString();

			const { balance } = await toolbox.getBalance(vaultId, suiTypeName);
			expect(Number(balance.balance)).toBe(0);

			// Transfer 1 SUI to the vault.
			const fundTransferTx = new Transaction();
			const sui = fundTransferTx.splitCoins(fundTransferTx.gas, [
				fundTransferTx.pure.u64(1_000_000_000),
			]);

			const into_balance = fundTransferTx.moveCall({
				target: '0x2::coin::into_balance',
				arguments: [sui],
				typeArguments: [suiTypeName],
			});
			fundTransferTx.moveCall({
				target: '0x2::balance::send_funds',
				arguments: [into_balance, fundTransferTx.pure.address(vaultId)],
				typeArguments: [suiTypeName],
			});
			await toolbox.executeTransaction(fundTransferTx);

			// Create the vault for the address.
			await toolbox.createVaultForAddress(toolbox.address());

			const { balance: vaultBalanceAfterTransfer } = await toolbox.getBalance(vaultId, suiTypeName);
			expect(Number(vaultBalanceAfterTransfer.balance)).toBe(1_000_000_000);

			// try to do an unlock but it should fail because `rule` for Sui does not exist.
			const tx = new Transaction();
			tx.add(
				toolbox.client.pas.tx.unlockFunds({
					from: toolbox.address(),
					amount: 1_000_000_000,
					assetType: suiTypeName,
				}),
			);
			// Should fail because SUI is not a managed asset
			await expect(toolbox.executeTransaction(tx)).rejects.toThrowError(
				'Rule does not exist for asset type ',
			);

			// Now let's unlock funds properly.
			const unlockTx = new Transaction();
			const withdrawal = unlockTx.add(
				toolbox.client.pas.tx.unlockUnrestrictedFunds({
					from: toolbox.address(),
					amount: 1_000_000_000,
					assetType: suiTypeName,
				}),
			);
			unlockTx.moveCall({
				target: '0x2::balance::send_funds',
				arguments: [withdrawal, unlockTx.pure.address(toolbox.address())],
				typeArguments: [suiTypeName],
			});

			await toolbox.executeTransaction(unlockTx);

			const { balance: vaultBalanceAfterUnlock } = await toolbox.getBalance(vaultId, suiTypeName);
			expect(Number(vaultBalanceAfterUnlock.balance)).toBe(0);
		});

		it('Should be able to transfer between vaults, going through the rule of the issuer;', async () => {
			const toolbox = await setupToolbox();
			const demoUsd = new DemoUsdTestHelpers(toolbox);
			await demoUsd.createRule();

			const from = toolbox.address();
			const to = normalizeSuiAddress('0x2');

			const fromVaultId = toolbox.client.pas.deriveVaultAddress(from);
			const toVaultId = toolbox.client.pas.deriveVaultAddress(to);

			await toolbox.createVaultForAddress(from);
			await toolbox.createVaultForAddress(to);

			await demoUsd.mintFromFaucetInto(100, fromVaultId);

			const [{ balance: fromBalanceBefore }, { balance: toBalanceBefore }] = await Promise.all([
				toolbox.getBalance(fromVaultId, demoUsd.demoUsdAssetType),
				toolbox.getBalance(toVaultId, demoUsd.demoUsdAssetType),
			]);

			expect(Number(fromBalanceBefore.balance)).toBe(100 * 1_000_000);
			expect(Number(toBalanceBefore.balance)).toBe(0);

			const tx = new Transaction();
			tx.add(
				toolbox.client.pas.tx.transferFunds({
					from,
					to,
					amount: 100 * 1_000_000,
					assetType: demoUsd.demoUsdAssetType,
				}),
			);

			await toolbox.executeTransaction(tx);

			const [{ balance: fromBalanceAfter }, { balance: toBalanceAfter }] = await Promise.all([
				toolbox.getBalance(fromVaultId, demoUsd.demoUsdAssetType),
				toolbox.getBalance(toVaultId, demoUsd.demoUsdAssetType),
			]);

			expect(Number(fromBalanceAfter.balance)).toBe(0);
			expect(Number(toBalanceAfter.balance)).toBe(100 * 1_000_000);
		});

		it('Should be able to create the recipient vault if it does not exist ahead of time', async () => {
			const toolbox = await setupToolbox();
			const demoUsd = new DemoUsdTestHelpers(toolbox);
			await demoUsd.createRule();

			const from = toolbox.address();
			const to = normalizeSuiAddress('0x2');

			const fromVaultId = toolbox.client.pas.deriveVaultAddress(from);
			const toVaultId = toolbox.client.pas.deriveVaultAddress(to);

			await demoUsd.mintFromFaucetInto(100, fromVaultId);
			await toolbox.createVaultForAddress(from);

			await expect(
				toolbox.client.core.getObject({
					objectId: toVaultId,
				}),
			).rejects.toThrowError('not found');

			const transaction = new Transaction();
			transaction.add(
				toolbox.client.pas.tx.transferFunds({
					from,
					to,
					amount: 1_000_000,
					assetType: demoUsd.demoUsdAssetType,
				}),
			);

			await toolbox.executeTransaction(transaction);

			// Object should now exist after the first transfer.
			const responseAfter = await toolbox.client.core.getObject({
				objectId: toVaultId,
			});

			expect(responseAfter.object).toBeDefined();
		});

		it('Should deduplicate vault creation when multiple intents reference the same non-existent vaults', async () => {
			const toolbox = await setupToolbox();
			const demoUsd = new DemoUsdTestHelpers(toolbox);
			await demoUsd.createRule();

			// Sender is the test keypair (required for Auth), receiver is fresh.
			const sender = toolbox.address();
			const receiver = normalizeSuiAddress('0xB2');

			const senderVaultId = toolbox.client.pas.deriveVaultAddress(sender);
			const receiverVaultId = toolbox.client.pas.deriveVaultAddress(receiver);

			// Verify neither vault exists.
			await expect(toolbox.client.core.getObject({ objectId: senderVaultId })).rejects.toThrowError(
				'not found',
			);
			await expect(
				toolbox.client.core.getObject({ objectId: receiverVaultId }),
			).rejects.toThrowError('not found');

			// Mint funds directly into the sender vault's address (balance::send_funds
			// works even before the vault object exists).
			await demoUsd.mintFromFaucetInto(200, senderVaultId);

			// Build a single PTB that:
			//   1. Implicitly creates the sender vault (via vaultForAddress)
			//   2. Has an intermediate non-PAS moveCall (a no-op)
			//   3. Transfers 50 DEMO_USD from sender -> receiver (receiver vault created implicitly)
			//   4. Has another intermediate non-PAS moveCall
			//   5. Transfers another 50 DEMO_USD from sender -> receiver (same vaults, no re-creation)
			const tx = new Transaction();

			// (1) vaultForAddress for sender -- forces implicit creation
			tx.add(toolbox.client.pas.tx.vaultForAddress(sender));

			// (2) Intermediate command: a harmless moveCall (merge empty split back into gas)
			const split1 = tx.splitCoins(tx.gas, [tx.pure.u64(0)]);
			tx.mergeCoins(tx.gas, [split1]);

			// (3) First transfer: sender -> receiver (receiver vault does not exist)
			tx.add(
				toolbox.client.pas.tx.transferFunds({
					from: sender,
					to: receiver,
					amount: 50 * 1_000_000,
					assetType: demoUsd.demoUsdAssetType,
				}),
			);

			// (4) Another intermediate command
			const split2 = tx.splitCoins(tx.gas, [tx.pure.u64(0)]);
			tx.mergeCoins(tx.gas, [split2]);

			// (5) Second transfer: sender -> receiver (both vaults already created in this PTB)
			tx.add(
				toolbox.client.pas.tx.transferFunds({
					from: sender,
					to: receiver,
					amount: 50 * 1_000_000,
					assetType: demoUsd.demoUsdAssetType,
				}),
			);

			await toolbox.executeTransaction(tx);

			// Verify both vaults now exist.
			const [senderObj, receiverObj] = await Promise.all([
				toolbox.client.core.getObject({ objectId: senderVaultId }),
				toolbox.client.core.getObject({ objectId: receiverVaultId }),
			]);
			expect(senderObj.object).toBeDefined();
			expect(receiverObj.object).toBeDefined();

			// Verify balances: sender started with 200, transferred 50+50 = 100.
			const [{ balance: senderBalance }, { balance: receiverBalance }] = await Promise.all([
				toolbox.getBalance(senderVaultId, demoUsd.demoUsdAssetType),
				toolbox.getBalance(receiverVaultId, demoUsd.demoUsdAssetType),
			]);

			expect(Number(senderBalance.balance)).toBe(100 * 1_000_000);
			expect(Number(receiverBalance.balance)).toBe(100 * 1_000_000);
		});

		it('v1 approval rejects transfers over 10K', async () => {
			const toolbox = await setupToolbox();
			const demoUsd = new DemoUsdTestHelpers(toolbox);
			await demoUsd.createRule();

			const from = toolbox.address();
			const to = normalizeSuiAddress('0x3');
			const fromVaultId = toolbox.client.pas.deriveVaultAddress(from);

			await toolbox.createVaultForAddress(from);
			await toolbox.createVaultForAddress(to);
			await demoUsd.mintFromFaucetInto(15_000, fromVaultId);

			const tx = new Transaction();
			tx.add(
				toolbox.client.pas.tx.transferFunds({
					from,
					to,
					amount: 15_000 * 1_000_000,
					assetType: demoUsd.demoUsdAssetType,
				}),
			);

			const resp = await simulateFailingTransaction(toolbox, tx);
			expect(resp.FailedTransaction).toBeDefined();
			expect(resp.FailedTransaction!.effects.status.error!.message).toContain(
				'Any amount over 10K is not allowed in this demo.',
			);
		});

		it('self-transfer is rejected (same vault cannot be borrowed mutably twice)', async () => {
			const toolbox = await setupToolbox();
			const demoUsd = new DemoUsdTestHelpers(toolbox);
			await demoUsd.createRule();

			const addr = toolbox.address();
			const vaultId = toolbox.client.pas.deriveVaultAddress(addr);

			await toolbox.createVaultForAddress(addr);
			await demoUsd.mintFromFaucetInto(10, vaultId);

			const tx = new Transaction();
			tx.add(
				toolbox.client.pas.tx.transferFunds({
					from: addr,
					to: addr,
					amount: 1_000_000,
					assetType: demoUsd.demoUsdAssetType,
				}),
			);

			const resp = await simulateFailingTransaction(toolbox, tx);
			expect(resp.FailedTransaction).toBeDefined();
			// Same vault passed as both &mut sender and &mut receiver -- Move rejects
			// this before the approval function even runs.
			expect(resp.FailedTransaction!.effects.status.error!.message).toContain(
				'InvalidReferenceArgument',
			);
		});

		it('Should fail to transfer between vaults, if there are not enough funds in the source vault', async () => {
			const toolbox = await setupToolbox();
			const demoUsd = new DemoUsdTestHelpers(toolbox);
			await demoUsd.createRule();

			const from = toolbox.address();
			const to = normalizeSuiAddress('0x2');

			await toolbox.createVaultForAddress(from);
			await toolbox.createVaultForAddress(to);

			const transaction = new Transaction();
			transaction.add(
				toolbox.client.pas.tx.transferFunds({
					from,
					to,
					amount: 100 * 1_000_000,
					assetType: demoUsd.demoUsdAssetType,
				}),
			);

			const resp = await toolbox.client.signAndExecuteTransaction({
				signer: toolbox.keypair,
				transaction,
				include: {
					effects: true,
				},
			});

			expect(resp.FailedTransaction).toBeDefined();
			expect(resp.FailedTransaction!.effects.status.error!.message).toEqual(
				'InsufficientFundsForWithdraw',
			);
		});

		it('use_v2 upgrades approval logic and the resolver picks up the new template', async () => {
			const toolbox = await setupToolbox();
			const demoUsd = new DemoUsdTestHelpers(toolbox);
			await demoUsd.createRule();

			const from = toolbox.address();
			const to = normalizeSuiAddress('0x3');
			const fromVaultId = toolbox.client.pas.deriveVaultAddress(from);

			await toolbox.createVaultForAddress(from);
			await toolbox.createVaultForAddress(to);
			await demoUsd.mintFromFaucetInto(15_000, fromVaultId);

			await demoUsd.upgradeToV2();

			const tx = new Transaction();
			tx.add(
				toolbox.client.pas.tx.transferFunds({
					from,
					to,
					amount: 15_000 * 1_000_000,
					assetType: demoUsd.demoUsdAssetType,
				}),
			);
			await toolbox.executeTransaction(tx);

			const { balance } = await toolbox.getBalance(
				toolbox.client.pas.deriveVaultAddress(to),
				demoUsd.demoUsdAssetType,
			);
			expect(Number(balance.balance)).toBe(15_000 * 1_000_000);
		});

		it('transfers two different asset types (v1 and v2 approval) in a single PTB', async () => {
			const toolbox = await setupToolbox();
			const asset1 = new DemoUsdTestHelpers(toolbox, 'demo_usd_1');
			const asset2 = new DemoUsdTestHelpers(toolbox, 'demo_usd_2');
			await asset1.createRule();
			await asset2.createRule();

			// Upgrade asset2 to v2 so the two assets use completely different approval code paths.
			await asset2.upgradeToV2();

			const sender = toolbox.address();
			const receiver = normalizeSuiAddress('0xB3');
			const senderVaultId = toolbox.client.pas.deriveVaultAddress(sender);
			const receiverVaultId = toolbox.client.pas.deriveVaultAddress(receiver);

			await asset1.mintFromFaucetInto(500, senderVaultId);
			await asset2.mintFromFaucetInto(800, senderVaultId);

			// --- First PTB: transfers both asset types, implicitly creates receiver vault ---
			const tx1 = new Transaction();
			tx1.add(
				toolbox.client.pas.tx.transferFunds({
					from: sender,
					to: receiver,
					amount: 120 * 1_000_000,
					assetType: asset1.demoUsdAssetType,
				}),
			);
			tx1.add(
				toolbox.client.pas.tx.transferFunds({
					from: sender,
					to: receiver,
					amount: 350 * 1_000_000,
					assetType: asset2.demoUsdAssetType,
				}),
			);
			await toolbox.executeTransaction(tx1);

			const receiverObj = await toolbox.client.core.getObject({ objectId: receiverVaultId });
			expect(receiverObj.object).toBeDefined();
			await expectBalances(toolbox, [
				{ vault: senderVaultId, asset: asset1.demoUsdAssetType, amount: 380 },
				{ vault: senderVaultId, asset: asset2.demoUsdAssetType, amount: 450 },
				{ vault: receiverVaultId, asset: asset1.demoUsdAssetType, amount: 120 },
				{ vault: receiverVaultId, asset: asset2.demoUsdAssetType, amount: 350 },
			]);

			// --- Second PTB: both vaults already exist, different amounts ---
			const tx2 = new Transaction();
			tx2.add(
				toolbox.client.pas.tx.transferFunds({
					from: sender,
					to: receiver,
					amount: 80 * 1_000_000,
					assetType: asset1.demoUsdAssetType,
				}),
			);
			tx2.add(
				toolbox.client.pas.tx.transferFunds({
					from: sender,
					to: receiver,
					amount: 150 * 1_000_000,
					assetType: asset2.demoUsdAssetType,
				}),
			);
			await toolbox.executeTransaction(tx2);

			await expectBalances(toolbox, [
				{ vault: senderVaultId, asset: asset1.demoUsdAssetType, amount: 300 },
				{ vault: senderVaultId, asset: asset2.demoUsdAssetType, amount: 300 },
				{ vault: receiverVaultId, asset: asset1.demoUsdAssetType, amount: 200 },
				{ vault: receiverVaultId, asset: asset2.demoUsdAssetType, amount: 500 },
			]);
		});

		it('v2 approval rejects transfers to 0x2', async () => {
			const toolbox = await setupToolbox();
			const demoUsd = new DemoUsdTestHelpers(toolbox);
			await demoUsd.createRule();

			const from = toolbox.address();
			const to = normalizeSuiAddress('0x2');
			const fromVaultId = toolbox.client.pas.deriveVaultAddress(from);

			await toolbox.createVaultForAddress(from);
			await toolbox.createVaultForAddress(to);
			await demoUsd.mintFromFaucetInto(10, fromVaultId);

			await demoUsd.upgradeToV2();

			const tx = new Transaction();
			tx.add(
				toolbox.client.pas.tx.transferFunds({
					from,
					to,
					amount: 1_000_000,
					assetType: demoUsd.demoUsdAssetType,
				}),
			);

			const resp = await simulateFailingTransaction(toolbox, tx);
			expect(resp.FailedTransaction).toBeDefined();
			expect(resp.FailedTransaction!.effects.status.error!.message).toContain(
				'Transfers to the address 0x2 are not allowed in this demo.',
			);
		});
	},
);
