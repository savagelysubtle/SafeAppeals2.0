/**
 * Build script for PDF Viewer webview media.
 * Bundles main.ts + renderer.ts + sidebar.ts + annotations.ts + signatures.ts → single pdfRustViewer.js
 *
 * Usage:
 *   node media/build.mjs           (single build)
 *   node media/build.mjs --watch   (watch mode)
 */
import { build, context } from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const isWatch = process.argv.includes('--watch');

const buildOptions = {
	entryPoints: [resolve(__dirname, 'main.ts')],
	bundle: true,
	outfile: resolve(__dirname, 'pdfRustViewer.js'),
	format: 'iife',
	platform: 'browser',
	target: ['es2020'],
	sourcemap: false,
	minify: false, // Keep readable for debugging
	// The wasm-bindgen JS glue is an ES module; esbuild can bundle it
	// The WASM binary itself is NOT bundled — it's loaded at runtime via fetch()
	// The PDFium Emscripten glue (pdfium.js) is loaded as a separate <script> tag, not bundled
	external: [],
	define: {
		'process.env.NODE_ENV': '"production"',
		'import.meta.url': '""',
	},
	logLevel: 'info',
};

if (isWatch) {
	const ctx = await context(buildOptions);
	await ctx.watch();
	console.log('Watching for changes...');
} else {
	await build(buildOptions);
	console.log('Build complete: pdfRustViewer.js');
}
