/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
export const IDocumentViewerService = createDecorator('documentViewerService');
export class DocumentViewerService {
    _serviceBrand;
    extractorOfExtension = new Map();
    constructor() {
        // Service starts empty, extractors registered by document viewer contributions
    }
    registerExtractor(extensions, extractor) {
        for (const ext of extensions) {
            this.extractorOfExtension.set(ext.toLowerCase(), extractor);
        }
    }
    isDocumentFile(uri) {
        const ext = this.getFileExtension(uri);
        return this.extractorOfExtension.has(ext);
    }
    async getTextContent(uri) {
        const ext = this.getFileExtension(uri);
        const extractor = this.extractorOfExtension.get(ext);
        if (!extractor) {
            return null;
        }
        try {
            return await extractor.extractContent(uri);
        }
        catch (error) {
            console.error(`Failed to extract content from ${uri.toString()}:`, error);
            return null;
        }
    }
    async getTextContentRange(uri, startPage, endPage) {
        const ext = this.getFileExtension(uri);
        const extractor = this.extractorOfExtension.get(ext);
        if (!extractor || !extractor.extractContentRange) {
            // Fallback to full content if range extraction not supported
            return await this.getTextContent(uri);
        }
        try {
            return await extractor.extractContentRange(uri, startPage, endPage);
        }
        catch (error) {
            console.error(`Failed to extract content range from ${uri.toString()}:`, error);
            return null;
        }
    }
    getFileExtension(uri) {
        const path = uri.path;
        const lastDot = path.lastIndexOf('.');
        if (lastDot === -1) {
            return '';
        }
        return path.substring(lastDot + 1).toLowerCase();
    }
}
// Register as singleton
registerSingleton(IDocumentViewerService, DocumentViewerService, 1 /* InstantiationType.Delayed */);
