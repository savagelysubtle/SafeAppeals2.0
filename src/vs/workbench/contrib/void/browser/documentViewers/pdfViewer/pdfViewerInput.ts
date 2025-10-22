/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { EditorInput } from '../../../../../common/editor/editorInput.js';
import { URI } from '../../../../../../base/common/uri.js';
import { IFileService } from '../../../../../../platform/files/common/files.js';
import { basename } from '../../../../../../base/common/path.js';
import { isEqual } from '../../../../../../base/common/resources.js';
import { ILabelService } from '../../../../../../platform/label/common/label.js';
import { IUntypedEditorInput } from '../../../../../common/editor.js';

export interface PDFSelection {
	startPage: number;
	endPage: number;
	text: string;
}

export class PDFViewerInput extends EditorInput {
	static readonly TYPE_ID = 'void.pdfViewerInput';
	static readonly EDITOR_ID = 'void.pdfViewer';

	currentPage: number = 1;
	selection: PDFSelection | null = null;

	constructor(
		public readonly resource: URI,
		@IFileService _fileService: IFileService,
		@ILabelService private readonly labelService: ILabelService
	) {
		super();
	}

	override get typeId(): string {
		return PDFViewerInput.TYPE_ID;
	}

	override get editorId(): string {
		return PDFViewerInput.EDITOR_ID;
	}

	override get capabilities() {
		return 0;
	}

	override getName(): string {
		return basename(this.resource.path);
	}

	override getDescription(): string {
		return this.labelService.getUriLabel(this.resource, { relative: true });
	}

	override matches(otherInput: EditorInput | IUntypedEditorInput): boolean {
		if (otherInput instanceof PDFViewerInput) {
			return isEqual(this.resource, otherInput.resource);
		}
		return false;
	}

	// For serialization
	toJSON(): any {
		return {
			resource: this.resource.toJSON(),
			currentPage: this.currentPage
		};
	}
}

