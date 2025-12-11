#!/usr/bin/env python
"""HTML to PDF converter module.

This module provides functionality to convert HTML files to PDF.
"""

import sys
from pathlib import Path
from typing import Any

import pdfkit

from transmutation_codex.core import (
    ErrorCode,
    check_feature_access,
    check_file_size_limit,
    complete_operation,
    get_log_manager,
    raise_conversion_error,
    start_operation,
    update_progress,
)
from transmutation_codex.core.decorators import converter
from transmutation_codex.core.settings import ConfigManager

# Setup logger
logger = get_log_manager().get_converter_logger("html2pdf")


def _ensure_path(input_val: str | Path) -> Path:
    """Ensures the input value is a Path object.

    If the input is already a Path object, it's returned directly.
    If it's a string, it's converted to a Path object.

    Args:
        input_val (str | Path): The input value, which can be a string path or a Path object.

    Returns:
        Path: The Path object representation of the input.
    """
    return Path(input_val)


@converter(
    source_format="html",
    target_format="pdf",
    description="Convert HTML to PDF using wkhtmltopdf via pdfkit",
    input_formats=["html", "htm"],
    max_file_size_mb=100,
)
def convert_html_to_pdf(
    input_path: str | Path, output_path: str | Path | None = None, **kwargs: Any
) -> Path:
    """Convert an HTML file to PDF using pdfkit.

    Args:
        input_path: Path to the input HTML file.
        output_path: Output file path; if not provided, defaults to same name with .pdf extension.
        **kwargs: Additional keyword arguments for the pdfkit converter.

    Returns:
        Path to the created PDF file.

    Raises:
        FileNotFoundError: If input file not found.
        ValueError: If input file is not HTML.
        ImportError: If pdfkit or wkhtmltopdf is not installed/found.
        RuntimeError: For other conversion errors.
    """
    operation = start_operation(
        "html2pdf", message=f"Converting {Path(input_path).name} to PDF", total_steps=100
    )

    try:
        logger.info(f"Starting HTML to PDF conversion: {input_path}")

        input_path = _ensure_path(input_path).resolve()
        if not input_path.exists():
            error_code = ErrorCode.VALIDATION_FILE_NOT_FOUND
            logger.error(f"[{error_code}] Input HTML file not found: {input_path}")
            complete_operation(operation, success=False)
            raise FileNotFoundError(f"Input file not found: {input_path}")
        if input_path.suffix.lower() not in [".html", ".htm"]:
            error_code = ErrorCode.VALIDATION_INVALID_FORMAT
            logger.error(f"[{error_code}] Invalid input file type: {input_path.suffix}")
            complete_operation(operation, success=False)
            raise ValueError(f"Input file must be an HTML file: {input_path}")

        output_path = (
            _ensure_path(output_path).resolve()
            if output_path
            else input_path.with_suffix(".pdf")
        )
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Get config
        config = ConfigManager()
        settings = config.get_converter_config("html2pdf")
        # Engine is now always pdfkit
        engine = "pdfkit"

        logger.info(f"Converting {input_path} to PDF using engine: {engine}")

        # License validation and feature gating (html2pdf is paid-only)
        try:
            check_feature_access("html2pdf")
            logger.debug("Feature access check passed for html2pdf")
        except Exception as e:
            logger.error(f"Feature access denied for html2pdf: {e}", exc_info=True)
            complete_operation(operation, success=False)
            raise

        # Convert to Path for validation
        input_path = Path(input_path).resolve()
        logger.debug(f"Resolved input path: {input_path}")

        # Check file size limit
        try:
            check_file_size_limit(str(input_path))
            logger.debug("File size check passed")
        except Exception as e:
            logger.error(f"File size limit exceeded: {e}", exc_info=True)
            complete_operation(operation, success=False)
            raise

        # pdfkit options can be passed as a dictionary
        options = {
            "page-size": kwargs.get("page_size", settings.get("page_size", "A4")),
            "margin-top": kwargs.get("margin_top", settings.get("margin_top", "1cm")),
            "margin-right": kwargs.get(
                "margin_right", settings.get("margin_right", "1cm")
            ),
            "margin-bottom": kwargs.get(
                "margin_bottom", settings.get("margin_bottom", "1cm")
            ),
            "margin-left": kwargs.get(
                "margin_left", settings.get("margin_left", "1cm")
            ),
            "encoding": "UTF-8",
            "enable-local-file-access": None,  # Enable loading local files (CSS, images)
            "quiet": None,  # Suppress wkhtmltopdf output
        }
        # Add optional JS delay
        js_delay = kwargs.get("javascript_delay", settings.get("javascript_delay"))
        if js_delay:
            options["javascript-delay"] = js_delay

        # Check for wkhtmltopdf path in config or kwargs
        wkhtmltopdf_path = kwargs.get(
            "wkhtmltopdf_path", settings.get("wkhtmltopdf_path")
        )
        pdfkit_config = (
            pdfkit.configuration(wkhtmltopdf=wkhtmltopdf_path)
            if wkhtmltopdf_path
            else None
        )
        logger.debug(f"pdfkit options: {options}, config: {pdfkit_config}")

        update_progress(operation, 50, "Converting HTML to PDF...")
        logger.debug(f"Converting HTML to PDF with pdfkit options: {options}")

        try:
            pdfkit.from_file(
                str(input_path),
                str(output_path),
                options=options,
                configuration=pdfkit_config,
            )
            logger.debug(f"Successfully converted HTML to PDF: {output_path}")
        except FileNotFoundError as e:
            # Check if it's wkhtmltopdf not found
            if "wkhtmltopdf" in str(e):
                error_code = ErrorCode.DEPENDENCY_MISSING_EXECUTABLE
                logger.error(
                    f"[{error_code}] wkhtmltopdf executable not found. Please install it and ensure it's in PATH "
                    "or specify the path in config (html2pdf.wkhtmltopdf_path)."
                )
                complete_operation(operation, success=False)
                raise FileNotFoundError(
                    "wkhtmltopdf not found. Install it or set path in config."
                ) from e
            else:
                error_code = ErrorCode.VALIDATION_FILE_NOT_FOUND
                logger.error(f"[{error_code}] File not found during conversion: {e}", exc_info=True)
                complete_operation(operation, success=False)
                raise
        except Exception as e:
            error_code = ErrorCode.CONVERSION_HTML2PDF_CONVERSION_FAILED
            logger.error(f"[{error_code}] Error during HTML to PDF conversion using pdfkit: {e}", exc_info=True)
            complete_operation(operation, success=False)
            raise_conversion_error(
                f"Error converting HTML to PDF with pdfkit: {e}",
                source_format="html",
                target_format="pdf",
                source_file=str(input_path),
                error_code=error_code,
            )

        update_progress(operation, 100, "Conversion complete")
        complete_operation(operation, success=True)
        logger.info(f"Successfully converted HTML to PDF: {output_path}")
        return output_path
    except (FileNotFoundError, ValueError) as e:
        # Already handled above
        raise
    except Exception as e:
        error_code = ErrorCode.CONVERSION_HTML2PDF_CONVERSION_FAILED
        logger.error(f"[{error_code}] Unexpected error during HTML to PDF conversion: {e}", exc_info=True)
        if 'operation' in locals():
            complete_operation(operation, success=False)
        raise_conversion_error(
            f"Error converting HTML to PDF: {e}",
            source_format="html",
            target_format="pdf",
            source_file=str(input_path) if isinstance(input_path, Path) else str(input_path),
            error_code=error_code,
        )


# Alias for naming consistency
html_to_pdf = convert_html_to_pdf

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python html_to_pdf.py <input_html_file> [output_pdf_file]")
        sys.exit(1)
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None

    try:
        # LogManager initializes automatically via singleton in convert call
        # log_manager.configure_logging() # Incorrect - Removed
        result = convert_html_to_pdf(input_file, output_file)
        # Logger is already configured, so just log the success
        # logger.info(f"Conversion successful: {result}") # Redundant if convert logs
        sys.exit(0)
    except Exception as e:
        # Logger should already be configured to handle this via root or specific loggers
        # logger.error(f"Error: {e}") # Redundant if convert logs exception
        print(f"Error: {e}", file=sys.stderr)  # Print to stderr for CLI feedback
        sys.exit(1)
