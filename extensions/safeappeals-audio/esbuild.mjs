/**
 * Bundle audio recorder webview React to media/sidebar IIFE bundle.
 *
 * Usage:
 *   node esbuild.mjs
 *   node esbuild.mjs --watch
 */
import { build, context } from 'esbuild';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, mkdirSync } from 'fs';

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
		'.css': 'css',
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
];

mkdirSync(resolve(__dirname, 'media/sidebar'), { recursive: true });
copyFileSync(
	resolve(__dirname, 'webview-src/sidebar/sidebar.css'),
	resolve(__dirname, 'media/sidebar/sidebar.css'),
);

if (isWatch) {
	const contexts = await Promise.all(builds.map(opts => context(opts)));
	await Promise.all(contexts.map(ctx => ctx.watch()));
	console.log('[safeappeals-audio] Watching webview-src…');
} else {
	for (const opts of builds) {
		await build(opts);
		console.log(`[safeappeals-audio] Built ${opts.outfile}`);
	}
}
