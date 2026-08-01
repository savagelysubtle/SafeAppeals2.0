/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/**
 * Compact Ctrl+K inline-edit popup for the XLSX canvas viewer.
 * Mirrors the DOCX VS Code inline-chat look (`docx-inline-edit-popup`).
 */

export interface XlsxInlineEditSelection {
	text: string;
	sheet?: string;
	range?: string;
}

export interface XlsxInlineEditPopupHost {
	postMessage(msg: unknown): void;
	/** Optional anchor rect for positioning (viewport coordinates). */
	getAnchorRect?: () => DOMRect | null;
}

export class XlsxInlineEditPopup {
	private readonly root: HTMLDivElement;
	private readonly previewEl: HTMLElement;
	private readonly inputEl: HTMLTextAreaElement;
	private readonly submitBtn: HTMLButtonElement;
	private readonly closeBtn: HTMLButtonElement;
	private selection: XlsxInlineEditSelection | null = null;
	private pending = false;
	private readonly onDocMouseDown: (e: MouseEvent) => void;

	constructor(private readonly host: XlsxInlineEditPopupHost) {
		this.root = document.createElement('div');
		this.root.className = 'docx-inline-edit-popup xlsx-inline-edit-popup';
		this.root.innerHTML = `
			<select id="xlsx-inline-edit-model" class="inline-edit-model-select" hidden></select>
			<div class="inline-edit-meta">
				<span class="inline-edit-selection-preview"></span>
				<button type="button" class="inline-edit-close" title="Close (Esc)">×</button>
			</div>
			<div class="inline-edit-input-row">
				<textarea class="inline-edit-input" placeholder="Edit selected cells…" rows="1"></textarea>
				<button type="button" class="inline-edit-submit" title="Edit Selection (Enter)">↵</button>
			</div>
		`;
		this.root.style.display = 'none';
		document.body.appendChild(this.root);

		this.previewEl = this.root.querySelector('.inline-edit-selection-preview') as HTMLElement;
		this.inputEl = this.root.querySelector('.inline-edit-input') as HTMLTextAreaElement;
		this.submitBtn = this.root.querySelector('.inline-edit-submit') as HTMLButtonElement;
		this.closeBtn = this.root.querySelector('.inline-edit-close') as HTMLButtonElement;

		this.closeBtn.addEventListener('click', () => this.hide());
		this.submitBtn.addEventListener('click', () => this.submit());
		this.inputEl.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				e.stopPropagation();
				this.submit();
			} else if (e.key === 'Escape') {
				e.preventDefault();
				e.stopPropagation();
				this.hide();
			}
		});
		this.root.addEventListener('mousedown', (e) => {
			e.stopPropagation();
		});

		this.onDocMouseDown = (e: MouseEvent) => {
			if (this.root.style.display === 'none' || this.pending) {
				return;
			}
			const target = e.target as Node | null;
			if (target && !this.root.contains(target)) {
				this.hide();
			}
		};
		document.addEventListener('mousedown', this.onDocMouseDown, true);
	}

	public isOpen(): boolean {
		return this.root.style.display !== 'none';
	}

	public show(selection: XlsxInlineEditSelection): void {
		const text = selection.text?.trim() ?? '';
		if (!text) {
			return;
		}

		this.selection = selection;
		const preview = text.length > 80 ? `${text.substring(0, 80)}…` : text;
		this.previewEl.textContent = preview;
		this.previewEl.title = text;
		this.previewEl.style.color = '';

		this.positionNearAnchor();

		this.root.style.display = 'flex';
		this.inputEl.value = '';
		this.resetControls();
		this.inputEl.focus();
	}

	public hide(options?: { skipCancel?: boolean }): void {
		const wasPending = this.pending;
		this.root.style.display = 'none';
		this.selection = null;
		this.inputEl.value = '';
		this.resetControls();
		if (wasPending && !options?.skipCancel) {
			this.host.postMessage({ type: 'inlineEditCancel' });
		}
	}

	public setLoading(): void {
		this.pending = true;
		this.submitBtn.disabled = true;
		this.submitBtn.textContent = '…';
		this.inputEl.disabled = true;
	}

	public showFailure(message: string): void {
		this.resetControls();
		const err = message || 'Edit failed';
		this.previewEl.textContent = err;
		this.previewEl.title = err;
		this.previewEl.style.color = 'var(--vscode-errorForeground, #f14c4c)';
		this.inputEl.focus();
	}

	public dispose(): void {
		document.removeEventListener('mousedown', this.onDocMouseDown, true);
		this.root.remove();
	}

	private resetControls(): void {
		this.pending = false;
		this.submitBtn.disabled = false;
		this.submitBtn.textContent = '↵';
		this.inputEl.disabled = false;
	}

	private submit(): void {
		const instructions = this.inputEl.value.trim();
		if (!instructions || !this.selection || this.pending) {
			return;
		}

		this.setLoading();

		this.host.postMessage({
			type: 'inlineEditRequest',
			selection: {
				text: this.selection.text,
				sheet: this.selection.sheet,
				range: this.selection.range,
			},
			instructions,
			modelSelection: null,
		});
	}

	private positionNearAnchor(): void {
		const rect = this.host.getAnchorRect?.() ?? null;
		const popupWidth = Math.min(480, window.innerWidth * 0.9);
		const popupHeight = 88;
		let left = 24;
		let top = 80;

		if (rect) {
			left = rect.left;
			top = rect.bottom + 8;
			if (left + popupWidth > window.innerWidth - 20) {
				left = window.innerWidth - popupWidth - 20;
			}
			if (left < 10) {
				left = 10;
			}
			if (top + popupHeight > window.innerHeight - 20) {
				top = rect.top - popupHeight - 8;
			}
			if (top < 10) {
				top = 10;
			}
		}

		this.root.style.left = `${left}px`;
		this.root.style.top = `${top}px`;
	}
}
