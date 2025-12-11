"""PDF to Images converter.

This module converts PDF pages to image files.
"""

from pathlib import Path
from typing import Any

try:
    from pdf2image import convert_from_path

    PDF2IMAGE_AVAILABLE = True
except ImportError:
    PDF2IMAGE_AVAILABLE = False
    convert_from_path = None

try:
    from PIL import Image

    PILLOW_AVAILABLE = True
except ImportError:
    PILLOW_AVAILABLE = False
    Image = None

from transmutation_codex.core import (
    ConversionEvent,
    EventTypes,
    check_feature_access,
    check_file_size_limit,
    complete_operation,
    get_log_manager,
    publish,
    raise_conversion_error,
    record_conversion_attempt,
    start_operation,
    update_progress,
)
from transmutation_codex.core.decorators import converter

# Setup logger
logger = get_log_manager().get_converter_logger("pdf2images")


@converter(
    source_format="pdf",
    target_format="images",
    description="Convert PDF pages to image files",
    required_dependencies=["pdf2image", "PIL"],
    priority=10,
    version="1.0.0",
)
def convert_pdf_to_images(
    input_path: str | Path,
    output_path: str | Path | None = None,
    **kwargs: Any,
) -> Path:
    """Convert PDF pages to image files.

    This function converts PDF files to individual image files for each page,
    supporting various image formats and quality settings.

    Args:
        input_path: Path to input PDF file
        output_path: Path for output directory (auto-generated if None)
        **kwargs: Additional options:
            - image_format: Image format ('png', 'jpg', 'jpeg', 'tiff', default: 'png')
            - dpi: Image resolution in DPI (default: 300)
            - quality: Image quality for JPEG (1-100, default: 95)
            - page_range: Page range to convert ('all', '1-5', '1,3,5', default: 'all')
            - first_page: First page to convert (default: 1)
            - last_page: Last page to convert (default: None)
            - output_prefix: Prefix for output files (default: 'page')

    Returns:
        Path: Path to output directory containing image files

    Raises:
        ConversionError: If conversion fails
        ValidationError: If input validation fails
    """
    # Validate dependencies
    if not PDF2IMAGE_AVAILABLE:
        raise_conversion_error("pdf2image is required for PDF to image conversion")
    if not PILLOW_AVAILABLE:
        raise_conversion_error("Pillow is required for image processing")

    # Start operation
    operation_id = start_operation(
        f"Converting PDF to images: {Path(input_path).name}", total_steps=100
    )

    try:
        # Check licensing and file size
        check_feature_access("pdf2images")
        check_file_size_limit(input_path)
        record_conversion_attempt("pdf2images", str(input_path))

        # Convert paths
        input_path = Path(input_path)
        if output_path is None:
            output_path = input_path.parent / f"{input_path.stem}_pages"
        else:
            output_path = Path(output_path)

        # Create output directory
        output_path.mkdir(parents=True, exist_ok=True)

        logger.info(f"Converting PDF to images: {input_path} -> {output_path}")

        # Parse options
        image_format = kwargs.get("image_format", "png").lower()
        dpi = kwargs.get("dpi", 300)
        quality = kwargs.get("quality", 95)
        page_range = kwargs.get("page_range", "all")
        first_page = kwargs.get("first_page", 1)
        last_page = kwargs.get("last_page", None)
        output_prefix = kwargs.get("output_prefix", "page")

        # Validate image format
        if image_format not in ["png", "jpg", "jpeg", "tiff"]:
            raise_conversion_error(f"Invalid image format: {image_format}")

        # Validate quality
        if not 1 <= quality <= 100:
            raise_conversion_error(f"Quality must be between 1 and 100, got: {quality}")

        # Validate DPI
        if not 50 <= dpi <= 1200:
            raise_conversion_error(f"DPI must be between 50 and 1200, got: {dpi}")

        update_progress(operation_id, 10, "Loading PDF file...")

        # Determine page range
        if page_range == "all":
            pages = None
        elif "-" in page_range:
            # Range format: "1-5"
            try:
                start, end = map(int, page_range.split("-"))
                pages = list(range(start - 1, end))  # Convert to 0-based indexing
            except ValueError:
                raise_conversion_error(f"Invalid page range format: {page_range}")
        elif "," in page_range:
            # List format: "1,3,5"
            try:
                pages = [
                    int(p) - 1 for p in page_range.split(",")
                ]  # Convert to 0-based indexing
            except ValueError:
                raise_conversion_error(f"Invalid page range format: {page_range}")
        else:
            # Single page
            try:
                page_num = int(page_range)
                pages = [page_num - 1]  # Convert to 0-based indexing
            except ValueError:
                raise_conversion_error(f"Invalid page range format: {page_range}")

        # Apply first_page and last_page if specified
        if first_page is not None or last_page is not None:
            if pages is None:
                # Convert all pages first, then filter
                try:
                    # Get total page count
                    from pdf2image import convert_from_path

                    test_images = convert_from_path(
                        str(input_path), first_page=1, last_page=1
                    )
                    total_pages = len(test_images)
                    pages = list(range(total_pages))
                except Exception as e:
                    raise_conversion_error(f"Failed to determine PDF page count: {e}")

            # Filter pages
            if first_page is not None:
                pages = [p for p in pages if p >= first_page - 1]
            if last_page is not None:
                pages = [p for p in pages if p < last_page]

        update_progress(operation_id, 20, "Converting PDF pages...")

        # Convert PDF to images
        try:
            if pages is None:
                # Convert all pages
                images = convert_from_path(str(input_path), dpi=dpi, fmt=image_format)
            else:
                # Convert specific pages
                images = convert_from_path(
                    str(input_path),
                    dpi=dpi,
                    fmt=image_format,
                    first_page=min(pages) + 1,  # Convert back to 1-based
                    last_page=max(pages) + 1,  # Convert back to 1-based
                )
                # Filter to only requested pages
                images = [images[i] for i in range(len(pages)) if i < len(images)]

        except Exception as e:
            raise_conversion_error(f"Failed to convert PDF to images: {e}")

        if not images:
            raise_conversion_error("No pages were converted")

        update_progress(operation_id, 60, "Saving images...")

        # Save images
        exported_files = []
        for i, image in enumerate(images):
            logger.info(f"Saving page {i + 1}/{len(images)}")
            update_progress(
                operation_id, 60 + (i / len(images)) * 30, f"Saving page {i + 1}"
            )

            # Determine page number
            if pages is None:
                page_num = i + 1
            else:
                page_num = pages[i] + 1

            # Create filename
            image_filename = f"{output_prefix}_{page_num:03d}.{image_format}"
            image_path = output_path / image_filename

            # Save image
            save_kwargs = {}
            if image_format in ["jpg", "jpeg"]:
                save_kwargs["quality"] = quality
                save_kwargs["optimize"] = True

            image.save(image_path, **save_kwargs)
            exported_files.append(str(image_path))

        update_progress(operation_id, 90, "Conversion completed...")

        # Publish success event
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_COMPLETED,
                input_file=str(input_path),
                output_file=str(output_path),
                conversion_type="conversion",
            )
        )

        complete_operation(
            operation_id, {"output_path": str(output_path), "files": exported_files}
        )
        logger.info(
            f"PDF to images conversion completed: {output_path} ({len(images)} images)"
        )

        return output_path

    except Exception as e:
        logger.exception(f"PDF to images conversion failed: {e}")
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_FAILED,
                input_file=str(input_path),
                conversion_type="conversion",
            )
        )
        raise_conversion_error(f"Conversion failed: {e}")
