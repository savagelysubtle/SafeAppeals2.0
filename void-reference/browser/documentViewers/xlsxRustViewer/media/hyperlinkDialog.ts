// Hyperlink Dialog for XLSX Rust Viewer
// Three-tab dialog: URL, Email, Sheet Reference

import type { HyperlinkDef } from './renderer.js';

export interface HLDialogEvent {
	action: 'insert' | 'edit' | 'remove' | 'close';
	link?: HyperlinkDef;
}

type TabId = 'url' | 'email' | 'sheet';

export class HyperlinkDialog {
	private container: HTMLElement;
	private onAction: (event: HLDialogEvent) => void;

	private dialog!: HTMLDivElement;
	private tabButtons: Map<TabId, HTMLButtonElement> = new Map();
	private tabContents: Map<TabId, HTMLElement> = new Map();

	// Current state
	private currentCellRef: string = 'A1';
	private isEditing: boolean = false;
	private existingLink: HyperlinkDef | null = null;

	// URL tab
	private urlInput!: HTMLInputElement;
	private urlDisplayInput!: HTMLInputElement;
	private urlTooltipInput!: HTMLInputElement;

	// Email tab
	private emailInput!: HTMLInputElement;
	private emailSubjectInput!: HTMLInputElement;
	private emailDisplayInput!: HTMLInputElement;

	// Sheet tab
	private sheetSelect!: HTMLSelectElement;
	private sheetCellInput!: HTMLInputElement;
	private sheetDisplayInput!: HTMLInputElement;

	// Remove button (shown when editing)
	private removeBtn!: HTMLButtonElement;

	constructor(container: HTMLElement, onAction: (event: HLDialogEvent) => void) {
		this.container = container;
		this.onAction = onAction;
		this._build();
	}

	private _build(): void {
		this.dialog = document.createElement('div');
		Object.assign(this.dialog.style, {
			display: 'none',
			position: 'fixed',
			top: '80px',
			left: '50%',
			transform: 'translateX(-50%)',
			width: '460px',
			background: '#1e1e1e',
			border: '1px solid #555',
			borderRadius: '6px',
			boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
			zIndex: '9999',
			fontFamily: 'system-ui, sans-serif',
			fontSize: '13px',
			color: '#ccc',
			userSelect: 'none',
		});

		// --- Title bar ---
		const titleBar = document.createElement('div');
		Object.assign(titleBar.style, {
			display: 'flex', alignItems: 'center', justifyContent: 'space-between',
			padding: '8px 12px', background: '#2d2d2d',
			borderRadius: '6px 6px 0 0', cursor: 'move',
			borderBottom: '1px solid #444',
		});
		const title = document.createElement('span');
		title.textContent = 'Insert Hyperlink';
		title.style.fontWeight = '600';
		const closeBtn = document.createElement('button');
		closeBtn.textContent = '✕';
		Object.assign(closeBtn.style, {
			background: 'none', border: 'none', color: '#ccc',
			cursor: 'pointer', fontSize: '14px', padding: '0 4px',
		});
		closeBtn.onclick = () => this.hide();
		titleBar.appendChild(title);
		titleBar.appendChild(closeBtn);
		this.dialog.appendChild(titleBar);
		this._makeDraggable(titleBar);

		// --- Tab bar ---
		const tabBar = document.createElement('div');
		Object.assign(tabBar.style, {
			display: 'flex', borderBottom: '1px solid #444', background: '#252526',
		});
		const tabs: { id: TabId; label: string }[] = [
			{ id: 'url',   label: 'Web URL' },
			{ id: 'email', label: 'Email' },
			{ id: 'sheet', label: 'Sheet / Cell' },
		];
		for (const tab of tabs) {
			const btn = document.createElement('button');
			btn.textContent = tab.label;
			Object.assign(btn.style, {
				background: 'none', border: 'none', color: '#aaa',
				padding: '8px 16px', cursor: 'pointer', fontSize: '13px',
				borderBottom: '2px solid transparent',
			});
			btn.onclick = () => this._switchTab(tab.id);
			tabBar.appendChild(btn);
			this.tabButtons.set(tab.id, btn);
		}
		this.dialog.appendChild(tabBar);

		// --- Tab content ---
		const body = document.createElement('div');
		body.style.padding = '16px';

		const urlContent = this._buildUrlTab();
		const emailContent = this._buildEmailTab();
		const sheetContent = this._buildSheetTab();

		body.appendChild(urlContent);
		body.appendChild(emailContent);
		body.appendChild(sheetContent);
		this.tabContents.set('url', urlContent);
		this.tabContents.set('email', emailContent);
		this.tabContents.set('sheet', sheetContent);
		this.dialog.appendChild(body);

		// --- Footer ---
		const footer = document.createElement('div');
		Object.assign(footer.style, {
			display: 'flex', justifyContent: 'space-between', alignItems: 'center',
			gap: '8px', padding: '10px 16px',
			borderTop: '1px solid #444', background: '#252526',
			borderRadius: '0 0 6px 6px',
		});

		this.removeBtn = document.createElement('button');
		this.removeBtn.textContent = 'Remove Link';
		Object.assign(this.removeBtn.style, {
			padding: '5px 12px', background: '#5a1515', border: '1px solid #8a3333',
			color: '#f88', borderRadius: '4px', cursor: 'pointer', fontSize: '13px',
			display: 'none',
		});
		this.removeBtn.onclick = () => {
			this.onAction({ action: 'remove', link: this.existingLink ?? undefined });
			this.hide();
		};
		footer.appendChild(this.removeBtn);

		const rightBtns = document.createElement('div');
		rightBtns.style.cssText = 'display:flex;gap:8px;';

		const cancelBtn = document.createElement('button');
		cancelBtn.textContent = 'Cancel';
		Object.assign(cancelBtn.style, {
			padding: '5px 16px', background: '#3a3a3a', border: '1px solid #555',
			color: '#ccc', borderRadius: '4px', cursor: 'pointer', fontSize: '13px',
		});
		cancelBtn.onclick = () => this.hide();

		const okBtn = document.createElement('button');
		okBtn.textContent = 'OK';
		Object.assign(okBtn.style, {
			padding: '5px 20px', background: '#0078d7', border: 'none',
			color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '13px',
		});
		okBtn.onclick = () => this._apply();

		rightBtns.appendChild(cancelBtn);
		rightBtns.appendChild(okBtn);
		footer.appendChild(rightBtns);
		this.dialog.appendChild(footer);

		this.container.appendChild(this.dialog);
		this._switchTab('url');
	}

	// ── URL Tab ────────────────────────────────────────────────────────────────

	private _buildUrlTab(): HTMLElement {
		const el = document.createElement('div');

		el.appendChild(this._field('URL', 'e.g. https://www.example.com', (inp) => {
			this.urlInput = inp as HTMLInputElement;
		}));
		el.appendChild(this._field('Display Text (optional)', 'Text to show in cell', (inp) => {
			this.urlDisplayInput = inp as HTMLInputElement;
		}));
		el.appendChild(this._field('Tooltip (optional)', 'Hover tooltip text', (inp) => {
			this.urlTooltipInput = inp as HTMLInputElement;
		}));

		return el;
	}

	// ── Email Tab ──────────────────────────────────────────────────────────────

	private _buildEmailTab(): HTMLElement {
		const el = document.createElement('div');

		const note = document.createElement('div');
		note.textContent = 'Creates a mailto: link that opens the default email client.';
		note.style.cssText = 'color:#888;font-size:12px;margin-bottom:12px;';
		el.appendChild(note);

		el.appendChild(this._field('Email Address', 'user@example.com', (inp) => {
			this.emailInput = inp as HTMLInputElement;
		}));
		el.appendChild(this._field('Subject (optional)', '', (inp) => {
			this.emailSubjectInput = inp as HTMLInputElement;
		}));
		el.appendChild(this._field('Display Text (optional)', 'Text to show in cell', (inp) => {
			this.emailDisplayInput = inp as HTMLInputElement;
		}));

		return el;
	}

	// ── Sheet Tab ─────────────────────────────────────────────────────────────

	private _buildSheetTab(): HTMLElement {
		const el = document.createElement('div');

		const note = document.createElement('div');
		note.textContent = 'Links to another location in this workbook.';
		note.style.cssText = 'color:#888;font-size:12px;margin-bottom:12px;';
		el.appendChild(note);

		// Sheet name dropdown
		const sheetLabel = document.createElement('div');
		sheetLabel.textContent = 'Sheet';
		sheetLabel.style.cssText = 'color:#888;font-size:11px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;';
		el.appendChild(sheetLabel);

		this.sheetSelect = document.createElement('select');
		Object.assign(this.sheetSelect.style, {
			width: '100%', background: '#2a2a2a', border: '1px solid #555',
			color: '#ccc', borderRadius: '3px', padding: '5px 8px',
			fontSize: '13px', marginBottom: '12px', boxSizing: 'border-box',
		});
		el.appendChild(this.sheetSelect);

		el.appendChild(this._field('Cell Reference', 'e.g. A1', (inp) => {
			this.sheetCellInput = inp as HTMLInputElement;
			this.sheetCellInput.value = 'A1';
		}));
		el.appendChild(this._field('Display Text (optional)', 'Text to show in cell', (inp) => {
			this.sheetDisplayInput = inp as HTMLInputElement;
		}));

		return el;
	}

	// ── Helpers ────────────────────────────────────────────────────────────────

	private _field(label: string, placeholder: string, init: (inp: HTMLElement) => void): HTMLElement {
		const wrapper = document.createElement('div');
		wrapper.style.marginBottom = '12px';

		const lbl = document.createElement('div');
		lbl.textContent = label;
		lbl.style.cssText = 'color:#888;font-size:11px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;';
		wrapper.appendChild(lbl);

		const inp = document.createElement('input');
		inp.type = 'text';
		inp.placeholder = placeholder;
		Object.assign(inp.style, {
			width: '100%', background: '#2a2a2a', border: '1px solid #555',
			color: '#ccc', borderRadius: '3px', padding: '5px 8px',
			fontSize: '13px', boxSizing: 'border-box',
		});
		wrapper.appendChild(inp);
		init(inp);
		return wrapper;
	}

	private _switchTab(id: TabId): void {
		for (const [tid, content] of this.tabContents) {
			content.style.display = tid === id ? 'block' : 'none';
		}
		for (const [tid, btn] of this.tabButtons) {
			const active = tid === id;
			btn.style.color = active ? '#0078d7' : '#aaa';
			btn.style.borderBottom = active ? '2px solid #0078d7' : '2px solid transparent';
			btn.style.fontWeight = active ? '600' : 'normal';
		}
	}

	private _apply(): void {
		let url = '';
		let display: string | undefined;
		let tooltip: string | undefined;
		let is_internal = false;

		// Determine active tab by which content is visible
		const activeTab = (['url', 'email', 'sheet'] as TabId[]).find(
			id => this.tabContents.get(id)?.style.display !== 'none'
		) ?? 'url';

		if (activeTab === 'url') {
			url = this.urlInput.value.trim();
			if (!url) { this.urlInput.focus(); return; }
			// Auto-prepend https:// if no scheme
			if (!/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(url)) url = `https://${url}`;
			display = this.urlDisplayInput.value.trim() || undefined;
			tooltip = this.urlTooltipInput.value.trim() || undefined;
		} else if (activeTab === 'email') {
			const addr = this.emailInput.value.trim();
			if (!addr) { this.emailInput.focus(); return; }
			const subj = this.emailSubjectInput.value.trim();
			url = subj ? `mailto:${addr}?subject=${encodeURIComponent(subj)}` : `mailto:${addr}`;
			display = this.emailDisplayInput.value.trim() || undefined;
		} else {
			const sheetName = this.sheetSelect.value;
			const cellRef = this.sheetCellInput.value.trim() || 'A1';
			if (!sheetName) return;
			const safeSheet = sheetName.includes(' ') ? `'${sheetName}'` : sheetName;
			url = `#${safeSheet}!${cellRef}`;
			is_internal = true;
			display = this.sheetDisplayInput.value.trim() || undefined;
		}

		const link: HyperlinkDef = {
			cell_ref: this.currentCellRef,
			url,
			tooltip,
			display,
			is_internal,
		};

		this.onAction({ action: this.isEditing ? 'edit' : 'insert', link });
		this.hide();
	}

	// ── Public API ─────────────────────────────────────────────────────────────

	show(cellRef: string, sheetNames: string[], existing?: HyperlinkDef): void {
		this.currentCellRef = cellRef;
		this.isEditing = !!existing;
		this.existingLink = existing ?? null;

		// Populate sheet dropdown
		this.sheetSelect.innerHTML = '';
		for (const name of sheetNames) {
			const opt = document.createElement('option');
			opt.value = name;
			opt.textContent = name;
			this.sheetSelect.appendChild(opt);
		}

		// Show/hide Remove button
		this.removeBtn.style.display = existing ? 'block' : 'none';

		// Pre-populate if editing
		this.urlInput.value = '';
		this.urlDisplayInput.value = '';
		this.urlTooltipInput.value = '';
		this.emailInput.value = '';
		this.emailSubjectInput.value = '';
		this.emailDisplayInput.value = '';
		this.sheetCellInput.value = 'A1';
		this.sheetDisplayInput.value = '';

		if (existing) {
			if (existing.is_internal) {
				// Internal link: parse #SheetName!CellRef
				const m = existing.url.match(/^#(.+?)!(.+)$/);
				if (m) {
					const sheetName = m[1].replace(/^'|'$/g, '');
					// Select sheet in dropdown
					for (let i = 0; i < this.sheetSelect.options.length; i++) {
						if (this.sheetSelect.options[i].value === sheetName) {
							this.sheetSelect.selectedIndex = i;
							break;
						}
					}
					this.sheetCellInput.value = m[2];
				}
				this.sheetDisplayInput.value = existing.display ?? '';
				this._switchTab('sheet');
			} else if (existing.url.startsWith('mailto:')) {
				const m = existing.url.match(/^mailto:([^?]+)(\?subject=(.*))?$/);
				if (m) {
					this.emailInput.value = m[1];
					this.emailSubjectInput.value = m[3] ? decodeURIComponent(m[3]) : '';
				}
				this.emailDisplayInput.value = existing.display ?? '';
				this._switchTab('email');
			} else {
				this.urlInput.value = existing.url;
				this.urlDisplayInput.value = existing.display ?? '';
				this.urlTooltipInput.value = existing.tooltip ?? '';
				this._switchTab('url');
			}
		} else {
			this._switchTab('url');
		}

		this.dialog.style.display = 'block';
		setTimeout(() => this.urlInput.focus(), 50);
	}

	hide(): void {
		this.dialog.style.display = 'none';
		this.onAction({ action: 'close' });
	}

	isVisible(): boolean {
		return this.dialog.style.display !== 'none';
	}

	private _makeDraggable(handle: HTMLElement): void {
		let startX = 0, startY = 0, origLeft = 0, origTop = 0;
		handle.addEventListener('mousedown', (e) => {
			if (e.button !== 0) return;
			startX = e.clientX;
			startY = e.clientY;
			const rect = this.dialog.getBoundingClientRect();
			origLeft = rect.left;
			origTop = rect.top;
			this.dialog.style.transform = 'none';
			this.dialog.style.left = `${origLeft}px`;
			this.dialog.style.top = `${origTop}px`;
			const onMove = (ev: MouseEvent) => {
				this.dialog.style.left = `${origLeft + ev.clientX - startX}px`;
				this.dialog.style.top = `${origTop + ev.clientY - startY}px`;
			};
			const onUp = () => {
				document.removeEventListener('mousemove', onMove);
				document.removeEventListener('mouseup', onUp);
			};
			document.addEventListener('mousemove', onMove);
			document.addEventListener('mouseup', onUp);
			e.preventDefault();
		});
	}
}
