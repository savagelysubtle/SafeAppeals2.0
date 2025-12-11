"""Shared utilities for LibreOffice-based conversions.

This module provides common functionality for LibreOffice headless conversions,
including PDF export filter options and LibreOffice detection.
"""

import os
import platform
import shutil
from typing import Any

from transmutation_codex.core import get_log_manager

# Setup logger
log_manager = get_log_manager()
logger = log_manager.get_converter_logger("libreoffice_utils")


def find_libreoffice() -> str | None:
    """Find LibreOffice executable on the system.

    Returns:
        Path to LibreOffice executable, or None if not found.
    """
    # Common executable names by platform
    if platform.system() == "Windows":
        executables = ["soffice.exe", "soffice"]
    else:
        executables = ["soffice", "libreoffice"]

    # Check PATH first
    for exe in executables:
        path = shutil.which(exe)
        if path:
            logger.debug(f"Found LibreOffice in PATH: {path}")
            return path

    # Check common installation locations
    if platform.system() == "Windows":
        common_paths = [
            r"C:\Program Files\LibreOffice\program\soffice.exe",
            r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
            os.path.join(
                os.environ.get("LOCALAPPDATA", ""),
                "Programs\\LibreOffice\\program\\soffice.exe",
            ),
        ]
    elif platform.system() == "Darwin":  # macOS
        common_paths = [
            "/Applications/LibreOffice.app/Contents/MacOS/soffice",
            "/usr/local/bin/soffice",
            "/opt/homebrew/bin/soffice",
        ]
    else:  # Linux
        common_paths = [
            "/usr/bin/soffice",
            "/usr/local/bin/soffice",
            "/opt/libreoffice/program/soffice",
        ]

    for path in common_paths:
        if os.path.exists(path) and os.access(path, os.X_OK):
            logger.debug(f"Found LibreOffice at: {path}")
            return path

    logger.warning("LibreOffice not found on system")
    return None


def build_pdf_export_filter_options(
    image_quality: int = 95,
    reduce_image_resolution: bool = False,
    export_bookmarks: bool = True,
    export_notes: bool = False,
    pdfa: bool = False,
    use_lossless_compression: bool = True,
    **additional_options: Any,
) -> str:
    """Build PDF export filter options string for LibreOffice.

    This function creates a filter options string compatible with LibreOffice's
    PDF export filter. All options are optimized for maximum quality and structure
    preservation.

    Args:
        image_quality: JPEG quality for images (0-100). Default is 95 (maximum).
        reduce_image_resolution: If True, reduces image resolution for smaller files.
                                Default is False to preserve original quality.
        export_bookmarks: Export document bookmarks/headings as PDF bookmarks.
                          Default is True.
        export_notes: Export document comments/notes. Default is False.
        pdfa: Create PDF/A-1b compliant output (archival standard). Default is False.
        use_lossless_compression: Use lossless compression for images. Default is True.
        **additional_options: Additional filter options as key-value pairs.

    Returns:
        Filter options string in format: "Option1=value1:Option2=value2:..."

    Example:
        >>> filter_str = build_pdf_export_filter_options(
        ...     image_quality=95,
        ...     use_lossless_compression=True
        ... )
        >>> # Use in LibreOffice command:
        >>> # --convert-to "pdf:writer_pdf_Export:{filter_str}"
    """
    filter_options = []

    # Selection: Export entire document (not just selected pages)
    filter_options.append("Selection=false")

    # Quality: JPEG quality for images (0-100)
    filter_options.append(f"Quality={image_quality}")

    # ReduceImageResolution: Keep original resolution for best quality
    filter_options.append(f"ReduceImageResolution={str(reduce_image_resolution).lower()}")

    # MaxImageResolution: DPI for images (300 is high quality for print)
    # Only relevant if ReduceImageResolution=true
    if reduce_image_resolution:
        filter_options.append("MaxImageResolution=300")

    # UseLosslessCompression: Use lossless compression for images
    filter_options.append(f"UseLosslessCompression={str(use_lossless_compression).lower()}")

    # ExportBookmarks: Export document headings as PDF bookmarks
    filter_options.append(f"ExportBookmarks={str(export_bookmarks).lower()}")

    # ExportNotes: Export comments/notes
    filter_options.append(f"ExportNotes={str(export_notes).lower()}")

    # ExportNotesPages: Don't create separate pages for notes
    filter_options.append("ExportNotesPages=false")

    # ExportFormFields: Convert form fields to PDF form fields
    filter_options.append("ExportFormFields=true")

    # FormsType: PDF form field format (0=FDF, 1=PDF, 2=HTML)
    filter_options.append("FormsType=1")

    # EmbedStandardFonts: Embed standard fonts for better compatibility
    filter_options.append("EmbedStandardFonts=true")

    # UseTaggedPDF: Create tagged PDF with structure information
    # This helps preserve document structure including page breaks
    filter_options.append("UseTaggedPDF=true")

    # IsSkipEmptyPages: Preserve empty pages (helps maintain page structure)
    # Setting to false ensures all pages are included, preserving layout
    filter_options.append("IsSkipEmptyPages=false")

    # FirstPageOnLeft: Standard page layout (false = right-hand page first)
    # This ensures consistent page numbering and layout
    filter_options.append("FirstPageOnLeft=false")

    # DisplayPDFDocumentTitle: Use document title in PDF metadata
    # Improves document structure and accessibility
    filter_options.append("DisplayPDFDocumentTitle=true")

    # PDF/A compliance (archival standard)
    if pdfa:
        filter_options.append("SelectPdfVersion=1")  # PDF/A-1b
    else:
        filter_options.append("SelectPdfVersion=0")  # Regular PDF 1.4

    # Add any additional options
    for key, value in additional_options.items():
        filter_options.append(f"{key}={value}")

    # Build the filter string
    filter_str = ":".join(filter_options)
    logger.debug(f"PDF filter options: {filter_str}")
    return filter_str


def get_libreoffice_pdf_filter_name(source_format: str) -> str:
    """Get the appropriate PDF export filter name for a source format.

    Args:
        source_format: Source format (docx, pptx, xlsx, epub, html, etc.)

    Returns:
        Filter name (e.g., "writer_pdf_Export", "impress_pdf_Export", "calc_pdf_Export")

    Raises:
        ValueError: If source format is not supported
    """
    format_filters = {
        "docx": "writer_pdf_Export",
        "doc": "writer_pdf_Export",
        "odt": "writer_pdf_Export",
        "pptx": "impress_pdf_Export",
        "ppt": "impress_pdf_Export",
        "odp": "impress_pdf_Export",
        "xlsx": "calc_pdf_Export",
        "xls": "calc_pdf_Export",
        "ods": "calc_pdf_Export",
        "epub": "writer_pdf_Export",  # EPUB is handled by Writer
        "html": "writer_web_pdf_Export",  # HTML uses web PDF export
        "htm": "writer_web_pdf_Export",
    }

    source_format_lower = source_format.lower()
    if source_format_lower not in format_filters:
        raise ValueError(
            f"Unsupported source format for LibreOffice PDF export: {source_format}. "
            f"Supported formats: {', '.join(format_filters.keys())}"
        )

    return format_filters[source_format_lower]

















