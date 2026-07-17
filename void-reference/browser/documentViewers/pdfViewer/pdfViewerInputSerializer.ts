/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IEditorSerializer } from '../../../../../common/editor.js';
import { EditorInput } from '../../../../../common/editor/editorInput.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { PDFViewerInput } from './pdfViewerInput.js';
import { URI } from '../../../../../../base/common/uri.js';

export class PDFViewerInputSerializer implements IEditorSerializer {
	static readonly ID = PDFViewerInput.TYPE_ID;

	canSerialize(input: EditorInput): boolean {
		return input instanceof PDFViewerInput;
	}

	serialize(editor: EditorInput): string | undefined {
		if (!(editor instanceof PDFViewerInput)) {
			return undefined;
		}
		return JSON.stringify(editor.toJSON());
	}

	deserialize(instantiationService: IInstantiationService, serializedInput: string): EditorInput | undefined {
		try {
			const data = JSON.parse(serializedInput);
			const uri = URI.revive(data.resource);
			if (!uri) {
				return undefined;
			}
			const input = instantiationService.createInstance(PDFViewerInput, uri);
			input.currentPage = data.currentPage || 1;
			return input;
		} catch (error) {
			console.error('Failed to deserialize PDFViewerInput:', error);
			return undefined;
		}
	}
}

