/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { SETUP_LOCAL_SEARCH_COMMAND } from './localAiSetupCompletion';
import type { HardDisableCode } from './types';

/**
 * User-facing hard-disable copy (nls). Never mentions Tesseract as a fallback.
 */
export function hardDisableMessage(code: HardDisableCode, reasons: readonly string[]): string {
	const detail = reasons.length ? ` ${reasons.join('; ')}` : '';
	switch (code) {
		case 'scanned-ocr-ineligible':
			return vscode.l10n.t(
				'This scanned PDF cannot be indexed on this computer. Private Search needs Unlimited-OCR, which is not available for this machine.{0}',
				detail,
			);
		case 'scanned-ocr-unpinned':
			return vscode.l10n.t(
				'This scanned PDF cannot be indexed yet. Unlimited-OCR download pins are not configured for this build.{0}',
				detail,
			);
		case 'scanned-ocr-not-installed':
			return vscode.l10n.t(
				'This scanned PDF cannot be indexed until Unlimited-OCR is installed with your consent. Run “Set Up Private Search” ({0}) to install it when eligible.{1}',
				SETUP_LOCAL_SEARCH_COMMAND,
				detail,
			);
		case 'scanned-ocr-sidecar-not-ready':
			return vscode.l10n.t(
				'This scanned PDF cannot be indexed because the Unlimited-OCR service is not ready.{0}',
				detail,
			);
		case 'path-outside-workspace':
			return vscode.l10n.t(
				'This file cannot be indexed because its path is outside the open workspace.{0}',
				detail,
			);
		case 'unsupported-format':
			return vscode.l10n.t(
				'This file type cannot be indexed yet.{0}',
				detail,
			);
		case 'extract-failed':
			return vscode.l10n.t(
				'Private Search could not extract text from this file.{0}',
				detail,
			);
		case 'native-missing':
			return vscode.l10n.t(
				'Private Search is unavailable because the on-device search engine is missing or does not match this runtime (native addon / ABI).{0}',
				detail,
			);
		case 'index-lock-busy':
			return vscode.l10n.t(
				'Private Search index is locked by another Safe Appeals window — close other windows using this profile and reload.{0}',
				detail,
			);
		case 'read-only-session':
			return vscode.l10n.t(
				'Private Search indexing is owned by the main workbench window. Search is available here in read-only mode.{0}',
				detail,
			);
		case 'models-missing':
			return vscode.l10n.t(
				'Private Search is unavailable until Search Tools are installed (or BYO model directories are set). Run “Set Up Private Search” ({0}).{1}',
				SETUP_LOCAL_SEARCH_COMMAND,
				detail,
			);
		case 'crypto-unavailable':
			return vscode.l10n.t(
				'Private Search cannot open an encrypted index because secure key storage is unavailable on this computer.{0}',
				detail,
			);
	}
}
