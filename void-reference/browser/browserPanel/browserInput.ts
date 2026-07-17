/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../../base/common/uri.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
import { IUntypedEditorInput } from '../../../../common/editor.js';

export class BrowserInput extends EditorInput {
	static readonly TYPE_ID = 'void.browserInput';
	static readonly EDITOR_ID = 'void.browserEditor';

	private readonly _tabId: string;
	private _url: string;
	private _title: string;

	constructor(url?: string, tabId?: string) {
		super();
		this._tabId = tabId || generateUuid();
		this._url = url || 'https://www.google.com';
		this._title = 'Browser';
	}

	get url(): string {
		return this._url;
	}

	get tabId(): string {
		return this._tabId;
	}

	setUrl(url: string): void {
		this._url = url;
	}

	setTitle(title: string): void {
		if (title) {
			this._title = title;
			this._onDidChangeLabel.fire();
		}
	}

	override get typeId(): string {
		return BrowserInput.TYPE_ID;
	}

	override get editorId(): string {
		return BrowserInput.EDITOR_ID;
	}

	override get capabilities(): number {
		return 0;
	}

	override get resource(): URI | undefined {
		return URI.parse(`void-browser://${this._tabId}`);
	}

	override getName(): string {
		return this._title;
	}

	override getDescription(): string {
		return this._url;
	}

	override matches(otherInput: EditorInput | IUntypedEditorInput): boolean {
		if (otherInput instanceof BrowserInput) {
			return this._tabId === otherInput._tabId;
		}
		return false;
	}

	toJSON(): { url: string; tabId: string } {
		return { url: this._url, tabId: this._tabId };
	}
}
