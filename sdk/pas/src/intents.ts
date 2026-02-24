// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { bcs } from '@mysten/sui/bcs';
import type { ClientWithCoreApi, SuiClientTypes } from '@mysten/sui/client';
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
	deriveChestAddress,
	derivePolicyAddress,
	deriveTemplateAddress,
	deriveTemplateRegistryAddress,
} from './derivation.js';
import { PASClientError, PolicyNotFoundError } from './error.js';
import {
	buildMoveCallCommandFromTemplate,
	getCommandFromTemplate,
	getRequiredApprovals,
	PASActionType,
} from './resolution.js';
import type { PASPackageConfig } from './types.js';

const PAS_INTENT_NAME = 'PAS';

// ---------------------------------------------------------------------------
// Intent data types
// ---------------------------------------------------------------------------

type TransferFundsIntentData = {
	action: 'transferFunds';
	from: string;
	to: string;
	amount: string;
	assetType: string;
	cfg: PASPackageConfig;
};

type UnlockFundsIntentData = {
	action: 'unlockFunds';
	from: string;
	amount: string;
	assetType: string;
	cfg: PASPackageConfig;
};

type UnlockUnrestrictedFundsIntentData = {
	action: 'unlockUnrestrictedFunds';
	from: string;
	amount: string;
	assetType: string;
	cfg: PASPackageConfig;
};

type ChestForAddressIntentData = {
	action: 'chestForAddress';
	owner: string;
	cfg: PASPackageConfig;
};

type PASIntentData =
	| TransferFundsIntentData
	| UnlockFundsIntentData
	| UnlockUnrestrictedFundsIntentData
	| ChestForAddressIntentData;

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
			cfg: packageConfig,
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
			cfg: packageConfig,
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
			cfg: packageConfig,
		});
}

export function chestForAddressIntent(
	packageConfig: PASPackageConfig,
): (owner: string) => (tx: Transaction) => TransactionResult {
	return (owner: string) =>
		createPASIntent({ action: 'chestForAddress', owner, cfg: packageConfig });
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
// So if baseIdx is 3 and we push 2 chest-creation commands before the
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

type ChestState = { kind: 'existing' } | { kind: 'created'; resultIndex: number };

/** Return value from each per-action builder. */
interface BuildResult {
	commands: Command[];
	/** Offset within `commands` of the command whose Result is the intent's output. */
	resultOffset: number;
}

class Resolver {
	/** Pre-fetched on-chain objects (chests, policies). null = does not exist. */
	readonly objects: Map<string, SuiObject | null>;
	/** Pre-fetched template dynamic field objects. */
	readonly templates: Map<string, SuiObject>;
	/** Pre-parsed template lookup: policyId:actionType -> approval type names. */
	readonly templateApprovals: Map<string, string[]>;
	/** Chest existence / creation tracking. */
	readonly chests: Map<string, ChestState>;

	readonly #tx: TransactionDataBuilder;
	readonly #inputCache = new Map<string, Argument>();
	readonly #templateCommandsCache = new Map<string, ReturnType<typeof getCommandFromTemplate>[]>();
	readonly #config: PASPackageConfig;

	constructor({
		transactionData,
		objects,
		templates,
		templateApprovals,
		chests,
		config,
	}: {
		transactionData: TransactionDataBuilder;
		objects: Map<string, SuiObject | null>;
		templates: Map<string, SuiObject>;
		templateApprovals: Map<string, string[]>;
		chests: Map<string, ChestState>;
		config: PASPackageConfig;
	}) {
		this.#tx = transactionData;
		this.objects = objects;
		this.templates = templates;
		this.templateApprovals = templateApprovals;
		this.chests = chests;
		this.#config = config;
	}

	// -- Input helpers (deduplicated) ----------------------------------------

	addObjectInput(objectId: string): Argument {
		let arg = this.#inputCache.get(objectId);
		if (!arg) {
			arg = this.#tx.addInput('object', {
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
			arg = this.#tx.addInput('pure', value);
			this.#inputCache.set(key, arg);
		}
		return arg;
	}

	addTemplateInput(type: 'object' | 'pure', arg: CallArg): Argument {
		if (type === 'object' && arg.$kind === 'UnresolvedObject') {
			return this.addObjectInput(arg.UnresolvedObject.objectId);
		}
		return this.#tx.addInput(type, arg);
	}

	// -- Object lookup -------------------------------------------------------

	getObjectOrThrow(objectId: string, errorFactory: () => Error): SuiObject {
		const obj = this.objects.get(objectId);
		if (!obj) throw errorFactory();
		return obj;
	}

	// -- Chest resolution ----------------------------------------------------

	/**
	 * Returns an Argument referencing the chest for `chestId`.
	 *
	 * - Existing on-chain chest: returns an object Input.
	 * - Already created earlier in this PTB: returns the stored Result ref.
	 * - Does not exist yet: **pushes** a `chest::create` MoveCall into the
	 *   caller's `commands` array (mutating it) and records the creation so
	 *   subsequent calls for the same chest reuse the same Result. The chest
	 *   will be shared at the end of the PTB via `shareNewChests()`.
	 *
	 * @param commands - The caller's local command array (may be mutated).
	 * @param baseIdx  - Absolute PTB index where `commands[0]` will land.
	 */
	resolveChestArg(chestId: string, owner: string, baseIdx: number): [Argument, Command[]] {
		const state = this.chests.get(chestId);
		const commands: Command[] = [];

		if (state?.kind === 'existing') return [this.addObjectInput(chestId), commands];

		if (state?.kind === 'created')
			return [{ $kind: 'Result', Result: state.resultIndex }, commands];

		const absoluteIndex = baseIdx + commands.length;
		commands.push(
			TransactionCommands.MoveCall({
				package: this.#config.packageId,
				module: 'chest',
				function: 'create',
				arguments: [
					this.addObjectInput(this.#config.namespaceId),
					this.addPureInput(`address:${owner}`, Inputs.Pure(bcs.Address.serialize(owner))),
				],
			}),
		);

		this.chests.set(chestId, { kind: 'created', resultIndex: absoluteIndex });
		return [{ $kind: 'Result', Result: absoluteIndex }, commands];
	}

	// -- Template resolution (synchronous, all data pre-fetched) -------------

	resolveTemplateCommands(policyObjectId: string, actionType: PASActionType) {
		const cacheKey = `${policyObjectId}:${actionType}`;
		const cached = this.#templateCommandsCache.get(cacheKey);
		if (cached) return cached;

		const approvalTypeNames = this.templateApprovals.get(cacheKey);
		if (!approvalTypeNames) {
			throw new PASClientError(
				`No required approvals found for action "${actionType}". The issuer has not configured this action.`,
			);
		}

		const templatesId = deriveTemplateRegistryAddress(this.#config);
		const commands = approvalTypeNames.map((tn) => {
			const templateId = deriveTemplateAddress(templatesId, tn);
			const template = this.templates.get(templateId);
			if (!template) {
				throw new PASClientError(
					`Template not found for approval type "${tn}". The issuer has not set up the template command.`,
				);
			}
			return getCommandFromTemplate(template);
		});

		this.#templateCommandsCache.set(cacheKey, commands);
		return commands;
	}

	/**
	 * Replaces a standard action intent (transfer/unlock) with its built
	 * commands. The resolve call at `actualIdx + resultOffset` produces the
	 * intent's output value.
	 */
	replaceIntent(actualIdx: number, commands: Command[], resultOffset: number) {
		this.#tx.replaceCommand(actualIdx, commands, { Result: actualIdx + resultOffset });
	}

	/**
	 * Replaces a chestForAddress intent when the chest already exists.
	 * The intent is removed (0 replacement commands) and external references
	 * are remapped to the existing chest's Input argument.
	 *
	 * Note: SDK's replaceCommand signature doesn't accept Input args as
	 * resultIndex, but the runtime handles it correctly via ArgumentSchema.parse().
	 */
	replaceIntentWithExistingChest(actualIdx: number, chestArg: Argument) {
		this.#tx.replaceCommand(actualIdx, [], chestArg as any);
	}

	/**
	 * Replaces a chestForAddress intent when the chest needs to be created.
	 * The intent is replaced with the chest::create command(s), and external
	 * references are remapped to the first command's Result (the new chest).
	 */
	replaceIntentWithCreatedChest(actualIdx: number, commands: Command[]) {
		this.#tx.replaceCommand(actualIdx, commands, { Result: actualIdx });
	}

	// -- Per-action builders --------------------------------------------------
	//
	// Each builder constructs a local `commands` array representing the
	// sequence of MoveCall commands that replace the intent. Commands
	// reference each other using absolute indices (baseIdx + local offset).
	//
	// The general pattern for a transfer is:
	//   [chest::create (0..N)]  -- only if chests don't exist yet
	//   chest::new_auth         -- create ownership proof
	//   chest::transfer_funds   -- initiate the request
	//   [approval commands]     -- issuer-defined template commands
	//   transfer_funds::resolve -- finalize and produce the output
	//
	// `resultOffset` points at the last command (resolve), whose Result
	// becomes the intent's output value.

	buildTransferFunds(data: TransferFundsIntentData, baseIdx: number): BuildResult {
		const { from, to, assetType, amount } = data;
		const fromChestId = deriveChestAddress(from, this.#config);
		const toChestId = deriveChestAddress(to, this.#config);

		const policyId = derivePolicyAddress(assetType, this.#config);
		const policyObject = this.getObjectOrThrow(policyId, () => new PolicyNotFoundError(assetType));
		const templateCmds = this.resolveTemplateCommands(
			policyObject.objectId,
			PASActionType.TransferFunds,
		);

		const [toChestArg, commands] = this.resolveChestArg(toChestId, to, baseIdx);
		const [fromChestArg, fromChestCommands] = this.resolveChestArg(
			fromChestId,
			from,
			baseIdx + commands.length,
		);
		commands.push(...fromChestCommands);

		const policyArg = this.addObjectInput(policyId);

		// chest::new_auth
		const authIdx = baseIdx + commands.length;
		commands.push(
			TransactionCommands.MoveCall({
				package: this.#config.packageId,
				module: 'chest',
				function: 'new_auth',
			}),
		);

		// chest::transfer_funds
		const requestIdx = baseIdx + commands.length;
		commands.push(
			TransactionCommands.MoveCall({
				package: this.#config.packageId,
				module: 'chest',
				function: 'transfer_funds',
				arguments: [
					fromChestArg,
					{ $kind: 'Result', Result: authIdx },
					toChestArg,
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
					senderChest: fromChestArg,
					receiverChest: toChestArg,
					policy: policyArg,
					request: requestArg,
					systemType: assetType,
				}),
			);
		}

		// transfer_funds::resolve
		const resultOffset = commands.length;
		commands.push(
			TransactionCommands.MoveCall({
				package: this.#config.packageId,
				module: 'transfer_funds',
				function: 'resolve',
				arguments: [requestArg, policyArg],
				typeArguments: [normalizeStructTag(assetType)],
			}),
		);

		return { commands, resultOffset };
	}

	/**
	 * Builds commands for both restricted and unrestricted unlock flows.
	 * Restricted: requires a Policy, runs issuer approval templates, then resolve.
	 * Unrestricted: no Policy needed, calls resolve_unrestricted directly.
	 */
	buildUnlockFunds(
		data: UnlockFundsIntentData | UnlockUnrestrictedFundsIntentData,
		baseIdx: number,
	): BuildResult {
		const { from, assetType, amount } = data;
		const fromChestId = deriveChestAddress(from, this.#config);
		const policyId = derivePolicyAddress(assetType, this.#config);

		const isRestricted = data.action === 'unlockFunds';

		if (isRestricted) {
			this.getObjectOrThrow(
				policyId,
				() =>
					new PASClientError(
						`Policy does not exist for asset type ${assetType}. ` +
							`That means that the issuer has not yet enabled funds management for this asset. ` +
							`If this is a non-managed asset, you can use the unrestricted unlock flow by calling unlockUnrestrictedFunds() instead.`,
					),
			);
		} else {
			if (this.objects.get(policyId) !== null) {
				throw new PASClientError(
					`A policy exists for asset type ${assetType}. That means that the issuer has enabled funds management for this asset and you can no longer use the unrestricted unlock flow.`,
				);
			}
		}

		const [fromChestArg, commands] = this.resolveChestArg(fromChestId, from, baseIdx);
		const policyArg = isRestricted ? this.addObjectInput(policyId) : undefined;

		// chest::new_auth
		const authIdx = baseIdx + commands.length;
		commands.push(
			TransactionCommands.MoveCall({
				package: this.#config.packageId,
				module: 'chest',
				function: 'new_auth',
			}),
		);

		// chest::unlock_funds
		const requestIdx = baseIdx + commands.length;
		commands.push(
			TransactionCommands.MoveCall({
				package: this.#config.packageId,
				module: 'chest',
				function: 'unlock_funds',
				arguments: [
					fromChestArg,
					{ $kind: 'Result', Result: authIdx },
					this.addTemplateInput('pure', Inputs.Pure(bcs.u64().serialize(BigInt(amount)))),
				],
				typeArguments: [normalizeStructTag(assetType)],
			}),
		);
		const requestArg: Argument = { $kind: 'Result', Result: requestIdx };

		if (isRestricted) {
			// Issuer-defined approval commands from templates
			const templateCmds = this.resolveTemplateCommands(policyId, PASActionType.UnlockFunds);
			for (const templateCmd of templateCmds) {
				commands.push(
					buildMoveCallCommandFromTemplate(templateCmd, {
						addInput: (type, arg) => this.addTemplateInput(type, arg),
						senderChest: fromChestArg,
						policy: policyArg,
						request: requestArg,
						systemType: assetType,
					}),
				);
			}

			// unlock_funds::resolve
			const resultOffset = commands.length;
			commands.push(
				TransactionCommands.MoveCall({
					package: this.#config.packageId,
					module: 'unlock_funds',
					function: 'resolve',
					arguments: [requestArg, policyArg!],
					typeArguments: [normalizeStructTag(assetType)],
				}),
			);
			return { commands, resultOffset };
		}

		// unlock_funds::resolve_unrestricted
		const resultOffset = commands.length;
		commands.push(
			TransactionCommands.MoveCall({
				package: this.#config.packageId,
				module: 'unlock_funds',
				function: 'resolve_unrestricted',
				arguments: [requestArg, this.addObjectInput(this.#config.namespaceId)],
				typeArguments: [normalizeStructTag(assetType)],
			}),
		);
		return { commands, resultOffset };
	}

	// -- Finalization ---------------------------------------------------------

	/**
	 * Appends `chest::share` commands for every chest that was created during
	 * resolution. Called once at the end, after all intents have been resolved,
	 * so that each chest is shared exactly once regardless of how many intents
	 * referenced it.
	 */
	shareNewChests() {
		for (const state of this.chests.values()) {
			if (state.kind !== 'created') continue;
			this.#tx.commands.push(
				TransactionCommands.MoveCall({
					package: this.#config.packageId,
					module: 'chest',
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

type ChestOwner = { owner: string };

interface IntentDataCollection {
	objectIds: Set<string>;
	chestRequests: Map<string, ChestOwner>;
	intentDataList: PASIntentData[];
	cfg: PASPackageConfig;
}

/** Scans commands for PAS intents and collects the object IDs we need to fetch. */
function collectIntentData(commands: readonly Command[]): IntentDataCollection | null {
	const objectIds = new Set<string>();
	const chestRequests = new Map<string, ChestOwner>();
	const intentDataList: PASIntentData[] = [];
	let cfg: PASPackageConfig | null = null;

	for (const command of commands) {
		if (command.$kind !== '$Intent' || command.$Intent.name !== PAS_INTENT_NAME) continue;
		const data = command.$Intent.data as unknown as PASIntentData;

		if (!cfg) cfg = data.cfg;
		intentDataList.push(data);

		switch (data.action) {
			case 'transferFunds': {
				const fromId = deriveChestAddress(data.from, cfg);
				const toId = deriveChestAddress(data.to, cfg);
				objectIds.add(fromId);
				objectIds.add(toId);
				objectIds.add(derivePolicyAddress(data.assetType, cfg));
				chestRequests.set(fromId, { owner: data.from });
				chestRequests.set(toId, { owner: data.to });
				break;
			}
			case 'unlockFunds':
			case 'unlockUnrestrictedFunds': {
				const fromId = deriveChestAddress(data.from, cfg);
				objectIds.add(fromId);
				objectIds.add(derivePolicyAddress(data.assetType, cfg));
				chestRequests.set(fromId, { owner: data.from });
				break;
			}
			case 'chestForAddress': {
				const id = deriveChestAddress(data.owner, cfg);
				objectIds.add(id);
				chestRequests.set(id, { owner: data.owner });
				break;
			}
		}
	}

	if (!cfg)
		throw new PASClientError('No package configuration found in intents. This is an internal bug.');

	return intentDataList.length > 0 ? { objectIds, chestRequests, intentDataList, cfg } : null;
}

async function initializeContext(
	transactionData: TransactionDataBuilder,
	client: ClientWithCoreApi,
	objectIds: Set<string>,
	chestRequests: Map<string, ChestOwner>,
	intentDataList: PASIntentData[],
	config: PASPackageConfig,
): Promise<Resolver> {
	// 1. Batch-fetch all chests + policies
	const allIds = [...objectIds];
	const { objects: fetched } = await client.core.getObjects({
		objectIds: allIds,
		include: { content: true },
	});

	const objects = new Map<string, SuiObject | null>();

	for (const id of allIds) {
		const obj = fetched.filter((o) => 'content' in o).find((o) => o.objectId === id);
		objects.set(id, obj ?? null);
	}

	// 2. Build initial chest map (existing vs needs-creation)
	const chests = new Map<string, ChestState>();
	for (const [chestId] of chestRequests) {
		if (objects.get(chestId) !== null) {
			chests.set(chestId, { kind: 'existing' });
		}
	}

	// 3. Collect template DF IDs by parsing rules
	const templateApprovals = new Map<string, string[]>();
	const templateIds: string[] = [];
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

		const policyId = derivePolicyAddress(assetType, config);
		const key = `${policyId}:${actionType}`;
		if (seen.has(key)) continue;
		seen.add(key);

		const policyObject = objects.get(policyId);
		if (!policyObject) continue;

		const approvalTypeNames = getRequiredApprovals(policyObject, actionType);
		if (!approvalTypeNames?.length) continue;

		const templatesId = deriveTemplateRegistryAddress(config);
		templateApprovals.set(key, approvalTypeNames);
		templateIds.push(...approvalTypeNames.map((tn) => deriveTemplateAddress(templatesId, tn)));
	}

	// 4. Batch-fetch all template data
	const templates = new Map<string, SuiObject>();
	if (templateIds.length > 0) {
		const { objects: templateObjects } = await client.core.getObjects({
			objectIds: templateIds,
			include: { content: true },
		});

		for (const obj of templateObjects.filter((o) => 'content' in o)) {
			templates.set(obj.objectId, obj);
		}
	}

	return new Resolver({
		transactionData,
		objects,
		templates,
		templateApprovals,
		chests,
		config,
	});
}

const resolvePASIntents: TransactionPlugin = async (transactionData, buildOptions, next) => {
	const client = buildOptions.client;
	if (!client)
		throw new PASClientError(
			'A SuiClient must be provided to build transactions with PAS intents.',
		);

	const requirements = collectIntentData(transactionData.commands);
	if (!requirements) return next();

	const { objectIds, chestRequests, intentDataList, cfg } = requirements;

	const ctx = await initializeContext(
		transactionData,
		client,
		objectIds,
		chestRequests,
		intentDataList,
		cfg,
	);

	// Iterate the live command list. replaceCommand mutates the array in place
	// and shifts all subsequent indices automatically, so we don't need to
	// track index offsets ourselves -- the iterator sees correct positions.
	for (const [index, command] of transactionData.commands.entries()) {
		if (command.$kind !== '$Intent' || command.$Intent.name !== PAS_INTENT_NAME) continue;

		const data = command.$Intent.data as unknown as PASIntentData;

		// -- chestForAddress is handled separately (may produce 0 commands) --
		if (data.action === 'chestForAddress') {
			const chestId = deriveChestAddress(data.owner, cfg);
			const [chestArg, commands] = ctx.resolveChestArg(chestId, data.owner, index);

			if (commands.length === 0) {
				ctx.replaceIntentWithExistingChest(index, chestArg);
			} else {
				ctx.replaceIntentWithCreatedChest(index, commands);
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

	ctx.shareNewChests();
	return next();
};
