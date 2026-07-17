/**
 * Bundle webview TypeScript/React to media/dashboard and media/eml IIFE bundles.
 *
 * Usage:
 *   node esbuild.mjs
 *   node esbuild.mjs --watch
 */
import { build, context } from 'esbuild';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes('--watch');

const shared = {
	bundle: true,
	format: 'iife',
	platform: 'browser',
	target: ['es2020'],
	sourcemap: false,
	minify: false,
	logLevel: 'info',
	define: {
		'process.env.NODE_ENV': '"production"',
	},
};

const builds = [
	{
		...shared,
		entryPoints: [resolve(__dirname, 'webview-src/dashboard/main.tsx')],
		outfile: resolve(__dirname, 'media/dashboard/dashboard.js'),
		jsx: 'automatic',
		loader: {
			'.tsx': 'tsx',
			'.ts': 'ts',
		},
		mainFields: ['browser', 'module', 'main'],
		conditions: ['browser'],
	},
	{
		...shared,
		entryPoints: [resolve(__dirname, 'webview-src/eml/main.ts')],
		outfile: resolve(__dirname, 'media/eml/emlViewer.js'),
	},
];

if (isWatch) {
	const contexts = await Promise.all(builds.map((opts) => context(opts)));
	await Promise.all(contexts.map((ctx) => ctx.watch()));
	console.log('[safeappeals-email] Watching webview-src…');
} else {
	for (const opts of builds) {
		await build(opts);
		console.log(`[safeappeals-email] Built ${opts.outfile}`);
	}
}
