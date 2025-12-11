"""TXT to PDF converter module.

This module provides functionality to convert plain text files to PDF documents.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path
from typing import Any

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from transmutation_codex.core import (
    check_feature_access,
    check_file_size_limit,
    complete_operation,
    get_log_manager,
    publish,
    record_conversion_attempt,
    start_operation,
    update_progress,
)
from transmutation_codex.core.decorators import converter
from transmutation_codex.core.events import ConversionEvent


@converter(
    source_format="txt",
    target_format="pdf",
    name="txt_to_pdf_convert_txt_to_pdf",
    description="Convert plain text files to PDF with configurable font and styling",
    required_dependencies=["reportlab"],
    priority=10,
    version="1.0.0",
)
def convert_txt_to_pdf(
    input_path: str | Path,
    output_path: str | Path | None = None,
    **kwargs: Any,
) -> Path:
    """Converts a plain text file to a PDF document.

    Args:
        input_path: Path to the input TXT file.
        output_path: Path for the output PDF file. If None, defaults to
                     the input filename with a .pdf extension.
        **kwargs: Additional keyword arguments. Currently supports:
            - font_name (str): Name of the font to use (e.g., "Helvetica").
            - font_size (int): Font size for the text.

    Returns:
        Path: The absolute path to the generated PDF file.

    Raises:
        FileNotFoundError: If the input_path does not exist.
        RuntimeError: For errors encountered during PDF generation.
    """
    # Get logger
    logger = get_log_manager().get_converter_logger("txt2pdf")

    # Convert to Path objects
    input_path = Path(input_path).resolve()
    if output_path:
        output_path = Path(output_path).resolve()
    else:
        output_path = input_path.with_suffix(".pdf")

    # Start operation tracking
    operation = start_operation(
        "conversion",
        100,
        description=f"Converting {input_path.name} to PDF",
    )

    # Publish conversion started event
    publish(
        ConversionEvent(
            event_type="conversion.started",
            conversion_type="txt2pdf",
            plugin_name="txt_to_pdf_convert_txt_to_pdf",
            input_file=str(input_path),
            output_file=str(output_path),
        )
    )

    logger.info(f"Starting TXT to PDF conversion: {input_path}")
    logger.info(f"Output will be saved to: {output_path}")

    start_time = time.time()

    try:
        # License validation and feature gating (txt2pdf is paid-only)
        check_feature_access("txt2pdf")

        # Convert to Path for validation
        input_path = Path(input_path).resolve()

        # Check file size limit
        check_file_size_limit(str(input_path))

        # Validate input file
        if not input_path.exists():
            raise FileNotFoundError(f"Input file not found: {input_path}")

        if input_path.suffix.lower() != ".txt":
            raise ValueError(f"Input file must be a TXT file: {input_path}")

        update_progress(operation, 10, "Reading text file...")

        # Get options
        font_name = kwargs.get("font_name", "Helvetica")
        font_size = kwargs.get("font_size", 10)

        logger.info(f"Font: {font_name}, Size: {font_size}")

        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)

        update_progress(operation, 30, "Preparing PDF document...")

        # Read text content
        with open(input_path, encoding="utf-8") as f:
            text_content = f.read()

        update_progress(operation, 50, "Generating PDF...")

        # Create PDF
        doc = SimpleDocTemplate(str(output_path), pagesize=letter)
        styles = getSampleStyleSheet()
        style = styles["Normal"]
        style.fontName = font_name
        style.fontSize = font_size
        style.leading = font_size * 1.2  # Line spacing

        story = []
        # Process text - replace newlines with <br/> tags
        processed_text = text_content.replace("\r\n", "\n").replace("\n", "<br/>\n")

        # Split by double newlines for paragraphs
        paragraphs = processed_text.split("<br/>\n<br/>\n")

        for para_text in paragraphs:
            if para_text.strip():
                story.append(Paragraph(para_text, style))
                story.append(Spacer(1, 0.2 * style.fontSize))

        if not story:  # Handle empty files
            story.append(Paragraph("<i>(Empty Document)</i>", style))

        update_progress(operation, 80, "Building PDF...")

        doc.build(story)

        update_progress(operation, 90, "Finalizing PDF...")

        duration = time.time() - start_time
        logger.info(f"Successfully converted {input_path.name} to PDF: {output_path}")
        logger.info(f"Conversion completed in {duration:.2f}s")

        # Complete operation
        # Record conversion for trial tracking
        record_conversion_attempt(
            converter_name="txt2pdf",
            input_file=str(input_path),
            output_file=str(output_path),
            success=True,
        )

        complete_operation(operation, success=True)

        # Publish conversion completed event
        publish(
            ConversionEvent(
                event_type="conversion.completed",
                conversion_type="txt2pdf",
                plugin_name="txt_to_pdf_convert_txt_to_pdf",
                input_file=str(input_path),
                output_file=str(output_path),
            )
        )

        return output_path

    except FileNotFoundError:
        logger.error(f"Input file not found: {input_path}")
        complete_operation(operation, success=False)

        publish(
            ConversionEvent(
                event_type="conversion.failed",
                conversion_type="txt2pdf",
                plugin_name="txt_to_pdf_convert_txt_to_pdf",
                input_file=str(input_path),
                output_file=str(output_path) if output_path else None,
            )
        )
        raise
    except Exception as e:
        duration = time.time() - start_time
        error_message = f"TXT to PDF conversion failed: {e}"
        logger.exception(error_message)

        complete_operation(operation, success=False)

        # Publish conversion failed event
        publish(
            ConversionEvent(
                event_type="conversion.failed",
                conversion_type="txt2pdf",
                plugin_name="txt_to_pdf_convert_txt_to_pdf",
                input_file=str(input_path),
                output_file=str(output_path) if output_path else None,
            )
        )

        raise RuntimeError(error_message) from e


# Alias for backward compatibility
txt_to_pdf = convert_txt_to_pdf


if __name__ == "__main__":
    # Example usage for direct script execution (testing)
    import logging

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    )

    import argparse

    parser = argparse.ArgumentParser(description="Convert TXT to PDF")
    parser.add_argument("input_file", type=Path, help="Path to input TXT file")
    parser.add_argument(
        "output_file",
        type=Path,
        nargs="?",
        help="Path to output PDF file (optional)",
    )
    parser.add_argument(
        "--font-name",
        default="Helvetica",
        help="Font name (default: Helvetica)",
    )
    parser.add_argument(
        "--font-size",
        type=int,
        default=10,
        help="Font size (default: 10)",
    )

    args = parser.parse_args()

    try:
        result = convert_txt_to_pdf(
            args.input_file,
            args.output_file,
            font_name=args.font_name,
            font_size=args.font_size,
        )
        print(f"Successfully converted to: {result}")
    except Exception as e:
        print(f"Conversion failed: {e}")
        sys.exit(1)
