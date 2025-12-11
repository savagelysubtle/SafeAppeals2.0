"""Image to Text converter (OCR).

This module extracts text from images using OCR technology.
"""

from pathlib import Path
from typing import Any

try:
    import pytesseract

    PYTESSERACT_AVAILABLE = True
except ImportError:
    PYTESSERACT_AVAILABLE = False
    pytesseract = None

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
logger = get_log_manager().get_converter_logger("image2text")


@converter(
    source_format="image",
    target_format="text",
    description="Extract text from images using OCR",
    required_dependencies=["pytesseract", "PIL"],
    priority=10,
    version="1.0.0",
)
def convert_image_to_text(
    input_path: str | Path,
    output_path: str | Path | None = None,
    **kwargs: Any,
) -> Path:
    """Extract text from images using OCR.

    This function extracts text from image files using Tesseract OCR,
    supporting multiple languages and output formats.

    Args:
        input_path: Path to input image file or directory containing images
        output_path: Path for output text file (auto-generated if None)
        **kwargs: Additional options:
            - language: OCR language code (default: 'eng')
            - output_format: Output format ('txt', 'hocr', 'tsv', default: 'txt')
            - dpi: Image DPI for OCR (default: 300)
            - preprocess: Image preprocessing ('none', 'grayscale', 'threshold', default: 'grayscale')
            - confidence_threshold: Minimum confidence for text (default: 0)

    Returns:
        Path: Path to generated text file

    Raises:
        ConversionError: If conversion fails
        ValidationError: If input validation fails
    """
    # Validate dependencies
    if not PYTESSERACT_AVAILABLE:
        raise_conversion_error("pytesseract is required for OCR")
    if not PILLOW_AVAILABLE:
        raise_conversion_error("Pillow is required for image processing")

    # Start operation
    operation_id = start_operation(
        f"Extracting text from images: {Path(input_path).name}", total_steps=100
    )

    try:
        # Check licensing and file size
        check_feature_access("image2text")
        check_file_size_limit(input_path)
        record_conversion_attempt("image2text", str(input_path))

        # Convert paths
        input_path = Path(input_path)
        if output_path is None:
            output_path = input_path.with_suffix(".txt")
        else:
            output_path = Path(output_path)

        logger.info(f"Extracting text from images: {input_path} -> {output_path}")

        # Parse options
        language = kwargs.get("language", "eng")
        output_format = kwargs.get("output_format", "txt")
        dpi = kwargs.get("dpi", 300)
        preprocess = kwargs.get("preprocess", "grayscale")
        confidence_threshold = kwargs.get("confidence_threshold", 0)

        # Validate output format
        if output_format not in ["txt", "hocr", "tsv"]:
            raise_conversion_error(f"Invalid output format: {output_format}")

        # Validate preprocessing
        if preprocess not in ["none", "grayscale", "threshold"]:
            raise_conversion_error(f"Invalid preprocessing option: {preprocess}")

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

        update_progress(operation_id, 20, "Processing images...")

        # Process each image
        total_images = len(image_files)
        extracted_texts = []

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
                # Open and preprocess image
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

                    # Apply preprocessing
                    if preprocess == "grayscale":
                        pil_image = pil_image.convert("L")
                    elif preprocess == "threshold":
                        pil_image = pil_image.convert("L")
                        # Apply threshold
                        threshold = 128
                        pil_image = pil_image.point(
                            lambda x: 255 if x > threshold else 0, mode="1"
                        )

                    # Perform OCR
                    if output_format == "txt":
                        text = pytesseract.image_to_string(
                            pil_image, lang=language, config=f"--dpi {dpi}"
                        )
                    elif output_format == "hocr":
                        text = pytesseract.image_to_pdf_or_hocr(
                            pil_image,
                            lang=language,
                            config=f"--dpi {dpi}",
                            extension="hocr",
                        )
                    else:  # tsv
                        text = pytesseract.image_to_data(
                            pil_image,
                            lang=language,
                            config=f"--dpi {dpi}",
                            output_type=pytesseract.Output.TSV,
                        )

                    # Add image header
                    extracted_texts.append(f"=== {img_path.name} ===")
                    extracted_texts.append("")
                    extracted_texts.append(text)
                    extracted_texts.append("")

            except Exception as e:
                logger.warning(f"Failed to process image {img_path}: {e}")
                extracted_texts.append(f"=== {img_path.name} ===")
                extracted_texts.append("")
                extracted_texts.append(f"Error processing image: {e}")
                extracted_texts.append("")
                continue

        if not extracted_texts:
            raise_conversion_error("No text was successfully extracted")

        update_progress(operation_id, 90, "Writing text file...")

        # Write text file
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(extracted_texts))

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
            f"Image to text conversion completed: {output_path} ({len(image_files)} images)"
        )

        return output_path

    except Exception as e:
        logger.exception(f"Image to text conversion failed: {e}")
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_FAILED,
                input_file=str(input_path),
                conversion_type="conversion",
            )
        )
        raise_conversion_error(f"Conversion failed: {e}")
