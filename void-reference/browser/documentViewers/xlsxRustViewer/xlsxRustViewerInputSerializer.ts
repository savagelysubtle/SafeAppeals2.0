/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../../../base/common/uri.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IEditorSerializer } from '../../../../../common/editor.js';
import { XLSXRustViewerInput } from './xlsxRustViewerInput.js';

export class XLSXRustViewerInputSerializer implements IEditorSerializer {
	static readonly ID = XLSXRustViewerInput.TYPE_ID;

	canSerialize(editorInput: XLSXRustViewerInput): boolean {
		return editorInput instanceof XLSXRustViewerInput;
	}

	serialize(editorInput: XLSXRustViewerInput): string {
		return JSON.stringify(editorInput.toJSON());
	}

	deserialize(instantiationService: IInstantiationService, serializedEditorInput: string): XLSXRustViewerInput {
		const json = JSON.parse(serializedEditorInput);
		const resource = URI.revive(json.resource);
		return instantiationService.createInstance(XLSXRustViewerInput, resource);
	}
}
