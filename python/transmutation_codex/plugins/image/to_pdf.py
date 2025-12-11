"""Image to PDF converter.

This module converts image files to PDF format, supporting multiple images per PDF.
"""

from pathlib import Path
from typing import Any

try:
    from PIL import Image

    PILLOW_AVAILABLE = True
except ImportError:
    PILLOW_AVAILABLE = False
    Image = None

try:
    from reportlab.lib.pagesizes import A4, letter
    from reportlab.lib.units import inch
    from reportlab.platypus import Image as RLImage
    from reportlab.platypus import SimpleDocTemplate

    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False

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
logger = get_log_manager().get_converter_logger("image2pdf")


@converter(
    source_format="image",
    target_format="pdf",
    description="Convert images to PDF format",
    required_dependencies=["PIL", "reportlab"],
    priority=10,
    version="1.0.0",
)
def convert_image_to_pdf(
    input_path: str | Path,
    output_path: str | Path | None = None,
    **kwargs: Any,
) -> Path:
    """Convert image files to PDF format.

    This function converts image files to PDF format, supporting multiple
    images per PDF document.

    Args:
        input_path: Path to input image file or directory containing images
        output_path: Path for output PDF file (auto-generated if None)
        **kwargs: Additional options:
            - page_size: Page size ('A4', 'Letter', default: 'A4')
            - orientation: Page orientation ('portrait', 'landscape', default: 'portrait')
            - fit_mode: How to fit images ('fit', 'fill', 'stretch', default: 'fit')
            - margin: Page margin in inches (default: 0.5)
            - quality: Image quality for PDF (default: 95)

    Returns:
        Path: Path to generated PDF file

    Raises:
        ConversionError: If conversion fails
        ValidationError: If input validation fails
    """
    # Validate dependencies
    if not PILLOW_AVAILABLE:
        raise_conversion_error("Pillow is required for image processing")
    if not REPORTLAB_AVAILABLE:
        raise_conversion_error("reportlab is required for PDF generation")

    # Start operation
    operation_id = start_operation(
        f"Converting images to PDF: {Path(input_path).name}", total_steps=100
    )

    try:
        # Check licensing and file size
        check_feature_access("image2pdf")
        check_file_size_limit(input_path)
        record_conversion_attempt("image2pdf", str(input_path))

        # Convert paths
        input_path = Path(input_path)
        if output_path is None:
            output_path = input_path.with_suffix(".pdf")
        else:
            output_path = Path(output_path)

        logger.info(f"Converting images to PDF: {input_path} -> {output_path}")

        # Parse options
        page_size = kwargs.get("page_size", "A4")
        orientation = kwargs.get("orientation", "portrait")
        fit_mode = kwargs.get("fit_mode", "fit")
        margin = kwargs.get("margin", 0.5)
        quality = kwargs.get("quality", 95)

        # Validate page size
        if page_size.lower() == "a4":
            pagesize = A4
        elif page_size.lower() == "letter":
            pagesize = letter
        else:
            raise_conversion_error(f"Invalid page size: {page_size}")

        # Validate orientation
        if orientation.lower() == "landscape":
            pagesize = (pagesize[1], pagesize[0])  # Swap width/height

        # Validate fit mode
        if fit_mode not in ["fit", "fill", "stretch"]:
            raise_conversion_error(f"Invalid fit mode: {fit_mode}")

        update_progress(operation_id, 10, "Collecting images...")

        # Collect image files
        image_files = []
        if input_path.is_file():
            # Single image file
            if input_path.suffix.lower() in [
                ".png",
                ".jpg",
                ".jpeg",
                ".bmp",
                ".tiff",
                ".gif",
            ]:
                image_files = [input_path]
            else:
                raise_conversion_error(f"Unsupported image format: {input_path.suffix}")
        elif input_path.is_dir():
            # Directory of images
            supported_formats = [".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".gif"]
            for ext in supported_formats:
                image_files.extend(input_path.glob(f"*{ext}"))
                image_files.extend(input_path.glob(f"*{ext.upper()}"))
            image_files.sort()  # Sort for consistent order
        else:
            raise_conversion_error(f"Input path does not exist: {input_path}")

        if not image_files:
            raise_conversion_error("No image files found")

        logger.info(f"Found {len(image_files)} image files")

        update_progress(operation_id, 20, "Creating PDF document...")

        # Create PDF document
        doc = SimpleDocTemplate(
            str(output_path),
            pagesize=pagesize,
            rightMargin=margin * inch,
            leftMargin=margin * inch,
            topMargin=margin * inch,
            bottomMargin=margin * inch,
        )

        story = []

        # Process each image
        total_images = len(image_files)

        for img_idx, img_path in enumerate(image_files):
            logger.info(
                f"Processing image {img_idx + 1}/{total_images}: {img_path.name}"
            )
            update_progress(
                operation_id,
                20 + (img_idx / total_images) * 60,
                f"Processing image {img_idx + 1}",
            )

            try:
                # Open and process image
                with Image.open(img_path) as pil_image:
                    # Convert to RGB if necessary
                    if pil_image.mode in ("RGBA", "LA", "P"):
                        # Create white background
                        background = Image.new("RGB", pil_image.size, (255, 255, 255))
                        if pil_image.mode == "P":
                            pil_image = pil_image.convert("RGBA")
                        background.paste(
                            pil_image,
                            mask=pil_image.split()[-1]
                            if pil_image.mode == "RGBA"
                            else None,
                        )
                        pil_image = background
                    elif pil_image.mode != "RGB":
                        pil_image = pil_image.convert("RGB")

                    # Calculate dimensions
                    img_width, img_height = pil_image.size

                    # Calculate available space on page
                    available_width = pagesize[0] - 2 * margin * inch
                    available_height = pagesize[1] - 2 * margin * inch

                    # Calculate scaling based on fit mode
                    if fit_mode == "fit":
                        # Fit image within page bounds
                        scale_x = available_width / img_width
                        scale_y = available_height / img_height
                        scale = min(scale_x, scale_y)
                    elif fit_mode == "fill":
                        # Fill page (may crop)
                        scale_x = available_width / img_width
                        scale_y = available_height / img_height
                        scale = max(scale_x, scale_y)
                    else:  # stretch
                        # Stretch to fill page
                        scale_x = available_width / img_width
                        scale_y = available_height / img_height
                        scale = min(scale_x, scale_y)  # Use min to avoid distortion

                    # Calculate final dimensions
                    final_width = img_width * scale
                    final_height = img_height * scale

                    # Center image on page
                    x = (available_width - final_width) / 2
                    y = (available_height - final_height) / 2

                    # Create ReportLab Image
                    rl_image = RLImage(
                        str(img_path), width=final_width, height=final_height
                    )
                    rl_image.hAlign = "CENTER"
                    rl_image.vAlign = "MIDDLE"

                    story.append(rl_image)

                    # Add page break if not the last image
                    if img_idx < total_images - 1:
                        from reportlab.platypus.flowables import PageBreak

                        story.append(PageBreak())

            except Exception as e:
                logger.warning(f"Failed to process image {img_path}: {e}")
                continue

        if not story:
            raise_conversion_error("No images were successfully processed")

        update_progress(operation_id, 90, "Generating PDF...")

        # Build PDF
        doc.build(story)

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
            operation_id,
            {"output_path": str(output_path), "images_count": len(image_files)},
        )
        logger.info(
            f"Image to PDF conversion completed: {output_path} ({len(image_files)} images)"
        )

        return output_path

    except Exception as e:
        logger.exception(f"Image to PDF conversion failed: {e}")
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_FAILED,
                input_file=str(input_path),
                conversion_type="conversion",
            )
        )
        raise_conversion_error(f"Conversion failed: {e}")
