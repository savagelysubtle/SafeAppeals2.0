/*--------------------------------------------------------------------------------------
 *  Entry point for bundling Tiptap DOCX editor with docx library and Tiptap
 *  MS Word Style Edition - Enhanced pagination support
 *--------------------------------------------------------------------------------------*/

// Import React (required for @adalat-ai/page-extension which uses ReactNodeViewRenderer)
import React from 'react';
import ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';

// Import docx library (will be bundled)
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak } from 'docx';

// Import Tiptap core
import { Editor, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

// Import @tiptap/react for ReactNodeViewRenderer support
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';

// Import Tiptap extensions for additional formatting
// NOTE: HorizontalRule is already included in StarterKit, so we don't import it separately
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';

// Import Pagination extension (@adalat-ai/page-extension)
// This replaces the previous hugs7 extension and provides automatic page management
import { PageExtension, PageDocument, Page } from '@adalat-ai/page-extension';

// Expose React globally (required for @tiptap/react and @adalat-ai/page-extension)
window.React = React;
window.ReactDOM = ReactDOM;
window.ReactDOMClient = ReactDOMClient;

// Try to import pagination breaks as fallback (optional, unlikely needed with page-extension)
let PaginationBreaks = null;
try {
	PaginationBreaks = require('tiptap-pagination-breaks').default;
} catch (e) {
	console.log('[TiptapDocxBundle] tiptap-pagination-breaks not available');
}

// Export for webview use
window.DocxLib = {
	Document,
	Packer,
	Paragraph,
	TextRun,
	HeadingLevel,
	AlignmentType,
	PageBreak
};

// Export Tiptap core
window.TiptapEditor = Editor;
window.TiptapExtension = Extension;
window.TiptapStarterKit = StarterKit;

// Export additional extensions
window.TiptapUnderline = Underline;
window.TiptapTextAlign = TextAlign;
window.TiptapLink = Link;
// Note: HorizontalRule is already in StarterKit, no need to export separately

// Export pagination extensions
// New @adalat-ai/page-extension exports
window.TiptapPageExtension = PageExtension;
window.TiptapPageDocument = PageDocument;
window.TiptapPage = Page;

// Legacy/Fallback exports (can be removed later)
window.TiptapPagination = null; // Disable hugs7
window.TiptapPageNode = null;
window.TiptapBodyNode = null;
window.TiptapHeaderFooterNode = null;
window.TiptapPaginationBreaks = PaginationBreaks;

console.log('[TiptapDocxBundle] docx library loaded and exposed globally');
console.log('[TiptapDocxBundle] Tiptap loaded with extensions: StarterKit, Underline, TextAlign, Link');
console.log('[TiptapDocxBundle] Pagination extension (@adalat-ai/page-extension) loaded');
