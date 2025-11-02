/*--------------------------------------------------------------------------------------
 *  Entry point for bundling Tiptap DOCX editor with docx library
 *--------------------------------------------------------------------------------------*/

// Import docx library (will be bundled)
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

// Export for webview use
window.DocxLib = {
	Document,
	Packer,
	Paragraph,
	TextRun,
	HeadingLevel,
	AlignmentType
};

console.log('[TiptapDocxBundle] docx library loaded and exposed globally');

