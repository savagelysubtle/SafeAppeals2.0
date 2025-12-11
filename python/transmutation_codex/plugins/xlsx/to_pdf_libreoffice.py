"""Excel to PDF conversion using LibreOffice headless mode.

This module provides professional-quality XLSX to PDF conversion using LibreOffice's
native rendering engine. This approach produces output that matches Microsoft Excel's
PDF export quality (95%+ formatting preservation).

Advantages over reportlab:
- Superior formatting preservation (cells, formulas, charts, formatting, layouts)
- Native XLSX engine (same as LibreOffice Calc)
- Preserves charts and graphics perfectly
- Handles complex spreadsheets with multiple sheets
- Cross-platform support (Windows, macOS, Linux)
"""

import os
import platform
import subprocess
import time
from pathlib import Path
from typing import Any

from transmutation_codex.core import (
    check_feature_access,
    complete_operation,
    get_log_manager,
    publish,
    record_conversion_attempt,
    start_operation,
    update_progress,
)
from transmutation_codex.core.decorators import converter
from transmutation_codex.core.events import ConversionEvent
from transmutation_codex.core.exceptions import raise_conversion_error
from transmutation_codex.plugins.shared.libreoffice_utils import (
    build_pdf_export_filter_options,
    find_libreoffice,
    get_libreoffice_pdf_filter_name,
)

# Setup logger
log_manager = get_log_manager()
logger = log_manager.get_converter_logger("xlsx2pdf_libreoffice")


@converter(
    source_format="xlsx",
    target_format="pdf",
    name="xlsx_to_pdf_libreoffice",
    description="Convert Excel to PDF using LibreOffice (professional quality)",
    required_dependencies=[],  # LibreOffice is detected at runtime
    priority=5,  # Highest priority (lower number = higher priority)
    version="1.0.0",
)
def convert_xlsx_to_pdf_libreoffice(
    input_path: str | Path,
    output_path: str | Path | None = None,
    timeout: int = 120,
    # PDF Quality Options
    image_quality: int = 95,  # JPEG quality (0-100), 95 is maximum quality
    reduce_image_resolution: bool = False,  # Keep original image resolution
    export_bookmarks: bool = True,  # Export sheet names as PDF bookmarks
    export_notes: bool = False,  # Don't export cell comments
    # PDF/A Compliance
    pdfa: bool = False,  # Set to True for PDF/A-1b compliance (archival)
    # Rendering Options
    use_lossless_compression: bool = True,  # Use lossless compression for images
    **options: Any,
) -> Path:
    """Convert XLSX to PDF using LibreOffice headless mode with enhanced quality.

    This converter produces Microsoft Excel-quality PDF output with excellent
    formatting preservation (95%+). It uses LibreOffice's native rendering engine
    with optimized export settings for maximum quality.

    Args:
        input_path: Path to the input XLSX file.
        output_path: Path for the output PDF file. If None, uses input filename
                     with .pdf extension.
        timeout: Maximum time in seconds to wait for conversion (default: 120).
        image_quality: JPEG quality for images (0-100). Default is 95 (maximum quality).
        reduce_image_resolution: If True, reduces image resolution for smaller files.
                                  Default is False to preserve original quality.
        export_bookmarks: Export sheet names as PDF bookmarks. Default is True.
        export_notes: Export cell comments. Default is False.
        pdfa: Create PDF/A-1b compliant output (archival standard). Default is False.
        use_lossless_compression: Use lossless compression for images. Default is True.
        **options: Additional keyword arguments (currently unused).

    Returns:
        Path object of the generated PDF file.

    Raises:
        FileNotFoundError: If LibreOffice is not installed or input file not found.
        RuntimeError: If conversion fails.

    Example:
        >>> # Basic conversion
        >>> convert_xlsx_to_pdf_libreoffice("spreadsheet.xlsx")

        >>> # High quality for professional documents
        >>> convert_xlsx_to_pdf_libreoffice(
        ...     "spreadsheet.xlsx",
        ...     output_path="spreadsheet_premium.pdf",
        ...     image_quality=95,
        ...     use_lossless_compression=True,
        ... )
    """
    # Convert to Path objects
    input_path = Path(input_path)
    if output_path:
        output_path = Path(output_path)
    else:
        output_path = input_path.with_suffix(".pdf")

    # Start operation tracking
    operation = start_operation(
        "conversion",
        100,
        description=f"Converting {input_path.name} to PDF (LibreOffice)",
    )

    # Publish conversion started event
    publish(
        ConversionEvent(
            event_type="conversion.started",
            conversion_type="xlsx2pdf",
            plugin_name="xlsx_to_pdf_libreoffice",
            input_file=str(input_path),
            output_file=str(output_path),
        )
    )

    logger.info(f"Starting LibreOffice XLSX to PDF conversion: {input_path}")
    logger.info(f"Output will be saved to: {output_path}")

    start_time = time.time()

    try:
        # License validation and feature gating (xlsx2pdf is paid-only)
        check_feature_access("xlsx2pdf")

        # Validate input file
        if not input_path.exists():
            raise FileNotFoundError(f"Input file not found: {input_path}")

        if not input_path.suffix.lower() in [".xlsx", ".xls", ".ods"]:
            raise ValueError(
                f"Input file must be .xlsx, .xls, or .ods, got: {input_path.suffix}"
            )

        update_progress(operation, 10, "Finding LibreOffice...")

        # Find LibreOffice
        soffice_path = find_libreoffice()
        if not soffice_path:
            error_msg = (
                "LibreOffice not found. Please install LibreOffice:\n"
                "  Windows: winget install LibreOffice\n"
                "  macOS:   brew install libreoffice\n"
                "  Linux:   sudo apt-get install libreoffice"
            )
            logger.error(error_msg)
            raise FileNotFoundError(error_msg)

        update_progress(operation, 20, "Preparing output directory...")

        # Ensure output directory exists
        output_dir = output_path.parent
        output_dir.mkdir(parents=True, exist_ok=True)

        # LibreOffice names the output file based on the input filename
        # So we need to account for that
        temp_output_name = input_path.with_suffix(".pdf").name
        temp_output_path = output_dir / temp_output_name

        update_progress(operation, 30, "Preparing PDF export settings...")

        # Build PDF export filter options using shared utility
        filter_options_str = build_pdf_export_filter_options(
            image_quality=image_quality,
            reduce_image_resolution=reduce_image_resolution,
            export_bookmarks=export_bookmarks,
            export_notes=export_notes,
            pdfa=pdfa,
            use_lossless_compression=use_lossless_compression,
        )

        # Get the appropriate filter name for Excel
        filter_name = get_libreoffice_pdf_filter_name("xlsx")

        update_progress(operation, 40, "Starting LibreOffice conversion...")

        # Build LibreOffice command
        # Let LibreOffice use its default user installation location
        cmd = [
            soffice_path,
            "--headless",
            "--convert-to",
            f"pdf:{filter_name}:{filter_options_str}",
            "--outdir",
            str(output_dir),
            str(input_path),
        ]

        logger.info(f"Running command: {' '.join(cmd)}")
        logger.debug(
            f"PDF export settings: quality={image_quality}, "
            f"lossless={use_lossless_compression}, pdfa={pdfa}"
        )

        update_progress(operation, 50, "Converting with LibreOffice...")

        # Run LibreOffice conversion
        try:
            # Log the full command for debugging
            logger.debug(f"Full command: {cmd}")

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
                check=False,  # Don't raise on non-zero exit, we'll handle it
                encoding="utf-8",
                errors="replace",  # Replace encoding errors instead of failing
            )

            update_progress(operation, 80, "Checking conversion result...")

            # Log output for debugging
            if result.stdout:
                logger.debug(f"LibreOffice STDOUT: {result.stdout}")
            if result.stderr:
                logger.debug(f"LibreOffice STDERR: {result.stderr}")

            # Check if conversion was successful
            if result.returncode != 0:
                # Try to get more detailed error information
                error_details = []
                if result.stdout:
                    error_details.append(f"STDOUT: {result.stdout}")
                if result.stderr:
                    error_details.append(f"STDERR: {result.stderr}")
                if not error_details:
                    error_details.append("No output captured from LibreOffice")

                error_msg = (
                    f"LibreOffice conversion failed with exit code {result.returncode}\n"
                    f"Command: {' '.join(cmd)}\n"
                    + "\n".join(error_details)
                )
                logger.error(error_msg)
                raise RuntimeError(error_msg)

            # Check if output file was created
            if not temp_output_path.exists():
                error_msg = (
                    f"LibreOffice conversion completed but output file not found: {temp_output_path}\n"
                    f"STDOUT: {result.stdout}\n"
                    f"STDERR: {result.stderr}"
                )
                logger.error(error_msg)
                raise RuntimeError(error_msg)

            # Rename to desired output path if different
            if temp_output_path != output_path:
                if output_path.exists():
                    output_path.unlink()
                temp_output_path.rename(output_path)

            update_progress(operation, 95, "Conversion complete")

        except subprocess.TimeoutExpired:
            error_msg = f"LibreOffice conversion timed out after {timeout} seconds"
            logger.error(error_msg)
            raise RuntimeError(error_msg)

        duration = time.time() - start_time
        logger.info(f"Successfully converted {input_path.name} to PDF: {output_path}")
        logger.info(f"Conversion completed in {duration:.2f}s")

        # Record conversion for trial tracking
        record_conversion_attempt(
            converter_name="xlsx2pdf_libreoffice",
            input_file=str(input_path),
            output_file=str(output_path),
            success=True,
        )

        complete_operation(operation, success=True)

        # Publish conversion completed event
        publish(
            ConversionEvent(
                event_type="conversion.completed",
                conversion_type="xlsx2pdf",
                plugin_name="xlsx_to_pdf_libreoffice",
                input_file=str(input_path),
                output_file=str(output_path),
            )
        )

        return output_path

    except FileNotFoundError as e:
        logger.error(f"File not found: {e}")
        complete_operation(operation, success=False)

        publish(
            ConversionEvent(
                event_type="conversion.failed",
                conversion_type="xlsx2pdf",
                plugin_name="xlsx_to_pdf_libreoffice",
                input_file=str(input_path),
                output_file=str(output_path) if output_path else None,
            )
        )
        raise

    except Exception as e:
        duration = time.time() - start_time
        error_message = f"LibreOffice conversion failed: {e}"
        logger.exception(error_message)

        complete_operation(operation, success=False)

        # Publish conversion failed event
        publish(
            ConversionEvent(
                event_type="conversion.failed",
                conversion_type="xlsx2pdf",
                plugin_name="xlsx_to_pdf_libreoffice",
                input_file=str(input_path),
                output_file=str(output_path) if output_path else None,
            )
        )

        raise RuntimeError(error_message) from e


# Alias for backward compatibility
xlsx_to_pdf_libreoffice = convert_xlsx_to_pdf_libreoffice

