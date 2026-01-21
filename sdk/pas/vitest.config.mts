// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		maxWorkers: 4,
		hookTimeout: 1000000,
		testTimeout: 1000000,
		env: {
			NODE_ENV: 'test',
		},
		setupFiles: ['test/e2e/setupEnv.ts'],
		globalSetup: ['test/e2e/globalSetup.ts'],
	},
	resolve: {
		alias: {
			'@mysten/bcs': new URL('../../../ts-sdks/packages/bcs/src', import.meta.url).pathname,
			'@mysten/sui': new URL('../../../ts-sdks/packages/sui/src', import.meta.url).pathname,
			'@mysten/utils': new URL('../../../ts-sdks/packages/utils/src', import.meta.url).pathname,
		},
	},
});
