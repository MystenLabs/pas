// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		testTimeout: 30000,
	},
	resolve: {
		alias: {
			'@mysten/bcs': new URL('../../../ts-sdks/packages/bcs/src', import.meta.url).pathname,
			'@mysten/sui': new URL('../../../ts-sdks/packages/sui/src', import.meta.url).pathname,
			'@mysten/utils': new URL('../../../ts-sdks/packages/utils/src', import.meta.url).pathname,
		},
	},
});
