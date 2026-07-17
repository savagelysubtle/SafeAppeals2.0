/**
 * Compile-time deps for the DOCX webview. Exposes the same window globals the
 * legacy TipTap DOCX scripts expect (tiptapBundle.js / docxViewerTiptap.js).
 *
 * All conversion (docx-preview parse → TipTap; TipTap → docx Packer) runs in
 * the webview — the extension host only shuttles bytes.
 */
import React from 'react';
import ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import JSZip from 'jszip';
import * as DocxPreview from 'docx-preview';
import {
	Document,
	Packer,
	Paragraph,
	TextRun,
	HeadingLevel,
	AlignmentType,
	PageBreak,
	ImageRun,
	ExternalHyperlink,
} from 'docx';
import { Editor, Extension, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import FontFamily from '@tiptap/extension-font-family';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Pica from 'pica';
import { PageExtension, PageDocument, Page } from '@adalat-ai/page-extension';

declare global {
	interface Window {
		React: typeof React;
		ReactDOM: typeof ReactDOM;
		ReactDOMClient: typeof ReactDOMClient;
		JSZip: typeof JSZip;
		docx: typeof DocxPreview;
		DocxLib: Record<string, unknown>;
		TiptapEditor: typeof Editor;
		TiptapExtension: typeof Extension;
		TiptapNode: typeof Node;
		TiptapStarterKit: typeof StarterKit;
		TiptapUnderline: typeof Underline;
		TiptapTextAlign: typeof TextAlign;
		TiptapLink: typeof Link;
		TiptapFontFamily: typeof FontFamily;
		TiptapTextStyle: typeof TextStyle;
		TiptapColor: typeof Color;
		TiptapTable: typeof Table;
		TiptapTableRow: typeof TableRow;
		TiptapTableCell: typeof TableCell;
		TiptapTableHeader: typeof TableHeader;
		Pica: typeof Pica;
		TiptapPageExtension: typeof PageExtension;
		TiptapPageDocument: typeof PageDocument;
		TiptapPage: typeof Page;
		TiptapPagination: null;
		TiptapPageNode: null;
		TiptapHeaderFooterNode: null;
		TiptapPaginationBreaks: null;
		TiptapDocxEditor?: unknown;
		DocxRibbon?: unknown;
	}
}

window.React = React;
window.ReactDOM = ReactDOM;
window.ReactDOMClient = ReactDOMClient;
window.JSZip = JSZip;
window.docx = DocxPreview;

window.DocxLib = {
	Document,
	Packer,
	Paragraph,
	TextRun,
	HeadingLevel,
	AlignmentType,
	PageBreak,
	ImageRun,
	ExternalHyperlink,
};

window.TiptapEditor = Editor;
window.TiptapExtension = Extension;
window.TiptapNode = Node;
window.TiptapStarterKit = StarterKit;
window.TiptapUnderline = Underline;
window.TiptapTextAlign = TextAlign;
window.TiptapLink = Link;
window.TiptapFontFamily = FontFamily;
window.TiptapTextStyle = TextStyle;
window.TiptapColor = Color;
window.TiptapTable = Table;
window.TiptapTableRow = TableRow;
window.TiptapTableCell = TableCell;
window.TiptapTableHeader = TableHeader;
window.Pica = Pica;
window.TiptapPageExtension = PageExtension;
window.TiptapPageDocument = PageDocument;
window.TiptapPage = Page;
window.TiptapPagination = null;
window.TiptapPageNode = null;
window.TiptapHeaderFooterNode = null;
window.TiptapPaginationBreaks = null;
