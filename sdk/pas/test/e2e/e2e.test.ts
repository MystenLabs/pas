import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupToolbox, TestToolbox } from './setup';

describe('e2e tests', () => {
    let toolbox: TestToolbox;

    beforeAll(async () => {
        toolbox = await setupToolbox();
    })

    it('should be able to reach this point', async () => {
        const result = await toolbox.publishPackage('testing/demo_usd');

        console.log(result);
        console.log(toolbox.publishedPackages);
    });

    it('should be able to reach this point', async () => {
        const result = await toolbox.publishPackage('testing/demo_usd');

        console.log(result);
    });

    it('should be able to reach this point', async () => {
        const result = await toolbox.publishPackage('testing/demo_usd');

        console.log(result);
        expect(true).toBe(true);
    })
})
