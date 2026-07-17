/**
 * Bundle PDF webview TypeScript → media/pdf/pdfRustViewer.js (IIFE).
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

const buildOptions = {
	entryPoints: [resolve(__dirname, 'webview-src/pdf/main.ts')],
	bundle: true,
	outfile: resolve(__dirname, 'media/pdf/pdfRustViewer.js'),
	format: 'iife',
	platform: 'browser',
	target: ['es2020'],
	sourcemap: false,
	minify: false,
	// WASM binary is loaded at runtime via fetch(data-wasm-url); pdfium.js is a separate script tag.
	define: {
		'process.env.NODE_ENV': '"production"',
		'import.meta.url': '""',
	},
	logLevel: 'info',
};

if (isWatch) {
	const ctx = await context(buildOptions);
	await ctx.watch();
	console.log('[safeappeals-documents] Watching webview-src/pdf...');
} else {
	await build(buildOptions);
	console.log('[safeappeals-documents] Built media/pdf/pdfRustViewer.js');
}
