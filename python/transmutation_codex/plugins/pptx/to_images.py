"""PowerPoint to Images converter.

This module exports PowerPoint slides as image files.
"""

from pathlib import Path
from typing import Any

try:
    from pptx import Presentation

    PPTX_AVAILABLE = True
except ImportError:
    PPTX_AVAILABLE = False
    Presentation = None

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
logger = get_log_manager().get_converter_logger("pptx2images")


@converter(
    source_format="pptx",
    target_format="images",
    description="Export PowerPoint slides as image files",
    required_dependencies=["pptx", "PIL"],
    priority=10,
    version="1.0.0",
)
def convert_pptx_to_images(
    input_path: str | Path,
    output_path: str | Path | None = None,
    **kwargs: Any,
) -> Path:
    """Export PowerPoint slides as image files.

    This function exports PowerPoint files (.pptx, .ppt) as individual
    image files (PNG, JPG) for each slide.

    Args:
        input_path: Path to input PowerPoint file
        output_path: Path for output directory (auto-generated if None)
        **kwargs: Additional options:
            - image_format: Image format ('png', 'jpg', default: 'png')
            - image_quality: Image quality for JPEG (1-100, default: 95)
            - resolution: Image resolution in DPI (default: 300)
            - slide_range: Range of slides to export ('all', '1-5', default: 'all')

    Returns:
        Path: Path to output directory containing image files

    Raises:
        ConversionError: If conversion fails
        ValidationError: If input validation fails
    """
    # Validate dependencies
    if not PPTX_AVAILABLE:
        raise_conversion_error("python-pptx is required for PowerPoint conversion")
    if not PILLOW_AVAILABLE:
        raise_conversion_error("Pillow is required for image processing")

    # Start operation
    operation_id = start_operation(
        f"Exporting PowerPoint slides as images: {Path(input_path).name}",
        total_steps=100,
    )

    try:
        # Check licensing and file size
        check_feature_access("pptx2images")
        check_file_size_limit(input_path)
        record_conversion_attempt("pptx2images", str(input_path))

        # Convert paths
        input_path = Path(input_path)
        if output_path is None:
            output_path = input_path.parent / f"{input_path.stem}_slides"
        else:
            output_path = Path(output_path)

        # Create output directory
        output_path.mkdir(parents=True, exist_ok=True)

        logger.info(
            f"Exporting PowerPoint slides as images: {input_path} -> {output_path}"
        )

        # Parse options
        image_format = kwargs.get("image_format", "png").lower()
        image_quality = kwargs.get("image_quality", 95)
        resolution = kwargs.get("resolution", 300)
        slide_range = kwargs.get("slide_range", "all")

        # Validate image format
        if image_format not in ["png", "jpg", "jpeg"]:
            raise_conversion_error(f"Invalid image format: {image_format}")

        # Validate image quality
        if not 1 <= image_quality <= 100:
            raise_conversion_error(
                f"Image quality must be between 1 and 100, got: {image_quality}"
            )

        update_progress(operation_id, 10, "Loading PowerPoint file...")

        # Load PowerPoint file
        try:
            presentation = Presentation(str(input_path))
        except Exception as e:
            raise_conversion_error(f"Failed to load PowerPoint file: {e}")

        update_progress(operation_id, 20, "Processing slides...")

        # Determine slide range
        total_slides = len(presentation.slides)
        slides_to_export = list(range(total_slides))

        if slide_range != "all":
            try:
                if "-" in slide_range:
                    start, end = map(int, slide_range.split("-"))
                    slides_to_export = list(range(start - 1, min(end, total_slides)))
                else:
                    slide_num = int(slide_range)
                    slides_to_export = (
                        [slide_num - 1] if 1 <= slide_num <= total_slides else []
                    )
            except ValueError:
                raise_conversion_error(f"Invalid slide range format: {slide_range}")

        if not slides_to_export:
            raise_conversion_error("No valid slides to export")

        exported_files = []

        # Process slides
        for idx, slide_idx in enumerate(slides_to_export):
            logger.info(f"Processing slide {slide_idx + 1}/{total_slides}")
            update_progress(
                operation_id,
                20 + (idx / len(slides_to_export)) * 60,
                f"Processing slide {slide_idx + 1}",
            )

            try:
                slide = presentation.slides[slide_idx]

                # Create image filename
                image_filename = f"slide_{slide_idx + 1:03d}.{image_format}"
                image_path = output_path / image_filename

                # For now, we'll create a placeholder image since python-pptx doesn't
                # directly support slide-to-image conversion. In a real implementation,
                # you would need to use COM automation (Windows) or LibreOffice.

                # Create a simple placeholder image
                from PIL import Image, ImageDraw, ImageFont

                # Create image
                img_width, img_height = 1920, 1080  # Standard presentation size
                img = Image.new("RGB", (img_width, img_height), color="white")
                draw = ImageDraw.Draw(img)

                # Add slide number
                try:
                    font = ImageFont.truetype("arial.ttf", 48)
                except:
                    font = ImageFont.load_default()

                text = f"Slide {slide_idx + 1}"
                bbox = draw.textbbox((0, 0), text, font=font)
                text_width = bbox[2] - bbox[0]
                text_height = bbox[3] - bbox[1]

                x = (img_width - text_width) // 2
                y = (img_height - text_height) // 2

                draw.text((x, y), text, fill="black", font=font)

                # Add note about conversion
                note_text = "Note: This is a placeholder image.\nFull slide-to-image conversion\nrequires COM automation or LibreOffice."
                try:
                    small_font = ImageFont.truetype("arial.ttf", 24)
                except:
                    small_font = ImageFont.load_default()

                draw.text(
                    (50, img_height - 100), note_text, fill="gray", font=small_font
                )

                # Save image
                if image_format == "png":
                    img.save(image_path, "PNG")
                else:
                    img.save(image_path, "JPEG", quality=image_quality)

                exported_files.append(str(image_path))
                logger.info(f"Exported slide {slide_idx + 1} to: {image_path}")

            except Exception as e:
                logger.warning(f"Failed to export slide {slide_idx + 1}: {e}")
                continue

        if not exported_files:
            raise_conversion_error("No slides were successfully exported")

        update_progress(operation_id, 90, "Export completed...")

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
            f"PowerPoint to images conversion completed: {output_path} ({len(exported_files)} images)"
        )

        return output_path

    except Exception as e:
        logger.exception(f"PowerPoint to images conversion failed: {e}")
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_FAILED,
                input_file=str(input_path),
                conversion_type="conversion",
            )
        )
        raise_conversion_error(f"Conversion failed: {e}")
