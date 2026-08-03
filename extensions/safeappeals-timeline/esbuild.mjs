/**
 * Bundle timeline webview React to media/sidebar and media/dashboard IIFE bundles.
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
	jsx: 'automatic',
	loader: {
		'.tsx': 'tsx',
		'.ts': 'ts',
	},
	mainFields: ['browser', 'module', 'main'],
	conditions: ['browser'],
};

const builds = [
	{
		...shared,
		entryPoints: [resolve(__dirname, 'webview-src/sidebar/main.tsx')],
		outfile: resolve(__dirname, 'media/sidebar/sidebar.js'),
	},
	{
		...shared,
		entryPoints: [resolve(__dirname, 'webview-src/dashboard/main.tsx')],
		outfile: resolve(__dirname, 'media/dashboard/dashboard.js'),
	},
];

if (isWatch) {
	const contexts = await Promise.all(builds.map(opts => context(opts)));
	await Promise.all(contexts.map(ctx => ctx.watch()));
	console.log('[safeappeals-timeline] Watching webview-src…');
} else {
	for (const opts of builds) {
		await build(opts);
		console.log(`[safeappeals-timeline] Built ${opts.outfile}`);
	}
}
