/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import {
	DocParseSidecarHost,
	resolveDocParseBinaryPath,
	resolveDocParseInferScriptPath,
} from '../docParseSidecarHost';

const FAKE_SERVER_SCRIPT = `
const http = require('http');
const host = process.env.SA_DOCPARSE_HOST || '127.0.0.1';
const port = Number(process.env.SA_DOCPARSE_PORT || '8742');
const server = http.createServer((req, res) => {
	if (req.url === '/health') {
		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ ok: true, model: 'test-fake' }));
		return;
	}
	res.writeHead(404);
	res.end();
});
server.listen(port, host, () => {
	process.stdout.write('ready\\n');
});
const shutdown = () => {
	server.close(() => process.exit(0));
	setTimeout(() => process.exit(0), 500).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
`;

suite('docParseSidecarHost', () => {
	let tmpRoot: string;
	let extensionPath: string;
	let modelDir: string;
	let baseUrl: string;
	let port: number;
	const activeHosts: DocParseSidecarHost[] = [];
	const priorDocParsePath = process.env.SAFEAPPEALS_DOCPARSE_PATH;
	const priorInferScript = process.env.SA_DOCPARSE_INFER_SCRIPT;

	function trackHost(host: DocParseSidecarHost): DocParseSidecarHost {
		activeHosts.push(host);
		return host;
	}

	setup(async () => {
		tmpRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'sa-docparse-host-'));
		extensionPath = path.join(tmpRoot, 'ext');
		modelDir = path.join(tmpRoot, 'models', 'unlimited-ocr');
		await fs.promises.mkdir(path.join(extensionPath, 'bin'), { recursive: true });
		await fs.promises.mkdir(modelDir, { recursive: true });
		await fs.promises.writeFile(path.join(modelDir, 'manifest.json'), '{"ok":true}\n');
		port = 18000 + Math.floor(Math.random() * 1000);
		baseUrl = `http://127.0.0.1:${port}`;
		delete process.env.SAFEAPPEALS_DOCPARSE_PATH;
		delete process.env.SA_DOCPARSE_INFER_SCRIPT;
	});

	teardown(async () => {
		await Promise.all(activeHosts.splice(0).map(host => host.stop()));
		if (priorDocParsePath === undefined) {
			delete process.env.SAFEAPPEALS_DOCPARSE_PATH;
		} else {
			process.env.SAFEAPPEALS_DOCPARSE_PATH = priorDocParsePath;
		}
		if (priorInferScript === undefined) {
			delete process.env.SA_DOCPARSE_INFER_SCRIPT;
		} else {
			process.env.SA_DOCPARSE_INFER_SCRIPT = priorInferScript;
		}
		await fs.promises.rm(tmpRoot, { recursive: true, force: true });
	});

	test('resolveDocParseBinaryPath prefers env then bundled then dev', async () => {
		const envBinary = path.join(tmpRoot, 'env-sa-docparse');
		await fs.promises.writeFile(envBinary, '#!/bin/sh\n', { mode: 0o755 });
		process.env.SAFEAPPEALS_DOCPARSE_PATH = envBinary;
		assert.strictEqual(resolveDocParseBinaryPath(extensionPath), envBinary);

		delete process.env.SAFEAPPEALS_DOCPARSE_PATH;
		const bundled = path.join(extensionPath, 'bin', 'sa-docparse');
		await fs.promises.writeFile(bundled, '#!/bin/sh\n', { mode: 0o755 });
		assert.strictEqual(resolveDocParseBinaryPath(extensionPath), bundled);

		await fs.promises.unlink(bundled);
		const devDir = path.join(tmpRoot, 'rust', 'target', 'release');
		await fs.promises.mkdir(devDir, { recursive: true });
		const devBinary = path.join(devDir, 'sa-docparse');
		await fs.promises.writeFile(devBinary, '#!/bin/sh\n', { mode: 0o755 });
		const extAtRepoRoot = path.join(tmpRoot, 'extensions', 'safeappeals-ml');
		await fs.promises.mkdir(extAtRepoRoot, { recursive: true });
		assert.strictEqual(resolveDocParseBinaryPath(extAtRepoRoot), path.resolve(devBinary));
	});

	test('resolveDocParseInferScriptPath prefers env then bundled then dev', async () => {
		const envScript = path.join(tmpRoot, 'env-infer.py');
		await fs.promises.writeFile(envScript, 'print("ok")\n');
		process.env.SA_DOCPARSE_INFER_SCRIPT = envScript;
		assert.strictEqual(resolveDocParseInferScriptPath(extensionPath), path.resolve(envScript));

		delete process.env.SA_DOCPARSE_INFER_SCRIPT;
		const bundledDir = path.join(extensionPath, 'bin', 'python');
		await fs.promises.mkdir(bundledDir, { recursive: true });
		const bundled = path.join(bundledDir, 'infer_unlimited_ocr.py');
		await fs.promises.writeFile(bundled, 'print("ok")\n');
		assert.strictEqual(resolveDocParseInferScriptPath(extensionPath), path.resolve(bundled));

		await fs.promises.unlink(bundled);
		const devScript = path.join(tmpRoot, 'rust', 'docparse', 'python', 'infer_unlimited_ocr.py');
		await fs.promises.mkdir(path.dirname(devScript), { recursive: true });
		await fs.promises.writeFile(devScript, 'print("ok")\n');
		const extAtRepoRoot = path.join(tmpRoot, 'extensions', 'safeappeals-ml');
		await fs.promises.mkdir(extAtRepoRoot, { recursive: true });
		assert.strictEqual(
			resolveDocParseInferScriptPath(extAtRepoRoot),
			path.resolve(devScript),
		);
	});

	test('start sets SA_DOCPARSE_INFER_SCRIPT when bundled script exists', async () => {
		const fakeBinary = path.join(extensionPath, 'bin', 'sa-docparse');
		await fs.promises.writeFile(fakeBinary, '#!/bin/sh\n', { mode: 0o755 });
		const inferDir = path.join(extensionPath, 'bin', 'python');
		await fs.promises.mkdir(inferDir, { recursive: true });
		const inferScript = path.join(inferDir, 'infer_unlimited_ocr.py');
		await fs.promises.writeFile(inferScript, 'print("ok")\n');

		let capturedEnv: NodeJS.ProcessEnv | undefined;
		const host = trackHost(new DocParseSidecarHost({
			extensionPath,
			modelDir,
			baseUrl,
			log: () => undefined,
			spawnFn: (_command, _args, options) => {
				capturedEnv = options.env as NodeJS.ProcessEnv;
				return spawn(process.execPath, ['-e', FAKE_SERVER_SCRIPT], {
					env: options.env as NodeJS.ProcessEnv,
					stdio: 'ignore',
				});
			},
		}));

		try {
			await host.start();
			assert.strictEqual(capturedEnv?.SA_DOCPARSE_INFER_SCRIPT, path.resolve(inferScript));
		} finally {
			await host.stop();
		}
	});

	test('start waits for /health with fake node sidecar', async () => {
		const fakeBinary = path.join(extensionPath, 'bin', 'sa-docparse');
		await fs.promises.writeFile(fakeBinary, '#!/bin/sh\n', { mode: 0o755 });

		const host = trackHost(new DocParseSidecarHost({
			extensionPath,
			modelDir,
			baseUrl,
			log: () => undefined,
			spawnFn: (_command, _args, options) =>
				spawn(process.execPath, ['-e', FAKE_SERVER_SCRIPT], {
					env: options.env as NodeJS.ProcessEnv,
					stdio: 'ignore',
				}),
		}));

		try {
			await host.start();
			assert.strictEqual(host.isRunning, true);
			assert.ok(host.childProcess);
		} finally {
			await host.stop();
		}
		assert.strictEqual(host.isRunning, false);
	});

	test('ensureStarted returns undefined when binary is absent (BYO mode)', async () => {
		const host = new DocParseSidecarHost({
			extensionPath,
			modelDir,
			baseUrl,
			log: () => undefined,
		});
		assert.strictEqual(host.isBinaryAvailable, false);
		const child = await host.ensureStarted();
		assert.strictEqual(child, undefined);
	});

	test('start throws when modelDir is missing or empty', async () => {
		const fakeBinary = path.join(extensionPath, 'bin', 'sa-docparse');
		await fs.promises.writeFile(fakeBinary, '#!/bin/sh\n', { mode: 0o755 });

		const emptyDir = path.join(tmpRoot, 'empty-model');
		await fs.promises.mkdir(emptyDir, { recursive: true });

		const host = trackHost(new DocParseSidecarHost({
			extensionPath,
			modelDir: emptyDir,
			baseUrl,
			log: () => undefined,
			spawnFn: () => ({ killed: false, exitCode: null, signalCode: null }) as ChildProcess,
		}));

		await assert.rejects(() => host.start(), /missing or empty/);

		const hostNoDir = trackHost(new DocParseSidecarHost({
			extensionPath,
			baseUrl,
			log: () => undefined,
			spawnFn: () => ({ killed: false, exitCode: null, signalCode: null }) as ChildProcess,
		}));
		await assert.rejects(() => hostNoDir.start(), /not configured/);
	});
});
