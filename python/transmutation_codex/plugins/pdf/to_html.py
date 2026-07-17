#!/usr/bin/env python
"""PDF to HTML converter module.

This module converts PDF files to HTML.
"""

import io
import sys
from pathlib import Path
from typing import Any

from transmutation_codex.core import (
    ConfigManager,
    LogManager,
    check_feature_access,
    check_file_size_limit,
    record_conversion_attempt,
)
from transmutation_codex.core.decorators import converter
from transmutation_codex.core.events import ConversionEvent, EventTypes, publish
from transmutation_codex.core.progress import (
    complete_operation,
    start_operation,
    update_progress,
)

# Setup logger
log_manager = LogManager()
logger = log_manager.get_converter_logger("pdf2html")

try:
    import fitz  # PyMuPDF

    PYMUPDF_AVAILABLE = True
except ImportError:
    logger.error("PyMuPDF not found. Install with: uv add pymupdf")
    PYMUPDF_AVAILABLE = False

# Check for pdfminer.six availability
try:
    from pdfminer.high_level import extract_text_to_fp  # type: ignore
    from pdfminer.layout import LAParams  # type: ignore

    PDFMINER_AVAILABLE = True
except ImportError:
    logger.error("pdfminer.six not found. Install with: uv add pdfminer.six")
    PDFMINER_AVAILABLE = False


@converter(
    source_format="pdf",
    target_format="html",
    description="Convert PDF to HTML with PyMuPDF or pdfminer.six",
    priority=50,
)
def convert_pdf_to_html(
    input_path: str | Path, output_path: str | Path | None = None, **kwargs: Any
) -> Path:
    """Converts a PDF file to an HTML document.

    This function can use either PyMuPDF (fitz) or pdfminer.six as the conversion
    engine. The engine can be specified via `**kwargs` or configuration.
    If PyMuPDF is used, it extracts HTML content page by page and wraps it in a
    basic HTML structure with some default CSS for readability.
    If pdfminer.six is used, it leverages `extract_text_to_fp`.

    Args:
        input_path (str | Path): Path to the input PDF file.
        output_path (str | Path | None): Path for the output HTML file.
            If None, defaults to the input filename with an .html extension.
            Defaults to None.
        **kwargs (Any): Additional keyword arguments. Currently supports:
            - `engine` (str): Specifies the conversion engine to use, either
              "pymupdf" or "pdfminer". If not provided, it defaults to the
              value in the `pdf2html` configuration, or "pymupdf" if PyMuPDF
              is available, otherwise "pdfminer".

    Returns:
        Path: The absolute path to the generated HTML file.

    Raises:
        FileNotFoundError: If the `input_path` does not exist.
        ValueError: If the `input_path` is not a PDF file, or if the specified
            engine is not supported or available.
        ImportError: If neither PyMuPDF nor pdfminer.six is available and no
            valid engine can be selected.
        RuntimeError: For other errors encountered during the conversion process.
    """
    # Start progress tracking
    operation = start_operation(
        "pdf2html",
        message=f"Converting {Path(input_path).name} to HTML",
        total_steps=100,
    )

    # Publish conversion started event
    publish(
        ConversionEvent(
            event_type=EventTypes.CONVERSION_STARTED,
            source="pdf2html",
            input_file=str(input_path),
            conversion_type="pdf2html",
            data={
                "operation_id": operation,
            },
        )
    )

    try:
        # License validation and feature gating (PDF→HTML is paid-only)
        check_feature_access("pdf2html")

        # Convert to Path for validation
        input_path = Path(input_path).resolve()

        # Check file size limit
        check_file_size_limit(str(input_path))

        update_progress(operation, 10, "Validating input file")

        if not input_path.exists():
            logger.error(f"Input PDF file not found: {input_path}")
            raise FileNotFoundError(f"Input file not found: {input_path}")
        if input_path.suffix.lower() != ".pdf":
            logger.error(f"Invalid input file type: {input_path.suffix}")
            raise ValueError(f"Input file must be a PDF: {input_path}")

        output_path = (
            Path(output_path).resolve()
            if output_path
            else input_path.with_suffix(".html")
        )
        output_path.parent.mkdir(parents=True, exist_ok=True)

        update_progress(operation, 20, "Loading configuration")

        # Get config
        config = ConfigManager()
        settings = config.get_environment_config()
        engine = kwargs.get(
            "engine",
            settings.get("engine", "pymupdf" if PYMUPDF_AVAILABLE else "pdfminer"),
        )

        logger.info(f"Converting {input_path} to HTML using engine: {engine}")
        update_progress(operation, 30, f"Starting conversion with {engine}")

        if engine == "pymupdf" and PYMUPDF_AVAILABLE:
            logger.debug("Using PyMuPDF engine.")
            pdf_document = fitz.open(str(input_path))
            update_progress(operation, 40, "Opening PDF document")

            html_content = '<html><head><meta charset="utf-8"><style>body { font-family: sans-serif; margin: 2em; } .page { border: 1px solid #ccc; padding: 1em; margin-bottom: 1em; background-color: #f9f9f9;} img { max-width: 100%; height: auto; }</style></head><body>'

            if pdf_document.is_encrypted:
                logger.warning("PDF is encrypted. Authentication may be required.")
                try:
                    pdf_document.authenticate("")
                except Exception as auth_e:
                    logger.error(f"Failed to authenticate encrypted PDF: {auth_e}")
                    html_content += "<p><strong>Error: Could not authenticate encrypted PDF.</strong></p>"

            total_pages = len(pdf_document)
            for page_num in range(total_pages):
                page = pdf_document.load_page(page_num)
                progress_percent = 40 + int((page_num / total_pages) * 50)
                update_progress(
                    operation,
                    progress_percent,
                    f"Processing page {page_num + 1}/{total_pages}",
                )

                html_content += f"<div class='page' id='page-{page_num + 1}'>"
                html_content += f"<h2>Page {page_num + 1}</h2>"
                # Correct method is get_text()
                try:
                    page_html = page.get_text("html")  # type: ignore
                    html_content += page_html
                except Exception as page_err:
                    logger.error(
                        f"Error extracting HTML from page {page_num + 1}: {page_err}"
                    )
                    html_content += (
                        "<p><em>Error extracting content from this page.</em></p>"
                    )
                html_content += "</div><hr>"
            html_content += "</body></html>"

            update_progress(operation, 90, "Writing HTML file")
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(html_content)
            pdf_document.close()

        elif engine == "pdfminer" and PDFMINER_AVAILABLE:
            logger.debug("Using pdfminer.six engine.")
            update_progress(operation, 50, "Extracting HTML with pdfminer.six")
            with open(input_path, "rb") as infile:
                with io.BytesIO() as outfile:  # Use BytesIO as buffer
                    extract_text_to_fp(
                        infile,
                        outfile,  # Write to buffer
                        output_type="html",
                        laparams=LAParams(),
                        codec="utf-8",  # Specify codec
                    )
                    html_bytes = outfile.getvalue()
                    update_progress(operation, 90, "Writing HTML file")
                    # Write the extracted bytes to the final file
                    with open(output_path, "wb") as final_outfile:
                        final_outfile.write(html_bytes)
        else:
            logger.error(
                f"Selected engine '{engine}' is not available or not supported."
            )
            if not PYMUPDF_AVAILABLE and not PDFMINER_AVAILABLE:
                raise ImportError(
                    "No PDF->HTML engine (PyMuPDF or pdfminer.six) installed."
                )
            else:
                raise ValueError(
                    f"PDF->HTML engine '{engine}' not available. Available: {'PyMuPDF' if PYMUPDF_AVAILABLE else ''}{', ' if PYMUPDF_AVAILABLE and PDFMINER_AVAILABLE else ''}{'pdfminer.six' if PDFMINER_AVAILABLE else ''}"
                )

        update_progress(operation, 100, "Conversion complete")
        logger.info(f"PDF converted to HTML: {output_path}")

        # Record conversion for trial tracking
        record_conversion_attempt(
            converter_name="pdf2html",
            input_file=str(input_path),
            output_file=str(output_path),
            success=True,
        )

        # Publish completion event
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_COMPLETED,
                source="pdf2html",
                input_file=str(input_path),
                output_file=str(output_path),
                conversion_type="pdf2html",
                data={
                    "operation_id": operation,
                },
            )
        )

        complete_operation(operation, success=True)
        return output_path

    except Exception as e:
        logger.exception(f"Error during PDF to HTML conversion: {e}")
        complete_operation(operation, success=False)

        # Publish failure event
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_FAILED,
                source="pdf2html",
                input_file=str(input_path),
                conversion_type="pdf2html",
                data={
                    "operation_id": operation,
                    "error": str(e),
                },
            )
        )

        raise RuntimeError(f"Error converting PDF to HTML: {e}") from e


# Alias for naming consistency
pdf_to_html = convert_pdf_to_html

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python pdf_to_html.py <input_pdf_file> [output_html_file]")
        sys.exit(1)
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None

    try:
        # LogManager initializes automatically via singleton
        result = convert_pdf_to_html(input_file, output_file)
        sys.exit(0)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
