/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3-multiple-ciphers');

const extensionRoot = path.resolve(__dirname, '..', '..', '..');
const binding = path.join(extensionRoot, 'prebuilds', `${process.platform}-${process.arch}`, `node-${process.versions.modules}`, 'safeappeals_secure_fs.node');
const sqliteBinding = path.join(extensionRoot, 'prebuilds', `${process.platform}-${process.arch}`, `node-${process.versions.modules}`, 'better_sqlite3.node');
const {
	SecureDirectory,
	bootstrapPrivateDirectory,
	openLegacyCodesWorkspace,
	openLegacyWorkspace,
	openLegacyWorkspaces,
} = require(binding);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'safeappeals-secure-fs-'));
fs.chmodSync(root, 0o700);

function expectCode(code, operation) {
	assert.throws(operation, error => error instanceof Error && error.code === code);
}

try {
	const capabilityMatch = fs.readFileSync('/proc/self/status', 'utf8').match(/^CapEff:\s*([0-9a-f]+)$/mi);
	assert.equal(capabilityMatch?.[1], '0000000000000000', 'activation smoke must run without effective Linux capabilities');
	fs.mkdirSync(path.join(root, 'data'), { mode: 0o700 });
	const data = path.join(root, 'data');
	fs.writeFileSync(path.join(data, 'source'), 'original', { mode: 0o600 });
	fs.writeFileSync(path.join(data, 'occupied'), 'occupied', { mode: 0o600 });
	fs.writeFileSync(path.join(data, 'source-backup'), 'unrelated', { mode: 0o600 });
	fs.writeFileSync(path.join(data, 'delete-source'), 'delete', { mode: 0o600 });
	const directory = new SecureDirectory(root, 'data');
	const heldSource = directory.openRegularFile('source', true);
	assert.deepStrictEqual(Object.keys(heldSource.identity).sort(), ['device', 'inode', 'kind', 'linkCount']);

	fs.renameSync(path.join(data, 'source'), path.join(data, 'old-path'));
	fs.writeFileSync(path.join(data, 'source'), 'replacement', { mode: 0o600 });
	const lock = directory.acquireExclusiveLock();
	const reserved = lock.createStagedFile('.safeappeals-tx-sqlite');
	fs.writeFileSync(reserved.descriptorPath, 'sqlite-like-write');
	assert.equal(lock.validateStagedFile('.safeappeals-tx-sqlite', reserved).inode, reserved.identity.inode);
	expectCode('SA_FS_EXISTS', () => lock.createStagedFile('.safeappeals-tx-sqlite'));
	const previousUmask = process.umask(0o000);
	const sqliteCandidate = lock.createStagedFile('.safeappeals-tx-sqlcipher');
	process.umask(previousUmask);
	assert.equal(fs.statSync(path.join(data, '.safeappeals-tx-sqlcipher')).mode & 0o777, 0o600);
	const sqlitePath = path.join(lock.directoryPath, '.safeappeals-tx-sqlcipher');
	const key = Buffer.alloc(32, 0x5a);
	let encrypted = new Database(sqlitePath, { nativeBinding: sqliteBinding });
	encrypted.pragma("cipher='sqlcipher'");
	encrypted.pragma('legacy = 4');
	encrypted.key(key);
	assert.equal(encrypted.pragma('journal_mode = WAL', { simple: true }).toLowerCase(), 'wal');
	encrypted.exec("CREATE TABLE secure_rows(value TEXT); INSERT INTO secure_rows VALUES ('confidential-sqlcipher-row')");
	encrypted.pragma('wal_checkpoint(TRUNCATE)');
	encrypted.close();
	lock.validateStagedFile('.safeappeals-tx-sqlcipher', sqliteCandidate);
	const databaseBytes = fs.readFileSync(path.join(data, '.safeappeals-tx-sqlcipher'));
	assert.equal(databaseBytes.subarray(0, 16).equals(Buffer.from('SQLite format 3\0')), false);
	assert.equal(databaseBytes.includes(Buffer.from('confidential-sqlcipher-row')), false);
	for (const suffix of ['-wal', '-shm']) {
		const sidecar = path.join(data, `.safeappeals-tx-sqlcipher${suffix}`);
		if (fs.existsSync(sidecar)) {
			assert.equal(fs.statSync(sidecar).mode & 0o077, 0);
		}
	}
	encrypted = new Database(sqlitePath, { nativeBinding: sqliteBinding });
	encrypted.pragma("cipher='sqlcipher'");
	encrypted.pragma('legacy = 4');
	encrypted.key(key);
	assert.equal(encrypted.prepare('SELECT value FROM secure_rows').pluck().get(), 'confidential-sqlcipher-row');
	encrypted.close();

	const firstManifest = lock.writeEncryptedManifest('.safeappeals-tx-manifest-first', Buffer.from('ciphertext-v1'));
	assert.equal(fs.readFileSync(path.join(data, '.timetracker-migration-v1.saenc'), 'utf8'), 'ciphertext-v1');
	expectCode('SA_FS_EXISTS', () => lock.writeEncryptedManifest('.safeappeals-tx-manifest-clobber', Buffer.from('bad')));
	assert.equal(fs.existsSync(path.join(data, '.safeappeals-tx-manifest-clobber')), true);
	expectCode('SA_FS_IDENTITY_MISMATCH', () => lock.writeEncryptedManifest(
		'.safeappeals-tx-manifest-stale',
		Buffer.from('stale'),
		{ ...firstManifest, inode: '0' },
	));
	assert.equal(fs.readFileSync(path.join(data, '.timetracker-migration-v1.saenc'), 'utf8'), 'ciphertext-v1');
	assert.equal(fs.existsSync(path.join(data, '.safeappeals-tx-manifest-stale')), true);
	const secondManifest = lock.writeEncryptedManifest('.safeappeals-tx-manifest-update', Buffer.from('ciphertext-v2'), firstManifest);
	assert.notEqual(secondManifest.inode, firstManifest.inode);
	assert.equal(fs.readFileSync(path.join(data, '.timetracker-migration-v1.saenc'), 'utf8'), 'ciphertext-v2');
	const priorSensitiveUmask = process.umask(0o000);
	const firstSensitive = lock.writeSensitiveState(
		'.safeappeals-tx-sensitive-state-first',
		Buffer.from('sealed-sensitive-v1'),
	);
	process.umask(priorSensitiveUmask);
	assert.equal(fs.statSync(path.join(data, 'sensitive-state.saenc')).mode & 0o777, 0o600);
	expectCode('SA_FS_EXISTS', () => lock.writeSensitiveState(
		'.safeappeals-tx-sensitive-state-crash',
		Buffer.from('no-clobber'),
	));
	assert.equal(fs.existsSync(path.join(data, '.safeappeals-tx-sensitive-state-crash')), true);
	expectCode('SA_FS_IDENTITY_MISMATCH', () => lock.writeSensitiveState(
		'.safeappeals-tx-sensitive-state-stale',
		Buffer.from('stale'),
		{ ...firstSensitive, inode: '0' },
	));
	assert.equal(fs.readFileSync(path.join(data, 'sensitive-state.saenc'), 'utf8'), 'sealed-sensitive-v1');
	assert.equal(fs.existsSync(path.join(data, '.safeappeals-tx-sensitive-state-stale')), true);
	const secondSensitive = lock.writeSensitiveState(
		'.safeappeals-tx-sensitive-state-update',
		Buffer.from('sealed-sensitive-v2'),
		firstSensitive,
	);
	assert.notEqual(secondSensitive.inode, firstSensitive.inode);
	assert.equal(fs.readFileSync(path.join(data, 'sensitive-state.saenc'), 'utf8'), 'sealed-sensitive-v2');
	const stagedSource = lock.quarantineCurrent('old-path', '.safeappeals-tx-active', heldSource);
	// Migration ordering contract: persist the quarantine rename before activation.
	lock.fsyncDirectory();
	fs.linkSync(path.join(data, '.safeappeals-tx-active'), path.join(data, 'active-hardlink'));
	expectCode('SA_FS_LINK_COUNT', () => lock.activateStagedNoReplace('.safeappeals-tx-active', stagedSource, 'active'));
	fs.unlinkSync(path.join(data, 'active-hardlink'));
	expectCode('SA_FS_EXISTS', () => lock.activateStagedNoReplace('.safeappeals-tx-active', stagedSource, 'occupied'));
	assert.equal(fs.readFileSync(path.join(data, 'occupied'), 'utf8'), 'occupied');
	assert.equal(fs.readFileSync(path.join(data, '.safeappeals-tx-active'), 'utf8'), 'original');
	lock.activateStagedNoReplace('.safeappeals-tx-active', stagedSource, 'active');
	// Persist activation before callers advance their manifest/state machine.
	lock.fsyncDirectory();
	assert.equal(fs.readFileSync(path.join(data, 'active'), 'utf8'), 'original');

	// The current source path is the replacement, so quarantine refuses it and preserves both paths.
	expectCode('SA_FS_STAGING_MISMATCH', () => lock.quarantineCurrent('source', '.safeappeals-tx-mismatch', heldSource));
	assert.equal(fs.readFileSync(path.join(data, 'source'), 'utf8'), 'replacement');
	assert.equal(fs.existsSync(path.join(data, '.safeappeals-tx-mismatch')), false);
	assert.equal(fs.readFileSync(path.join(data, 'active'), 'utf8'), 'original');

	const heldDelete = directory.openRegularFile('delete-source', true);
	fs.linkSync(path.join(data, 'delete-source'), path.join(data, 'delete-hardlink'));
	expectCode('SA_FS_LINK_COUNT', () => lock.quarantineCurrent('delete-source', '.safeappeals-tx-hardlink', heldDelete));
	assert.equal(fs.existsSync(path.join(data, 'delete-source')), true);
	fs.unlinkSync(path.join(data, 'delete-hardlink'));
	const staged = lock.quarantineCurrent('delete-source', '.safeappeals-tx-delete', heldDelete);
	expectCode('SA_FS_INVALID_STAGE', () => lock.deleteQuarantine('source-backup', staged));
	fs.linkSync(path.join(data, '.safeappeals-tx-delete'), path.join(data, 'purge-hardlink'));
	expectCode('SA_FS_LINK_COUNT', () => lock.deleteQuarantine('.safeappeals-tx-delete', staged));
	assert.equal(fs.existsSync(path.join(data, '.safeappeals-tx-delete')), true);
	assert.equal(fs.existsSync(path.join(data, 'purge-hardlink')), true);
	fs.unlinkSync(path.join(data, 'purge-hardlink'));
	lock.deleteQuarantine('.safeappeals-tx-delete', staged);
	assert.equal(fs.existsSync(path.join(data, '.safeappeals-tx-delete')), false);
	assert.equal(fs.readFileSync(path.join(data, 'source-backup'), 'utf8'), 'unrelated');

	fs.symlinkSync('active', path.join(data, 'symlink'));
	expectCode('SA_FS_SYMLINK', () => directory.openRegularFile('symlink', false));
	fs.linkSync(path.join(data, 'active'), path.join(data, 'hardlink'));
	expectCode('SA_FS_LINK_COUNT', () => directory.openRegularFile('active', false));
	fs.unlinkSync(path.join(data, 'hardlink'));
	const children = directory.enumerateChildren(100);
	const repeatedChildren = directory.enumerateChildren(100);
	assert.deepStrictEqual(repeatedChildren.map(entry => entry.name).sort(), children.map(entry => entry.name).sort());
	assert.equal(children.some(entry => entry.name === 'symlink' && entry.kind === 'symlink'), true);
	assert.equal(children.some(entry => entry.name === 'source-backup' && entry.kind === 'file'), true);
	expectCode('SA_FS_INVALID_LIMIT', () => directory.enumerateChildren(0));
	expectCode('SA_FS_ENUM_LIMIT', () => directory.enumerateChildren(1));
	assert.equal(directory.enumerateChildren(100).length, children.length);
	const invalidUtf8Path = Buffer.concat([Buffer.from(`${data}/`), Buffer.from([0xff])]);
	fs.writeFileSync(invalidUtf8Path, 'invalid-name');
	const descriptorsBeforeInvalidEnumeration = fs.readdirSync('/proc/self/fd').length;
	expectCode('SA_FS_INVALID_NAME', () => directory.enumerateChildren(100));
	assert.equal(fs.readdirSync('/proc/self/fd').length, descriptorsBeforeInvalidEnumeration);
	fs.unlinkSync(invalidUtf8Path);
	fs.mkdirSync(path.join(data, 'private-child'), { mode: 0o700 });
	const privateChild = directory.openPrivateChild('private-child');
	privateChild.dispose();

	const contender = new SecureDirectory(root, 'data');
	expectCode('SA_FS_LOCKED', () => contender.acquireExclusiveLock());
	lock.fsyncDirectory();
	lock.close();
	lock.close();
	expectCode('SA_FS_CLOSED', () => lock.fsyncDirectory());
	const contenderLock = contender.acquireExclusiveLock();
	contenderLock.dispose();
	fs.writeFileSync(path.join(data, 'time-tracker-codes.json'), '{"private":"codes"}', { mode: 0o600 });
	fs.writeFileSync(path.join(data, 'codes-unrelated.json'), 'preserve', { mode: 0o600 });
	const codesWorkspace = openLegacyCodesWorkspace(data);
	assert.equal(codesWorkspace.inspectCodes().kind, 'file');
	const heldCodes = codesWorkspace.openCodes();
	const codesLock = codesWorkspace.acquireExclusiveLock();
	const stagedCodes = codesLock.quarantineCodes('.safeappeals-tx-legacy-codes', heldCodes);
	codesLock.deleteQuarantine('.safeappeals-tx-legacy-codes', stagedCodes);
	assert.equal(fs.existsSync(path.join(data, 'time-tracker-codes.json')), false);
	assert.equal(fs.readFileSync(path.join(data, 'codes-unrelated.json'), 'utf8'), 'preserve');
	codesLock.dispose();
	codesWorkspace.dispose();
	fs.symlinkSync(data, path.join(root, 'codes-workspace-link'));
	expectCode('SA_FS_SYMLINK', () => openLegacyCodesWorkspace(path.join(root, 'codes-workspace-link')));
	fs.chmodSync(data, 0o770);
	expectCode('SA_FS_UNTRUSTED_ANCHOR', () => openLegacyCodesWorkspace(data));
	fs.chmodSync(data, 0o700);
	fs.mkdirSync(path.join(root, 'chmod-after-open'), { mode: 0o700 });
	const chmodAfterOpen = new SecureDirectory(root, 'chmod-after-open');
	fs.chmodSync(path.join(root, 'chmod-after-open'), 0o777);
	expectCode('SA_FS_UNTRUSTED_DIRECTORY', () => chmodAfterOpen.acquireExclusiveLock());
	fs.chmodSync(path.join(root, 'chmod-after-open'), 0o700);
	chmodAfterOpen.dispose();

	heldSource.fsync();
	heldSource.dispose();
	heldSource.dispose();
	expectCode('SA_FS_CLOSED', () => heldSource.fsync());
	directory.close();
	directory.close();
	expectCode('SA_FS_CLOSED', () => directory.inspect('active'));

	// A directory path replaced after construction is rejected during lock acquisition.
	fs.mkdirSync(path.join(root, 'replaceable'), { mode: 0o700 });
	const replaceable = new SecureDirectory(root, 'replaceable');
	fs.renameSync(path.join(root, 'replaceable'), path.join(root, 'replaced-original'));
	fs.mkdirSync(path.join(root, 'replaceable'), { mode: 0o700 });
	expectCode('SA_FS_DIRECTORY_REPLACED', () => replaceable.acquireExclusiveLock());
	replaceable.dispose();

	for (const invalid of ['', '.', '..', 'nested/name']) {
		expectCode('SA_FS_INVALID_NAME', () => contender.inspect(invalid));
	}
	expectCode('SA_FS_OUTSIDE_ROOT', () => new SecureDirectory(root, '../data'));
	fs.symlinkSync('data', path.join(root, 'data-link'));
	expectCode('SA_FS_SYMLINK', () => new SecureDirectory(root, 'data-link'));

	const home = path.join(root, 'home-anchor');
	fs.mkdirSync(home, { mode: 0o755 });
	const bootstrapped = bootstrapPrivateDirectory(home, ['managed', 'workspaces', 'abc123']);
	assert.equal(fs.statSync(path.join(home, 'managed')).mode & 0o777, 0o700);
	assert.equal(fs.statSync(path.join(home, 'managed', 'workspaces', 'abc123')).mode & 0o777, 0o700);
	bootstrapped.dispose();
	fs.mkdirSync(path.join(home, 'bad-mode'), { mode: 0o750 });
	expectCode('SA_FS_UNTRUSTED_DIRECTORY', () => bootstrapPrivateDirectory(home, ['bad-mode', 'child']));
	fs.symlinkSync('managed', path.join(home, 'managed-link'));
	expectCode('SA_FS_SYMLINK', () => bootstrapPrivateDirectory(home, ['managed-link', 'child']));

	const legacyBase = path.join(home, '.safe-appeals-navigator');
	fs.mkdirSync(path.join(legacyBase, 'databases', 'workspaces', '0123456789abcdef'), { recursive: true, mode: 0o755 });
	fs.chmodSync(path.join(legacyBase, 'databases', 'workspaces', '0123456789abcdef'), 0o700);
	const legacy = openLegacyWorkspace(home, '0123456789abcdef');
	legacy.dispose();
	fs.mkdirSync(path.join(legacyBase, 'databases', 'workspaces', 'fedcba9876543210'), { mode: 0o700 });
	fs.mkdirSync(path.join(legacyBase, 'databases', 'workspaces', 'not-a-workspace'), { mode: 0o700 });
	const legacyWorkspaces = openLegacyWorkspaces(home);
	assert.deepStrictEqual(legacyWorkspaces.enumerateWorkspaceIds(100).sort(), ['0123456789abcdef', 'fedcba9876543210']);
	const openedLegacyChild = legacyWorkspaces.openWorkspace('fedcba9876543210');
	openedLegacyChild.dispose();
	expectCode('SA_FS_INVALID_NAME', () => legacyWorkspaces.openWorkspace('not-a-workspace'));
	expectCode('SA_FS_ENUM_LIMIT', () => legacyWorkspaces.enumerateWorkspaceIds(1));
	legacyWorkspaces.dispose();
	fs.chmodSync(path.join(legacyBase, 'databases'), 0o775);
	expectCode('SA_FS_UNTRUSTED_ANCHOR', () => openLegacyWorkspace(home, '0123456789abcdef'));
	fs.chmodSync(path.join(legacyBase, 'databases'), 0o755);

	for (const mode of [0o000, 0o100, 0o500, 0o600, 0o750]) {
		const modeName = `mode-${mode.toString(8)}`;
		fs.mkdirSync(path.join(root, modeName), { mode: 0o700 });
		fs.chmodSync(path.join(root, modeName), mode);
		assert.throws(
			() => new SecureDirectory(root, modeName),
			error => error instanceof Error && ['SA_FS_PERMISSION', 'SA_FS_UNTRUSTED_DIRECTORY'].includes(error.code),
		);
		fs.chmodSync(path.join(root, modeName), 0o700);
	}
	const descriptorCountBefore = fs.readdirSync('/proc/self/fd').length;
	const lifecycle = new SecureDirectory(root, 'data');
	const descriptorCountOpen = fs.readdirSync('/proc/self/fd').length;
	lifecycle.close();
	const descriptorCountClosed = fs.readdirSync('/proc/self/fd').length;
	assert.equal(descriptorCountOpen - descriptorCountBefore, 2);
	assert.equal(descriptorCountClosed, descriptorCountBefore);
	expectCode('SA_FS_CLOSED', () => lifecycle.acquireExclusiveLock());
	contender.dispose();
	console.log('safeappeals-secure-fs smoke: PASS');
} finally {
	fs.rmSync(root, { recursive: true, force: true });
}
