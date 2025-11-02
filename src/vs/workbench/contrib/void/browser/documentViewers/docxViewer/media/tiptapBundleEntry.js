/*--------------------------------------------------------------------------------------
 *  Entry point for bundling Tiptap DOCX editor with docx library and Tiptap
 *--------------------------------------------------------------------------------------*/

// Import docx library (will be bundled)
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

// Import Tiptap (will be bundled)
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

// Import Pagination extension
import { Pagination } from 'tiptap-pagination-breaks';

// Export for webview use
window.DocxLib = {
	Document,
	Packer,
	Paragraph,
	TextRun,
	HeadingLevel,
	AlignmentType
};

// Export Tiptap
window.TiptapEditor = Editor;
window.TiptapStarterKit = StarterKit;
window.TiptapPagination = Pagination;

console.log('[TiptapDocxBundle] docx library loaded and exposed globally');
console.log('[TiptapDocxBundle] Tiptap loaded and exposed globally');
console.log('[TiptapDocxBundle] Pagination extension loaded and exposed globally');


