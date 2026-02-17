/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { basename } from '../../../../../../base/common/path.js';
import { isEqual } from '../../../../../../base/common/resources.js';
import { URI } from '../../../../../../base/common/uri.js';
import { IFileService } from '../../../../../../platform/files/common/files.js';
import { ILabelService } from '../../../../../../platform/label/common/label.js';
import { IUntypedEditorInput } from '../../../../../common/editor.js';
import { EditorInput } from '../../../../../common/editor/editorInput.js';

export interface XLSXSelection {
	sheet: string;
	sheetIndex: number;
	range: string; // e.g., "A1:B10"
	text: string;
}

export class XLSXViewerInput extends EditorInput {
	static readonly TYPE_ID = 'void.xlsxViewerInput';
	static readonly EDITOR_ID = 'void.xlsxViewer';

	currentSheet: number = 0;
	selection: XLSXSelection | null = null;
	private _content?: string; // Base64 encoded content
	private _workingCopy?: { isDirty(): boolean };

	constructor(
		public readonly resource: URI,
		@IFileService _fileService: IFileService,
		@ILabelService private readonly labelService: ILabelService
	) {
		super();
	}

	setContent(content: string): void {
		this._content = content;
	}

	getContent(): string | undefined {
		return this._content;
	}

	hasContent(): boolean {
		return !!this._content;
	}

	/**
	 * Set the working copy for this input to delegate dirty state
	 */
	setWorkingCopy(workingCopy: { isDirty(): boolean }): void {
		this._workingCopy = workingCopy;
	}

	/**
	 * Clear the working copy reference to prevent stale dirty state checks
	 */
	clearWorkingCopy(): void {
		this._workingCopy = undefined;
	}

	override isDirty(): boolean {
		return this._workingCopy?.isDirty() ?? false;
	}

	override get typeId(): string {
		return XLSXViewerInput.TYPE_ID;
	}

	override get editorId(): string {
		return XLSXViewerInput.EDITOR_ID;
	}

	override get capabilities() {
		return 0; // Read-only
	}

	override getName(): string {
		return basename(this.resource.path);
	}

	override getDescription(): string {
		return this.labelService.getUriLabel(this.resource, { relative: true });
	}

	override matches(otherInput: EditorInput | IUntypedEditorInput): boolean {
		if (otherInput instanceof XLSXViewerInput) {
			return isEqual(this.resource, otherInput.resource);
		}
		return false;
	}

	// For serialization
	toJSON(): any {
		return {
			resource: this.resource.toJSON(),
			currentSheet: this.currentSheet
		};
	}
}

