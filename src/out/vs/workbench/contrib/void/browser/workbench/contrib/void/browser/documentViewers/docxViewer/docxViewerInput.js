/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/
import { EditorInput } from '../../../../../common/editor/editorInput.js';
import { basename } from '../../../../../../base/common/path.js';
import { isEqual } from '../../../../../../base/common/resources.js';
export class DOCXViewerInput extends EditorInput {
    resource;
    labelService;
    static TYPE_ID = 'void.docxViewerInput';
    static EDITOR_ID = 'void.docxViewer';
    selection = null;
    constructor(resource, _fileService, labelService) {
        super();
        this.resource = resource;
        this.labelService = labelService;
    }
    get typeId() {
        return DOCXViewerInput.TYPE_ID;
    }
    get editorId() {
        return DOCXViewerInput.EDITOR_ID;
    }
    get capabilities() {
        return 0;
    }
    getName() {
        return basename(this.resource.path);
    }
    getDescription() {
        return this.labelService.getUriLabel(this.resource, { relative: true });
    }
    matches(otherInput) {
        if (otherInput instanceof DOCXViewerInput) {
            return isEqual(this.resource, otherInput.resource);
        }
        return false;
    }
    // For serialization
    toJSON() {
        return {
            resource: this.resource.toJSON()
        };
    }
}
