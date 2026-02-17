/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IEditorSerializer } from '../../../../../common/editor.js';
import { XLSXRustViewerInput } from './xlsxRustViewerInput.js';

export class XLSXRustViewerInputSerializer implements IEditorSerializer {
	static readonly ID = XLSXRustViewerInput.TYPE_ID;

	canSerialize(editorInput: XLSXRustViewerInput): boolean {
		return true;
	}

	serialize(editorInput: XLSXRustViewerInput): string {
		return JSON.stringify(editorInput.toJSON());
	}

	deserialize(instantiationService: IInstantiationService, serializedEditorInput: string): XLSXRustViewerInput {
		const json = JSON.parse(serializedEditorInput);
		// Note: We need to reconstruct the input from the serialized data
		// Ideally, we'd use the proper URI restoration logic here
		// For now, this is a placeholder implementation
		return instantiationService.createInstance(XLSXRustViewerInput, json.resource);
	}
}
