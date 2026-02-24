import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { beforeAll, describe, expect, it } from 'vitest';

import { Chest } from '../../src/contracts/pas/chest.js';
import { DemoUsdTestHelpers } from './demoUsd.ts';
import { setupToolbox, TestToolbox } from './setup.ts';

describe('e2e tests with shared PAS package (all tests run in the same PAS package)', () => {
	let toolbox: TestToolbox;
	let demoUsd: DemoUsdTestHelpers;

	// Each execution should use its own runner to avoid shared state of PAS package.
	beforeAll(async () => {
		toolbox = await setupToolbox();
		demoUsd = new DemoUsdTestHelpers(toolbox);
		await demoUsd.createPolicy();
	});

	it('Should not be able to unlock restricted funds (e.g. DEMO_USD).', async () => {
		const keypair = Ed25519Keypair.generate();
		const address = keypair.getPublicKey().toSuiAddress();

		await toolbox.createChestForAddress(address);
		const chestId = toolbox.client.pas.deriveChestAddress(address);
		await demoUsd.mintFromFaucetInto(100, chestId);

		const tx = new Transaction();
		tx.add(
			toolbox.client.pas.tx.unlockFunds({
				from: address,
				amount: 100 * 1_000_000,
				assetType: demoUsd.demoUsdAssetType,
			}),
		);

		await expect(
			toolbox.client.core.signAndExecuteTransaction({
				signer: keypair,
				transaction: tx,
				include: {
					effects: true,
				},
			}),
		).rejects.toThrowError('No required approvals found for action');
	});

	it('derivations work as expected for chests', async () => {
		const chestObjectId = toolbox.client.pas.deriveChestAddress(toolbox.address());
		await toolbox.createChestForAddress(toolbox.address());

		const { object: chestObject } = await toolbox.client.core.getObject({
			objectId: chestObjectId,
			include: { content: true },
		});

		expect(chestObject).toBeDefined();

		const parsed = Chest.parse(chestObject.content!);
		expect(normalizeSuiAddress(parsed.owner)).toBe(normalizeSuiAddress(toolbox.address()));
		expect(chestObject.type).toBe(
			`${toolbox.client.pas.getPackageConfig().packageId}::chest::Chest`,
		);
	});

	it('derivations work as expected for policies', async () => {
		const policyObjectId = toolbox.client.pas.derivePolicyAddress(demoUsd.demoUsdAssetType);

		const { object: policyObject } = await toolbox.client.core.getObject({
			objectId: policyObjectId,
			include: { content: true },
		});

		expect(policyObject).toBeDefined();
		expect(policyObject.type).toBe(
			`${toolbox.client.pas.getPackageConfig().packageId}::policy::Policy<${demoUsd.pub.originalId}::demo_usd::DEMO_USD>`,
		);
	});
});
