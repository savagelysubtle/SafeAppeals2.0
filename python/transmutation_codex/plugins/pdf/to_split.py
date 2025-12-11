"""PDF split converter.

This module provides functionality to split PDF files into multiple smaller PDFs.
Supports splitting by page ranges, individual pages, or fixed page counts.
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
logger = get_log_manager().get_converter_logger("pdf2split")


@converter(
    source_format="pdf",
    target_format="split",
    description="Split PDF into multiple smaller PDFs",
    required_dependencies=["pikepdf"],
    priority=10,
    version="1.0.0",
)
def convert_pdf_to_split(
    input_path: str | Path,
    output_path: str | Path | None = None,
    **kwargs: Any,
) -> Path:
    """Split PDF file into multiple smaller PDFs.

    This function splits a PDF file into multiple smaller PDFs based on
    various criteria like page ranges, individual pages, or fixed page counts.

    Args:
        input_path: Path to input PDF file
        output_path: Path for output directory (auto-generated if None)
        **kwargs: Additional options:
            - `split_mode` (str): Split mode ("pages", "ranges", "count").
                                 Defaults to "pages".
            - `page_ranges` (list): List of page ranges (e.g., ["1-5", "6-10"]).
                                   Required for "ranges" mode.
            - `page_numbers` (list): List of individual page numbers.
                                    Required for "pages" mode.
            - `pages_per_file` (int): Number of pages per output file.
                                     Required for "count" mode.
            - `output_prefix` (str): Prefix for output files.
                                    Defaults to "page".

    Returns:
        Path: The directory containing the split PDF files.

    Raises:
        ValidationError: If input or output paths are invalid, or dependencies are missing.
        ConversionError: If the splitting process fails.
    """
    logger.info(f"Attempting to split PDF: {input_path}")

    # Validate dependencies
    if not PIKEPDF_AVAILABLE:
        raise_conversion_error("pikepdf is required for PDF splitting")

    # Start operation
    operation_id = start_operation(
        f"Splitting PDF: {Path(input_path).name}", total_steps=100
    )

    try:
        # Check licensing and file size
        check_feature_access("pdf2split")
        check_file_size_limit(input_path)
        record_conversion_attempt("pdf2split", str(input_path))

        # Convert paths
        input_path = Path(input_path)
        if output_path is None:
            output_path = input_path.parent / f"{input_path.stem}_split"
        else:
            output_path = Path(output_path)

        # Create output directory
        output_path.mkdir(parents=True, exist_ok=True)

        logger.info(f"Splitting PDF: {input_path} -> {output_path}")

        # Parse options
        split_mode = kwargs.get("split_mode", "pages")
        page_ranges = kwargs.get("page_ranges", [])
        page_numbers = kwargs.get("page_numbers", [])
        pages_per_file = kwargs.get("pages_per_file", 1)
        output_prefix = kwargs.get("output_prefix", "page")

        update_progress(operation_id, 10, "Loading PDF file...")

        # Load PDF file
        try:
            pdf = pikepdf.Pdf.open(input_path)
        except Exception as e:
            raise_conversion_error(f"Failed to load PDF file: {e}")

        total_pages = len(pdf.pages)
        logger.info(f"PDF has {total_pages} pages")

        update_progress(operation_id, 20, "Processing split configuration...")

        # Determine split configuration
        split_configs = []

        if split_mode == "pages":
            # Split by individual pages
            if not page_numbers:
                # If no specific pages, split every page
                page_numbers = list(range(1, total_pages + 1))

            for page_num in page_numbers:
                if 1 <= page_num <= total_pages:
                    split_configs.append(
                        {
                            "pages": [page_num - 1],  # Convert to 0-based
                            "name": f"{output_prefix}_{page_num:03d}.pdf",
                        }
                    )

        elif split_mode == "ranges":
            # Split by page ranges
            if not page_ranges:
                raise_conversion_error("page_ranges must be provided for 'ranges' mode")

            for i, page_range in enumerate(page_ranges):
                if "-" in page_range:
                    start, end = map(int, page_range.split("-"))
                    pages = list(range(start - 1, end))  # Convert to 0-based
                else:
                    pages = [int(page_range) - 1]  # Convert to 0-based

                split_configs.append(
                    {"pages": pages, "name": f"{output_prefix}_range_{i + 1:03d}.pdf"}
                )

        elif split_mode == "count":
            # Split by fixed page count
            for start_page in range(0, total_pages, pages_per_file):
                end_page = min(start_page + pages_per_file, total_pages)
                pages = list(range(start_page, end_page))

                split_configs.append(
                    {
                        "pages": pages,
                        "name": f"{output_prefix}_{start_page + 1:03d}-{end_page:03d}.pdf",
                    }
                )

        else:
            raise_conversion_error(f"Invalid split mode: {split_mode}")

        logger.info(f"Will create {len(split_configs)} split files")

        update_progress(operation_id, 30, "Creating split files...")

        # Create split files
        output_files = []
        for i, config in enumerate(split_configs):
            logger.info(f"Creating split file: {config['name']}")
            update_progress(
                operation_id,
                30 + (i / len(split_configs)) * 60,
                f"Creating {config['name']}",
            )

            try:
                # Create new PDF with selected pages
                new_pdf = pikepdf.Pdf.new()
                new_pdf.pages.extend([pdf.pages[page] for page in config["pages"]])

                # Save split file
                output_file = output_path / config["name"]
                new_pdf.save(output_file)
                output_files.append(str(output_file))

                logger.info(f"Created: {output_file}")

            except Exception as e:
                logger.error(f"Failed to create {config['name']}: {e}")
                continue

        update_progress(operation_id, 95, "Finalizing...")

        # Publish success event
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_COMPLETED,
                input_file=str(input_path),
                output_file=str(output_path),
                conversion_type="pdf2split",
            )
        )

        complete_operation(
            operation_id,
            {
                "output_path": str(output_path),
                "files": output_files,
                "split_count": len(output_files),
            },
        )
        logger.info(
            f"PDF splitting completed: {output_path} ({len(output_files)} files)"
        )

        return output_path

    except Exception as e:
        logger.exception(f"PDF splitting failed: {e}")
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_FAILED,
                input_file=str(input_path),
                conversion_type="pdf2split",
            )
        )
        raise_conversion_error(f"PDF splitting failed: {e}")
