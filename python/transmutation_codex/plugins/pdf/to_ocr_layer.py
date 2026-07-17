"""PDF OCR layer converter.

This module provides functionality to add OCR text layers to PDF files.
Converts scanned PDFs to searchable PDFs with invisible text overlay.
"""

from pathlib import Path
from typing import Any

try:
    import pikepdf

    PIKEPDF_AVAILABLE = True
except ImportError:
    PIKEPDF_AVAILABLE = False

try:
    import pytesseract

    PYTESSERACT_AVAILABLE = True
except ImportError:
    PYTESSERACT_AVAILABLE = False

try:
    from pdf2image import convert_from_path

    PDF2IMAGE_AVAILABLE = True
except ImportError:
    PDF2IMAGE_AVAILABLE = False

try:
    from PIL import Image

    PILLOW_AVAILABLE = True
except ImportError:
    PILLOW_AVAILABLE = False

try:
    from reportlab.lib.colors import transparent
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False

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
logger = get_log_manager().get_converter_logger("pdf2ocr")


@converter(
    source_format="pdf",
    target_format="ocr_layer",
    description="Add OCR text layer to PDF for searchability",
    required_dependencies=["pikepdf", "pytesseract", "pdf2image", "reportlab"],
    priority=10,
    version="1.0.0",
)
def convert_pdf_to_ocr_layer(
    input_path: str | Path,
    output_path: str | Path | None = None,
    **kwargs: Any,
) -> Path:
    """Add OCR text layer to PDF file.

    This function adds an invisible OCR text layer to a PDF file, making
    scanned PDFs searchable while preserving the original appearance.

    Args:
        input_path: Path to input PDF file
        output_path: Path for output PDF file (auto-generated if None)
        **kwargs: Additional options:
            - `language` (str): OCR language code (e.g., "eng", "spa", "fra").
                              Defaults to "eng".
            - `dpi` (int): DPI for image conversion.
                          Defaults to 300.
            - `preprocess` (str): Image preprocessing ("none", "grayscale", "threshold").
                                Defaults to "grayscale".
            - `confidence_threshold` (int): Minimum confidence for text extraction.
                                          Defaults to 0.
            - `page_range` (str): Page range to process ("all", "1-5", "1,3,5").
                                Defaults to "all".
            - `preserve_layout` (bool): Whether to preserve text layout.
                                     Defaults to True.

    Returns:
        Path: The path to the OCR-enhanced PDF file.

    Raises:
        ValidationError: If input or output paths are invalid, or dependencies are missing.
        ConversionError: If the OCR process fails.
    """
    logger.info(f"Attempting to add OCR layer to PDF: {input_path}")

    # Validate dependencies
    if not PIKEPDF_AVAILABLE:
        raise_conversion_error("pikepdf is required for PDF OCR")
    if not PYTESSERACT_AVAILABLE:
        raise_conversion_error("pytesseract is required for OCR")
    if not PDF2IMAGE_AVAILABLE:
        raise_conversion_error("pdf2image is required for PDF to image conversion")
    if not PILLOW_AVAILABLE:
        raise_conversion_error("Pillow is required for image processing")
    if not REPORTLAB_AVAILABLE:
        raise_conversion_error("reportlab is required for PDF generation")

    # Start operation
    operation_id = start_operation(
        f"Adding OCR layer to PDF: {Path(input_path).name}", total_steps=100
    )

    try:
        # Check licensing and file size
        check_feature_access("pdf2ocr")
        check_file_size_limit(input_path)
        record_conversion_attempt("pdf2ocr", str(input_path))

        # Convert paths
        input_path = Path(input_path)
        if output_path is None:
            output_path = input_path.parent / f"{input_path.stem}_ocr.pdf"
        else:
            output_path = Path(output_path)

        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)

        logger.info(f"Adding OCR layer to PDF: {input_path} -> {output_path}")

        # Parse options
        language = kwargs.get("language", "eng")
        dpi = kwargs.get("dpi", 300)
        preprocess = kwargs.get("preprocess", "grayscale")
        confidence_threshold = kwargs.get("confidence_threshold", 0)
        page_range = kwargs.get("page_range", "all")
        preserve_layout = kwargs.get("preserve_layout", True)

        # Validate preprocessing
        if preprocess not in ["none", "grayscale", "threshold"]:
            raise_conversion_error(f"Invalid preprocessing option: {preprocess}")

        # Validate DPI
        if not 50 <= dpi <= 1200:
            raise_conversion_error(f"DPI must be between 50 and 1200, got: {dpi}")

        logger.info(f"OCR language: {language}")
        logger.info(f"DPI: {dpi}, Preprocessing: {preprocess}")

        update_progress(operation_id, 10, "Loading PDF file...")

        # Load PDF file
        try:
            pdf = pikepdf.Pdf.open(input_path)
        except Exception as e:
            raise_conversion_error(f"Failed to load PDF file: {e}")

        total_pages = len(pdf.pages)
        logger.info(f"PDF has {total_pages} pages")

        # Determine pages to process
        pages_to_process = _parse_page_range(page_range, total_pages)
        logger.info(f"Processing pages: {pages_to_process}")

        update_progress(operation_id, 20, "Converting pages to images...")

        # Convert PDF pages to images
        try:
            images = convert_from_path(
                input_path,
                dpi=dpi,
                first_page=min(pages_to_process),
                last_page=max(pages_to_process),
            )
            logger.info(f"Converted {len(images)} pages to images")

        except Exception as e:
            raise_conversion_error(f"Failed to convert PDF to images: {e}")

        update_progress(operation_id, 30, "Processing OCR...")

        # Process OCR for each page
        ocr_results = []
        for i, page_num in enumerate(pages_to_process):
            logger.info(f"Processing OCR for page {page_num}")
            update_progress(
                operation_id,
                30 + (i / len(pages_to_process)) * 50,
                f"OCR processing page {page_num}",
            )

            try:
                # Get image for this page
                image = images[i]

                # Preprocess image
                processed_image = _preprocess_image(image, preprocess)

                # Perform OCR
                ocr_data = pytesseract.image_to_data(
                    processed_image,
                    lang=language,
                    output_type=pytesseract.Output.DICT,
                )

                # Filter by confidence
                filtered_data = _filter_ocr_data(ocr_data, confidence_threshold)

                ocr_results.append(
                    {
                        "page_num": page_num,
                        "data": filtered_data,
                        "image_size": processed_image.size,
                    }
                )

                logger.info(f"OCR completed for page {page_num}")

            except Exception as e:
                logger.error(f"OCR failed for page {page_num}: {e}")
                continue

        update_progress(operation_id, 80, "Creating OCR text layer...")

        # Create OCR text layer PDF
        try:
            ocr_layer_pdf = _create_ocr_layer_pdf(ocr_results, preserve_layout)
            logger.info("OCR text layer created")

        except Exception as e:
            raise_conversion_error(f"Failed to create OCR text layer: {e}")

        update_progress(operation_id, 90, "Merging with original PDF...")

        # Merge OCR layer with original PDF
        try:
            # Create overlay
            for i, page_num in enumerate(pages_to_process):
                page_index = page_num - 1
                page = pdf.pages[page_index]

                # Add OCR layer as overlay
                page.add_overlay(
                    ocr_layer_pdf.pages[i],
                    pikepdf.Rectangle(0, 0, page.mediabox[2], page.mediabox[3]),
                )

            logger.info("OCR layer merged with original PDF")

        except Exception as e:
            raise_conversion_error(f"Failed to merge OCR layer: {e}")

        update_progress(operation_id, 95, "Saving OCR-enhanced PDF...")

        # Save OCR-enhanced PDF
        try:
            pdf.save(output_path)
            logger.info("OCR-enhanced PDF saved successfully")

        except Exception as e:
            raise_conversion_error(f"Failed to save OCR-enhanced PDF: {e}")

        # Publish success event
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_COMPLETED,
                input_file=str(input_path),
                output_file=str(output_path),
                conversion_type="pdf2ocr",
            )
        )

        complete_operation(
            operation_id,
            {
                "output_path": str(output_path),
                "pages_processed": len(pages_to_process),
                "language": language,
                "dpi": dpi,
            },
        )
        logger.info(f"PDF OCR layer addition completed: {output_path}")

        return output_path

    except Exception as e:
        logger.exception(f"PDF OCR layer addition failed: {e}")
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_FAILED,
                input_file=str(input_path),
                conversion_type="pdf2ocr",
            )
        )
        raise_conversion_error(f"PDF OCR layer addition failed: {e}")


def _parse_page_range(page_range: str, total_pages: int) -> list[int]:
    """Parse page range string into list of page numbers."""
    if page_range == "all":
        return list(range(1, total_pages + 1))

    pages = []
    for part in page_range.split(","):
        part = part.strip()
        if "-" in part:
            start, end = map(int, part.split("-"))
            pages.extend(range(start, end + 1))
        else:
            pages.append(int(part))

    # Filter valid pages
    return [p for p in pages if 1 <= p <= total_pages]


def _preprocess_image(image: Image.Image, preprocess: str) -> Image.Image:
    """Preprocess image for OCR."""
    if preprocess == "none":
        return image
    elif preprocess == "grayscale":
        return image.convert("L")
    elif preprocess == "threshold":
        # Convert to grayscale first
        gray = image.convert("L")
        # Apply threshold
        threshold = 128
        return gray.point(lambda x: 255 if x > threshold else 0, mode="1")
    else:
        return image


def _filter_ocr_data(ocr_data: dict, confidence_threshold: int) -> dict:
    """Filter OCR data by confidence threshold."""
    filtered_data = {key: [] for key in ocr_data.keys()}

    for i in range(len(ocr_data["text"])):
        if int(ocr_data["conf"][i]) >= confidence_threshold:
            for key in ocr_data.keys():
                filtered_data[key].append(ocr_data[key][i])

    return filtered_data


def _create_ocr_layer_pdf(ocr_results: list, preserve_layout: bool) -> pikepdf.Pdf:
    """Create PDF with invisible OCR text layer."""
    from io import BytesIO

    # Create PDF in memory
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)

    for result in ocr_results:
        page_data = result["data"]
        image_size = result["image_size"]

        # Set transparent text
        c.setFillColor(transparent)
        c.setStrokeColor(transparent)

        # Add text elements
        for i in range(len(page_data["text"])):
            text = page_data["text"][i].strip()
            if text:
                x = page_data["left"][i]
                y = page_data["top"][i]
                width = page_data["width"][i]
                height = page_data["height"][i]

                # Scale coordinates to PDF page size
                pdf_x = (x / image_size[0]) * A4[0]
                pdf_y = A4[1] - (y / image_size[1]) * A4[1]

                # Add invisible text
                c.drawString(pdf_x, pdf_y, text)

        c.showPage()

    c.save()
    buffer.seek(0)

    # Create pikepdf object
    ocr_layer_pdf = pikepdf.Pdf.open(buffer)
    return ocr_layer_pdf
