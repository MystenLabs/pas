import { beforeAll, describe, expect, it } from 'vitest';
import { setupToolbox, TestToolbox } from './setup';
import { Vault } from '../../src/contracts/pas/vault';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { DemoUsdTestHelpers } from './e2e.isolated.test'; 

describe('e2e tests with shared PAS package (all tests run in the same PAS package)', () => {
    let toolbox: TestToolbox;
    let demoUsd: DemoUsdTestHelpers;

    // Each execution should use its own runner to avoid shared state of PAS package.
    beforeAll(async () => {
        toolbox = await setupToolbox();
        demoUsd = new DemoUsdTestHelpers(toolbox);
        await demoUsd.createRule();
    });

    it('derivations work as expected for vaults', async () => {
        const vaultObjectId = toolbox.client.pas.deriveVaultAddress(toolbox.address());
        await toolbox.createVaultForAddress(toolbox.address());

        const { object: vaultObject } = await toolbox.client.core.getObject({
            objectId: vaultObjectId,
            include: { content: true }
        });

        expect(vaultObject).toBeDefined();

        const parsed = Vault.parse(vaultObject.content!);
        expect(normalizeSuiAddress(parsed.owner)).toBe(normalizeSuiAddress(toolbox.address()));
        expect(vaultObject.type).toBe(`${toolbox.client.pas.getPackageConfig().packageId}::vault::Vault`);
    })

    it('derivations work as expected for rules', async () => {
        const ruleObjectId = toolbox.client.pas.deriveRuleAddress(demoUsd.demoUsdAssetType);

        const { object: ruleObject } = await toolbox.client.core.getObject({
            objectId: ruleObjectId,
            include: { content: true }
        });

        expect(ruleObject).toBeDefined();
        expect(ruleObject.type).toBe(`${toolbox.client.pas.getPackageConfig().packageId}::rule::Rule<${demoUsd.pub.originalId}::demo_usd::DEMO_USD>`);
    });
})
