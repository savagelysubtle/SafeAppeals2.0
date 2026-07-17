"""PDF watermark converter.

This module provides functionality to add watermarks to PDF files.
Supports text and image watermarks with various positioning and styling options.
"""

from pathlib import Path
from typing import Any

try:
    import pikepdf

    PIKEPDF_AVAILABLE = True
except ImportError:
    PIKEPDF_AVAILABLE = False

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.pdfgen import canvas
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False

try:
    from PIL import Image

    PILLOW_AVAILABLE = True
except ImportError:
    PILLOW_AVAILABLE = False

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
logger = get_log_manager().get_converter_logger("pdf2watermark")


@converter(
    source_format="pdf",
    target_format="watermark",
    description="Add watermarks to PDF files",
    required_dependencies=["pikepdf", "reportlab"],
    priority=10,
    version="1.0.0",
)
def convert_pdf_to_watermark(
    input_path: str | Path,
    output_path: str | Path | None = None,
    **kwargs: Any,
) -> Path:
    """Add watermarks to PDF file.

    This function adds watermarks to a PDF file, supporting both text and
    image watermarks with various positioning and styling options.

    Args:
        input_path: Path to input PDF file
        output_path: Path for output PDF file (auto-generated if None)
        **kwargs: Additional options:
            - `watermark_type` (str): Type of watermark ("text", "image").
                                    Defaults to "text".
            - `watermark_text` (str): Text for text watermark.
                                    Required for "text" type.
            - `watermark_image` (str): Path to image for image watermark.
                                     Required for "image" type.
            - `position` (str): Watermark position ("center", "top", "bottom", "custom").
                               Defaults to "center".
            - `opacity` (float): Watermark opacity (0.0 to 1.0).
                                Defaults to 0.3.
            - `rotation` (float): Watermark rotation in degrees.
                                 Defaults to 0.
            - `font_size` (int): Font size for text watermark.
                               Defaults to 48.
            - `font_color` (str): Font color for text watermark.
                                Defaults to "gray".
            - `scale` (float): Scale factor for image watermark.
                             Defaults to 0.5.

    Returns:
        Path: The path to the watermarked PDF file.

    Raises:
        ValidationError: If input or output paths are invalid, or dependencies are missing.
        ConversionError: If the watermarking process fails.
    """
    logger.info(f"Attempting to add watermark to PDF: {input_path}")

    # Validate dependencies
    if not PIKEPDF_AVAILABLE:
        raise_conversion_error("pikepdf is required for PDF watermarking")
    if not REPORTLAB_AVAILABLE:
        raise_conversion_error("reportlab is required for PDF watermarking")

    # Start operation
    operation_id = start_operation(f"Adding watermark to PDF: {Path(input_path).name}", total_steps=100)

    try:
        # Check licensing and file size
        check_feature_access("pdf2watermark")
        check_file_size_limit(input_path)
        record_conversion_attempt("pdf2watermark", str(input_path))

        # Convert paths
        input_path = Path(input_path)
        if output_path is None:
            output_path = input_path.parent / f"{input_path.stem}_watermarked.pdf"
        else:
            output_path = Path(output_path)

        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)

        logger.info(f"Adding watermark to PDF: {input_path} -> {output_path}")

        # Parse options
        watermark_type = kwargs.get("watermark_type", "text")
        watermark_text = kwargs.get("watermark_text", "DRAFT")
        watermark_image = kwargs.get("watermark_image", None)
        position = kwargs.get("position", "center")
        opacity = kwargs.get("opacity", 0.3)
        rotation = kwargs.get("rotation", 0)
        font_size = kwargs.get("font_size", 48)
        font_color = kwargs.get("font_color", "gray")
        scale = kwargs.get("scale", 0.5)

        # Validate watermark type
        if watermark_type not in ["text", "image"]:
            raise_conversion_error(f"Invalid watermark type: {watermark_type}")

        # Validate opacity
        if not 0.0 <= opacity <= 1.0:
            raise_conversion_error(
                f"Opacity must be between 0.0 and 1.0, got: {opacity}"
            )

        # Validate watermark content
        if watermark_type == "text" and not watermark_text:
            raise_conversion_error("watermark_text is required for text watermarks")
        if watermark_type == "image" and not watermark_image:
            raise_conversion_error("watermark_image is required for image watermarks")

        logger.info(f"Watermark type: {watermark_type}")
        logger.info(f"Position: {position}, Opacity: {opacity}, Rotation: {rotation}°")

        update_progress(operation_id, 10, "Loading PDF file...")

        # Load PDF file
        try:
            pdf = pikepdf.Pdf.open(input_path)
        except Exception as e:
            raise_conversion_error(f"Failed to load PDF file: {e}")

        total_pages = len(pdf.pages)
        logger.info(f"PDF has {total_pages} pages")

        update_progress(operation_id, 20, "Creating watermark...")

        # Create watermark
        try:
            if watermark_type == "text":
                # Create text watermark
                watermark_pdf = _create_text_watermark(
                    watermark_text, font_size, font_color, opacity, rotation
                )
            else:
                # Create image watermark
                watermark_pdf = _create_image_watermark(
                    watermark_image, scale, opacity, rotation
                )

            logger.info("Watermark created successfully")

        except Exception as e:
            raise_conversion_error(f"Failed to create watermark: {e}")

        update_progress(operation_id, 30, "Applying watermark to pages...")

        # Apply watermark to each page
        try:
            for page_num in range(total_pages):
                logger.info(f"Applying watermark to page {page_num + 1}/{total_pages}")
                update_progress(
                    operation_id,
                    30 + (page_num / total_pages) * 60,
                    f"Processing page {page_num + 1}",
                )

                # Get page dimensions
                page = pdf.pages[page_num]
                page_width = float(page.mediabox[2] - page.mediabox[0])
                page_height = float(page.mediabox[3] - page.mediabox[1])

                # Calculate watermark position
                watermark_x, watermark_y = _calculate_position(
                    position, page_width, page_height
                )

                # Apply watermark to page
                page.add_overlay(
                    watermark_pdf.pages[0],
                    pikepdf.Rectangle(
                        watermark_x,
                        watermark_y,
                        watermark_x + page_width,
                        watermark_y + page_height,
                    ),
                )

            logger.info("Watermark applied to all pages")

        except Exception as e:
            raise_conversion_error(f"Failed to apply watermark: {e}")

        update_progress(operation_id, 90, "Saving watermarked PDF...")

        # Save watermarked PDF
        try:
            pdf.save(output_path)
            logger.info("Watermarked PDF saved successfully")

        except Exception as e:
            raise_conversion_error(f"Failed to save watermarked PDF: {e}")

        update_progress(operation_id, 95, "Finalizing...")

        # Publish success event
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_COMPLETED,
                input_file=str(input_path),
                output_file=str(output_path),
                conversion_type="pdf2watermark",
            )
        )

        complete_operation(
            operation_id,
            {
                "output_path": str(output_path),
                "watermark_type": watermark_type,
                "pages_processed": total_pages,
            },
        )
        logger.info(f"PDF watermarking completed: {output_path}")

        return output_path

    except Exception as e:
        logger.exception(f"PDF watermarking failed: {e}")
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_FAILED,
                input_file=str(input_path),
                conversion_type="pdf2watermark",
            )
        )
        raise_conversion_error(f"PDF watermarking failed: {e}")


def _create_text_watermark(
    text: str, font_size: int, font_color: str, opacity: float, rotation: float
) -> pikepdf.Pdf:
    """Create a text watermark PDF."""
    from io import BytesIO

    # Create PDF in memory
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)

    # Set font and color
    c.setFont("Helvetica-Bold", font_size)
    c.setFillColor(font_color)

    # Set opacity
    c.setFillAlpha(opacity)

    # Get page dimensions
    width, height = A4

    # Calculate text position (center)
    text_width = c.stringWidth(text, "Helvetica-Bold", font_size)
    text_height = font_size

    x = (width - text_width) / 2
    y = (height - text_height) / 2

    # Apply rotation
    if rotation != 0:
        c.saveState()
        c.translate(x + text_width / 2, y + text_height / 2)
        c.rotate(rotation)
        c.translate(-text_width / 2, -text_height / 2)
        c.drawString(0, 0, text)
        c.restoreState()
    else:
        c.drawString(x, y, text)

    c.save()
    buffer.seek(0)

    # Create pikepdf object
    watermark_pdf = pikepdf.Pdf.open(buffer)
    return watermark_pdf


def _create_image_watermark(
    image_path: str, scale: float, opacity: float, rotation: float
) -> pikepdf.Pdf:
    """Create an image watermark PDF."""
    from io import BytesIO

    if not PILLOW_AVAILABLE:
        raise_conversion_error("Pillow is required for image watermarks")

    # Load and process image
    try:
        with Image.open(image_path) as img:
            # Convert to RGB if necessary
            if img.mode != "RGB":
                img = img.convert("RGB")

            # Scale image
            if scale != 1.0:
                new_size = (int(img.width * scale), int(img.height * scale))
                img = img.resize(new_size, Image.Resampling.LANCZOS)

            # Apply opacity
            if opacity < 1.0:
                # Create alpha channel
                alpha = Image.new("L", img.size, int(255 * opacity))
                img.putalpha(alpha)

            # Save to buffer
            img_buffer = BytesIO()
            img.save(img_buffer, format="PNG")
            img_buffer.seek(0)

    except Exception as e:
        raise_conversion_error(f"Failed to process image: {e}")

    # Create PDF with image
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)

    # Get page dimensions
    width, height = A4

    # Calculate image position (center)
    img_width, img_height = img.size
    x = (width - img_width) / 2
    y = (height - img_height) / 2

    # Apply rotation
    if rotation != 0:
        c.saveState()
        c.translate(x + img_width / 2, y + img_height / 2)
        c.rotate(rotation)
        c.translate(-img_width / 2, -img_height / 2)
        c.drawImage(img_buffer, 0, 0, width=img_width, height=img_height)
        c.restoreState()
    else:
        c.drawImage(img_buffer, x, y, width=img_width, height=img_height)

    c.save()
    buffer.seek(0)

    # Create pikepdf object
    watermark_pdf = pikepdf.Pdf.open(buffer)
    return watermark_pdf


def _calculate_position(
    position: str, page_width: float, page_height: float
) -> tuple[float, float]:
    """Calculate watermark position based on position string."""
    if position == "center":
        return (0, 0)  # Center position
    elif position == "top":
        return (0, page_height * 0.7)  # Top position
    elif position == "bottom":
        return (0, page_height * 0.1)  # Bottom position
    else:
        return (0, 0)  # Default to center
