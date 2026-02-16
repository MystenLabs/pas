// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { bcs } from '@mysten/sui/bcs';
import type { SuiClientTypes } from '@mysten/sui/client';
import { Inputs, Transaction, TransactionCommands } from '@mysten/sui/transactions';
import type {
	Argument,
	CallArg,
	Command,
	TransactionDataBuilder,
	TransactionPlugin,
	TransactionResult,
} from '@mysten/sui/transactions';
import { normalizeStructTag } from '@mysten/sui/utils';

import {
	deriveRuleAddress,
	deriveTemplateDFAddress,
	deriveTemplatesObjectAddress,
	deriveVaultAddress,
} from './derivation.js';
import { PASClientError, RuleNotFoundError } from './error.js';
import {
	buildMoveCallCommandFromTemplate,
	getCommandFromTemplateDF,
	getRequiredApprovals,
	PASActionType,
} from './resolution.js';
import type { PASPackageConfig } from './types.js';

const PAS_INTENT_NAME = 'PAS';

// ---------------------------------------------------------------------------
// Intent data types
// ---------------------------------------------------------------------------

interface TransferFundsIntentData {
	action: 'transferFunds';
	from: string;
	to: string;
	amount: string;
	assetType: string;
	packageConfig: PASPackageConfig;
}

interface UnlockFundsIntentData {
	action: 'unlockFunds';
	from: string;
	amount: string;
	assetType: string;
	packageConfig: PASPackageConfig;
}

interface UnlockUnrestrictedFundsIntentData {
	action: 'unlockUnrestrictedFunds';
	from: string;
	amount: string;
	assetType: string;
	packageConfig: PASPackageConfig;
}

interface VaultForAddressIntentData {
	action: 'vaultForAddress';
	owner: string;
	packageConfig: PASPackageConfig;
}

type PASIntentData =
	| TransferFundsIntentData
	| UnlockFundsIntentData
	| UnlockUnrestrictedFundsIntentData
	| VaultForAddressIntentData;

// ---------------------------------------------------------------------------
// Intent creator helpers (called from PASClient.tx.*)
// ---------------------------------------------------------------------------

/**
 * Creates a memoized PAS intent closure. On first call it registers the
 * shared resolver and adds the $Intent command; subsequent calls return
 * the cached TransactionResult.
 */
function createPASIntent(data: PASIntentData): (tx: Transaction) => TransactionResult {
	let result: TransactionResult | null = null;
	return (tx: Transaction) => {
		if (result) return result;
		tx.addIntentResolver(PAS_INTENT_NAME, resolvePASIntents);
		result = tx.add(
			TransactionCommands.Intent({
				name: PAS_INTENT_NAME,
				inputs: {},
				data: data as unknown as Record<string, unknown>,
			}),
		);
		return result;
	};
}

export function transferFundsIntent(
	packageConfig: PASPackageConfig,
): (options: {
	from: string;
	to: string;
	amount: number | bigint;
	assetType: string;
}) => (tx: Transaction) => TransactionResult {
	return ({ from, to, amount, assetType }) =>
		createPASIntent({
			action: 'transferFunds',
			from,
			to,
			amount: String(amount),
			assetType,
			packageConfig,
		});
}

export function unlockFundsIntent(
	packageConfig: PASPackageConfig,
): (options: {
	from: string;
	amount: number | bigint;
	assetType: string;
}) => (tx: Transaction) => TransactionResult {
	return ({ from, amount, assetType }) =>
		createPASIntent({
			action: 'unlockFunds',
			from,
			amount: String(amount),
			assetType,
			packageConfig,
		});
}

export function unlockUnrestrictedFundsIntent(
	packageConfig: PASPackageConfig,
): (options: {
	from: string;
	amount: number | bigint;
	assetType: string;
}) => (tx: Transaction) => TransactionResult {
	return ({ from, amount, assetType }) =>
		createPASIntent({
			action: 'unlockUnrestrictedFunds',
			from,
			amount: String(amount),
			assetType,
			packageConfig,
		});
}

export function vaultForAddressIntent(
	packageConfig: PASPackageConfig,
): (owner: string) => (tx: Transaction) => TransactionResult {
	return (owner: string) => createPASIntent({ action: 'vaultForAddress', owner, packageConfig });
}

// ---------------------------------------------------------------------------
// Resolver -- holds mutable state shared across all intent builders
// ---------------------------------------------------------------------------
//
// ## How intent resolution works
//
// Each PAS intent occupies a single $Intent slot in the transaction's command
// list. At build time, the resolver replaces each $Intent with a sequence of
// concrete MoveCall commands via `replaceCommand`.
//
// The tricky part is **indexing**. Commands within a PTB reference each
// other's outputs by absolute command index (e.g. `{ Result: 5 }` means
// "the output of command #5"). When we build the replacement commands for
// an intent, we need to know what absolute index each new command will land
// at in the final PTB. That's what `baseIdx` is for:
//
//   baseIdx = the position of the $Intent slot being replaced
//
// So if baseIdx is 3 and we push 2 vault-creation commands before the
// new_auth call, new_auth lands at absolute index 5 (= 3 + 2).
//
// The SDK's `replaceCommand` handles index shifting automatically: after
// splicing N commands in place of 1, it adjusts all Result/NestedResult
// references in subsequent commands by (N - 1). So we iterate the live
// command list directly -- no manual offset tracking needed.
//
// Each builder returns a `BuildResult` containing:
//   - `commands`: the replacement commands (local array, 0-indexed)
//   - `resultOffset`: which command in that array produces the intent's
//     output value (so external references to the intent can be remapped)
//

type SuiObject = SuiClientTypes.Object<{ content: true }>;

type VaultState =
	| { kind: 'existing' }
	| { kind: 'created'; resultIndex: number; cfg: PASPackageConfig };

/** Return value from each per-action builder. */
interface BuildResult {
	commands: Command[];
	/** Offset within `commands` of the command whose Result is the intent's output. */
	resultOffset: number;
}

class Resolver {
	/** Pre-fetched on-chain objects (vaults, rules). null = does not exist. */
	readonly objects: Map<string, SuiObject | null>;
	/** Pre-fetched template dynamic field objects. */
	readonly templateDFs: Map<string, SuiObject>;
	/** Pre-parsed template lookup: ruleId:actionType -> approval type names. */
	readonly templateLookup: Map<string, string[]>;
	/** Vault existence / creation tracking. */
	readonly vaults: Map<string, VaultState>;

	readonly #txData: TransactionDataBuilder;
	readonly #inputCache = new Map<string, Argument>();
	readonly #templateCommandsCache = new Map<
		string,
		ReturnType<typeof getCommandFromTemplateDF>[]
	>();

	constructor(
		txData: TransactionDataBuilder,
		objects: Map<string, SuiObject | null>,
		templateDFs: Map<string, SuiObject>,
		templateLookup: Map<string, string[]>,
		vaults: Map<string, VaultState>,
	) {
		this.#txData = txData;
		this.objects = objects;
		this.templateDFs = templateDFs;
		this.templateLookup = templateLookup;
		this.vaults = vaults;
	}

	// -- Input helpers (deduplicated) ----------------------------------------

	addObjectInput(objectId: string): Argument {
		let arg = this.#inputCache.get(objectId);
		if (!arg) {
			arg = this.#txData.addInput('object', {
				$kind: 'UnresolvedObject',
				UnresolvedObject: { objectId },
			});
			this.#inputCache.set(objectId, arg);
		}
		return arg;
	}

	addPureInput(key: string, value: ReturnType<typeof Inputs.Pure>): Argument {
		let arg = this.#inputCache.get(key);
		if (!arg) {
			arg = this.#txData.addInput('pure', value);
			this.#inputCache.set(key, arg);
		}
		return arg;
	}

	addTemplateInput(type: 'object' | 'pure', arg: CallArg): Argument {
		if (type === 'object' && arg.$kind === 'UnresolvedObject') {
			return this.addObjectInput(arg.UnresolvedObject.objectId);
		}
		return this.#txData.addInput(type, arg);
	}

	// -- Object lookup -------------------------------------------------------

	getObjectOrThrow(objectId: string, errorFactory: () => Error): SuiObject {
		const obj = this.objects.get(objectId);
		if (!obj) throw errorFactory();
		return obj;
	}

	// -- Vault resolution ----------------------------------------------------

	/**
	 * Returns an Argument referencing the vault for `vaultId`.
	 *
	 * - Existing on-chain vault: returns an object Input.
	 * - Already created earlier in this PTB: returns the stored Result ref.
	 * - Does not exist yet: **pushes** a `vault::create` MoveCall into the
	 *   caller's `commands` array (mutating it) and records the creation so
	 *   subsequent calls for the same vault reuse the same Result. The vault
	 *   will be shared at the end of the PTB via `appendVaultShares()`.
	 *
	 * @param commands - The caller's local command array (may be mutated).
	 * @param baseIdx  - Absolute PTB index where `commands[0]` will land.
	 */
	resolveVaultArg(
		vaultId: string,
		owner: string,
		cfg: PASPackageConfig,
		commands: Command[],
		baseIdx: number,
	): Argument {
		const state = this.vaults.get(vaultId);

		if (state?.kind === 'existing') {
			return this.addObjectInput(vaultId);
		}
		if (state?.kind === 'created') {
			return { $kind: 'Result', Result: state.resultIndex };
		}

		const absoluteIndex = baseIdx + commands.length;
		commands.push(
			TransactionCommands.MoveCall({
				package: cfg.packageId,
				module: 'vault',
				function: 'create',
				arguments: [
					this.addObjectInput(cfg.namespaceId),
					this.addPureInput(`address:${owner}`, Inputs.Pure(bcs.Address.serialize(owner))),
				],
			}),
		);

		this.vaults.set(vaultId, { kind: 'created', resultIndex: absoluteIndex, cfg });
		return { $kind: 'Result', Result: absoluteIndex };
	}

	// -- Template resolution (synchronous, all data pre-fetched) -------------

	resolveTemplateCommands(ruleObjectId: string, actionType: PASActionType, cfg: PASPackageConfig) {
		const cacheKey = `${ruleObjectId}:${actionType}`;
		const cached = this.#templateCommandsCache.get(cacheKey);
		if (cached) return cached;

		const approvalTypeNames = this.templateLookup.get(cacheKey);
		if (!approvalTypeNames) {
			throw new PASClientError(
				`No required approvals found for action "${actionType}". The issuer has not configured this action.`,
			);
		}

		const templatesId = deriveTemplatesObjectAddress(cfg);
		const commands = approvalTypeNames.map((tn) => {
			const dfId = deriveTemplateDFAddress(templatesId, tn);
			const df = this.templateDFs.get(dfId);
			if (!df) {
				throw new PASClientError(
					`Template not found for approval type "${tn}". The issuer has not set up the template command.`,
				);
			}
			return getCommandFromTemplateDF(df);
		});

		this.#templateCommandsCache.set(cacheKey, commands);
		return commands;
	}

	// -- Command replacement --------------------------------------------------
	//
	// `replaceCommand(index, commands, resultIndex)` splices the replacement
	// commands in and automatically remaps all external argument references:
	//   - References past `index` are shifted by (commands.length - 1)
	//   - References to `index` itself are remapped to `resultIndex`
	// So we just need to tell it which command produces the intent's output.

	/**
	 * Replaces a standard action intent (transfer/unlock) with its built
	 * commands. The resolve call at `actualIdx + resultOffset` produces the
	 * intent's output value.
	 */
	replaceIntent(actualIdx: number, commands: Command[], resultOffset: number) {
		this.#txData.replaceCommand(actualIdx, commands, { Result: actualIdx + resultOffset });
	}

	/**
	 * Replaces a vaultForAddress intent when the vault already exists.
	 * The intent is removed (0 replacement commands) and external references
	 * are remapped to the existing vault's Input argument.
	 *
	 * Note: SDK's replaceCommand signature doesn't accept Input args as
	 * resultIndex, but the runtime handles it correctly via ArgumentSchema.parse().
	 */
	replaceIntentWithExistingVault(actualIdx: number, vaultArg: Argument) {
		this.#txData.replaceCommand(actualIdx, [], vaultArg as any);
	}

	/**
	 * Replaces a vaultForAddress intent when the vault needs to be created.
	 * The intent is replaced with the vault::create command(s), and external
	 * references are remapped to the first command's Result (the new vault).
	 */
	replaceIntentWithCreatedVault(actualIdx: number, commands: Command[]) {
		this.#txData.replaceCommand(actualIdx, commands, { Result: actualIdx });
	}

	// -- Per-action builders --------------------------------------------------
	//
	// Each builder constructs a local `commands` array representing the
	// sequence of MoveCall commands that replace the intent. Commands
	// reference each other using absolute indices (baseIdx + local offset).
	//
	// The general pattern for a transfer is:
	//   [vault::create (0..N)]  -- only if vaults don't exist yet
	//   vault::new_auth         -- create ownership proof
	//   vault::transfer_funds   -- initiate the request
	//   [approval commands]     -- issuer-defined template commands
	//   transfer_funds::resolve -- finalize and produce the output
	//
	// `resultOffset` points at the last command (resolve), whose Result
	// becomes the intent's output value.

	buildTransferFunds(data: TransferFundsIntentData, baseIdx: number): BuildResult {
		const { from, to, assetType, amount, packageConfig: cfg } = data;
		const fromVaultId = deriveVaultAddress(from, cfg);
		const toVaultId = deriveVaultAddress(to, cfg);

		const ruleId = deriveRuleAddress(assetType, cfg);
		const ruleObject = this.getObjectOrThrow(ruleId, () => new RuleNotFoundError(assetType));
		const templateCmds = this.resolveTemplateCommands(
			ruleObject.objectId,
			PASActionType.TransferFunds,
			cfg,
		);

		const commands: Command[] = [];
		const toVaultArg = this.resolveVaultArg(toVaultId, to, cfg, commands, baseIdx);
		const fromVaultArg = this.resolveVaultArg(fromVaultId, from, cfg, commands, baseIdx);
		const ruleArg = this.addObjectInput(ruleId);

		// vault::new_auth
		const authIdx = baseIdx + commands.length;
		commands.push(
			TransactionCommands.MoveCall({
				package: cfg.packageId,
				module: 'vault',
				function: 'new_auth',
			}),
		);

		// vault::transfer_funds
		const requestIdx = baseIdx + commands.length;
		commands.push(
			TransactionCommands.MoveCall({
				package: cfg.packageId,
				module: 'vault',
				function: 'transfer_funds',
				arguments: [
					fromVaultArg,
					{ $kind: 'Result', Result: authIdx },
					toVaultArg,
					this.addTemplateInput('pure', Inputs.Pure(bcs.u64().serialize(BigInt(amount)))),
				],
				typeArguments: [normalizeStructTag(assetType)],
			}),
		);
		const requestArg: Argument = { $kind: 'Result', Result: requestIdx };

		// Issuer-defined approval commands from templates
		for (const templateCmd of templateCmds) {
			commands.push(
				buildMoveCallCommandFromTemplate(templateCmd, {
					addInput: (type, arg) => this.addTemplateInput(type, arg),
					senderVault: fromVaultArg,
					receiverVault: toVaultArg,
					rule: ruleArg,
					request: requestArg,
					systemType: assetType,
				}),
			);
		}

		// transfer_funds::resolve
		const resultOffset = commands.length;
		commands.push(
			TransactionCommands.MoveCall({
				package: cfg.packageId,
				module: 'transfer_funds',
				function: 'resolve',
				arguments: [requestArg, ruleArg],
				typeArguments: [normalizeStructTag(assetType)],
			}),
		);

		return { commands, resultOffset };
	}

	/**
	 * Builds commands for both restricted and unrestricted unlock flows.
	 * Restricted: requires a Rule, runs issuer approval templates, then resolve.
	 * Unrestricted: no Rule needed, calls resolve_unrestricted directly.
	 */
	buildUnlockFunds(
		data: UnlockFundsIntentData | UnlockUnrestrictedFundsIntentData,
		baseIdx: number,
	): BuildResult {
		const { from, assetType, amount, packageConfig: cfg } = data;
		const fromVaultId = deriveVaultAddress(from, cfg);
		const ruleId = deriveRuleAddress(assetType, cfg);

		const isRestricted = data.action === 'unlockFunds';

		if (isRestricted) {
			this.getObjectOrThrow(
				ruleId,
				() =>
					new PASClientError(
						`Rule does not exist for asset type ${assetType}. ` +
							`That means that the issuer has not yet enabled funds management for this asset. ` +
							`If this is a non-managed asset, you can use the unrestricted unlock flow by calling unlockUnrestrictedFunds() instead.`,
					),
			);
		} else {
			if (this.objects.get(ruleId) !== null) {
				throw new PASClientError(
					`A rule exists for asset type ${assetType}. That means that the issuer has enabled funds management for this asset and you can no longer use the unrestricted unlock flow.`,
				);
			}
		}

		const commands: Command[] = [];
		const fromVaultArg = this.resolveVaultArg(fromVaultId, from, cfg, commands, baseIdx);
		const ruleArg = isRestricted ? this.addObjectInput(ruleId) : undefined;

		// vault::new_auth
		const authIdx = baseIdx + commands.length;
		commands.push(
			TransactionCommands.MoveCall({
				package: cfg.packageId,
				module: 'vault',
				function: 'new_auth',
			}),
		);

		// vault::unlock_funds
		const requestIdx = baseIdx + commands.length;
		commands.push(
			TransactionCommands.MoveCall({
				package: cfg.packageId,
				module: 'vault',
				function: 'unlock_funds',
				arguments: [
					fromVaultArg,
					{ $kind: 'Result', Result: authIdx },
					this.addTemplateInput('pure', Inputs.Pure(bcs.u64().serialize(BigInt(amount)))),
				],
				typeArguments: [normalizeStructTag(assetType)],
			}),
		);
		const requestArg: Argument = { $kind: 'Result', Result: requestIdx };

		if (isRestricted) {
			// Issuer-defined approval commands from templates
			const templateCmds = this.resolveTemplateCommands(ruleId, PASActionType.UnlockFunds, cfg);
			for (const templateCmd of templateCmds) {
				commands.push(
					buildMoveCallCommandFromTemplate(templateCmd, {
						addInput: (type, arg) => this.addTemplateInput(type, arg),
						senderVault: fromVaultArg,
						rule: ruleArg,
						request: requestArg,
						systemType: assetType,
					}),
				);
			}

			// unlock_funds::resolve
			const resultOffset = commands.length;
			commands.push(
				TransactionCommands.MoveCall({
					package: cfg.packageId,
					module: 'unlock_funds',
					function: 'resolve',
					arguments: [requestArg, ruleArg!],
					typeArguments: [normalizeStructTag(assetType)],
				}),
			);
			return { commands, resultOffset };
		}

		// unlock_funds::resolve_unrestricted
		const resultOffset = commands.length;
		commands.push(
			TransactionCommands.MoveCall({
				package: cfg.packageId,
				module: 'unlock_funds',
				function: 'resolve_unrestricted',
				arguments: [requestArg, this.addObjectInput(cfg.namespaceId)],
				typeArguments: [normalizeStructTag(assetType)],
			}),
		);
		return { commands, resultOffset };
	}

	// -- Finalization ---------------------------------------------------------

	/**
	 * Appends `vault::share` commands for every vault that was created during
	 * resolution. Called once at the end, after all intents have been resolved,
	 * so that each vault is shared exactly once regardless of how many intents
	 * referenced it.
	 */
	appendVaultShares() {
		for (const [, state] of this.vaults) {
			if (state.kind !== 'created') continue;
			this.#txData.commands.push(
				TransactionCommands.MoveCall({
					package: state.cfg.packageId,
					module: 'vault',
					function: 'share',
					arguments: [{ $kind: 'Result', Result: state.resultIndex }],
				}),
			);
		}
	}
}

// ---------------------------------------------------------------------------
// Data collection + fetching (pre-resolution)
// ---------------------------------------------------------------------------

interface PreFetchRequirements {
	objectIds: Set<string>;
	vaultRequests: Map<string, { owner: string; cfg: PASPackageConfig }>;
	intentDataList: PASIntentData[];
}

/** Scans commands for PAS intents and collects the object IDs we need to fetch. */
function collectPreFetchRequirements(commands: readonly Command[]): PreFetchRequirements | null {
	const objectIds = new Set<string>();
	const vaultRequests = new Map<string, { owner: string; cfg: PASPackageConfig }>();
	const intentDataList: PASIntentData[] = [];

	for (const command of commands) {
		if (command.$kind !== '$Intent' || command.$Intent.name !== PAS_INTENT_NAME) continue;

		const data = command.$Intent.data as unknown as PASIntentData;
		intentDataList.push(data);
		const cfg = data.packageConfig;

		switch (data.action) {
			case 'transferFunds': {
				const fromId = deriveVaultAddress(data.from, cfg);
				const toId = deriveVaultAddress(data.to, cfg);
				objectIds.add(fromId);
				objectIds.add(toId);
				objectIds.add(deriveRuleAddress(data.assetType, cfg));
				vaultRequests.set(fromId, { owner: data.from, cfg });
				vaultRequests.set(toId, { owner: data.to, cfg });
				break;
			}
			case 'unlockFunds':
			case 'unlockUnrestrictedFunds': {
				const fromId = deriveVaultAddress(data.from, cfg);
				objectIds.add(fromId);
				objectIds.add(deriveRuleAddress(data.assetType, cfg));
				vaultRequests.set(fromId, { owner: data.from, cfg });
				break;
			}
			case 'vaultForAddress': {
				const id = deriveVaultAddress(data.owner, cfg);
				objectIds.add(id);
				vaultRequests.set(id, { owner: data.owner, cfg });
				break;
			}
		}
	}

	return intentDataList.length > 0 ? { objectIds, vaultRequests, intentDataList } : null;
}

interface FetchedState {
	objects: Map<string, SuiObject | null>;
	templateDFs: Map<string, SuiObject>;
	templateLookup: Map<string, string[]>;
	vaults: Map<string, VaultState>;
}

async function fetchOnChainState(
	client: NonNullable<Parameters<TransactionPlugin>[1]['client']>,
	objectIds: Set<string>,
	vaultRequests: Map<string, { owner: string; cfg: PASPackageConfig }>,
	intentDataList: PASIntentData[],
): Promise<FetchedState> {
	// 1. Batch-fetch all vaults + rules
	const allIds = [...objectIds];
	const { objects: fetched } = await client.core.getObjects({
		objectIds: allIds,
		include: { content: true },
	});

	const objects = new Map<string, SuiObject | null>();
	for (let i = 0; i < allIds.length; i++) {
		const obj = fetched[i];
		objects.set(
			allIds[i],
			obj && !(obj instanceof Error) && obj.content ? (obj as SuiObject) : null,
		);
	}

	// 2. Build initial vault map (existing vs needs-creation)
	const vaults = new Map<string, VaultState>();
	for (const [vaultId] of vaultRequests) {
		if (objects.get(vaultId) !== null) {
			vaults.set(vaultId, { kind: 'existing' });
		}
	}

	// 3. Collect template DF IDs by parsing rules
	const templateLookup = new Map<string, string[]>();
	const templateDFIds: string[] = [];
	const seen = new Set<string>();

	for (const data of intentDataList) {
		let actionType: PASActionType | null = null;
		let assetType: string | null = null;

		if (data.action === 'transferFunds') {
			actionType = PASActionType.TransferFunds;
			assetType = data.assetType;
		} else if (data.action === 'unlockFunds') {
			actionType = PASActionType.UnlockFunds;
			assetType = data.assetType;
		}

		if (!actionType || !assetType) continue;

		const ruleId = deriveRuleAddress(assetType, data.packageConfig);
		const key = `${ruleId}:${actionType}`;
		if (seen.has(key)) continue;
		seen.add(key);

		const ruleObject = objects.get(ruleId);
		if (!ruleObject) continue;

		const approvalTypeNames = getRequiredApprovals(ruleObject, actionType);
		if (!approvalTypeNames?.length) continue;

		const templatesId = deriveTemplatesObjectAddress(data.packageConfig);
		templateLookup.set(key, approvalTypeNames);
		templateDFIds.push(...approvalTypeNames.map((tn) => deriveTemplateDFAddress(templatesId, tn)));
	}

	// 4. Batch-fetch all template DFs
	const templateDFs = new Map<string, SuiObject>();
	if (templateDFIds.length > 0) {
		const { objects: dfObjects } = await client.core.getObjects({
			objectIds: templateDFIds,
			include: { content: true },
		});
		for (let i = 0; i < templateDFIds.length; i++) {
			const obj = dfObjects[i];
			if (obj && !(obj instanceof Error) && obj.content) {
				templateDFs.set(templateDFIds[i], obj as SuiObject);
			}
		}
	}

	return { objects, templateDFs, templateLookup, vaults };
}

// ---------------------------------------------------------------------------
// Shared resolver (TransactionPlugin)
// ---------------------------------------------------------------------------

const resolvePASIntents: TransactionPlugin = async (transactionData, buildOptions, next) => {
	const client = buildOptions.client;
	if (!client) {
		throw new PASClientError(
			'A SuiClient must be provided to build transactions with PAS intents.',
		);
	}

	const requirements = collectPreFetchRequirements(transactionData.commands);
	if (!requirements) return next();

	const { objectIds, vaultRequests, intentDataList } = requirements;
	const state = await fetchOnChainState(client, objectIds, vaultRequests, intentDataList);
	const ctx = new Resolver(
		transactionData,
		state.objects,
		state.templateDFs,
		state.templateLookup,
		state.vaults,
	);

	// Iterate the live command list. replaceCommand mutates the array in place
	// and shifts all subsequent indices automatically, so we don't need to
	// track index offsets ourselves -- the iterator sees correct positions.
	for (const [index, command] of transactionData.commands.entries()) {
		if (command.$kind !== '$Intent' || command.$Intent.name !== PAS_INTENT_NAME) continue;

		const data = command.$Intent.data as unknown as PASIntentData;

		// -- vaultForAddress is handled separately (may produce 0 commands) --
		if (data.action === 'vaultForAddress') {
			const vaultId = deriveVaultAddress(data.owner, data.packageConfig);
			const commands: Command[] = [];
			const vaultArg = ctx.resolveVaultArg(
				vaultId,
				data.owner,
				data.packageConfig,
				commands,
				index,
			);

			if (commands.length === 0) {
				ctx.replaceIntentWithExistingVault(index, vaultArg);
			} else {
				ctx.replaceIntentWithCreatedVault(index, commands);
			}
			continue;
		}

		// -- Standard action intents --
		let result: BuildResult;
		switch (data.action) {
			case 'transferFunds':
				result = ctx.buildTransferFunds(data, index);
				break;
			case 'unlockFunds':
			case 'unlockUnrestrictedFunds':
				result = ctx.buildUnlockFunds(data, index);
				break;
			default:
				continue;
		}

		ctx.replaceIntent(index, result.commands, result.resultOffset);
	}

	ctx.appendVaultShares();
	return next();
};
