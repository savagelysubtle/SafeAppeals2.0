/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IEditorSerializer } from '../../../../common/editor.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { BrowserInput } from './browserInput.js';

export class BrowserInputSerializer implements IEditorSerializer {
	static readonly ID = BrowserInput.TYPE_ID;

	canSerialize(input: EditorInput): boolean {
		return input instanceof BrowserInput;
	}

	serialize(editor: EditorInput): string | undefined {
		if (editor instanceof BrowserInput) {
			return JSON.stringify(editor.toJSON());
		}
		return undefined;
	}

	deserialize(
		_instantiationService: IInstantiationService,
		serializedInput: string
	): EditorInput | undefined {
		try {
			const data = JSON.parse(serializedInput);
			if (data.url) {
				return new BrowserInput(data.url, data.tabId);
			}
		} catch {
			// ignore
		}
		return undefined;
	}
}
