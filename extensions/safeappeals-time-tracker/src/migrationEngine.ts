/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

/** An identity returned by the secure native filesystem layer. */
export interface FileIdentity {
	readonly device: string;
	readonly inode: string;
	readonly kind: string;
	readonly linkCount: number;
}

export type MigrationPhase =
	'sourceDiscovered'
	| 'snapshotHeld'
	| 'candidateBuilding'
	| 'candidateVerified'
	| 'sourceQuarantining'
	| 'plaintextPurging'
	| 'activating'
	| 'complete';

export interface MigrationMember {
	readonly sourceName: string;
	readonly quarantineName: string;
	readonly identity: FileIdentity;
	readonly quarantineIntent: boolean;
	readonly quarantined: boolean;
	readonly purgeIntent: boolean;
	readonly purged: boolean;
}

export interface MigrationManifest {
	readonly version: 1;
	readonly txid: string;
	readonly phase: MigrationPhase;
	readonly sourceNames: readonly string[];
	readonly candidateName: string;
	readonly candidateIdentity?: FileIdentity;
	readonly destinationName: string;
	readonly schemaVersion: number;
	readonly rowCounts: Readonly<Record<string, number>>;
	readonly semanticDigest: string;
	readonly members: readonly MigrationMember[];
	readonly activationIntent: boolean;
	readonly activated: boolean;
}

export interface SourceDescription {
	readonly members: readonly { readonly name: string; readonly identity: FileIdentity }[];
	readonly schemaVersion: number;
	readonly rowCounts: Readonly<Record<string, number>>;
	readonly semanticDigest: string;
}

export interface MigrationNames {
	readonly txid: string;
	readonly candidateName: string;
	readonly destinationName: string;
	quarantineName(txid: string, sourceName: string): string;
}

export interface ManifestStore {
	open(): Promise<MigrationManifest | undefined>;
	store(manifest: MigrationManifest): Promise<void>;
	remove(): Promise<void>;
}

export interface MigrationDirectoryLock {
	observeExact(names: readonly string[]): Promise<ReadonlyMap<string, FileIdentity>>;
	quarantineCurrent(sourceName: string, quarantineName: string, expected: FileIdentity): Promise<FileIdentity>;
	deleteQuarantine(quarantineName: string, expected: FileIdentity): Promise<void>;
	activateCandidateNoReplace(candidateName: string, destinationName: string, expected: FileIdentity): Promise<FileIdentity>;
	fsyncDirectory(): Promise<void>;
}

export interface MigrationSourceAdapter {
	describeHeldSnapshot(): Promise<SourceDescription | undefined>;
}

export interface MigrationCandidateAdapter {
	verifyExistingDestination(destinationName: string, identity: FileIdentity): Promise<void>;
	createNoReplace(candidateName: string): Promise<FileIdentity>;
	openExisting(candidateName: string, expectedIdentity: FileIdentity): Promise<void>;
	/** Transactionally returns the identity-pinned, unverified candidate to an empty import state. */
	resetForImport(): Promise<void>;
	importHeldSnapshot(): Promise<void>;
	rewriteWorkspaceId(): Promise<void>;
	verify(schemaVersion: number, rowCounts: Readonly<Record<string, number>>, semanticDigest: string): Promise<void>;
	close(): Promise<void>;
	fsync(): Promise<void>;
	reopenAndVerify(name: string, expectedIdentity: FileIdentity, schemaVersion: number, rowCounts: Readonly<Record<string, number>>, semanticDigest: string): Promise<void>;
}

export interface MigrationReporter {
	log(message: string): void;
	warn(message: string): void;
}

export interface MigrationEngineDependencies {
	readonly names: MigrationNames;
	readonly manifest: ManifestStore;
	readonly sourceLock: MigrationDirectoryLock;
	readonly managedLock: MigrationDirectoryLock;
	readonly source: MigrationSourceAdapter;
	readonly candidate: MigrationCandidateAdapter;
	readonly reporter: MigrationReporter;
}

export type MigrationResult =
	{ readonly kind: 'complete' }
	| { readonly kind: 'noSource' }
	| { readonly kind: 'blocked'; readonly reason: string; readonly recoverable: boolean };

const phases: readonly MigrationPhase[] = [
	'sourceDiscovered', 'snapshotHeld', 'candidateBuilding', 'candidateVerified',
	'sourceQuarantining', 'plaintextPurging', 'activating', 'complete'
];
const safeName = /^(?!\.{1,2}$)[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
const safeArtifactName = /^(?!\.{1,2}$)[A-Za-z0-9.][A-Za-z0-9._-]{0,254}$/;
const safeTxid = /^[a-f0-9]{16,128}$/;

function identitiesEqual(left: FileIdentity, right: FileIdentity): boolean {
	return left.device === right.device && left.inode === right.inode
		&& left.kind === right.kind && left.linkCount === right.linkCount;
}

function withPhase(manifest: MigrationManifest, phase: MigrationPhase): MigrationManifest {
	return { ...manifest, phase };
}

function hasExactKeys(value: object, expected: readonly string[]): boolean {
	const actual = Object.keys(value).sort();
	return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index]);
}

function validIdentity(value: FileIdentity): boolean {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		&& Object.getPrototypeOf(value) === Object.prototype
		&& hasExactKeys(value, ['device', 'inode', 'kind', 'linkCount'])
		&& typeof value.device === 'string' && value.device.length > 0
		&& typeof value.inode === 'string' && value.inode.length > 0
		&& value.kind === 'file' && Number.isSafeInteger(value.linkCount) && value.linkCount === 1;
}

function validRowCounts(value: Readonly<Record<string, number>>): boolean {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) { return false; }
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null) { return false; }
	const allowedTables = new Set(['matters', 'billing_rates', 'time_entries']);
	const entries = Object.entries(value);
	return entries.length === allowedTables.size
		&& entries.every(([table, count]) => allowedTables.has(table)
			&& Number.isSafeInteger(count) && count >= 0);
}

function validateManifest(manifest: MigrationManifest): string | undefined {
	const manifestKeys = [
		'activated', 'activationIntent', 'candidateName', 'destinationName', 'members', 'phase',
		'rowCounts', 'schemaVersion', 'semanticDigest', 'sourceNames', 'txid', 'version',
		...(manifest.candidateIdentity ? ['candidateIdentity'] : [])
	];
	if (!hasExactKeys(manifest, manifestKeys)
		|| !Array.isArray(manifest.sourceNames) || !Array.isArray(manifest.members)
		|| typeof manifest.schemaVersion !== 'number' || !Number.isSafeInteger(manifest.schemaVersion) || manifest.schemaVersion < 0
		|| typeof manifest.semanticDigest !== 'string' || manifest.semanticDigest.length === 0 || manifest.semanticDigest.length > 256
		|| !validRowCounts(manifest.rowCounts)
		|| typeof manifest.activationIntent !== 'boolean' || typeof manifest.activated !== 'boolean') {
		return 'The authenticated migration manifest does not match the exact runtime schema';
	}
	if (manifest.version !== 1 || !safeTxid.test(manifest.txid) || !phases.includes(manifest.phase)) {
		return 'The authenticated migration manifest has an invalid version, transaction, or phase';
	}
	const expectedCandidateName = `.safeappeals-tx-db-${manifest.txid}`;
	if (!safeArtifactName.test(manifest.candidateName) || manifest.candidateName !== expectedCandidateName
		|| !safeName.test(manifest.destinationName) || manifest.candidateName === manifest.destinationName
		|| manifest.sourceNames.some(name => !safeName.test(name))
		|| new Set(manifest.sourceNames).size !== manifest.sourceNames.length) {
		return 'The authenticated migration manifest contains invalid or duplicate names';
	}
	if (manifest.members.length === 0
		|| manifest.members.length !== manifest.sourceNames.length
		|| manifest.members.some((member, index) => !hasExactKeys(member, [
			'identity', 'purgeIntent', 'purged', 'quarantineIntent', 'quarantineName', 'quarantined', 'sourceName'
		]) || !validIdentity(member.identity)
			|| typeof member.quarantineIntent !== 'boolean' || typeof member.quarantined !== 'boolean'
			|| typeof member.purgeIntent !== 'boolean' || typeof member.purged !== 'boolean'
			|| member.sourceName !== manifest.sourceNames[index]
			|| !safeArtifactName.test(member.quarantineName)
			|| member.quarantineName !== `.safeappeals-tx-${manifest.txid}-${member.sourceName}`
			|| member.quarantined && !member.quarantineIntent
			|| member.purgeIntent && !member.quarantined
			|| member.purged && !member.purgeIntent)) {
		return 'The authenticated migration manifest has inconsistent member state';
	}
	if (manifest.activated && !manifest.activationIntent) {
		return 'The authenticated migration manifest has inconsistent activation state';
	}
	if (manifest.candidateIdentity && !validIdentity(manifest.candidateIdentity)) {
		return 'The authenticated migration manifest has a malformed candidate identity';
	}
	if (phases.indexOf(manifest.phase) >= phases.indexOf('candidateVerified') && !manifest.candidateIdentity) {
		return 'The authenticated migration manifest is missing the verified candidate identity';
	}
	const phaseIndex = phases.indexOf(manifest.phase);
	const hasQuarantineState = manifest.members.some(member => member.quarantineIntent || member.quarantined);
	const hasPurgeState = manifest.members.some(member => member.purgeIntent || member.purged);
	if (phaseIndex < phases.indexOf('sourceQuarantining') && hasQuarantineState
		|| phaseIndex < phases.indexOf('plaintextPurging') && hasPurgeState
		|| phaseIndex < phases.indexOf('activating') && (manifest.activationIntent || manifest.activated)
		|| phaseIndex >= phases.indexOf('plaintextPurging') && manifest.members.some(member => !member.quarantined)
		|| phaseIndex >= phases.indexOf('activating') && manifest.members.some(member => !member.purged)
		|| phaseIndex < phases.indexOf('candidateBuilding') && Boolean(manifest.candidateIdentity)
		|| manifest.phase === 'complete' && !manifest.activated) {
		return 'The authenticated migration manifest contains an impossible or replayed phase state';
	}
	return undefined;
}

function replaceMember(manifest: MigrationManifest, index: number, member: MigrationMember): MigrationManifest {
	return { ...manifest, members: manifest.members.map((value, memberIndex) => memberIndex === index ? member : value) };
}

/** Crash-recoverable plaintext-to-encrypted database migration state machine. */
export class MigrationEngine {
	constructor(private readonly dependencies: MigrationEngineDependencies) {}

	async run(): Promise<MigrationResult> {
		let manifest: MigrationManifest | undefined;
		try {
			manifest = await this.dependencies.manifest.open();
		} catch (error) {
			return this.blocked(`Migration manifest could not be authenticated: ${this.message(error)}`, false);
		}
		if (manifest) {
			let invalid: string | undefined;
			try {
				invalid = validateManifest(manifest);
			} catch (error) {
				return this.blocked(`The authenticated migration manifest has a malformed runtime shape: ${this.message(error)}`, false);
			}
			if (invalid) {
				return this.blocked(invalid, false);
			}
			const manifestTxid = manifest.txid;
			if (manifestTxid !== this.dependencies.names.txid
				|| manifest.candidateName !== this.dependencies.names.candidateName
				|| manifest.destinationName !== this.dependencies.names.destinationName
				|| manifest.members.some(member => member.quarantineName
					!== this.dependencies.names.quarantineName(manifestTxid, member.sourceName))) {
				return this.blocked('The authenticated migration manifest was replayed in a different transaction context', false);
			}
		} else {
			const destination = await this.dependencies.managedLock.observeExact([this.dependencies.names.destinationName]);
			const source = await this.dependencies.source.describeHeldSnapshot();
			const destinationIdentity = destination.get(this.dependencies.names.destinationName);
			if (destinationIdentity) {
				if (source) {
					return this.blocked('Destination and plaintext source coexist without an authenticated migration manifest', false);
				}
				try {
					await this.dependencies.candidate.verifyExistingDestination(
						this.dependencies.names.destinationName, destinationIdentity);
					return { kind: 'noSource' };
				} catch (error) {
					return this.blocked(`Unmanaged destination could not be verified: ${this.message(error)}`, false);
				}
			}
			if (!source) {
				return { kind: 'noSource' };
			}
			if (!Array.isArray(source.members) || source.members.length === 0
				|| source.members.some(member => typeof member !== 'object' || member === null
					|| !hasExactKeys(member, ['identity', 'name'])
					|| typeof member.name !== 'string' || !safeName.test(member.name)
					|| !validIdentity(member.identity))
				|| !Number.isSafeInteger(source.schemaVersion) || source.schemaVersion < 0
				|| !validRowCounts(source.rowCounts)
				|| typeof source.semanticDigest !== 'string' || source.semanticDigest.length === 0
				|| source.semanticDigest.length > 256) {
				return this.blocked('Source discovery returned invalid or duplicate opaque basenames', false);
			}
			const sourceNames = source.members.map(member => member.name);
			if (new Set(sourceNames).size !== sourceNames.length || !safeTxid.test(this.dependencies.names.txid)) {
				return this.blocked('Source discovery returned invalid or duplicate opaque basenames', false);
			}
			manifest = {
				version: 1, txid: this.dependencies.names.txid, phase: 'sourceDiscovered',
				sourceNames, candidateName: this.dependencies.names.candidateName,
				destinationName: this.dependencies.names.destinationName,
				schemaVersion: source.schemaVersion, rowCounts: source.rowCounts,
				semanticDigest: source.semanticDigest,
				members: source.members.map(member => ({
					sourceName: member.name,
					quarantineName: this.dependencies.names.quarantineName(this.dependencies.names.txid, member.name),
					identity: member.identity, quarantineIntent: false, quarantined: false,
					purgeIntent: false, purged: false
				})),
				activationIntent: false, activated: false
			};
			let invalid: string | undefined;
			try { invalid = validateManifest(manifest); } catch (error) {
				return this.blocked(`Source discovery produced a malformed manifest: ${this.message(error)}`, false);
			}
			if (invalid) {
				return this.blocked(invalid, false);
			}
			try {
				await this.dependencies.manifest.store(manifest);
			} catch (error) {
				return this.blocked(`Initial migration intent could not be stored: ${this.message(error)}`, true);
			}
		}

		try {
			manifest = await this.reconcile(manifest);
			if (phases.indexOf(manifest.phase) >= phases.indexOf('candidateVerified')) {
				await this.verifyDurableDatabase(manifest, manifest.activated ? manifest.destinationName : manifest.candidateName);
			}
			if (manifest.phase === 'complete') {
				await this.dependencies.manifest.remove();
				return { kind: 'complete' };
			}
			if (manifest.phase === 'sourceDiscovered') {
				manifest = await this.persist(withPhase(manifest, 'snapshotHeld'));
			}
			if (manifest.phase === 'snapshotHeld' || manifest.phase === 'candidateBuilding') {
				manifest = await this.buildCandidate(manifest);
			}
			if (manifest.phase === 'candidateVerified' || manifest.phase === 'sourceQuarantining') {
				manifest = await this.quarantine(manifest);
			}
			if (manifest.phase === 'plaintextPurging') {
				manifest = await this.purge(manifest);
			}
			if (manifest.phase === 'activating') {
				manifest = await this.activate(manifest);
			}
			await this.dependencies.manifest.remove();
			return { kind: 'complete' };
		} catch (error) {
			this.dependencies.reporter.warn(`Migration paused with durable recovery state: ${this.message(error)}`);
			return { kind: 'blocked', reason: this.message(error), recoverable: true };
		}
	}

	private async reconcile(manifest: MigrationManifest): Promise<MigrationManifest> {
		const sourceObserved = await this.dependencies.sourceLock.observeExact(
			manifest.members.flatMap(member => [member.sourceName, member.quarantineName]));
		const managedObserved = await this.dependencies.managedLock.observeExact([
			manifest.candidateName, manifest.destinationName
		]);
		for (const member of manifest.members) {
			const source = sourceObserved.get(member.sourceName);
			const quarantine = sourceObserved.get(member.quarantineName);
			if (source && quarantine || source && !identitiesEqual(source, member.identity)
				|| quarantine && !identitiesEqual(quarantine, member.identity)) {
				throw new Error(`Ambiguous or replaced source member: ${member.sourceName}`);
			}
			if (!source && !quarantine && !member.purgeIntent) {
				throw new Error(`Source member disappeared before an authenticated purge intent: ${member.sourceName}`);
			}
		}
		const candidate = managedObserved.get(manifest.candidateName);
		const destination = managedObserved.get(manifest.destinationName);
		if (candidate && destination) {
			throw new Error('Candidate and destination both exist; refusing ambiguous recovery');
		}
		if (destination && !manifest.activationIntent) {
			throw new Error('Destination exists without authenticated activation intent');
		}
		if (!candidate && !destination && phases.indexOf(manifest.phase) >= phases.indexOf('candidateVerified')) {
			throw new Error('Verified candidate is missing');
		}
		if (candidate && manifest.candidateIdentity && !identitiesEqual(candidate, manifest.candidateIdentity)
			|| destination && manifest.candidateIdentity && !identitiesEqual(destination, manifest.candidateIdentity)) {
			throw new Error('Candidate or destination identity does not match the authenticated manifest');
		}
		return manifest;
	}

	private async buildCandidate(manifest: MigrationManifest): Promise<MigrationManifest> {
		if (manifest.phase === 'snapshotHeld') {
			manifest = await this.persist(withPhase(manifest, 'candidateBuilding'));
		}
		try {
			let candidateIdentity = manifest.candidateIdentity;
			if (candidateIdentity) {
				await this.dependencies.candidate.openExisting(manifest.candidateName, candidateIdentity);
			} else {
				const observed = await this.dependencies.managedLock.observeExact([manifest.candidateName]);
				const observedIdentity = observed.get(manifest.candidateName);
				if (observedIdentity) {
					if (manifest.phase !== 'candidateBuilding' || !validIdentity(observedIdentity)) {
						throw new Error('An orphan candidate exists outside a safe authenticated adoption state');
					}
					await this.dependencies.candidate.openExisting(manifest.candidateName, observedIdentity);
					candidateIdentity = observedIdentity;
					manifest = await this.persist({ ...manifest, candidateIdentity });
				} else {
					candidateIdentity = await this.dependencies.candidate.createNoReplace(manifest.candidateName);
					if (!validIdentity(candidateIdentity)) {
						throw new Error('Candidate creation returned a malformed identity');
					}
					manifest = await this.persist({ ...manifest, candidateIdentity });
				}
			}
			await this.dependencies.candidate.resetForImport();
			await this.dependencies.candidate.importHeldSnapshot();
			await this.dependencies.candidate.rewriteWorkspaceId();
			await this.dependencies.candidate.verify(manifest.schemaVersion, manifest.rowCounts, manifest.semanticDigest);
			await this.dependencies.candidate.close();
			await this.dependencies.candidate.fsync();
			await this.dependencies.candidate.reopenAndVerify(
				manifest.candidateName, candidateIdentity, manifest.schemaVersion, manifest.rowCounts, manifest.semanticDigest);
			manifest = await this.persist(withPhase(manifest, 'candidateVerified'));
			return manifest;
		} catch (error) {
			try {
				await this.dependencies.candidate.close();
			} catch (closeError) {
				this.dependencies.reporter.warn(`Candidate close after failure also failed: ${this.message(closeError)}`);
			}
			throw error;
		}
	}

	private async quarantine(manifest: MigrationManifest): Promise<MigrationManifest> {
		if (manifest.phase === 'candidateVerified') {
			manifest = await this.persist(withPhase(manifest, 'sourceQuarantining'));
		}
		for (let index = 0; index < manifest.members.length; index++) {
			let member = manifest.members[index];
			if (!member.quarantineIntent) {
				member = { ...member, quarantineIntent: true };
				manifest = await this.persist(replaceMember(manifest, index, member));
			}
			if (!member.quarantined) {
				const observed = await this.dependencies.sourceLock.observeExact([member.sourceName, member.quarantineName]);
				const sourceIdentity = observed.get(member.sourceName);
				if (sourceIdentity) {
					const movedIdentity = await this.dependencies.sourceLock.quarantineCurrent(member.sourceName, member.quarantineName, member.identity);
					if (!identitiesEqual(movedIdentity, member.identity)) { throw new Error(`Quarantine returned a replaced identity: ${member.sourceName}`); }
				}
				await this.dependencies.sourceLock.fsyncDirectory();
				const durable = await this.dependencies.sourceLock.observeExact([member.sourceName, member.quarantineName]);
				if (durable.has(member.sourceName) || !durable.get(member.quarantineName)
					|| !identitiesEqual(durable.get(member.quarantineName)!, member.identity)) {
					throw new Error(`Quarantine was not durably observed: ${member.sourceName}`);
				}
				member = { ...member, quarantined: true };
				manifest = await this.persist(replaceMember(manifest, index, member));
			}
		}
		return this.persist(withPhase(manifest, 'plaintextPurging'));
	}

	private async purge(manifest: MigrationManifest): Promise<MigrationManifest> {
		for (let index = 0; index < manifest.members.length; index++) {
			let member = manifest.members[index];
			if (!member.purgeIntent) {
				member = { ...member, purgeIntent: true };
				manifest = await this.persist(replaceMember(manifest, index, member));
			}
			if (!member.purged) {
				const observed = await this.dependencies.sourceLock.observeExact([member.quarantineName]);
				if (observed.has(member.quarantineName)) {
					await this.dependencies.sourceLock.deleteQuarantine(member.quarantineName, member.identity);
				}
				await this.dependencies.sourceLock.fsyncDirectory();
				const durable = await this.dependencies.sourceLock.observeExact([member.quarantineName]);
				if (durable.has(member.quarantineName)) { throw new Error(`Plaintext purge was not durably observed: ${member.sourceName}`); }
				member = { ...member, purged: true };
				manifest = await this.persist(replaceMember(manifest, index, member));
			}
		}
		return this.persist(withPhase(manifest, 'activating'));
	}

	private async activate(manifest: MigrationManifest): Promise<MigrationManifest> {
		if (!manifest.activationIntent) {
			manifest = await this.persist({ ...manifest, activationIntent: true });
		}
		if (!manifest.activated) {
			const observed = await this.dependencies.managedLock.observeExact([
				manifest.candidateName, manifest.destinationName
			]);
			const candidateIdentity = observed.get(manifest.candidateName);
			if (candidateIdentity) {
				if (!manifest.candidateIdentity || !identitiesEqual(candidateIdentity, manifest.candidateIdentity)) {
					throw new Error('Candidate identity changed before activation');
				}
				const activatedIdentity = await this.dependencies.managedLock.activateCandidateNoReplace(
					manifest.candidateName, manifest.destinationName, candidateIdentity);
				if (!identitiesEqual(activatedIdentity, candidateIdentity)) { throw new Error('Activation returned a replaced identity'); }
			}
			await this.dependencies.managedLock.fsyncDirectory();
			const durable = await this.dependencies.managedLock.observeExact([manifest.candidateName, manifest.destinationName]);
			const destinationIdentity = durable.get(manifest.destinationName);
			if (durable.has(manifest.candidateName) || !destinationIdentity || !manifest.candidateIdentity
				|| !identitiesEqual(destinationIdentity, manifest.candidateIdentity)) {
				throw new Error('Activation was not durably observed');
			}
			manifest = await this.persist({ ...manifest, activated: true });
		}
		await this.verifyDurableDatabase(manifest, manifest.destinationName);
		return this.persist(withPhase(manifest, 'complete'));
	}

	private async verifyDurableDatabase(manifest: MigrationManifest, name: string): Promise<void> {
		if (!manifest.candidateIdentity) { throw new Error('Authenticated candidate identity is missing'); }
		await this.dependencies.candidate.reopenAndVerify(
			name, manifest.candidateIdentity, manifest.schemaVersion, manifest.rowCounts, manifest.semanticDigest);
	}

	private async persist(manifest: MigrationManifest): Promise<MigrationManifest> {
		await this.dependencies.manifest.store(manifest);
		return manifest;
	}

	private blocked(reason: string, recoverable: boolean): MigrationResult {
		this.dependencies.reporter.warn(reason);
		return { kind: 'blocked', reason, recoverable };
	}

	private message(error: object): string {
		return error instanceof Error ? error.message : String(error);
	}
}
