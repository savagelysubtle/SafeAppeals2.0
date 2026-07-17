/**
 * Bundle webview TypeScript to media PDF/DOCX/XLSX IIFE bundles.
 *
 * Usage:
 *   node esbuild.mjs
 *   node esbuild.mjs --watch
 *
 * XLSX: main-thread WASM (worker.ts unused). WASM binary is NOT bundled —
 * loaded at runtime from media/xlsx/wasm/xlsx_rust_viewer_bg.wasm.
 * Rust source (reference only): void-reference/.../xlsxRustViewer/wasm/src
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
		'import.meta.url': '""',
	},
};

const builds = [
	{
		...shared,
		entryPoints: [resolve(__dirname, 'webview-src/pdf/main.ts')],
		outfile: resolve(__dirname, 'media/pdf/pdfRustViewer.js'),
	},
	{
		...shared,
		entryPoints: [resolve(__dirname, 'webview-src/docx/main.ts')],
		outfile: resolve(__dirname, 'media/docx/docxEditor.js'),
		loader: {
			'.js': 'js',
		},
		mainFields: ['browser', 'module', 'main'],
		conditions: ['browser'],
	},
	{
		...shared,
		entryPoints: [resolve(__dirname, 'webview-src/xlsx/main.ts')],
		outfile: resolve(__dirname, 'media/xlsx/xlsxViewer.js'),
		loader: {
			'.js': 'js',
		},
		mainFields: ['browser', 'module', 'main'],
		conditions: ['browser'],
	},
];

if (isWatch) {
	const contexts = await Promise.all(builds.map(opts => context(opts)));
	await Promise.all(contexts.map(ctx => ctx.watch()));
	console.log('[safeappeals-documents] Watching webview-src/pdf + docx + xlsx...');
} else {
	for (const opts of builds) {
		await build(opts);
		console.log(`[safeappeals-documents] Built ${opts.outfile}`);
	}
}
