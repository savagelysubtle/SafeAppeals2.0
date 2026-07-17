/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../../../base/common/uri.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IEditorSerializer } from '../../../../../common/editor.js';
import { EditorInput } from '../../../../../common/editor/editorInput.js';
import { ImageViewerInput } from './imageViewerInput.js';

export class ImageViewerInputSerializer implements IEditorSerializer {
	static readonly ID = ImageViewerInput.TYPE_ID;

	canSerialize(input: EditorInput): boolean {
		return input instanceof ImageViewerInput;
	}

	serialize(editor: EditorInput): string | undefined {
		if (!(editor instanceof ImageViewerInput)) {
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
			return instantiationService.createInstance(ImageViewerInput, uri);
		} catch (error) {
			console.error('Failed to deserialize ImageViewerInput:', error);
			return undefined;
		}
	}
}
