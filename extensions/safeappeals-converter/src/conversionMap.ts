/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import type { AvailableConversions } from './types';
import * as vscode from 'vscode';

export interface ConversionTarget {
	key: string;
	ext: string;
	label: string;
	fidelity: string;
	installHint?: string;
}

/** Convert a sidecar fidelity identifier into a localized display label. */
export function localizeFidelityLabel(fidelity: string): string {
	switch (fidelity) {
		case 'office-fidelity': return vscode.l10n.t('Office Fidelity');
		case 'semantic': return vscode.l10n.t('Semantic');
		case 'browser-print': return vscode.l10n.t('Browser Print');
		case 'preview-fast': return vscode.l10n.t('Fast Preview');
		case 'pdf-ops': return vscode.l10n.t('PDF Operations');
		case 'ocr': return vscode.l10n.t('OCR');
		default: return fidelity;
	}
}

/**
 * Mapping from source file extension to valid conversion targets.
 * Based on the Rust registry (rust/converter/src/registry.rs).
 * Only includes single-file → single-file conversions (excludes merge, split, page-range operations).
 */
const CONVERSION_MAP_RAW: Record<string, Omit<ConversionTarget, 'installHint'>[]> = {
	// Documents
	docx: [
		{ key: 'docx2pdf', ext: 'pdf', label: 'PDF (Office fidelity)', fidelity: 'office-fidelity' },
		{ key: 'docx2md', ext: 'md', label: 'Markdown', fidelity: 'semantic' },
		{ key: 'docx2epub', ext: 'epub', label: 'EPUB', fidelity: 'semantic' },
	],
	md: [
		{ key: 'md2html', ext: 'html', label: 'HTML', fidelity: 'semantic' },
		{ key: 'md2docx', ext: 'docx', label: 'Word (docx)', fidelity: 'semantic' },
		{ key: 'md2pdf', ext: 'pdf', label: 'PDF (Browser print)', fidelity: 'browser-print' },
		{ key: 'md2epub', ext: 'epub', label: 'EPUB', fidelity: 'semantic' },
	],
	html: [
		{ key: 'html2pdf', ext: 'pdf', label: 'PDF (Browser print)', fidelity: 'browser-print' },
		{ key: 'html2epub', ext: 'epub', label: 'EPUB', fidelity: 'semantic' },
	],
	epub: [
		{ key: 'epub2pdf', ext: 'pdf', label: 'PDF (Office fidelity)', fidelity: 'office-fidelity' },
		{ key: 'epub2html', ext: 'html', label: 'HTML', fidelity: 'semantic' },
		{ key: 'epub2md', ext: 'md', label: 'Markdown', fidelity: 'semantic' },
		{ key: 'epub2docx', ext: 'docx', label: 'Word (docx)', fidelity: 'semantic' },
	],
	// Spreadsheets
	xlsx: [
		{ key: 'xlsx2pdf', ext: 'pdf', label: 'PDF (Office fidelity)', fidelity: 'office-fidelity' },
		{ key: 'xlsx2csv', ext: 'csv', label: 'CSV', fidelity: 'semantic' },
		{ key: 'xlsx2md', ext: 'md', label: 'Markdown', fidelity: 'semantic' },
		{ key: 'xlsx2html', ext: 'html', label: 'HTML', fidelity: 'semantic' },
	],
	csv: [
		{ key: 'csv2xlsx', ext: 'xlsx', label: 'Excel (xlsx)', fidelity: 'semantic' },
		{ key: 'csv2pdf', ext: 'pdf', label: 'PDF', fidelity: 'preview-fast' },
	],
	// Presentations
	pptx: [
		{ key: 'pptx2pdf', ext: 'pdf', label: 'PDF (Office fidelity)', fidelity: 'office-fidelity' },
		{ key: 'pptx2html', ext: 'html', label: 'HTML', fidelity: 'semantic' },
		{ key: 'pptx2md', ext: 'md', label: 'Markdown', fidelity: 'semantic' },
		{ key: 'pptx2images', ext: 'zip', label: 'Images (ZIP)', fidelity: 'office-fidelity' },
	],
	// PDF operations (single-file → single-file only)
	pdf: [
		{ key: 'pdf2md', ext: 'md', label: 'Markdown', fidelity: 'semantic' },
		{ key: 'pdf2html', ext: 'html', label: 'HTML', fidelity: 'semantic' },
		{ key: 'pdf2images', ext: 'zip', label: 'Images (ZIP)', fidelity: 'semantic' },
		{ key: 'pdf2compress', ext: 'pdf', label: 'Compressed PDF', fidelity: 'pdf-ops' },
		{ key: 'pdf2watermark', ext: 'pdf', label: 'Watermarked PDF', fidelity: 'pdf-ops' },
		{ key: 'pdf2ocr_layer', ext: 'pdf', label: 'OCR Layer (Searchable PDF)', fidelity: 'ocr' },
		{ key: 'pdf2editable', ext: 'pdf', label: 'Editable PDF (OCR)', fidelity: 'ocr' },
	],
	// Images
	png: [
		{ key: 'image2pdf', ext: 'pdf', label: 'PDF', fidelity: 'semantic' },
		{ key: 'image2image', ext: 'png', label: 'Convert Image', fidelity: 'semantic' },
		{ key: 'image2text', ext: 'txt', label: 'Extract Text (OCR)', fidelity: 'ocr' },
	],
	jpg: [
		{ key: 'image2pdf', ext: 'pdf', label: 'PDF', fidelity: 'semantic' },
		{ key: 'image2image', ext: 'jpg', label: 'Convert Image', fidelity: 'semantic' },
		{ key: 'image2text', ext: 'txt', label: 'Extract Text (OCR)', fidelity: 'ocr' },
	],
	jpeg: [
		{ key: 'image2pdf', ext: 'pdf', label: 'PDF', fidelity: 'semantic' },
		{ key: 'image2image', ext: 'jpeg', label: 'Convert Image', fidelity: 'semantic' },
		{ key: 'image2text', ext: 'txt', label: 'Extract Text (OCR)', fidelity: 'ocr' },
	],
	tiff: [
		{ key: 'image2pdf', ext: 'pdf', label: 'PDF', fidelity: 'semantic' },
		{ key: 'image2image', ext: 'tiff', label: 'Convert Image', fidelity: 'semantic' },
		{ key: 'image2text', ext: 'txt', label: 'Extract Text (OCR)', fidelity: 'ocr' },
	],
	bmp: [
		{ key: 'image2pdf', ext: 'pdf', label: 'PDF', fidelity: 'semantic' },
		{ key: 'image2image', ext: 'bmp', label: 'Convert Image', fidelity: 'semantic' },
		{ key: 'image2text', ext: 'txt', label: 'Extract Text (OCR)', fidelity: 'ocr' },
	],
	gif: [
		{ key: 'image2pdf', ext: 'pdf', label: 'PDF', fidelity: 'semantic' },
		{ key: 'image2image', ext: 'gif', label: 'Convert Image', fidelity: 'semantic' },
		{ key: 'image2text', ext: 'txt', label: 'Extract Text (OCR)', fidelity: 'ocr' },
	],
	// Text
	txt: [
		{ key: 'txt2pdf', ext: 'pdf', label: 'PDF', fidelity: 'preview-fast' },
	],
};

/**
 * Get available conversion targets for a source file extension.
 * Filters to only include conversions that are available or have an install hint (missing external tool).
 * Excludes conversions that are fundamentally unavailable (e.g., not implemented).
 */
export function getConversionTargetsForExtension(
	ext: string,
	availableConversions: AvailableConversions,
): ConversionTarget[] {
	const rawTargets = CONVERSION_MAP_RAW[ext.toLowerCase()] ?? [];
	const targets: ConversionTarget[] = [];

	for (const raw of rawTargets) {
		const spec = availableConversions.conversions[raw.key];
		if (!spec) {
			continue; // Not in registry at all
		}
		if (spec.available) {
			targets.push({ ...raw, label: localizeConversionLabel(raw.label), installHint: undefined });
		} else if (spec.install_hint) {
			// Available but missing external tool (LibreOffice, Chromium, Tesseract, etc.)
			targets.push({ ...raw, label: localizeConversionLabel(raw.label), installHint: spec.install_hint });
		}
		// If not available and no install_hint, it's fundamentally unavailable (e.g., pdf2encrypt) — hide it
	}

	return targets;
}

function localizeConversionLabel(label: string): string {
	switch (label) {
		case 'PDF (Office fidelity)': return vscode.l10n.t('PDF (Office fidelity)');
		case 'Markdown': return vscode.l10n.t('Markdown');
		case 'EPUB': return vscode.l10n.t('EPUB');
		case 'HTML': return vscode.l10n.t('HTML');
		case 'Word (docx)': return vscode.l10n.t('Word (docx)');
		case 'PDF (Browser print)': return vscode.l10n.t('PDF (Browser print)');
		case 'CSV': return vscode.l10n.t('CSV');
		case 'PDF': return vscode.l10n.t('PDF');
		case 'Excel (xlsx)': return vscode.l10n.t('Excel (xlsx)');
		case 'Images (ZIP)': return vscode.l10n.t('Images (ZIP)');
		case 'Compressed PDF': return vscode.l10n.t('Compressed PDF');
		case 'Watermarked PDF': return vscode.l10n.t('Watermarked PDF');
		case 'OCR Layer (Searchable PDF)': return vscode.l10n.t('OCR Layer (Searchable PDF)');
		case 'Editable PDF (OCR)': return vscode.l10n.t('Editable PDF (OCR)');
		case 'Convert Image': return vscode.l10n.t('Convert Image');
		case 'Extract Text (OCR)': return vscode.l10n.t('Extract Text (OCR)');
		default: return label;
	}
}

/**
 * Get all supported source extensions.
 */
export function getSupportedSourceExtensions(): string[] {
	return Object.keys(CONVERSION_MAP_RAW);
}
