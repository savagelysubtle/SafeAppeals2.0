"""PDF converters package.

This package contains converters for PDF files.
Each converter is imported individually to allow graceful degradation
when optional dependencies are missing.
"""

import logging

_logger = logging.getLogger("aichemist_codex.plugins.pdf")

# Import converters individually with graceful fallback
# This allows converters to work even if some dependencies are missing

convert_pdf_to_editable = None
convert_pdf_to_html = None
convert_pdf_to_images = None
convert_pdf_to_md = None
convert_pdf_to_xlsx = None

try:
    from .to_editable_pdf import convert_pdf_to_editable
except ImportError as e:
    _logger.debug(f"PDF to editable converter not available: {e}")

try:
    from .to_html import convert_pdf_to_html
except ImportError as e:
    _logger.debug(f"PDF to HTML converter not available: {e}")

try:
    from .to_images import convert_pdf_to_images
except ImportError as e:
    _logger.debug(f"PDF to images converter not available: {e}")

try:
    from .to_markdown import convert_pdf_to_md
except ImportError as e:
    _logger.debug(f"PDF to markdown converter not available: {e}")

try:
    from .to_xlsx import convert_pdf_to_xlsx
except ImportError as e:
    _logger.debug(f"PDF to xlsx converter not available: {e}")

# Export only successfully imported converters
__all__ = [
    name for name in [
        "convert_pdf_to_editable",
        "convert_pdf_to_html",
        "convert_pdf_to_images",
        "convert_pdf_to_md",
        "convert_pdf_to_xlsx",
    ]
    if globals().get(name) is not None
]
