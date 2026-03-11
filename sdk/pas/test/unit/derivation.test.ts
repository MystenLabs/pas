// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { deriveAccountAddress, derivePolicyAddress } from '../../src/derivation.js';
import type { PASPackageConfig } from '../../src/types.js';

describe('PAS Object Derivation', () => {
	const packageConfig: PASPackageConfig = {
		packageId: '0x123',
		namespaceId: '0xabc',
	};

	describe('deriveAccountAddress', () => {
		it('should derive account address for owner 0x456', () => {
			const accountId = deriveAccountAddress('0x456', packageConfig);
			expect(accountId).toMatchInlineSnapshot(
				`"0x669fe85c5c4c4df6780f1e8680a8616af7fdca99559a5204e72cf092f3eaadbc"`,
			);
		});

		it('should derive account address for owner 0x789', () => {
			const accountId = deriveAccountAddress('0x789', packageConfig);
			expect(accountId).toMatchInlineSnapshot(
				`"0xc50c691dc80963539896ff8c261b7c046eeebc84fc9e9d0278ef5381b31b3fa8"`,
			);
		});

		it('should derive account address for different namespace', () => {
			const config = { ...packageConfig, namespaceId: '0xdef' };
			const accountId = deriveAccountAddress('0x456', config);
			expect(accountId).toMatchInlineSnapshot(
				`"0x219e8547860e5fe3f526453e108763965fbb0d7f391c1ba977c5cc5ea74be1e1"`,
			);
		});

		it('should normalize addresses correctly', () => {
			const accountId1 = deriveAccountAddress('0x1', packageConfig);
			const accountId2 = deriveAccountAddress(
				'0x0000000000000000000000000000000000000000000000000000000000000001',
				packageConfig,
			);

			expect(accountId1).toBe(accountId2);
			expect(accountId1).toMatchInlineSnapshot(
				`"0xed31e9da3671b44b36eb216e5fdbacd42e32fc060e74def41a5fca3f5aba2000"`,
			);
		});

		it('should derive account for object owner', () => {
			const accountId = deriveAccountAddress(
				'0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
				packageConfig,
			);
			expect(accountId).toMatchInlineSnapshot(
				`"0x3c76832eb19537437d093c4bf1264e9e371f168f884295764f2f4a370fb5c898"`,
			);
		});
	});

	describe('derivePolicyAddress', () => {
		it('should derive policy address for SUI (Balance-wrapped)', () => {
			const policyId = derivePolicyAddress('0x2::sui::SUI', packageConfig);
			expect(policyId).toMatchInlineSnapshot(
				`"0xafc3922318beb884092ce0349fae45b00cc46913dfd72247c48ad1ca890734ab"`,
			);
		});

		it('should derive policy address for custom token (Balance-wrapped)', () => {
			const policyId = derivePolicyAddress('0x123::custom::TOKEN', packageConfig);
			expect(policyId).toMatchInlineSnapshot(
				`"0x0c363b471efa71550b30f4a634fc6f35e0ac357a4a107c7e8f9a0f179334912b"`,
			);
		});

		it('should derive policy address for USDC (Balance-wrapped)', () => {
			const policyId = derivePolicyAddress(
				'0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
				packageConfig,
			);
			expect(policyId).toMatchInlineSnapshot(
				`"0xe87bda7a9b045040fe9a6882e6d69f9fb1c79abb804472b273d2ce4b1430bb34"`,
			);
		});

		it('should derive policy address for different namespace', () => {
			const config = { ...packageConfig, namespaceId: '0xdef' };
			const policyId = derivePolicyAddress('0x2::sui::SUI', config);
			expect(policyId).toMatchInlineSnapshot(
				`"0x182cd5446391f7a5be59e6f79beb0c0ed1e3532543f82d37d8a41f13c6dae130"`,
			);
		});

		it('should handle complex generic types (Balance-wrapped)', () => {
			const policyId = derivePolicyAddress(
				'0x2::coin::Coin<0x123::my_token::MY_TOKEN>',
				packageConfig,
			);
			expect(policyId).toMatchInlineSnapshot(
				`"0xb347105016824245f2bc3611bd7d2f9761b68edf4105837e3372710abcff0912"`,
			);
		});

		it('should handle nested generics (Balance-wrapped)', () => {
			const policyId = derivePolicyAddress(
				'0x1::option::Option<0x2::coin::Coin<0x2::sui::SUI>>',
				packageConfig,
			);
			expect(policyId).toMatchInlineSnapshot(
				`"0x3851acd50e6a5c86fd8ae0e8acd8aee738849c10f399ac78e4c46ea0a4e8a880"`,
			);
		});

		it('should allow raw derivation via wrapType identity', () => {
			const policyId = derivePolicyAddress('0x2::sui::SUI', packageConfig, {
				wrapType: (t) => t,
			});
			expect(policyId).toMatchInlineSnapshot(
				`"0x85ae367dd0501a222f2ef6038f08cafc0c10ba2e85746e4ee15b8d1426ce1954"`,
			);
		});
	});
});
