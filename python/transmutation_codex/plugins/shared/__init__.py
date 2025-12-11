"""Shared utilities for LibreOffice-based conversions.

This package provides common functionality for LibreOffice headless conversions.
"""

from .libreoffice_utils import (
    build_pdf_export_filter_options,
    find_libreoffice,
    get_libreoffice_pdf_filter_name,
)

__all__ = [
    "find_libreoffice",
    "build_pdf_export_filter_options",
    "get_libreoffice_pdf_filter_name",
]

















