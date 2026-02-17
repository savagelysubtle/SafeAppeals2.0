/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../../../base/common/uri.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IEditorSerializer } from '../../../../../common/editor.js';
import { EditorInput } from '../../../../../common/editor/editorInput.js';
import { XLSXViewerInput } from './xlsxViewerInput.js';

export class XLSXViewerInputSerializer implements IEditorSerializer {
	static readonly ID = XLSXViewerInput.TYPE_ID;

	canSerialize(input: EditorInput): boolean {
		return input instanceof XLSXViewerInput;
	}

	serialize(editor: EditorInput): string | undefined {
		if (editor instanceof XLSXViewerInput) {
			return JSON.stringify(editor.toJSON());
		}
		return undefined;
	}

	deserialize(instantiationService: IInstantiationService, serializedInput: string): EditorInput | undefined {
		try {
			const data = JSON.parse(serializedInput);
			const resource = URI.revive(data.resource);
			if (resource) {
				const input = instantiationService.createInstance(XLSXViewerInput, resource);
				input.currentSheet = data.currentSheet || 0;
				return input;
			}
		} catch (e) {
			// ignore
		}
		return undefined;
	}
}

