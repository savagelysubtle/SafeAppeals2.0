/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebviewMessageHandler, MessageBuilder } from './messageHandler';

export interface EditorState {
	content: string;
	selection: {
		start: number;
		end: number;
		text: string;
	};
	isFocused: boolean;
	undoStack: string[];
	redoStack: string[];
	currentUndoIndex: number;
}

export interface EditorOptions {
	maxUndoSteps: number;
	debounceDelay: number;
	enableSpellCheck: boolean;
	enableAutoSave: boolean;
	autoSaveDelay: number;
}

export class RichTextEditor {
	private readonly editor: HTMLElement;
	private readonly messageHandler: WebviewMessageHandler;
	private readonly options: EditorOptions;
	private state: EditorState;
	private typingTimer: NodeJS.Timeout | null = null;
	private autoSaveTimer: NodeJS.Timeout | null = null;
	private isInitialized = false;

	constructor(
		editorElement: HTMLElement,
		messageHandler: WebviewMessageHandler,
		options: Partial<EditorOptions> = {}
	) {
		this.editor = editorElement;
		this.messageHandler = messageHandler;
		this.options = {
			maxUndoSteps: 50,
			debounceDelay: 150,
			enableSpellCheck: true,
			enableAutoSave: true,
			autoSaveDelay: 2000,
			...options
		};

		this.state = {
			content: '',
			selection: { start: 0, end: 0, text: '' },
			isFocused: false,
			undoStack: [],
			redoStack: [],
			currentUndoIndex: -1
		};

		this.initialize();
	}

	/**
	 * Initialize the editor
	 */
	private initialize(): void {
		if (this.isInitialized) return;

		this.setupEventListeners();
		this.setupKeyboardShortcuts();
		this.setupPasteHandling();
		this.setupAccessibility();
		this.initializeUndoStack();

		this.isInitialized = true;
	}

	/**
	 * Setup event listeners
	 */
	private setupEventListeners(): void {
		// Content change events
		this.editor.addEventListener('input', this.handleInput.bind(this));
		this.editor.addEventListener('keyup', this.handleKeyUp.bind(this));
		this.editor.addEventListener('keydown', this.handleKeyDown.bind(this));

		// Selection events
		this.editor.addEventListener('selectionchange', this.handleSelectionChange.bind(this));

		// Focus events
		this.editor.addEventListener('focus', this.handleFocus.bind(this));
		this.editor.addEventListener('blur', this.handleBlur.bind(this));

		// Mouse events
		this.editor.addEventListener('click', this.handleClick.bind(this));
		this.editor.addEventListener('mousedown', this.handleMouseDown.bind(this));

		// Context menu
		this.editor.addEventListener('contextmenu', this.handleContextMenu.bind(this));

		// Drag and drop
		this.editor.addEventListener('dragover', this.handleDragOver.bind(this));
		this.editor.addEventListener('drop', this.handleDrop.bind(this));
	}

	/**
	 * Setup keyboard shortcuts
	 */
	private setupKeyboardShortcuts(): void {
		document.addEventListener('keydown', (e) => {
			if (!this.state.isFocused) return;

			// Handle Ctrl/Cmd combinations
			if (e.ctrlKey || e.metaKey) {
				switch (e.key) {
					case 'b':
						e.preventDefault();
						this.execCommand('bold');
						break;
					case 'i':
						e.preventDefault();
						this.execCommand('italic');
						break;
					case 'u':
						e.preventDefault();
						this.execCommand('underline');
						break;
					case 'z':
						e.preventDefault();
						if (e.shiftKey) {
							this.redo();
						} else {
							this.undo();
						}
						break;
					case 'y':
						e.preventDefault();
						this.redo();
						break;
					case 's':
						e.preventDefault();
						this.save();
						break;
					case 'a':
						e.preventDefault();
						this.selectAll();
						break;
					case 'c':
						e.preventDefault();
						this.copy();
						break;
					case 'v':
						e.preventDefault();
						this.paste();
						break;
					case 'x':
						e.preventDefault();
						this.cut();
						break;
				}
			}

			// Handle special keys
			switch (e.key) {
				case 'Enter':
					this.handleEnterKey(e);
					break;
				case 'Tab':
					this.handleTabKey(e);
					break;
				case 'Backspace':
				case 'Delete':
					this.handleDeleteKey(e);
					break;
			}
		});
	}

	/**
	 * Setup paste handling
	 */
	private setupPasteHandling(): void {
		this.editor.addEventListener('paste', (e) => {
			e.preventDefault();
			this.handlePaste(e);
		});
	}

	/**
	 * Setup accessibility features
	 */
	private setupAccessibility(): void {
		this.editor.setAttribute('role', 'textbox');
		this.editor.setAttribute('aria-multiline', 'true');
		this.editor.setAttribute('spellcheck', this.options.enableSpellCheck.toString());
		this.editor.setAttribute('contenteditable', 'true');
	}

	/**
	 * Initialize undo stack
	 */
	private initializeUndoStack(): void {
		this.state.undoStack = [this.editor.innerHTML];
		this.state.currentUndoIndex = 0;
	}

	/**
	 * Handle input events
	 */
	private handleInput(): void {
		// Clear existing timer
		if (this.typingTimer) {
			clearTimeout(this.typingTimer);
		}

		// Set new timer for debounced content change
		this.typingTimer = setTimeout(() => {
			this.syncWithExtension();
		}, this.options.debounceDelay);

		// Update state immediately
		this.updateState();
	}

	/**
	 * Handle key up events
	 */
	private handleKeyUp(): void {
		this.updateState();
	}

	/**
	 * Handle key down events
	 */
	private handleKeyDown(e: KeyboardEvent): void {
		// Prevent default behavior for certain keys
		if (e.key === 'Tab') {
			e.preventDefault();
		}
	}

	/**
	 * Handle selection change events
	 */
	private handleSelectionChange(): void {
		this.updateSelection();
	}

	/**
	 * Handle focus events
	 */
	private handleFocus(): void {
		this.state.isFocused = true;
		this.messageHandler.postMessage(this.messageHandler as any, MessageBuilder.ready());
	}

	/**
	 * Handle blur events
	 */
	private handleBlur(): void {
		this.state.isFocused = false;
		this.messageHandler.postMessage(this.messageHandler as any, MessageBuilder.ready());
	}

	/**
	 * Handle click events
	 */
	private handleClick(): void {
		this.updateSelection();
	}

	/**
	 * Handle mouse down events
	 */
	private handleMouseDown(): void {
		this.updateSelection();
	}

	/**
	 * Handle context menu events
	 */
	private handleContextMenu(_e: MouseEvent): void {
		_e.preventDefault();
		// Context menu will be handled by VS Code
	}

	/**
	 * Handle drag over events
	 */
	private handleDragOver(_e: DragEvent): void {
		_e.preventDefault();
		_e.dataTransfer!.dropEffect = 'copy';
	}

	/**
	 * Handle drop events
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	private handleDrop(_e: DragEvent): void {
		_e.preventDefault();
		// Handle file drops
		const files = Array.from(_e.dataTransfer!.files);
		if (files.length > 0) {
			this.handleFileDrop(files);
		}
	}

	/**
	 * Handle paste events
	 */
	private handlePaste(e: ClipboardEvent): void {
		const clipboardData = e.clipboardData;
		if (!clipboardData) return;

		// Get HTML content
		let html = clipboardData.getData('text/html');
		if (html) {
			// Clean HTML content
			html = this.cleanPastedHtml(html);
			this.insertHtml(html);
		} else {
			// Fallback to plain text
			const text = clipboardData.getData('text/plain');
			if (text) {
				this.insertText(text);
			}
		}
	}

	/**
	 * Handle Enter key
	 */
	private handleEnterKey(e: KeyboardEvent): void {
		if (e.shiftKey) {
			// Shift + Enter = line break
			e.preventDefault();
			this.execCommand('insertHTML', '<br>');
		} else {
			// Enter = new paragraph
			e.preventDefault();
			this.execCommand('insertHTML', '<div><br></div>');
		}
	}

	/**
	 * Handle Tab key
	 */
	private handleTabKey(e: KeyboardEvent): void {
		e.preventDefault();
		if (e.shiftKey) {
			this.execCommand('outdent');
		} else {
			this.execCommand('indent');
		}
	}

	/**
	 * Handle Delete key
	 */
	private handleDeleteKey(e: KeyboardEvent): void {
		// Let the browser handle deletion, but update state
		setTimeout(() => {
			this.updateState();
		}, 0);
	}

	/**
	 * Handle file drop
	 */
	private handleFileDrop(files: File[]): void {
		for (const file of files) {
			if (file.type.startsWith('image/')) {
				this.handleImageDrop(file);
			} else if (file.type === 'text/plain') {
				this.handleTextFileDrop(file);
			}
		}
	}

	/**
	 * Handle image drop
	 */
	private handleImageDrop(file: File): void {
		const reader = new FileReader();
		reader.onload = (e) => {
			const dataUrl = e.target?.result as string;
			const img = `<img src="${dataUrl}" alt="${file.name}" style="max-width: 100%; height: auto;">`;
			this.insertHtml(img);
		};
		reader.readAsDataURL(file);
	}

	/**
	 * Handle text file drop
	 */
	private handleTextFileDrop(file: File): void {
		const reader = new FileReader();
		reader.onload = (e) => {
			const text = e.target?.result as string;
			this.insertText(text);
		};
		reader.readAsText(file);
	}

	/**
	 * Update editor state
	 */
	private updateState(): void {
		this.state.content = this.editor.innerHTML;
		this.updateSelection();
	}

	/**
	 * Update selection state
	 */
	private updateSelection(): void {
		const selection = window.getSelection();
		if (selection && selection.rangeCount > 0) {
			const range = selection.getRangeAt(0);
			const start = this.getOffset(range.startContainer, range.startOffset);
			const end = this.getOffset(range.endContainer, range.endOffset);
			const text = selection.toString();

			this.state.selection = { start, end, text };
		}
	}

	/**
	 * Get offset within editor
	 */
	private getOffset(node: Node, offset: number): number {
		let totalOffset = 0;
		const walker = document.createTreeWalker(
			this.editor,
			NodeFilter.SHOW_TEXT,
			null
		);

		let currentNode;
		while (currentNode = walker.nextNode()) {
			if (currentNode === node) {
				return totalOffset + offset;
			}
			totalOffset += currentNode.textContent?.length || 0;
		}

		return totalOffset;
	}

	/**
	 * Sync with extension
	 */
	private syncWithExtension(): void {
		this.updateState();
		this.messageHandler.postMessage(this.messageHandler as any, {
			type: 'content-changed',
			data: {
				content: this.state.content,
				selection: this.state.selection
			}
		});
	}

	/**
	 * Execute command
	 */
	private execCommand(command: string, value?: string): void {
		document.execCommand(command, false, value);
		this.updateState();
		this.syncWithExtension();
	}

	/**
	 * Insert HTML content
	 */
	private insertHtml(html: string): void {
		this.execCommand('insertHTML', html);
	}

	/**
	 * Insert text content
	 */
	private insertText(text: string): void {
		this.execCommand('insertText', text);
	}

	/**
	 * Clean pasted HTML
	 */
	private cleanPastedHtml(html: string): string {
		// Remove script tags and event handlers
		html = html
			.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
			.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
			.replace(/javascript:/gi, '')
			.replace(/vbscript:/gi, '');

		// Remove dangerous attributes
		html = html
			.replace(/\s*style\s*=\s*["'][^"']*["']/gi, '')
			.replace(/\s*class\s*=\s*["'][^"']*["']/gi, '');

		// Normalize whitespace
		html = html
			.replace(/\s+/g, ' ')
			.replace(/>\s+</g, '><')
			.trim();

		return html;
	}

	/**
	 * Undo last action
	 */
	private undo(): void {
		if (this.state.currentUndoIndex > 0) {
			this.state.currentUndoIndex--;
			this.editor.innerHTML = this.state.undoStack[this.state.currentUndoIndex];
			this.updateState();
			this.syncWithExtension();
		}
	}

	/**
	 * Redo last action
	 */
	private redo(): void {
		if (this.state.currentUndoIndex < this.state.undoStack.length - 1) {
			this.state.currentUndoIndex++;
			this.editor.innerHTML = this.state.undoStack[this.state.currentUndoIndex];
			this.updateState();
			this.syncWithExtension();
		}
	}

	/**
	 * Save document
	 */
	private save(): void {
		this.messageHandler.postMessage(this.messageHandler as any, {
			type: 'execute-command',
			data: { command: 'txtRich.saveDoc' }
		});
	}

	/**
	 * Select all content
	 */
	private selectAll(): void {
		const range = document.createRange();
		range.selectNodeContents(this.editor);
		const selection = window.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
	}

	/**
	 * Copy selected content
	 */
	private copy(): void {
		this.execCommand('copy');
	}

	/**
	 * Paste content
	 */
	private paste(): void {
		this.execCommand('paste');
	}

	/**
	 * Cut selected content
	 */
	private cut(): void {
		this.execCommand('cut');
	}

	/**
	 * Set content
	 */
	public setContent(content: string, isHtml: boolean = true): void {
		if (isHtml) {
			this.editor.innerHTML = content;
		} else {
			this.editor.textContent = content;
		}
		this.updateState();
	}

	/**
	 * Get content
	 */
	public getContent(): string {
		return this.editor.innerHTML;
	}

	/**
	 * Get plain text content
	 */
	public getPlainText(): string {
		return this.editor.textContent || '';
	}

	/**
	 * Get current selection
	 */
	public getSelection(): { start: number; end: number; text: string } {
		return this.state.selection;
	}

	/**
	 * Set selection
	 */
	public setSelection(start: number, end: number): void {
		// Implementation would require more complex range handling
		// For now, just update the state
		this.state.selection = { start, end, text: '' };
	}

	/**
	 * Focus the editor
	 */
	public focus(): void {
		this.editor.focus();
	}

	/**
	 * Blur the editor
	 */
	public blur(): void {
		this.editor.blur();
	}

	/**
	 * Check if editor is focused
	 */
	public isFocused(): boolean {
		return this.state.isFocused;
	}

	/**
	 * Dispose the editor
	 */
	public dispose(): void {
		if (this.typingTimer) {
			clearTimeout(this.typingTimer);
		}
		if (this.autoSaveTimer) {
			clearTimeout(this.autoSaveTimer);
		}
	}
}
