/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { importAMDNodeModule } from '../../../amdX.js';
export const EDITOR_EXPERIMENTAL_PREFER_TREESITTER = 'editor.experimental.preferTreeSitter';
export const TREESITTER_ALLOWED_SUPPORT = ['css', 'typescript', 'ini', 'regex'];
export const ITreeSitterParserService = createDecorator('treeSitterParserService');
export const ITreeSitterImporter = createDecorator('treeSitterImporter');
export class TreeSitterImporter {
    _serviceBrand;
    _treeSitterImport;
    constructor() { }
    async _getTreeSitterImport() {
        if (!this._treeSitterImport) {
            this._treeSitterImport = await importAMDNodeModule('@vscode/tree-sitter-wasm', 'wasm/tree-sitter.js');
        }
        return this._treeSitterImport;
    }
    get parserClass() {
        return this._parserClass;
    }
    _parserClass;
    async getParserClass() {
        if (!this._parserClass) {
            this._parserClass = (await this._getTreeSitterImport()).Parser;
        }
        return this._parserClass;
    }
    _languageClass;
    async getLanguageClass() {
        if (!this._languageClass) {
            this._languageClass = (await this._getTreeSitterImport()).Language;
        }
        return this._languageClass;
    }
    _queryClass;
    async getQueryClass() {
        if (!this._queryClass) {
            this._queryClass = (await this._getTreeSitterImport()).Query;
        }
        return this._queryClass;
    }
}
