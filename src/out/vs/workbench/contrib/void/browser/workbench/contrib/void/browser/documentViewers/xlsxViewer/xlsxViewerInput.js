/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/
import { basename } from '../../../../../../base/common/path.js';
import { isEqual } from '../../../../../../base/common/resources.js';
import { EditorInput } from '../../../../../common/editor/editorInput.js';
export class XLSXViewerInput extends EditorInput {
    resource;
    labelService;
    static TYPE_ID = 'void.xlsxViewerInput';
    static EDITOR_ID = 'void.xlsxViewer';
    currentSheet = 0;
    selection = null;
    constructor(resource, _fileService, labelService) {
        super();
        this.resource = resource;
        this.labelService = labelService;
    }
    get typeId() {
        return XLSXViewerInput.TYPE_ID;
    }
    get editorId() {
        return XLSXViewerInput.EDITOR_ID;
    }
    get capabilities() {
        return 0; // Read-only
    }
    getName() {
        return basename(this.resource.path);
    }
    getDescription() {
        return this.labelService.getUriLabel(this.resource, { relative: true });
    }
    matches(otherInput) {
        if (otherInput instanceof XLSXViewerInput) {
            return isEqual(this.resource, otherInput.resource);
        }
        return false;
    }
    // For serialization
    toJSON() {
        return {
            resource: this.resource.toJSON(),
            currentSheet: this.currentSheet
        };
    }
}
