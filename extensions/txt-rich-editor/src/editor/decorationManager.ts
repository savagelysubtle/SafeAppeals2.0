/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Logger } from '../logger';

export interface DecorationRange {
	range: vscode.Range;
	decoration: vscode.TextEditorDecorationType;
	priority?: number;
}

export interface DecorationBatch {
	style: string;
	ranges: vscode.Range[];
	decoration: vscode.TextEditorDecorationType;
}

export interface SyntaxHighlightingRule {
	pattern: RegExp;
	style: vscode.TextEditorDecorationType;
	priority: number;
}

export class DecorationManager {
	private readonly disposables: vscode.Disposable[] = [];
	private readonly logger: Logger;
	private readonly decorationBatches = new Map<string, DecorationBatch>();
	private readonly syntaxRules: SyntaxHighlightingRule[] = [];
	private readonly debounceTimer: NodeJS.Timeout | null = null;
	private readonly debounceDelay = 100;

	constructor(private readonly editor: vscode.TextEditor, logger: Logger) {
		this.logger = logger;
		this.setupSyntaxHighlighting();
		this.setupEventListeners();
	}

	/**
	 * Setup syntax highlighting rules
	 */
	private setupSyntaxHighlighting(): void {
		// Heading styles
		this.syntaxRules.push({
			pattern: /^#{1,6}\s+.+$/gm,
			style: vscode.window.createTextEditorDecorationType({
				fontWeight: 'bold',
				color: new vscode.ThemeColor('editor.foreground')
			}),
			priority: 1
		});

		// Bold text
		this.syntaxRules.push({
			pattern: /\*\*([^*]+)\*\*/g,
			style: vscode.window.createTextEditorDecorationType({
				fontWeight: 'bold'
			}),
			priority: 2
		});

		// Italic text
		this.syntaxRules.push({
			pattern: /\*([^*]+)\*/g,
			style: vscode.window.createTextEditorDecorationType({
				fontStyle: 'italic'
			}),
			priority: 2
		});

		// Underlined text
		this.syntaxRules.push({
			pattern: /__([^_]+)__/g,
			style: vscode.window.createTextEditorDecorationType({
				textDecoration: 'underline'
			}),
			priority: 2
		});

		// Strikethrough text
		this.syntaxRules.push({
			pattern: /~~([^~]+)~~/g,
			style: vscode.window.createTextEditorDecorationType({
				textDecoration: 'line-through'
			}),
			priority: 2
		});

		// Code blocks
		this.syntaxRules.push({
			pattern: /```[\s\S]*?```/g,
			style: vscode.window.createTextEditorDecorationType({
				backgroundColor: new vscode.ThemeColor('editor.background'),
				border: '1px solid ' + new vscode.ThemeColor('editor.foreground'),
				borderRadius: '3px'
			}),
			priority: 3
		});

		// Inline code
		this.syntaxRules.push({
			pattern: /`([^`]+)`/g,
			style: vscode.window.createTextEditorDecorationType({
				backgroundColor: new vscode.ThemeColor('editor.background'),
				border: '1px solid ' + new vscode.ThemeColor('editor.foreground'),
				borderRadius: '2px'
			}),
			priority: 3
		});

		// Links
		this.syntaxRules.push({
			pattern: /\[([^\]]+)\]\(([^)]+)\)/g,
			style: vscode.window.createTextEditorDecorationType({
				color: new vscode.ThemeColor('textLink.foreground'),
				textDecoration: 'underline'
			}),
			priority: 4
		});

		// Lists
		this.syntaxRules.push({
			pattern: /^[\s]*[-*+]\s+/gm,
			style: vscode.window.createTextEditorDecorationType({
				color: new vscode.ThemeColor('editor.foreground')
			}),
			priority: 5
		});

		// Numbered lists
		this.syntaxRules.push({
			pattern: /^[\s]*\d+\.\s+/gm,
			style: vscode.window.createTextEditorDecorationType({
				color: new vscode.ThemeColor('editor.foreground')
			}),
			priority: 5
		});

		// Blockquotes
		this.syntaxRules.push({
			pattern: /^>\s+.+$/gm,
			style: vscode.window.createTextEditorDecorationType({
				color: new vscode.ThemeColor('textBlockQuote.foreground')
			}),
			priority: 6
		});

		// Tables
		this.syntaxRules.push({
			pattern: /^\|.*\|$/gm,
			style: vscode.window.createTextEditorDecorationType({
				backgroundColor: new vscode.ThemeColor('editor.background'),
				border: '1px solid ' + new vscode.ThemeColor('editor.foreground')
			}),
			priority: 7
		});

		// Store decorations for disposal
		this.syntaxRules.forEach(rule => {
			this.disposables.push(rule.style);
		});
	}

	/**
	 * Setup event listeners
	 */
	private setupEventListeners(): void {
		// Listen for document changes
		const documentChangeDisposable = vscode.workspace.onDidChangeTextDocument((e) => {
			if (e.document === this.editor.document) {
				this.debouncedUpdateDecorations();
			}
		});

		// Listen for selection changes
		const selectionChangeDisposable = vscode.window.onDidChangeTextEditorSelection((e) => {
			if (e.textEditor === this.editor) {
				this.updateSelectionDecorations();
			}
		});

		// Listen for editor changes
		const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor((e) => {
			if (e === this.editor) {
				this.updateAllDecorations();
			}
		});

		this.disposables.push(documentChangeDisposable, selectionChangeDisposable, editorChangeDisposable);
	}

	/**
	 * Debounced update decorations
	 */
	private debouncedUpdateDecorations(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}

		setTimeout(() => {
			this.updateAllDecorations();
		}, this.debounceDelay);
	}

	/**
	 * Update all decorations
	 */
	private updateAllDecorations(): void {
		try {
			this.logger.info('Updating all decorations');

			// Clear existing batches
			this.decorationBatches.clear();

			// Apply syntax highlighting
			this.applySyntaxHighlighting();

			// Apply other decorations
			this.applySelectionDecorations();
			this.applyErrorDecorations();
			this.applyWarningDecorations();

			// Batch apply all decorations
			this.batchApplyDecorations();

		} catch (error) {
			this.logger.error('Error updating decorations:', error);
		}
	}

	/**
	 * Apply syntax highlighting
	 */
	private applySyntaxHighlighting(): void {
		const document = this.editor.document;
		const text = document.getText();

		// Sort rules by priority
		const sortedRules = [...this.syntaxRules].sort((a, b) => a.priority - b.priority);

		for (const rule of sortedRules) {
			const ranges: vscode.Range[] = [];
			let match;

			// Reset regex lastIndex
			rule.pattern.lastIndex = 0;

			while ((match = rule.pattern.exec(text)) !== null) {
				const startPos = document.positionAt(match.index);
				const endPos = document.positionAt(match.index + match[0].length);
				ranges.push(new vscode.Range(startPos, endPos));
			}

			if (ranges.length > 0) {
				this.addDecorationBatch(`syntax-${rule.pattern.source}`, {
					style: `syntax-${rule.pattern.source}`,
					ranges,
					decoration: rule.style
				});
			}
		}
	}

	/**
	 * Apply selection decorations
	 */
	private applySelectionDecorations(): void {
		const selections = this.editor.selections;
		if (selections.length === 0) return;

		const decoration = vscode.window.createTextEditorDecorationType({
			backgroundColor: new vscode.ThemeColor('editor.selectionBackground'),
			color: new vscode.ThemeColor('editor.selectionForeground')
		});

		this.addDecorationBatch('selection', {
			style: 'selection',
			ranges: Array.from(selections),
			decoration
		});

		this.disposables.push(decoration);
	}

	/**
	 * Apply error decorations
	 */
	private applyErrorDecorations(): void {
		// This would integrate with a spell checker or linter
		// For now, just a placeholder
	}

	/**
	 * Apply warning decorations
	 */
	private applyWarningDecorations(): void {
		// This would integrate with a spell checker or linter
		// For now, just a placeholder
	}

	/**
	 * Add decoration batch
	 */
	private addDecorationBatch(key: string, batch: DecorationBatch): void {
		this.decorationBatches.set(key, batch);
	}

	/**
	 * Batch apply all decorations
	 */
	private batchApplyDecorations(): void {
		for (const [, batch] of this.decorationBatches) {
			try {
				this.editor.setDecorations(batch.decoration, batch.ranges);
				this.logger.info(`Applied ${batch.ranges.length} decorations`);
			} catch (error) {
				this.logger.error(`Error applying decorations:`, error);
			}
		}
	}

	/**
	 * Update selection decorations
	 */
	private updateSelectionDecorations(): void {
		// Remove existing selection decorations
		this.decorationBatches.delete('selection');

		// Apply new selection decorations
		this.applySelectionDecorations();
		this.batchApplyDecorations();
	}

	/**
	 * Add custom decoration
	 */
	public addDecoration(range: vscode.Range, decoration: vscode.TextEditorDecorationType): void {
		const key = `custom-${Date.now()}`;
		this.addDecorationBatch(key, {
			style: key,
			ranges: [range],
			decoration
		});
		this.batchApplyDecorations();
	}

	/**
	 * Remove decoration by key
	 */
	public removeDecoration(key: string): void {
		this.decorationBatches.delete(key);
		this.batchApplyDecorations();
	}

	/**
	 * Clear all decorations
	 */
	public clearAllDecorations(): void {
		for (const [, batch] of this.decorationBatches) {
			this.editor.setDecorations(batch.decoration, []);
		}
		this.decorationBatches.clear();
	}

	/**
	 * Get decoration count
	 */
	public getDecorationCount(): number {
		let total = 0;
		for (const batch of this.decorationBatches.values()) {
			total += batch.ranges.length;
		}
		return total;
	}

	/**
	 * Get decoration info
	 */
	public getDecorationInfo(): { [key: string]: number } {
		const info: { [key: string]: number } = {};
		for (const [key, batch] of this.decorationBatches) {
			info[key] = batch.ranges.length;
		}
		return info;
	}

	/**
	 * Update syntax highlighting rules
	 */
	public updateSyntaxRules(rules: SyntaxHighlightingRule[]): void {
		// Dispose old rules
		this.syntaxRules.forEach(rule => {
			rule.style.dispose();
		});

		// Clear rules
		this.syntaxRules.length = 0;

		// Add new rules
		this.syntaxRules.push(...rules);

		// Store new decorations for disposal
		this.syntaxRules.forEach(rule => {
			this.disposables.push(rule.style);
		});

		// Update decorations
		this.updateAllDecorations();
	}

	/**
	 * Add syntax highlighting rule
	 */
	public addSyntaxRule(rule: SyntaxHighlightingRule): void {
		this.syntaxRules.push(rule);
		this.disposables.push(rule.style);
		this.updateAllDecorations();
	}

	/**
	 * Remove syntax highlighting rule
	 */
	public removeSyntaxRule(pattern: RegExp): void {
		const index = this.syntaxRules.findIndex(rule => rule.pattern.source === pattern.source);
		if (index > -1) {
			const rule = this.syntaxRules[index];
			rule.style.dispose();
			this.syntaxRules.splice(index, 1);
			this.updateAllDecorations();
		}
	}

	/**
	 * Dispose the decoration manager
	 */
	public dispose(): void {
		this.logger.info('Disposing decoration manager');

		// Clear all decorations
		this.clearAllDecorations();

		// Dispose all decorations
		for (const [, batch] of this.decorationBatches) {
			batch.decoration.dispose();
		}

		// Dispose all disposables
		this.disposables.forEach(disposable => disposable.dispose());
		this.disposables.length = 0;

		// Clear batches
		this.decorationBatches.clear();

		// Clear rules
		this.syntaxRules.length = 0;
	}
}
