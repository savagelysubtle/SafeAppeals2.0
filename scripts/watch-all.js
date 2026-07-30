/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// @ts-check

const cp = require('child_process');
const path = require('path');

const APP_ROOT = path.join(__dirname, '..');

/** Strip ANSI escape sequences so ready-signal matching is color-safe. */
const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

/**
 * Ready signals for each watcher started by npm-run-all2 -lp.
 * Match after stripping ANSI. Require the npm-run-all label so a ready line
 * from one watcher cannot mark another; fancy-log timestamps may sit between
 * the label and the ready substring.
 *
 * @type {{ name: string, ready: RegExp }[]}
 */
// npm-run-all2 -l pads labels to equal width inside the brackets
// (e.g. "[watch-client           ]"), so allow trailing spaces before "]".
const WATCHERS = [
	{ name: 'watch-client-transpile', ready: /\[watch-client-transpile\s*\].*Finished transpilation with/ },
	{ name: 'watch-client', ready: /\[watch-client\s*\].*Finished watch-client-noEmit/ },
	{ name: 'watch-extensions', ready: /\[watch-extensions\s*\].*Finished compilation/ },
	{ name: 'watch-copilot', ready: /\[watch-copilot\s*\].*Watching for file changes/ },
];

const READY_MESSAGE = 'Watchers done and ready for changes.';
const BEGINS_MESSAGE = 'Starting all watchers...';

/**
 * @param {string} text
 * @returns {string}
 */
function stripAnsi(text) {
	return text.replace(ansiRegex, '');
}

/**
 * Update ready flags from a single log line. Returns true when all watchers
 * have signaled ready for the first time (caller should print READY_MESSAGE once).
 *
 * @param {string} line
 * @param {Set<string>} ready
 * @returns {boolean}
 */
function trackReadyLine(line, ready) {
	const clean = stripAnsi(line);
	for (const watcher of WATCHERS) {
		if (!ready.has(watcher.name) && watcher.ready.test(clean)) {
			ready.add(watcher.name);
		}
	}
	return ready.size === WATCHERS.length;
}

/**
 * Process a chunk of stdout/stderr, handling partial lines across chunks.
 *
 * @param {string} chunk
 * @param {{ buffer: string, announced: boolean, ready: Set<string> }} state
 * @param {(s: string) => void} write
 */
function processChunk(chunk, state, write) {
	write(chunk);
	state.buffer += chunk;
	const parts = state.buffer.split(/\r?\n/);
	state.buffer = parts.pop() ?? '';
	for (const line of parts) {
		if (!state.announced && trackReadyLine(line, state.ready)) {
			state.announced = true;
			write('\n');
			write(`\x1b[32m\x1b[1m${READY_MESSAGE}\x1b[0m\n`);
			write('\n');
		}
	}
}

function main() {
	console.log(BEGINS_MESSAGE);

	/** @type {{ buffer: string, announced: boolean, ready: Set<string> }} */
	const state = {
		buffer: '',
		announced: false,
		ready: new Set(),
	};

	const args = [
		'-lp',
		'watch-client-transpile',
		'watch-client',
		'watch-extensions',
		'watch-copilot',
	];

	const npmRunAll = path.join(APP_ROOT, 'node_modules', '.bin', 'npm-run-all2');
	const child = cp.spawn(npmRunAll, args, {
		cwd: APP_ROOT,
		env: process.env,
		stdio: ['inherit', 'pipe', 'pipe'],
		shell: true,
	});

	const writeOut = (s) => process.stdout.write(s);
	const writeErr = (s) => process.stderr.write(s);

	child.stdout?.on('data', (data) => {
		processChunk(data.toString(), state, writeOut);
	});
	child.stderr?.on('data', (data) => {
		processChunk(data.toString(), state, writeErr);
	});

	child.on('error', (err) => {
		console.error(err);
		process.exit(1);
	});

	child.on('exit', (code, signal) => {
		if (signal) {
			process.kill(process.pid, signal);
			return;
		}
		process.exit(code ?? 1);
	});

	const forwardSignal = (signal) => {
		if (!child.killed) {
			child.kill(signal);
		}
	};

	process.on('SIGINT', () => forwardSignal('SIGINT'));
	process.on('SIGTERM', () => forwardSignal('SIGTERM'));
}

// Exported for lightweight self-checks when run with --self-test
if (require.main === module) {
	if (process.argv.includes('--self-test')) {
		const ready = new Set();
		// Labels padded like npm-run-all2 -l (width = longest script name).
		const samples = [
			'[watch-client-transpile] Finished transpilation with 0 errors after 12 ms',
			'[watch-client          ] [12:00:00] Finished \x1b[32mwatch-client-noEmit\x1b[39m src/tsconfig.json with 0 errors.',
			'[watch-extensions      ] Finished compilation',
			'[watch-copilot         ] Found 0 errors. Watching for file changes.',
		];
		// Padded watch-client must not be satisfied by the transpile line alone.
		const partial = new Set();
		trackReadyLine(samples[0], partial);
		if (partial.has('watch-client') || !partial.has('watch-client-transpile')) {
			console.error('self-test failed: label isolation broken');
			process.exit(1);
		}
		let done = false;
		for (const line of samples) {
			done = trackReadyLine(line, ready);
		}
		if (!done || ready.size !== WATCHERS.length) {
			console.error('self-test failed: expected all watchers ready');
			process.exit(1);
		}
		// Rebuild should not flip announced logic — trackReadyLine only fills the set
		const again = trackReadyLine(samples[0], ready);
		if (!again || ready.size !== WATCHERS.length) {
			console.error('self-test failed: ready set should stay complete');
			process.exit(1);
		}
		console.log('self-test ok');
		process.exit(0);
	}
	main();
}

module.exports = { stripAnsi, trackReadyLine, WATCHERS, READY_MESSAGE, BEGINS_MESSAGE };
