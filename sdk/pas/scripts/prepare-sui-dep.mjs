#!/usr/bin/env node
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * This script prepares the @mysten/sui dependency from git by building it
 * if it hasn't been built yet.
 */
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, '..');

const suiPackagePath = join(packageRoot, 'node_modules', '@mysten', 'sui');
const suiDistPath = join(suiPackagePath, 'packages', 'sui', 'dist');

console.log('Checking @mysten/sui build status...');

// Check if the dist directory already exists
if (existsSync(suiDistPath)) {
	console.log('✓ @mysten/sui is already built');
	process.exit(0);
}

console.log('Building @mysten/sui from git...');

try {
	// Temporarily remove patchedDependencies to avoid validation error
	const pkgJsonPath = join(suiPackagePath, 'package.json');
	const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
	const originalPnpm = { ...pkgJson.pnpm };

	if (pkgJson.pnpm?.patchedDependencies) {
		console.log('Temporarily removing patchedDependencies...');
		delete pkgJson.pnpm.patchedDependencies;
		writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, '\t'));
	}

	try {
		// Navigate to the monorepo and install dependencies
		console.log('Installing monorepo dependencies...');
		execSync('pnpm install --no-frozen-lockfile --config.strict-peer-dependencies=false', {
			cwd: suiPackagePath,
			stdio: 'inherit',
		});
	} finally {
		// Restore original package.json
		if (originalPnpm.patchedDependencies) {
			pkgJson.pnpm = originalPnpm;
			writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, '\t'));
		}
	}

	// Build the @mysten/sui package and its dependencies using turbo
	console.log('Building @mysten/sui package and dependencies...');
	execSync('pnpm turbo run build --filter=@mysten/sui...', {
		cwd: suiPackagePath,
		stdio: 'inherit',
	});

	console.log('✓ Successfully built @mysten/sui');
} catch (error) {
	console.error('Failed to build @mysten/sui:', error.message);
	console.error('You may need to build it manually or use a published version');
	process.exit(1);
}
