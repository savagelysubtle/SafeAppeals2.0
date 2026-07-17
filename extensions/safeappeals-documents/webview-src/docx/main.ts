/**
 * DOCX webview entry: load TipTap/docx globals, then the legacy editor scripts.
 *
 * AI quick-edit / DocuSign / main-process PDF export messages still fire from
 * the ported scripts but are ignored by the extension host (rung 12 / later).
 */
import './deps';
import './vendor/tiptapBundle.js';
import './vendor/docxRibbon.js';
import './vendor/docxViewerTiptap.js';
