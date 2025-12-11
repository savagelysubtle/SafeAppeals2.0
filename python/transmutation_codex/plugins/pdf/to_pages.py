"""PDF pages converter.

This module provides functionality to extract, rotate, and remove pages from PDF files.
Supports various page operations and transformations.
"""

from pathlib import Path
from typing import Any

try:
    import pikepdf

    PIKEPDF_AVAILABLE = True
except ImportError:
    PIKEPDF_AVAILABLE = False

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
from transmutation_codex.core.events import ConversionEvent, EventTypes
from transmutation_codex.core.exceptions import raise_conversion_error

# Setup logger
logger = get_log_manager().get_converter_logger("pdf2pages")


@converter(
    source_format="pdf",
    target_format="pages",
    description="Extract, rotate, and remove pages from PDF",
    required_dependencies=["pikepdf"],
    priority=10,
    version="1.0.0",
)
def convert_pdf_to_pages(
    input_path: str | Path,
    output_path: str | Path | None = None,
    **kwargs: Any,
) -> Path:
    """Extract, rotate, and remove pages from PDF file.

    This function performs various page operations on a PDF file, including
    extracting specific pages, rotating pages, and removing pages.

    Args:
        input_path: Path to input PDF file
        output_path: Path for output PDF file (auto-generated if None)
        **kwargs: Additional options:
            - `operation` (str): Page operation ("extract", "rotate", "remove").
                               Defaults to "extract".
            - `page_numbers` (list): List of page numbers to operate on.
                                    Required for all operations.
            - `rotation` (int): Rotation angle in degrees (0, 90, 180, 270).
                               Required for "rotate" operation.
            - `output_format` (str): Output format ("single", "multiple").
                                   Defaults to "single".
            - `output_prefix` (str): Prefix for output files.
                                    Defaults to "page".

    Returns:
        Path: The path to the output PDF file(s).

    Raises:
        ValidationError: If input or output paths are invalid, or dependencies are missing.
        ConversionError: If the page operation fails.
    """
    logger.info(f"Attempting to perform page operations on PDF: {input_path}")

    # Validate dependencies
    if not PIKEPDF_AVAILABLE:
        raise_conversion_error("pikepdf is required for PDF page operations")

    # Start operation
    operation_id = start_operation(
        f"Performing page operations on PDF: {Path(input_path).name}", total_steps=100
    )

    try:
        # Check licensing and file size
        check_feature_access("pdf2pages")
        check_file_size_limit(input_path)
        record_conversion_attempt("pdf2pages", str(input_path))

        # Convert paths
        input_path = Path(input_path)
        if output_path is None:
            output_path = input_path.parent / f"{input_path.stem}_pages.pdf"
        else:
            output_path = Path(output_path)

        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)

        logger.info(f"Performing page operations on PDF: {input_path} -> {output_path}")

        # Parse options from GUI
        page_range = kwargs.get("pageRange", "")
        rotation = kwargs.get("rotate", 0)
        remove_pages = kwargs.get("removePages", "")

        # Parse legacy options if provided
        operation_type = kwargs.get("operation", "")
        page_numbers = kwargs.get("page_numbers", [])
        output_format = kwargs.get("output_format", "single")
        output_prefix = kwargs.get("output_prefix", "page")

        # Determine operation type and page numbers based on GUI inputs
        if remove_pages:
            # Remove pages operation
            operation_type = "remove"
            page_numbers = _parse_page_range(remove_pages)
            logger.info(f"Remove pages operation: {page_numbers}")
        elif rotation != 0:
            # Rotate pages operation
            operation_type = "rotate"
            if page_range:
                page_numbers = _parse_page_range(page_range)
            else:
                # Rotate all pages if no specific range provided
                page_numbers = []
            logger.info(
                f"Rotate pages operation: {rotation}° on pages {page_numbers if page_numbers else 'all'}"
            )
        elif page_range:
            # Extract pages operation
            operation_type = "extract"
            page_numbers = _parse_page_range(page_range)
            logger.info(f"Extract pages operation: {page_numbers}")
        elif page_numbers:
            # Legacy mode with explicit page_numbers
            if not operation_type:
                operation_type = "extract"
            logger.info(f"Legacy operation: {operation_type} on pages {page_numbers}")
        else:
            # No operation specified - default to extract all pages
            operation_type = "extract"
            page_numbers = []
            logger.info("No specific operation - extracting all pages")

        # Validate operation type
        if operation_type not in ["extract", "rotate", "remove"]:
            raise_conversion_error(f"Invalid operation type: {operation_type}")

        # Validate rotation
        if operation_type == "rotate" and rotation not in [0, 90, 180, 270]:
            raise_conversion_error(f"Invalid rotation angle: {rotation}")

        logger.info(f"Final operation: {operation_type}")
        logger.info(f"Page numbers: {page_numbers if page_numbers else 'all'}")
        if operation_type == "rotate":
            logger.info(f"Rotation: {rotation}°")

        update_progress(operation_id, 10, "Loading PDF file...")

        # Load PDF file
        try:
            pdf = pikepdf.Pdf.open(input_path)
        except Exception as e:
            raise_conversion_error(f"Failed to load PDF file: {e}")

        total_pages = len(pdf.pages)
        logger.info(f"PDF has {total_pages} pages")

        # If no specific pages provided, use all pages
        if not page_numbers:
            page_numbers = list(range(1, total_pages + 1))
            logger.info(f"Using all pages: {page_numbers}")

        # Validate page numbers
        for page_num in page_numbers:
            if not 1 <= page_num <= total_pages:
                raise_conversion_error(f"Invalid page number: {page_num}")

        update_progress(operation_id, 20, "Performing page operations...")

        # Perform page operations
        try:
            if operation_type == "extract":
                result_pdf = _extract_pages(pdf, page_numbers)
            elif operation_type == "rotate":
                result_pdf = _rotate_pages(pdf, page_numbers, rotation)
            elif operation_type == "remove":
                result_pdf = _remove_pages(pdf, page_numbers)

            logger.info(f"Page operation completed: {operation_type}")

        except Exception as e:
            raise_conversion_error(f"Failed to perform page operation: {e}")

        update_progress(operation_id, 30, "Saving result...")

        # Save result
        try:
            if output_format == "single":
                # Save as single PDF
                result_pdf.save(output_path)
                output_files = [str(output_path)]
                logger.info(f"Saved single PDF: {output_path}")

            else:
                # Save as multiple PDFs (one per page)
                output_files = []
                for i, page_num in enumerate(page_numbers):
                    page_pdf = pikepdf.Pdf.new()
                    page_pdf.pages.append(result_pdf.pages[i])

                    page_output = (
                        output_path.parent / f"{output_prefix}_{page_num:03d}.pdf"
                    )
                    page_pdf.save(page_output)
                    output_files.append(str(page_output))
                    logger.info(f"Saved page PDF: {page_output}")

        except Exception as e:
            raise_conversion_error(f"Failed to save result: {e}")

        update_progress(operation_id, 95, "Finalizing...")

        # Publish success event
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_COMPLETED,
                input_file=str(input_path),
                output_file=str(output_path),
                conversion_type="pdf2pages",
            )
        )

        complete_operation(
            operation_id,
            {
                "output_path": str(output_path),
                "output_files": output_files,
                "operation": operation_type,
                "pages_processed": len(page_numbers),
            },
        )
        logger.info(f"PDF page operations completed: {output_path}")

        return output_path

    except Exception as e:
        logger.exception(f"PDF page operations failed: {e}")
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_FAILED,
                input_file=str(input_path),
                conversion_type="pdf2pages",
            )
        )
        raise_conversion_error(f"PDF page operations failed: {e}")


def _extract_pages(pdf: pikepdf.Pdf, page_numbers: list[int]) -> pikepdf.Pdf:
    """Extract specific pages from PDF."""
    new_pdf = pikepdf.Pdf.new()

    for page_num in page_numbers:
        # Convert to 0-based indexing
        page_index = page_num - 1
        new_pdf.pages.append(pdf.pages[page_index])

    return new_pdf


def _rotate_pages(
    pdf: pikepdf.Pdf, page_numbers: list[int], rotation: int
) -> pikepdf.Pdf:
    """Rotate specific pages in PDF."""
    # Create a copy of the PDF
    new_pdf = pikepdf.Pdf.new()
    new_pdf.pages.extend(pdf.pages)

    for page_num in page_numbers:
        # Convert to 0-based indexing
        page_index = page_num - 1
        page = new_pdf.pages[page_index]

        # Apply rotation
        if rotation == 90:
            page.rotate(90, relative=False)
        elif rotation == 180:
            page.rotate(180, relative=False)
        elif rotation == 270:
            page.rotate(270, relative=False)

    return new_pdf


def _remove_pages(pdf: pikepdf.Pdf, page_numbers: list[int]) -> pikepdf.Pdf:
    """Remove specific pages from PDF."""
    # Create a copy of the PDF
    new_pdf = pikepdf.Pdf.new()
    new_pdf.pages.extend(pdf.pages)

    # Sort page numbers in descending order to avoid index issues
    page_numbers_sorted = sorted(page_numbers, reverse=True)

    for page_num in page_numbers_sorted:
        # Convert to 0-based indexing
        page_index = page_num - 1
        del new_pdf.pages[page_index]

    return new_pdf


def _parse_page_range(page_range: str) -> list[int]:
    """Parse page range string into list of page numbers.

    Supports formats like:
    - "1-5" -> [1, 2, 3, 4, 5]
    - "1,3,5" -> [1, 3, 5]
    - "1-3,5,7-9" -> [1, 2, 3, 5, 7, 8, 9]
    """
    if not page_range.strip():
        return []

    page_numbers = []

    # Split by comma to handle multiple ranges
    parts = page_range.split(",")

    for part in parts:
        part = part.strip()
        if "-" in part:
            # Handle range like "1-5"
            try:
                start, end = map(int, part.split("-"))
                page_numbers.extend(range(start, end + 1))
            except ValueError:
                raise_conversion_error(f"Invalid page range format: {part}")
        else:
            # Handle single page number
            try:
                page_num = int(part)
                page_numbers.append(page_num)
            except ValueError:
                raise_conversion_error(f"Invalid page number: {part}")

    # Remove duplicates and sort
    return sorted(list(set(page_numbers)))
