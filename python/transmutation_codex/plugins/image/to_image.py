"""Image to Image converter.

This module converts between different image formats and applies transformations.
"""

from pathlib import Path
from typing import Any

try:
    from PIL import Image, ImageEnhance, ImageFilter, ImageOps

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
logger = get_log_manager().get_converter_logger("image2image")


@converter(
    source_format="image",
    target_format="image",
    description="Convert between image formats and apply transformations",
    required_dependencies=["PIL"],
    priority=10,
    version="1.0.0",
)
def convert_image_to_image(
    input_path: str | Path,
    output_path: str | Path | None = None,
    **kwargs: Any,
) -> Path:
    """Convert between image formats and apply transformations.

    This function converts images between different formats and applies
    various transformations like resizing, compression, and filters.

    Args:
        input_path: Path to input image file
        output_path: Path for output image file (auto-generated if None)
        **kwargs: Additional options:
            - output_format: Output format ('png', 'jpg', 'jpeg', 'bmp', 'tiff', 'webp', default: 'png')
            - quality: Image quality for JPEG (1-100, default: 95)
            - resize: Resize dimensions ('width,height' or 'scale', default: None)
            - resize_mode: Resize mode ('fit', 'fill', 'stretch', default: 'fit')
            - compress: Compression level (1-100, default: None)
            - filter: Apply filter ('blur', 'sharpen', 'edge', 'emboss', default: None)
            - enhance: Enhancement ('brightness', 'contrast', 'color', 'sharpness', default: None)
            - enhance_factor: Enhancement factor (0.1-3.0, default: 1.0)
            - rotate: Rotation angle in degrees (default: 0)
            - flip: Flip direction ('horizontal', 'vertical', default: None)
            - grayscale: Convert to grayscale (default: False)

    Returns:
        Path: Path to generated image file

    Raises:
        ConversionError: If conversion fails
        ValidationError: If input validation fails
    """
    # Validate dependencies
    if not PILLOW_AVAILABLE:
        raise_conversion_error("Pillow is required for image processing")

    # Start operation
    operation_id = start_operation(
        f"Converting image: {Path(input_path).name}", total_steps=100
    )

    try:
        # Check licensing and file size
        check_feature_access("image2image")
        check_file_size_limit(input_path)
        record_conversion_attempt("image2image", str(input_path))

        # Convert paths
        input_path = Path(input_path)
        if output_path is None:
            output_path = input_path.with_suffix(".png")
        else:
            output_path = Path(output_path)

        logger.info(f"Converting image: {input_path} -> {output_path}")

        # Parse options
        output_format = kwargs.get("output_format", "png").lower()
        quality = kwargs.get("quality", 95)
        resize = kwargs.get("resize", None)
        resize_mode = kwargs.get("resize_mode", "fit")
        compress = kwargs.get("compress", None)
        filter_name = kwargs.get("filter", None)
        enhance = kwargs.get("enhance", None)
        enhance_factor = kwargs.get("enhance_factor", 1.0)
        rotate = kwargs.get("rotate", 0)
        flip = kwargs.get("flip", None)
        grayscale = kwargs.get("grayscale", False)

        # Validate output format
        if output_format not in ["png", "jpg", "jpeg", "bmp", "tiff", "webp"]:
            raise_conversion_error(f"Invalid output format: {output_format}")

        # Validate quality
        if not 1 <= quality <= 100:
            raise_conversion_error(f"Quality must be between 1 and 100, got: {quality}")

        # Validate resize mode
        if resize_mode not in ["fit", "fill", "stretch"]:
            raise_conversion_error(f"Invalid resize mode: {resize_mode}")

        # Validate filter
        if filter_name and filter_name not in ["blur", "sharpen", "edge", "emboss"]:
            raise_conversion_error(f"Invalid filter: {filter_name}")

        # Validate enhancement
        if enhance and enhance not in ["brightness", "contrast", "color", "sharpness"]:
            raise_conversion_error(f"Invalid enhancement: {enhance}")

        # Validate enhancement factor
        if not 0.1 <= enhance_factor <= 3.0:
            raise_conversion_error(
                f"Enhancement factor must be between 0.1 and 3.0, got: {enhance_factor}"
            )

        # Validate flip
        if flip and flip not in ["horizontal", "vertical"]:
            raise_conversion_error(f"Invalid flip direction: {flip}")

        update_progress(operation_id, 10, "Loading image...")

        # Open image
        try:
            with Image.open(input_path) as pil_image:
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

                update_progress(operation_id, 20, "Applying transformations...")

                # Apply transformations
                if resize:
                    if resize.startswith("scale"):
                        # Scale by factor
                        try:
                            scale_factor = float(resize.split(":")[1])
                            new_size = (
                                int(pil_image.width * scale_factor),
                                int(pil_image.height * scale_factor),
                            )
                        except (IndexError, ValueError):
                            raise_conversion_error(f"Invalid scale format: {resize}")
                    else:
                        # Specific dimensions
                        try:
                            width, height = map(int, resize.split(","))
                            new_size = (width, height)
                        except ValueError:
                            raise_conversion_error(f"Invalid resize format: {resize}")

                    if resize_mode == "fit":
                        pil_image = pil_image.resize(new_size, Image.Resampling.LANCZOS)
                    elif resize_mode == "fill":
                        pil_image = ImageOps.fit(
                            pil_image, new_size, Image.Resampling.LANCZOS
                        )
                    else:  # stretch
                        pil_image = pil_image.resize(new_size, Image.Resampling.LANCZOS)

                # Apply rotation
                if rotate != 0:
                    pil_image = pil_image.rotate(rotate, expand=True)

                # Apply flip
                if flip == "horizontal":
                    pil_image = pil_image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
                elif flip == "vertical":
                    pil_image = pil_image.transpose(Image.Transpose.FLIP_TOP_BOTTOM)

                # Convert to grayscale
                if grayscale:
                    pil_image = pil_image.convert("L")

                # Apply filters
                if filter_name:
                    if filter_name == "blur":
                        pil_image = pil_image.filter(ImageFilter.BLUR)
                    elif filter_name == "sharpen":
                        pil_image = pil_image.filter(ImageFilter.SHARPEN)
                    elif filter_name == "edge":
                        pil_image = pil_image.filter(ImageFilter.EDGE_ENHANCE)
                    elif filter_name == "emboss":
                        pil_image = pil_image.filter(ImageFilter.EMBOSS)

                # Apply enhancements
                if enhance:
                    if enhance == "brightness":
                        enhancer = ImageEnhance.Brightness(pil_image)
                        pil_image = enhancer.enhance(enhance_factor)
                    elif enhance == "contrast":
                        enhancer = ImageEnhance.Contrast(pil_image)
                        pil_image = enhancer.enhance(enhance_factor)
                    elif enhance == "color":
                        enhancer = ImageEnhance.Color(pil_image)
                        pil_image = enhancer.enhance(enhance_factor)
                    elif enhance == "sharpness":
                        enhancer = ImageEnhance.Sharpness(pil_image)
                        pil_image = enhancer.enhance(enhance_factor)

                update_progress(operation_id, 80, "Saving image...")

                # Save image
                save_kwargs = {}
                if output_format in ["jpg", "jpeg"]:
                    save_kwargs["quality"] = quality
                    save_kwargs["optimize"] = True
                elif output_format == "png" and compress:
                    save_kwargs["compress_level"] = compress

                pil_image.save(output_path, format=output_format.upper(), **save_kwargs)

        except Exception as e:
            raise_conversion_error(f"Failed to process image: {e}")

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

        complete_operation(operation_id, {"output_path": str(output_path)})
        logger.info(f"Image to image conversion completed: {output_path}")

        return output_path

    except Exception as e:
        logger.exception(f"Image to image conversion failed: {e}")
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_FAILED,
                input_file=str(input_path),
                conversion_type="conversion",
            )
        )
        raise_conversion_error(f"Conversion failed: {e}")
