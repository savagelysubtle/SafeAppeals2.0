/**
 * DOCX webview entry: load TipTap/docx globals, then the legacy editor scripts.
 *
 * Host↔webview agent bridge: applyDocxEdits / getText / applyInlineEdit /
 * inlineEditRequest (Phase D). DocuSign / PDF export remain later.
 */
import './deps';
import './vendor/tiptapBundle.js';
import './vendor/docxRibbon.js';
import './vendor/docxViewerTiptap.js';
