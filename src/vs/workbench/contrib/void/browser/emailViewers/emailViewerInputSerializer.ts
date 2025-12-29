/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IEditorSerializer } from '../../../../common/editor.js';
import { EmailViewerInput } from './emailViewerInput.js';
import { URI, UriComponents } from '../../../../../base/common/uri.js';

interface SerializedEmailViewerInput {
	resource: UriComponents;
	emailId: string;
}

export class EmailViewerInputSerializer implements IEditorSerializer {
	static readonly ID = 'void.emailViewerInput';

	canSerialize(editorInput: EmailViewerInput): boolean {
		return true;
	}

	serialize(input: EmailViewerInput): string {
		const data: SerializedEmailViewerInput = {
			resource: input.resource.toJSON(),
			emailId: input.emailId
		};
		return JSON.stringify(data);
	}

	deserialize(instantiationService: IInstantiationService, serializedEditorInput: string): EmailViewerInput | undefined {
		try {
			const data: SerializedEmailViewerInput = JSON.parse(serializedEditorInput);
			const resource = URI.revive(data.resource);
			return instantiationService.createInstance(EmailViewerInput, resource, data.emailId);
		} catch {
			return undefined;
		}
	}
}

