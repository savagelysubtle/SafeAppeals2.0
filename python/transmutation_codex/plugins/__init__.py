"""Plugin package for document format converters.

This package contains converter modules organized by source format.
Importing this module triggers automatic registration of all converters
with the plugin registry.
"""

import logging

# Get logger for plugin loading
_logger = logging.getLogger("aichemist_codex.plugins")

# Import all converter modules to trigger @converter decorator registration
# The @converter decorator automatically registers each converter with the registry

# Markdown converters
try:
    from .markdown.to_html import convert_md_to_html

    _logger.debug("Markdown to HTML converter loaded")
except ImportError as e:
    _logger.warning(f"Markdown to HTML converter not available: {e}")
except Exception as e:
    _logger.error(f"Markdown to HTML converter failed: {e}", exc_info=True)

try:
    from .markdown.to_pdf import convert_md_to_pdf

    _logger.debug("Markdown to PDF converter loaded")
except ImportError as e:
    _logger.warning(f"Markdown to PDF converter not available: {e}")
except Exception as e:
    _logger.error(f"Markdown to PDF converter failed: {e}", exc_info=True)

try:
    from .markdown.to_docx import convert_md_to_docx

    _logger.debug("Markdown to DOCX converter loaded")
except ImportError as e:
    _logger.warning(f"Markdown to DOCX converter not available: {e}")
except Exception as e:
    _logger.error(f"Markdown to DOCX converter failed: {e}", exc_info=True)

# PDF converters
try:
    from .pdf.to_markdown import (
        convert_pdf_to_md,
        convert_pdf_to_md_with_enhanced_ocr,
        convert_pdf_to_md_with_ocr,
        convert_pdf_to_md_with_pymupdf4llm,
    )

    _logger.debug("PDF to Markdown converters loaded")
except ImportError as e:
    _logger.warning(f"PDF to Markdown converters not available: {e}")
except Exception as e:
    _logger.error(f"PDF to Markdown converters failed: {e}", exc_info=True)

try:
    from .pdf.to_html import convert_pdf_to_html

    _logger.debug("PDF to HTML converter loaded")
except ImportError as e:
    _logger.warning(f"PDF to HTML converter not available: {e}")
except Exception as e:
    _logger.error(f"PDF to HTML converter failed: {e}", exc_info=True)

try:
    from .pdf.to_editable_pdf import convert_pdf_to_editable

    _logger.debug("PDF to Editable PDF converter loaded")
except ImportError as e:
    _logger.warning(f"PDF to Editable converter not available: {e}")
except Exception as e:
    _logger.error(f"PDF to Editable converter failed: {e}", exc_info=True)

# DOCX converters
try:
    from .docx.to_markdown import convert_docx_to_markdown

    _logger.debug("DOCX to Markdown converter loaded")
except ImportError as e:
    _logger.warning(f"DOCX to Markdown converter not available: {e}")
except Exception as e:
    _logger.error(f"DOCX to Markdown converter failed: {e}", exc_info=True)

try:
    from .docx.to_pdf import convert_docx_to_pdf

    _logger.debug("DOCX to PDF converter loaded")
except ImportError as e:
    _logger.warning(f"DOCX to PDF converter not available: {e}")
except Exception as e:
    _logger.error(f"DOCX to PDF converter failed: {e}", exc_info=True)

# HTML converters
try:
    from .html.to_pdf import convert_html_to_pdf

    _logger.debug("HTML to PDF converter loaded")
except ImportError as e:
    _logger.warning(f"HTML to PDF converter not available: {e}")
except Exception as e:
    _logger.error(f"HTML to PDF converter failed: {e}", exc_info=True)

# TXT converters
try:
    from .txt.to_pdf import convert_txt_to_pdf

    _logger.debug("TXT to PDF converter loaded")
except ImportError as e:
    _logger.warning(f"TXT to PDF converter not available: {e}")
except Exception as e:
    _logger.error(f"TXT to PDF converter failed to load: {e}", exc_info=True)
    raise

# Excel converters
try:
    from .xlsx.to_csv import convert_xlsx_to_csv
    from .xlsx.to_html import convert_xlsx_to_html
    from .xlsx.to_markdown import convert_xlsx_to_markdown
    from .xlsx.to_pdf import convert_xlsx_to_pdf
    from .xlsx.to_pdf_libreoffice import convert_xlsx_to_pdf_libreoffice

    _logger.debug("Excel converters loaded")
except ImportError as e:
    _logger.warning(f"Excel converters not available: {e}")
except Exception as e:
    _logger.error(f"Excel converters failed: {e}", exc_info=True)

# CSV converters
try:
    from .csv.to_pdf import convert_csv_to_pdf
    from .csv.to_xlsx import convert_csv_to_xlsx

    _logger.debug("CSV converters loaded")
except ImportError as e:
    _logger.warning(f"CSV converters not available: {e}")
except Exception as e:
    _logger.error(f"CSV converters failed: {e}", exc_info=True)

# PowerPoint converters
try:
    from .pptx.to_html import convert_pptx_to_html
    from .pptx.to_images import convert_pptx_to_images
    from .pptx.to_markdown import convert_pptx_to_markdown
    from .pptx.to_pdf import convert_pptx_to_pdf
    from .pptx.to_pdf_libreoffice import convert_pptx_to_pdf_libreoffice

    _logger.debug("PowerPoint converters loaded")
except ImportError as e:
    _logger.warning(f"PowerPoint converters not available: {e}")
except Exception as e:
    _logger.error(f"PowerPoint converters failed: {e}", exc_info=True)

# Image converters
try:
    from .image.to_image import convert_image_to_image
    from .image.to_pdf import convert_image_to_pdf
    from .image.to_text import convert_image_to_text

    _logger.debug("Image converters loaded")
except ImportError as e:
    _logger.warning(f"Image converters not available: {e}")
except Exception as e:
    _logger.error(f"Image converters failed: {e}", exc_info=True)

# PDF to Excel converter
try:
    from .pdf.to_xlsx import convert_pdf_to_xlsx

    _logger.debug("PDF to Excel converter loaded")
except ImportError as e:
    _logger.warning(f"PDF to Excel converter not available: {e}")
except Exception as e:
    _logger.error(f"PDF to Excel converter failed: {e}", exc_info=True)

# PDF to Images converter
try:
    from .pdf.to_images import convert_pdf_to_images

    _logger.debug("PDF to Images converter loaded")
except ImportError as e:
    _logger.warning(f"PDF to Images converter not available: {e}")
except Exception as e:
    _logger.error(f"PDF to Images converter failed: {e}", exc_info=True)

# Advanced PDF operations
try:
    from .pdf.to_compress import convert_pdf_to_compress
    from .pdf.to_encrypt import convert_pdf_to_encrypt
    from .pdf.to_ocr_layer import convert_pdf_to_ocr_layer
    from .pdf.to_pages import convert_pdf_to_pages
    from .pdf.to_split import convert_pdf_to_split
    from .pdf.to_watermark import convert_pdf_to_watermark

    _logger.debug("Advanced PDF operations loaded")
except ImportError as e:
    _logger.warning(f"Advanced PDF operations not available: {e}")
except Exception as e:
    _logger.error(f"Advanced PDF operations failed: {e}", exc_info=True)

# EPUB converters
try:
    from .epub.to_docx import convert_epub_to_docx
    from .epub.to_html import convert_epub_to_html
    from .epub.to_markdown import convert_epub_to_markdown
    from .epub.to_pdf import convert_epub_to_pdf
    from .epub.to_pdf_libreoffice import convert_epub_to_pdf_libreoffice

    _logger.debug("EPUB converters loaded")
except ImportError as e:
    _logger.warning(f"EPUB converters not available: {e}")
except Exception as e:
    _logger.error(f"EPUB converters failed: {e}", exc_info=True)

# EPUB creation converters
try:
    from .docx.to_epub import convert_docx_to_epub
    from .html.to_epub import convert_html_to_epub
    from .markdown.to_epub import convert_markdown_to_epub

    _logger.debug("EPUB creation converters loaded")
except ImportError as e:
    _logger.warning(f"EPUB creation converters not available: {e}")
except Exception as e:
    _logger.error(f"EPUB creation converters failed: {e}", exc_info=True)

_logger.info("Plugin package initialized - all converters registered")

# Public API - exported converter functions
__all__ = [
    # Original converters
    "convert_docx_to_markdown",
    "convert_docx_to_pdf",
    "convert_html_to_pdf",
    "convert_md_to_docx",
    "convert_md_to_html",
    "convert_md_to_pdf",
    "convert_pdf_to_editable",
    "convert_pdf_to_html",
    "convert_pdf_to_md",
    "convert_pdf_to_md_with_enhanced_ocr",
    "convert_pdf_to_md_with_ocr",
    "convert_pdf_to_md_with_pymupdf4llm",
    "convert_txt_to_pdf",
    # Excel converters
    "convert_xlsx_to_pdf",
    "convert_xlsx_to_html",
    "convert_xlsx_to_markdown",
    "convert_xlsx_to_csv",
    # CSV converters
    "convert_csv_to_xlsx",
    "convert_csv_to_pdf",
    # PowerPoint converters
    "convert_pptx_to_pdf",
    "convert_pptx_to_html",
    "convert_pptx_to_markdown",
    "convert_pptx_to_images",
    # Image converters
    "convert_image_to_pdf",
    "convert_image_to_text",
    "convert_image_to_image",
    # PDF converters
    "convert_pdf_to_xlsx",
    "convert_pdf_to_images",
    # Advanced PDF operations
    "convert_pdf_to_split",
    "convert_pdf_to_compress",
    "convert_pdf_to_encrypt",
    "convert_pdf_to_watermark",
    "convert_pdf_to_pages",
    "convert_pdf_to_ocr_layer",
    # EPUB converters
    "convert_epub_to_docx",
    "convert_epub_to_pdf",
    "convert_epub_to_html",
    "convert_epub_to_markdown",
    # EPUB creation converters
    "convert_markdown_to_epub",
    "convert_docx_to_epub",
    "convert_html_to_epub",
]
