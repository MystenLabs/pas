import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PublishedPackage, setupToolbox, TestToolbox } from './setup';
import { Transaction } from '@mysten/sui/transactions';
import { Vault } from '../../src/contracts/pas/vault';
import { normalizeSuiAddress } from '@mysten/sui/utils';


describe('e2e tests with isolated PAS Package (each test runs in its own PAS package)', () => {
    let toolbox: TestToolbox;

    // Each execution should use its own runner to avoid shared state of PAS package.
    beforeEach(async () => {
        toolbox = await setupToolbox();
    })

    it('Should be able to transfer between vaults, going through the rule of the issuer;', async () => {
        const demoUsd = new DemoUsdTestHelpers(toolbox);
        await demoUsd.createRule();

        const from = toolbox.address();
        const to = normalizeSuiAddress('0x2');

        const fromVaultId = toolbox.client.pas.deriveVaultAddress(from);
        const toVaultId = toolbox.client.pas.deriveVaultAddress(to);

        await toolbox.createVaultForAddress(from);
        await toolbox.createVaultForAddress(to);

        await demoUsd.mintFromFaucetInto(100, fromVaultId);

        const [{balance: fromBalanceBefore}, {balance: toBalanceBefore}] = await Promise.all([
            toolbox.getBalance(fromVaultId, demoUsd.demoUsdAssetType),
            toolbox.getBalance(toVaultId, demoUsd.demoUsdAssetType),
        ]);

        expect(Number(fromBalanceBefore.balance)).toBe(100 * 1_000_000);
        expect(Number(toBalanceBefore.balance)).toBe(0);

        const tx = new Transaction();
        tx.add(toolbox.client.pas.tx.transferFunds({
            from,
            to,
            amount: 100 * 1_000_000,
            assetType: demoUsd.demoUsdAssetType,
        }));

        await toolbox.executeTransaction(tx);

        const [{balance: fromBalanceAfter}, {balance: toBalanceAfter}] = await Promise.all([
            toolbox.getBalance(fromVaultId, demoUsd.demoUsdAssetType),
            toolbox.getBalance(toVaultId, demoUsd.demoUsdAssetType),
        ]);

        expect(Number(fromBalanceAfter.balance)).toBe(0);
        expect(Number(toBalanceAfter.balance)).toBe(100 * 1_000_000);
    });
})


export class DemoUsdTestHelpers {
    toolbox: TestToolbox;
    #publicationData: PublishedPackage;

    constructor(toolbox: TestToolbox) {
        this.toolbox = toolbox;
    }

    get pub() {
        if (!this.#publicationData) {
            throw new Error('Publication data not found. Call `createRule` first.');
        }
        return this.#publicationData;
    }

    // setup the rule
    async createRule() {
        if (this.#publicationData) {
            return this.#publicationData;
        }

        const result = await this.toolbox.publishPackage('demo_usd');
        this.#publicationData = result;

        const transaction = new Transaction();
        transaction.moveCall({
            target: `${result.originalId}::demo_usd::setup`,
            arguments: [transaction.object(this.toolbox.client.pas.getPackageConfig().namespaceId)],
        });

        await this.toolbox.executeTransaction(transaction);

        return this.#publicationData;
    }


    async mintFromFaucetInto(amount: number, to: string) {
        const transaction = new Transaction();
        const balance = transaction.moveCall({
            target: `${this.pub.originalId}::demo_usd::faucet_mint_balance`,
            arguments: [
                transaction.object(this.pub.createdObjects.find(o => o.type.endsWith('demo_usd::Faucet'))!.id),
                transaction.pure.u64(amount * 1_000_000)],
        });

        transaction.moveCall({
            target: `0x2::balance::send_funds`,
            arguments: [balance, transaction.pure.address(to)],
            typeArguments: [this.demoUsdAssetType],
        });

        await this.toolbox.executeTransaction(transaction);
    }


    get demoUsdAssetType() {
        return `${this.pub.originalId}::demo_usd::DEMO_USD`;
    }
}
