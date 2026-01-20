// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { deriveRuleAddress, deriveVaultAddress } from '../../src/derivation.js';
import type { PASPackageConfig } from '../../src/types.js';

describe('PAS Object Derivation', () => {
	const packageConfig: PASPackageConfig = {
		packageId: '0x123',
		namespaceId: '0xabc',
	};

	describe('deriveVaultAddress', () => {
		it('should derive vault address for owner 0x456', () => {
			const vaultId = deriveVaultAddress('0x456', packageConfig);
			expect(vaultId).toMatchInlineSnapshot(
				`"0x8712c77726f5c0927363764d6fd6ec64fb03becb51228bfcb2017442b6c30b62"`,
			);
		});

		it('should derive vault address for owner 0x789', () => {
			const vaultId = deriveVaultAddress('0x789', packageConfig);
			expect(vaultId).toMatchInlineSnapshot(
				`"0x36379f73c885824bd00cf8e441464aa7a3ccd0624c1c34fd526ed7db1f83a116"`,
			);
		});

		it('should derive vault address for different namespace', () => {
			const config = { ...packageConfig, namespaceId: '0xdef' };
			const vaultId = deriveVaultAddress('0x456', config);
			expect(vaultId).toMatchInlineSnapshot(
				`"0xa378d4ccc977bbb997618a32c4bbe8cc55a67551870f2574626fd624e1b3cfb7"`,
			);
		});

		it('should normalize addresses correctly', () => {
			const vaultId1 = deriveVaultAddress('0x1', packageConfig);
			const vaultId2 = deriveVaultAddress(
				'0x0000000000000000000000000000000000000000000000000000000000000001',
				packageConfig,
			);

			expect(vaultId1).toBe(vaultId2);
			expect(vaultId1).toMatchInlineSnapshot(
				`"0xe5dd472028385358d7727a799555e42f43858c7621a84473e0f5384cda737ed6"`,
			);
		});

		it('should derive vault for object owner', () => {
			const vaultId = deriveVaultAddress(
				'0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
				packageConfig,
			);
			expect(vaultId).toMatchInlineSnapshot(
				`"0xf29869e74858befbd65b5b03338d0b1f4855bb7eeb6b37b5559879f461930114"`,
			);
		});
	});

	describe('deriveRuleAddress', () => {
		it('should derive rule address for SUI', () => {
			const ruleId = deriveRuleAddress('0x2::sui::SUI', packageConfig);
			expect(ruleId).toMatchInlineSnapshot(
				`"0xa80f7887519529d8c1dc071335581b2be8b1ae3ef2cf389252cb237a7fd981ac"`,
			);
		});

		it('should derive rule address for custom token', () => {
			const ruleId = deriveRuleAddress('0x123::custom::TOKEN', packageConfig);
			expect(ruleId).toMatchInlineSnapshot(
				`"0x8bea006c7d66636853801a03eaa744cb7233fabb03564b9a226ec0599054e607"`,
			);
		});

		it('should derive rule address for USDC', () => {
			const ruleId = deriveRuleAddress(
				'0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
				packageConfig,
			);
			expect(ruleId).toMatchInlineSnapshot(
				`"0x07aa4265f1818ce739c4d683644c6806673eca42c4df517ff603765879a74548"`,
			);
		});

		it('should derive rule address for different namespace', () => {
			const config = { ...packageConfig, namespaceId: '0xdef' };
			const ruleId = deriveRuleAddress('0x2::sui::SUI', config);
			expect(ruleId).toMatchInlineSnapshot(
				`"0xc0461196a5123f86d8e2ea00139db53a149cb0a329f19a4e5aa6da752fe656fd"`,
			);
		});

		it('should handle complex generic types', () => {
			const ruleId = deriveRuleAddress('0x2::coin::Coin<0x123::my_token::MY_TOKEN>', packageConfig);
			expect(ruleId).toMatchInlineSnapshot(
				`"0xc14f2075c203f51e202c68b3ff99f67f98014213be4d974059971e91696f9485"`,
			);
		});

		it('should handle nested generics', () => {
			const ruleId = deriveRuleAddress(
				'0x1::option::Option<0x2::coin::Coin<0x2::sui::SUI>>',
				packageConfig,
			);
			expect(ruleId).toMatchInlineSnapshot(
				`"0xd99a6a6328063a63343024ec3167f4ddd15cf68bb523dbe8c3c623bf895e73e0"`,
			);
		});
	});
});
