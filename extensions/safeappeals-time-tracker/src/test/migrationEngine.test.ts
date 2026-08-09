/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import {
	MigrationEngine, type FileIdentity, type ManifestStore, type MigrationCandidateAdapter,
	type MigrationDirectoryLock, type MigrationEngineDependencies, type MigrationManifest
} from '../migrationEngine';

const identity: FileIdentity = { device: '1', inode: '2', kind: 'file', linkCount: 1 };
const replacedIdentity: FileIdentity = { device: '1', inode: '99', kind: 'file', linkCount: 1 };

class InjectedCrash extends Error {}

class FaultController {
	failAfter: string | undefined;

	record(events: string[], event: string): void {
		events.push(event);
		if (this.failAfter === event) {
			this.failAfter = undefined;
			throw new InjectedCrash(event);
		}
	}
}

class MemoryManifest implements ManifestStore {
	value: MigrationManifest | undefined;
	readonly events: string[] = [];
	failCandidateIdentityStoreOnce = false;
	constructor(private readonly faults = new FaultController(), private readonly sharedEvents?: string[]) {}

	async open(): Promise<MigrationManifest | undefined> { return this.value; }
	async store(manifest: MigrationManifest): Promise<void> {
		if (this.failCandidateIdentityStoreOnce && manifest.phase === 'candidateBuilding' && manifest.candidateIdentity) {
			this.failCandidateIdentityStoreOnce = false;
			throw new Error('injected candidate identity store failure');
		}
		this.value = manifest;
		const member = manifest.members[0];
		const event = `store:${manifest.phase}:${member?.quarantineIntent ?? false}:${member?.quarantined ?? false}:${member?.purgeIntent ?? false}:${member?.purged ?? false}:${manifest.activationIntent}:${manifest.activated}`;
		this.faults.record(this.events, event);
		this.sharedEvents?.push(event);
	}
	async remove(): Promise<void> { this.value = undefined; this.events.push('manifest:remove'); this.sharedEvents?.push('manifest:remove'); }
}

class MemoryLock implements MigrationDirectoryLock {
	readonly files = new Map<string, FileIdentity>();
	constructor(private readonly manifest: MemoryManifest, private readonly events: string[], private readonly faults = new FaultController()) {}

	async observeExact(names: readonly string[]): Promise<ReadonlyMap<string, FileIdentity>> {
		return new Map(names.flatMap(name => {
			const value = this.files.get(name);
			return value ? [[name, value] as const] : [];
		}));
	}
	async quarantineCurrent(sourceName: string, quarantineName: string, expected: FileIdentity): Promise<FileIdentity> {
		assert.strictEqual(this.manifest.value?.members.find(member => member.sourceName === sourceName)?.quarantineIntent, true);
		this.files.delete(sourceName);
		this.files.set(quarantineName, expected);
		this.faults.record(this.events, `quarantine:${sourceName}`);
		return expected;
	}
	async deleteQuarantine(quarantineName: string, expected: FileIdentity): Promise<void> {
		assert.ok(this.manifest.value?.members.find(member => member.quarantineName === quarantineName)?.purgeIntent);
		assert.strictEqual(this.files.get(quarantineName), expected);
		this.files.delete(quarantineName);
		this.faults.record(this.events, `delete:${quarantineName}`);
	}
	async activateCandidateNoReplace(candidateName: string, destinationName: string, expected: FileIdentity): Promise<FileIdentity> {
		assert.strictEqual(this.manifest.value?.activationIntent, true);
		assert.strictEqual(this.files.has(destinationName), false);
		this.files.delete(candidateName);
		this.files.set(destinationName, expected);
		this.faults.record(this.events, 'activate');
		return expected;
	}
	async fsyncDirectory(): Promise<void> { this.faults.record(this.events, 'fsync'); }
}

class MemoryCandidate implements MigrationCandidateAdapter {
	constructor(private readonly lock: MemoryLock, private readonly events: string[]) {}
	async verifyExistingDestination(): Promise<void> { this.events.push('verify-existing-destination'); }
	async createNoReplace(candidateName: string): Promise<FileIdentity> { this.lock.files.set(candidateName, identity); this.events.push('build'); return identity; }
	async openExisting(): Promise<void> { this.events.push('open'); }
	async resetForImport(): Promise<void> { this.events.push('reset'); }
	async importHeldSnapshot(): Promise<void> { this.events.push('import'); }
	async rewriteWorkspaceId(): Promise<void> { this.events.push('rewrite'); }
	async verify(): Promise<void> { this.events.push('verify'); }
	async close(): Promise<void> { this.events.push('close'); }
	async fsync(): Promise<void> { this.events.push('candidate:fsync'); }
	async reopenAndVerify(name: string): Promise<void> { this.events.push(`reopen:${name}`); }
}

function recoveryManifest(phase: 'candidateBuilding' | 'candidateVerified'): MigrationManifest {
	return {
		version: 1, txid: '0123456789abcdef', phase, sourceNames: ['timetracker.db'],
		candidateName: '.safeappeals-tx-db-0123456789abcdef', candidateIdentity: identity,
		destinationName: 'timetracker.db', schemaVersion: 4,
		rowCounts: { matters: 1, billing_rates: 0, time_entries: 0 }, semanticDigest: 'digest',
		members: [{
			sourceName: 'timetracker.db', quarantineName: '.safeappeals-tx-0123456789abcdef-timetracker.db',
			identity, quarantineIntent: false, quarantined: false, purgeIntent: false, purged: false
		}],
		activationIntent: false, activated: false
	};
}

function advancedManifest(phase: 'sourceQuarantining' | 'plaintextPurging' | 'activating' | 'complete'): MigrationManifest {
	const quarantined = phase !== 'sourceQuarantining';
	const purged = phase === 'activating' || phase === 'complete';
	return {
		...recoveryManifest('candidateVerified'), phase,
		members: [{
			...recoveryManifest('candidateVerified').members[0], quarantineIntent: quarantined,
			quarantined, purgeIntent: purged, purged
		}],
		activationIntent: phase === 'complete', activated: phase === 'complete'
	};
}

function mutationEvents(events: readonly string[]): readonly string[] {
	return events.filter(event => event.startsWith('quarantine:') || event.startsWith('delete:') || event === 'activate');
}

function recoveryDependencies(manifest: MemoryManifest, sourceLock: MemoryLock, managedLock: MemoryLock,
	candidate: MigrationCandidateAdapter, events: string[]): MigrationEngineDependencies {
	return {
		names: {
			txid: '0123456789abcdef', candidateName: '.safeappeals-tx-db-0123456789abcdef', destinationName: 'timetracker.db',
			quarantineName: (txid: string, name: string) => `.safeappeals-tx-${txid}-${name}`
		},
		manifest, sourceLock, managedLock,
		source: { describeHeldSnapshot: async () => undefined }, candidate,
		reporter: { log: (message: string) => events.push(message), warn: (message: string) => events.push(message) }
	};
}

function unsafeManifest(value: object): MigrationManifest {
	return value as MigrationManifest;
}

suite('MigrationEngine', () => {
	test('persists destructive intent and directory durability before observed progress', async () => {
		const events: string[] = [];
		const manifest = new MemoryManifest();
		const sourceLock = new MemoryLock(manifest, events);
		const managedLock = new MemoryLock(manifest, events);
		sourceLock.files.set('timetracker.db', identity);
		const engine = new MigrationEngine({
			names: {
				txid: '0123456789abcdef', candidateName: '.safeappeals-tx-db-0123456789abcdef', destinationName: 'timetracker.db',
				quarantineName: (txid, name) => `.safeappeals-tx-${txid}-${name}`
			},
			manifest, sourceLock, managedLock,
			source: { describeHeldSnapshot: async () => ({
				members: [{ name: 'timetracker.db', identity }], schemaVersion: 4,
				rowCounts: { matters: 1, billing_rates: 0, time_entries: 0 }, semanticDigest: 'digest'
			}) },
			candidate: new MemoryCandidate(managedLock, events),
			reporter: { log: message => events.push(message), warn: message => events.push(message) }
		});

		assert.deepStrictEqual(await engine.run(), { kind: 'complete' });
		assert.deepStrictEqual({
			sourceGone: sourceLock.files.size === 0,
			destinationPresent: managedLock.files.has('timetracker.db'),
			candidateDeleted: events.includes('candidate:delete'),
			quarantineBeforeDelete: events.indexOf('quarantine:timetracker.db') < events.indexOf('delete:.safeappeals-tx-0123456789abcdef-timetracker.db'),
			fsyncBeforeActivate: events.lastIndexOf('fsync') < events.indexOf('reopen:timetracker.db')
		}, {
			sourceGone: true, destinationPresent: true, candidateDeleted: false,
			quarantineBeforeDelete: true, fsyncBeforeActivate: true
		});
	});

	test('blocks a tampered manifest without filesystem mutation', async () => {
		const events: string[] = [];
		const manifest = new MemoryManifest();
		manifest.value = {
			version: 1, txid: 'not-a-transaction', phase: 'candidateVerified', sourceNames: ['timetracker.db'],
			candidateName: '.safeappeals-tx-db-0123456789abcdef', destinationName: 'timetracker.db', schemaVersion: 1,
			candidateIdentity: identity, rowCounts: {}, semanticDigest: 'digest', members: [], activationIntent: false, activated: false
		};
		const sourceLock = new MemoryLock(manifest, events);
		const managedLock = new MemoryLock(manifest, events);
		const result = await new MigrationEngine({
			names: { txid: '0123456789abcdef', candidateName: '.safeappeals-tx-db-0123456789abcdef', destinationName: 'timetracker.db', quarantineName: (txid, name) => `${txid}-${name}` },
			manifest, sourceLock, managedLock,
			source: { describeHeldSnapshot: async () => undefined },
			candidate: new MemoryCandidate(managedLock, events),
			reporter: { log: message => events.push(message), warn: message => events.push(message) }
		}).run();

		assert.deepStrictEqual({ kind: result.kind, recoverable: result.kind === 'blocked' ? result.recoverable : true, mutations: events.filter(event => ['build', 'activate'].includes(event)) }, {
			kind: 'blocked', recoverable: false, mutations: []
		});
	});

	test('resets an identity-pinned partial candidate before a restarted import', async () => {
		const events: string[] = [];
		const manifest = new MemoryManifest();
		manifest.value = recoveryManifest('candidateBuilding');
		const sourceLock = new MemoryLock(manifest, events);
		const managedLock = new MemoryLock(manifest, events);
		sourceLock.files.set('timetracker.db', identity);
		managedLock.files.set('.safeappeals-tx-db-0123456789abcdef', identity);
		const candidate = new MemoryCandidate(managedLock, events);

		assert.deepStrictEqual(await new MigrationEngine(
			recoveryDependencies(manifest, sourceLock, managedLock, candidate, events)).run(), { kind: 'complete' });
		assert.deepStrictEqual(events.filter(event => ['build', 'open', 'reset', 'import'].includes(event)),
			['open', 'reset', 'import']);
	});

	test('reverifies a recovered verified candidate before any destructive source operation', async () => {
		const events: string[] = [];
		const manifest = new MemoryManifest();
		manifest.value = recoveryManifest('candidateVerified');
		const sourceLock = new MemoryLock(manifest, events);
		const managedLock = new MemoryLock(manifest, events);
		sourceLock.files.set('timetracker.db', identity);
		managedLock.files.set('.safeappeals-tx-db-0123456789abcdef', identity);
		const candidate = new MemoryCandidate(managedLock, events);
		candidate.reopenAndVerify = async () => { events.push('reverify:failed'); throw new Error('semantic mismatch'); };

		const result = await new MigrationEngine(
			recoveryDependencies(manifest, sourceLock, managedLock, candidate, events)).run();
		assert.deepStrictEqual({
			kind: result.kind,
			sourcePresent: sourceLock.files.has('timetracker.db'),
			destructiveEvents: events.filter(event => event.startsWith('quarantine:') || event.startsWith('delete:'))
		}, { kind: 'blocked', sourcePresent: true, destructiveEvents: [] });
	});

	for (const scenario of [
		{ name: 'quarantine operation', phase: 'sourceQuarantining' as const, fault: 'quarantine:timetracker.db' },
		{ name: 'quarantine fsync', phase: 'sourceQuarantining' as const, fault: 'fsync' },
		{ name: 'purge operation', phase: 'plaintextPurging' as const, fault: 'delete:.safeappeals-tx-0123456789abcdef-timetracker.db' },
		{ name: 'purge fsync', phase: 'plaintextPurging' as const, fault: 'fsync' },
		{ name: 'activation operation', phase: 'activating' as const, fault: 'activate' },
		{ name: 'activation fsync', phase: 'activating' as const, fault: 'fsync' }
	]) {
		test(`recovers idempotently after a crash following ${scenario.name}`, async () => {
			const events: string[] = [];
			const faults = new FaultController();
			const manifest = new MemoryManifest();
			manifest.value = advancedManifest(scenario.phase);
			const sourceLock = new MemoryLock(manifest, events, faults);
			const managedLock = new MemoryLock(manifest, events, faults);
			if (scenario.phase === 'sourceQuarantining') {
				sourceLock.files.set('timetracker.db', identity);
			} else if (scenario.phase === 'plaintextPurging') {
				sourceLock.files.set('.safeappeals-tx-0123456789abcdef-timetracker.db', identity);
			}
			if (scenario.phase !== 'activating') {
				managedLock.files.set('.safeappeals-tx-db-0123456789abcdef', identity);
			} else {
				managedLock.files.set('.safeappeals-tx-db-0123456789abcdef', identity);
			}
			faults.failAfter = scenario.fault;
			const dependencies = recoveryDependencies(manifest, sourceLock, managedLock, new MemoryCandidate(managedLock, events), events);
			assert.strictEqual((await new MigrationEngine(dependencies).run()).kind, 'blocked');
			assert.deepStrictEqual(await new MigrationEngine(dependencies).run(), { kind: 'complete' });
			assert.deepStrictEqual({ source: [...sourceLock.files], managed: [...managedLock.files] }, {
				source: [], managed: [['timetracker.db', identity]]
			});
		});
	}

	test('verifies a complete destination before removing the manifest and retains it on failure', async () => {
		const events: string[] = [];
		const manifest = new MemoryManifest(new FaultController(), events);
		manifest.value = advancedManifest('complete');
		const sourceLock = new MemoryLock(manifest, events);
		const managedLock = new MemoryLock(manifest, events);
		managedLock.files.set('timetracker.db', identity);
		const candidate = new MemoryCandidate(managedLock, events);
		assert.deepStrictEqual(await new MigrationEngine(recoveryDependencies(manifest, sourceLock, managedLock, candidate, events)).run(), { kind: 'complete' });
		assert.ok(events.indexOf('reopen:timetracker.db') < events.indexOf('manifest:remove'));

		events.length = 0;
		manifest.value = advancedManifest('complete');
		candidate.reopenAndVerify = async name => { events.push(`reopen:${name}`); throw new Error('invalid destination'); };

		assert.strictEqual((await new MigrationEngine(recoveryDependencies(manifest, sourceLock, managedLock, candidate, events)).run()).kind, 'blocked');
		assert.deepStrictEqual({ manifestRetained: Boolean(manifest.value), events }, {
			manifestRetained: true, events: ['reopen:timetracker.db', 'Migration paused with durable recovery state: invalid destination']
		});
	});

	for (const change of [
		{ name: 'transaction', apply: (value: MigrationManifest): MigrationManifest => ({ ...value, txid: 'fedcba9876543210', members: [{ ...value.members[0], quarantineName: '.safeappeals-tx-fedcba9876543210-timetracker.db' }] }) },
		{ name: 'candidate context', apply: (value: MigrationManifest): MigrationManifest => ({ ...value, candidateName: '.safeappeals-tx-db-fedcba9876543210' }) },
		{ name: 'destination context', apply: (value: MigrationManifest): MigrationManifest => ({ ...value, destinationName: 'other.db' }) }
	]) {
		test(`rejects authenticated replay in the wrong ${change.name} with zero mutations`, async () => {
			const events: string[] = [];
			const manifest = new MemoryManifest();
			manifest.value = change.apply(recoveryManifest('candidateVerified'));
			const sourceLock = new MemoryLock(manifest, events);
			const managedLock = new MemoryLock(manifest, events);
			assert.strictEqual((await new MigrationEngine(recoveryDependencies(manifest, sourceLock, managedLock, new MemoryCandidate(managedLock, events), events)).run()).kind, 'blocked');
			assert.deepStrictEqual(mutationEvents(events), []);
		});
	}

	for (const scenario of [
		{ name: 'source and quarantine coexist', source: identity, quarantine: identity, candidate: identity, destination: undefined },
		{ name: 'candidate and destination coexist', source: identity, quarantine: undefined, candidate: identity, destination: identity },
		{ name: 'source identity was replaced', source: replacedIdentity, quarantine: undefined, candidate: identity, destination: undefined },
		{ name: 'source disappeared before purge intent', source: undefined, quarantine: undefined, candidate: identity, destination: undefined }
	]) {
		test(`blocks recovery when ${scenario.name}`, async () => {
			const events: string[] = [];
			const manifest = new MemoryManifest();
			manifest.value = recoveryManifest('candidateVerified');
			const sourceLock = new MemoryLock(manifest, events);
			const managedLock = new MemoryLock(manifest, events);
			if (scenario.source) { sourceLock.files.set('timetracker.db', scenario.source); }
			if (scenario.quarantine) { sourceLock.files.set('.safeappeals-tx-0123456789abcdef-timetracker.db', scenario.quarantine); }
			if (scenario.candidate) { managedLock.files.set('.safeappeals-tx-db-0123456789abcdef', scenario.candidate); }
			if (scenario.destination) { managedLock.files.set('timetracker.db', scenario.destination); }
			const result = await new MigrationEngine(recoveryDependencies(manifest, sourceLock, managedLock, new MemoryCandidate(managedLock, events), events)).run();
			assert.deepStrictEqual({ kind: result.kind, mutations: mutationEvents(events) }, { kind: 'blocked', mutations: [] });
		});
	}

	test('blocks wrong returned and durably observed post-operation identities', async () => {
		for (const mode of ['returned', 'observed', 'missing'] as const) {
			const events: string[] = [];
			const manifest = new MemoryManifest();
			manifest.value = advancedManifest('sourceQuarantining');
			const sourceLock = new MemoryLock(manifest, events);
			const managedLock = new MemoryLock(manifest, events);
			sourceLock.files.set('timetracker.db', identity);
			managedLock.files.set('.safeappeals-tx-db-0123456789abcdef', identity);
			if (mode === 'returned') {
				sourceLock.quarantineCurrent = async (source, quarantine) => { sourceLock.files.delete(source); sourceLock.files.set(quarantine, identity); return replacedIdentity; };
			} else if (mode === 'observed') {
				sourceLock.fsyncDirectory = async () => { sourceLock.files.set('.safeappeals-tx-0123456789abcdef-timetracker.db', replacedIdentity); };
			} else {
				sourceLock.fsyncDirectory = async () => { sourceLock.files.delete('.safeappeals-tx-0123456789abcdef-timetracker.db'); };
			}
			assert.strictEqual((await new MigrationEngine(recoveryDependencies(manifest, sourceLock, managedLock, new MemoryCandidate(managedLock, events), events)).run()).kind, 'blocked');
		}
	});

	test('without a manifest, source plus destination blocks and destination only is verified', async () => {
		for (const hasSource of [true, false]) {
			const events: string[] = [];
			const manifest = new MemoryManifest();
			const sourceLock = new MemoryLock(manifest, events);
			const managedLock = new MemoryLock(manifest, events);
			managedLock.files.set('timetracker.db', identity);
			const candidate = new MemoryCandidate(managedLock, events);
			const dependencies = recoveryDependencies(manifest, sourceLock, managedLock, candidate, events);
			dependencies.source.describeHeldSnapshot = async () => hasSource ? {
				members: [{ name: 'timetracker.db', identity }], schemaVersion: 4,
				rowCounts: { matters: 1, billing_rates: 0, time_entries: 0 }, semanticDigest: 'digest'
			} : undefined;
			const result = await new MigrationEngine(dependencies).run();
			assert.deepStrictEqual({ kind: result.kind, verified: events.includes('verify-existing-destination') }, {
				kind: hasSource ? 'blocked' : 'noSource', verified: !hasSource
			});
		}
	});

	for (const invalid of [
		{ name: 'extra schema key', value: unsafeManifest({ ...recoveryManifest('candidateVerified'), extra: true }) },
		{ name: 'invalid phase', value: unsafeManifest({ ...recoveryManifest('candidateVerified'), phase: 'unknown' }) },
		{ name: 'arbitrary dotted candidate', value: unsafeManifest({ ...recoveryManifest('candidateVerified'), candidateName: '.candidate' }) },
		{ name: 'candidate path escape', value: unsafeManifest({ ...recoveryManifest('candidateVerified'), candidateName: '../.safeappeals-tx-db-0123456789abcdef' }) },
		{ name: 'non-array source names', value: unsafeManifest({ ...recoveryManifest('candidateVerified'), sourceNames: {} }) },
		{ name: 'null members', value: unsafeManifest({ ...recoveryManifest('candidateVerified'), members: null }) }
	]) {
		test(`blocks exact-schema violation: ${invalid.name}`, async () => {
			const events: string[] = [];
			const manifest = new MemoryManifest();
			manifest.value = invalid.value;
			const sourceLock = new MemoryLock(manifest, events);
			const managedLock = new MemoryLock(manifest, events);
			const result = await new MigrationEngine(recoveryDependencies(manifest, sourceLock, managedLock, new MemoryCandidate(managedLock, events), events)).run();
			assert.deepStrictEqual({ kind: result.kind, mutations: mutationEvents(events) }, { kind: 'blocked', mutations: [] });
		});
	}

	test('orders intent store, operation, fsync, observation, and progress store distinctly', async () => {
		const events: string[] = [];
		const manifest = new MemoryManifest(new FaultController(), events);
		manifest.value = advancedManifest('sourceQuarantining');
		const sourceLock = new MemoryLock(manifest, events);
		const managedLock = new MemoryLock(manifest, events);
		sourceLock.files.set('timetracker.db', identity);
		managedLock.files.set('.safeappeals-tx-db-0123456789abcdef', identity);
		sourceLock.observeExact = async names => {
			events.push(`observe:${names.join(',')}`);
			return new Map(names.flatMap(name => {
				const value = sourceLock.files.get(name);
				return value ? [[name, value] as const] : [];
			}));
		};
		await new MigrationEngine(recoveryDependencies(manifest, sourceLock, managedLock, new MemoryCandidate(managedLock, events), events)).run();
		const relevant = events.filter(event => event.startsWith('store:sourceQuarantining') || event.startsWith('quarantine:') || event === 'fsync' || event.startsWith('observe:timetracker.db,'));
		const intentIndex = relevant.indexOf('store:sourceQuarantining:true:false:false:false:false:false');
		assert.deepStrictEqual(relevant.slice(intentIndex, intentIndex + 5), [
			'store:sourceQuarantining:true:false:false:false:false:false',
			'observe:timetracker.db,.safeappeals-tx-0123456789abcdef-timetracker.db',
			'quarantine:timetracker.db', 'fsync',
			'observe:timetracker.db,.safeappeals-tx-0123456789abcdef-timetracker.db'
		]);
		assert.ok(relevant[intentIndex + 5]?.includes('store:sourceQuarantining:true:true'));
	});

	test('adopts and resets a candidate created before its identity store completed', async () => {
		const events: string[] = [];
		const manifest = new MemoryManifest();
		manifest.failCandidateIdentityStoreOnce = true;
		const sourceLock = new MemoryLock(manifest, events);
		const managedLock = new MemoryLock(manifest, events);
		sourceLock.files.set('timetracker.db', identity);
		const candidate = new MemoryCandidate(managedLock, events);
		const dependencies = {
			...recoveryDependencies(manifest, sourceLock, managedLock, candidate, events),
			source: { describeHeldSnapshot: async () => ({
				members: [{ name: 'timetracker.db', identity }], schemaVersion: 4,
				rowCounts: { matters: 1, billing_rates: 0, time_entries: 0 }, semanticDigest: 'digest'
			}) }
		};

		const interrupted = await new MigrationEngine(dependencies).run();
		assert.deepStrictEqual({
			kind: interrupted.kind,
			phase: manifest.value?.phase,
			candidatePresent: managedLock.files.has('.safeappeals-tx-db-0123456789abcdef'),
			creates: events.filter(event => event === 'build').length
		}, { kind: 'blocked', phase: 'candidateBuilding', candidatePresent: true, creates: 1 });

		const completed = await new MigrationEngine(dependencies).run();
		assert.deepStrictEqual({
			result: completed,
			creates: events.filter(event => event === 'build').length,
			adopted: events.includes('open'),
			resetAfterAdoption: events.indexOf('open') < events.lastIndexOf('reset')
		}, { result: { kind: 'complete' }, creates: 1, adopted: true, resetAfterAdoption: true });
	});
});
