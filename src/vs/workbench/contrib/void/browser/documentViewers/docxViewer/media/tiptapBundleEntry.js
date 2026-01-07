/*--------------------------------------------------------------------------------------
 *  Entry point for bundling Tiptap DOCX editor with docx library and Tiptap
 *  MS Word Style Edition - Enhanced pagination support
 *--------------------------------------------------------------------------------------*/

// Import React (required for @adalat-ai/page-extension which uses ReactNodeViewRenderer)
import React from 'react';
import ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';

// Import docx library (will be bundled)
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak, ImageRun, ExternalHyperlink } from 'docx';

// Import Tiptap core
import { Editor, Extension, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

// Import @tiptap/react for ReactNodeViewRenderer support
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';

// Import Tiptap extensions for additional formatting
// NOTE: HorizontalRule is already included in StarterKit, so we don't import it separately
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import FontFamily from '@tiptap/extension-font-family';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';

// Import Table extensions (separate packages in Tiptap v2.x)
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';

// Import pica for memory-efficient image resizing
import Pica from 'pica';

// NOTE: We no longer use tiptap-extension-resize-image due to memory issues
// Instead, we use a custom lightweight extension with CSS resize in tiptapBundle.js

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
	PageBreak,
	ImageRun,
	ExternalHyperlink
};

// Export Tiptap core
window.TiptapEditor = Editor;
window.TiptapExtension = Extension;
window.TiptapNode = Node;  // Required for creating custom Node-based extensions (e.g., Image)
window.TiptapStarterKit = StarterKit;

// Export additional extensions
window.TiptapUnderline = Underline;
window.TiptapTextAlign = TextAlign;
window.TiptapLink = Link;
window.TiptapFontFamily = FontFamily;
window.TiptapTextStyle = TextStyle;
window.TiptapColor = Color;
// Note: HorizontalRule is already in StarterKit, no need to export separately

// Export Table extensions
window.TiptapTable = Table;
window.TiptapTableRow = TableRow;
window.TiptapTableCell = TableCell;
window.TiptapTableHeader = TableHeader;

// Export pica for efficient image resizing
window.Pica = Pica;

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
