"""PDF to Markdown converter.

This module provides functionality to convert PDF documents to Markdown format,
preserving document structure and formatting where possible.
"""

import json
import logging  # Import python's logging directly for module-level messages
import re
from pathlib import Path
from typing import TYPE_CHECKING, Any

from transmutation_codex.core import (
    ConfigManager,
    ConversionEvent,
    EventTypes,
    check_feature_access,
    check_file_size_limit,
    complete_operation,
    get_log_manager,
    publish,
    raise_validation_error,
    record_conversion_attempt,
    start_operation,
    update_progress,
)
from transmutation_codex.core.decorators import converter

# Setup a basic logger for module-level messages (e.g., missing dependencies)
# These logs might not have session_id if emitted before LogManager is fully initialized by the app entry point.
module_logger = logging.getLogger("aichemist_codex.converters.pdf2md.module_init")

try:
    import fitz  # PyMuPDF
except ImportError:
    module_logger.error("PyMuPDF is required. Install with: uv add pymupdf")
    fitz = None

# Try importing PyMuPDF4LLM
try:
    from pymupdf4llm import parse_pdf_to_markdown  # type: ignore

    PYMUPDF4LLM_AVAILABLE = True
except ImportError:
    PYMUPDF4LLM_AVAILABLE = False
    module_logger.error("PyMuPDF4LLM not found. Install with: uv add pymupdf4llm")

# Try importing OCR dependencies
try:
    import pytesseract
    from PIL import Image, ImageFilter
    # from PIL.ImageEnhance import ImageEnhance # This was causing ImportError, handle it locally or ensure Pillow is complete

    # Get Tesseract path from config or use default
    # ConfigManager should not be instantiated at module level if it depends on LogManager or causes premature init.
    # For now, let's assume TESSERACT_CMD might be hardcoded or handled differently if ConfigManager init is problematic here.
    # tesseract_cmd = ConfigManager().get_value(
    #     "ocr", "tesseract_cmd", r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    # )
    tesseract_cmd_path_str = r"C:\Program Files\Tesseract-OCR\tesseract.exe"  # Example, ideally from config at runtime

    # Set Tesseract path for Windows
    if Path(tesseract_cmd_path_str).exists():
        pytesseract.tesseract_cmd = tesseract_cmd_path_str
        TESSERACT_AVAILABLE = True
    else:
        module_logger.error(
            f"Tesseract executable not found at: {tesseract_cmd_path_str}"
        )
        TESSERACT_AVAILABLE = False
except ImportError:
    module_logger.error(
        "Pytesseract or core PIL components not installed. Install with: uv add pytesseract pillow"
    )
    TESSERACT_AVAILABLE = False
    # Define ImageEnhance as None or a dummy if it's used elsewhere and might be missing
    ImageEnhance = None

# For type checking only
if TYPE_CHECKING:
    import cv2  # type: ignore
    import numpy as np  # type: ignore
    from PIL import Image, ImageFilter  # type: ignore

# Try importing OpenCV
try:
    import cv2  # type: ignore
    import numpy as np  # type: ignore

    OPENCV_AVAILABLE = True
except ImportError:
    module_logger.error("OpenCV not found. Install with: uv add opencv-python numpy")
    OPENCV_AVAILABLE = False


class PDFToMarkdownConverter:
    """Coordinates PDF to Markdown conversion using different engines.

    This class acts as a dispatcher, selecting the appropriate conversion
    function based on the configured or specified engine (e.g., "basic",
    "ocr", "enhanced_ocr", "pymupdf4llm").

    Attributes:
        settings (dict): Configuration settings specific to "pdf2md" conversions,
            loaded from `ConfigManager`.
        logger (logging.Logger): Logger instance for this converter.
    """

    def __init__(self):
        """Initializes the PDFToMarkdownConverter.

        Loads "pdf2md" specific configurations and sets up a logger.
        """
        # Get configuration for pdf2md
        config = (
            ConfigManager()
        )  # Assuming ConfigManager doesn't initialize LogManager itself
        self.settings = config.get_environment_config()  # Load environment config
        # Obtain logger from the central LogManager instance at runtime
        self.logger = get_log_manager().get_converter_logger("pdf2md")

    def convert(
        self,
        input_path: str | Path,
        output_path: str | Path | None = None,
        **options: Any,
    ) -> Path:
        """Main conversion function, delegates based on config."""
        engine = options.get("engine", self.settings.get("engine", "enhanced_ocr"))
        self.logger.info(f"Using engine: {engine}")

        # Update settings with provided options
        merged_options = {**self.settings, **options}

        if engine == "pymupdf4llm":
            return convert_pdf_to_md_with_pymupdf4llm(
                input_path, output_path, **merged_options
            )
        elif engine == "enhanced_ocr":
            return convert_pdf_to_md_with_enhanced_ocr(
                input_path, output_path, **merged_options
            )
        elif engine == "ocr":
            return convert_pdf_to_md_with_ocr(input_path, output_path, **merged_options)
        elif engine == "basic":
            return convert_pdf_to_md(input_path, output_path, **merged_options)
        else:
            self.logger.error(
                f"Unknown pdf2md engine: {engine}. Defaulting to enhanced_ocr."
            )
            return convert_pdf_to_md_with_enhanced_ocr(
                input_path, output_path, **merged_options
            )


def _enhance_image_for_ocr(image: Image.Image) -> Image.Image:
    """Apply image enhancements to improve OCR accuracy."""
    # Obtain logger at runtime if needed, or pass it, or use a module-level one carefully.
    logger = get_log_manager().get_converter_logger(
        "pdf2md_utils"
    )  # Example of runtime logger retrieval
    logger.debug("Enhancing image for OCR...")
    # Step 1: Convert to grayscale
    if image.mode != "L":
        image = image.convert("L")
        logger.debug("Converted image to grayscale.")

    # Step 2: Increase contrast
    # Ensure ImageEnhance is available before using it
    try:
        from PIL import ImageEnhance

        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(2.0)
        logger.debug("Increased image contrast.")
    except ImportError:
        logger.warning("PIL.ImageEnhance not available, skipping contrast enhancement.")

    # Step 3: Apply sharpening
    image = image.filter(ImageFilter.SHARPEN)
    logger.debug("Applied sharpening filter.")

    if OPENCV_AVAILABLE:
        try:
            # Step 4: Apply bilateral filter for noise reduction
            img_array = np.array(image)
            img_array = cv2.bilateralFilter(img_array, 9, 75, 75)
            image = Image.fromarray(img_array)
            logger.debug("Applied bilateral filter.")

            # Step 5: Apply adaptive thresholding
            img_array = np.array(image)
            img_array = cv2.adaptiveThreshold(
                img_array, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
            )
            image = Image.fromarray(img_array)
            logger.debug("Applied adaptive thresholding.")
        except Exception as e:
            logger.warning(f"OpenCV processing step failed: {e}")
    else:
        logger.debug("OpenCV not available, skipping advanced filtering.")

    return image


def _deskew_image(image: Image.Image) -> Image.Image:
    """Correct skewed text in images using OpenCV."""
    if not OPENCV_AVAILABLE:
        # Use module_logger or a runtime-obtained logger
        get_log_manager().get_converter_logger("pdf2md_utils").debug(
            "OpenCV not available, skipping deskew."
        )
        return image

    logger = get_log_manager().get_converter_logger("pdf2md_utils")  # Runtime logger
    logger.debug("Deskewing image...")
    try:
        img_array = np.array(image)
        gray = (
            cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
            if len(img_array.shape) == 3
            else img_array
        )
        thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
        coords = np.column_stack(np.where(thresh > 0))
        if len(coords) == 0:
            logger.debug("No text found for deskewing.")
            return image

        angle = cv2.minAreaRect(coords)[-1]
        angle = -(90 + angle) if angle < -45 else -angle

        (h, w) = img_array.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(
            img_array, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
        )
        logger.debug(f"Deskewed image by {angle:.2f} degrees.")
        return Image.fromarray(rotated)
    except Exception as e:
        logger.warning(f"Deskewing failed: {e}")
        return image  # Return original if deskewing fails


def _extract_text_from_page(page: Any) -> str:
    """Attempt multiple extraction methods on a page and return the text."""
    logger = get_log_manager().get_converter_logger("pdf2md_utils")  # Runtime logger
    methods = ["text", "html", "json", "dict"]
    for method in methods:
        try:
            text = page.get_text(method)
            if isinstance(text, str) and text.strip():
                if method == "html":
                    # Basic HTML cleaning
                    text = re.sub(r"<style.*?</style>", "", text, flags=re.DOTALL)
                    text = re.sub(r"<[^>]+>", " ", text)
                    text = re.sub(r"\s+", " ", text).strip()
                elif method == "json":
                    data = json.loads(text)
                    text = " ".join(
                        block.get("text", "") for block in data.get("blocks", [])
                    )
                elif method == "dict":
                    dict_data = page.get_text("dict")  # Already a dict
                    text_blocks = []
                    for block in dict_data.get("blocks", []):
                        for line in block.get("lines", []):
                            for span in line.get("spans", []):
                                text_blocks.append(span.get("text", ""))
                    text = " ".join(text_blocks)

                if text.strip():
                    logger.debug(f"Extracted text using method: {method}")
                    return text
        except Exception as e:
            logger.debug(f"Text extraction method '{method}' failed: {e}")
    logger.warning("All text extraction methods failed for a page.")
    return ""


def _process_paragraphs(text: str) -> list[str]:
    """Process raw extracted text into cleaned paragraphs."""
    text = re.sub(r"(\w+)-\n(\w+)", r"\1\2", text)  # Fix hyphenated words
    text = re.sub(r"\s*\n\s*", "\n\n", text)  # Normalize line breaks to double newlines
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    return paragraphs


@converter(
    source_format="pdf",
    target_format="md",
    description="Convert PDF to Markdown with basic text extraction and optional OCR",
    input_formats=["pdf"],
    max_file_size_mb=500,
    priority=10,  # Highest priority (basic conversion, always works)
    version="1.0.0",
)
def convert_pdf_to_md(
    input_path: str | Path,
    output_path: str | Path | None = None,
    auto_ocr: bool = True,  # Kept for backward compatibility, use engine config
    **kwargs: Any,  # Catch other potential args
) -> Path:
    """Convert a PDF file to Markdown (Basic - text extraction only)."""
    # Start operation tracking
    logger = get_log_manager().get_converter_logger("pdf2md")
    operation = start_operation(
        "pdf2md",
        message=f"Converting {Path(input_path).name} to Markdown",
        total_steps=100,
    )

    # Publish conversion started event
    publish(
        ConversionEvent(
            event_type=EventTypes.CONVERSION_STARTED,
            source="pdf2md",
            input_file=str(input_path),
            conversion_type="pdf2md",
            data={
                "operation_id": operation,
            },
        )
    )

    try:
        # License validation and feature gating (PDF→MD is paid-only)
        check_feature_access("pdf2md")

        # Convert to Path for validation
        input_path = Path(input_path).resolve()

        # Check file size limit (free tier: 5MB, paid: unlimited)
        check_file_size_limit(str(input_path))

        if fitz is None:
            logger.error("PyMuPDF is required for PDF conversion.")
            raise_validation_error(
                "PyMuPDF is required. Install it with: pip install pymupdf"
            )

        if not input_path.exists():
            logger.error(f"Input file not found: {input_path}")
            raise FileNotFoundError(f"Input file not found: {input_path}")
        if input_path.suffix.lower() != ".pdf":
            logger.error(f"Invalid input file type: {input_path.suffix}")
            raise ValueError(f"Input file must be a PDF: {input_path}")

        update_progress(operation, 10, "File validated")

        output_path = (
            Path(output_path).resolve()
            if output_path
            else input_path.with_suffix(".md")
        )
        output_path.parent.mkdir(parents=True, exist_ok=True)

        logger.info(f"Converting {input_path} to Markdown (Basic)")

        update_progress(operation, 20, "Opening PDF document")

        pdf_document = fitz.open(str(input_path))
        md_lines = [f"# {input_path.stem}\n\n"]
        empty_pages = 0
        ocr_used = False  # Track if OCR was used for summary

        config = ConfigManager()
        settings = config.get_environment_config()
        # Use auto_ocr from args if passed, otherwise from config
        _auto_ocr = kwargs.get("auto_ocr", settings.get("ocr_enabled", True))
        ocr_available = _auto_ocr and TESSERACT_AVAILABLE
        ocr_lang = kwargs.get("lang", settings.get("ocr_languages", "eng"))
        ocr_dpi = kwargs.get("dpi", settings.get("ocr_dpi", 300))
        ocr_psm = kwargs.get("psm", settings.get("ocr_psm", 1))
        ocr_oem = kwargs.get("oem", settings.get("ocr_oem", 3))

        if _auto_ocr and not TESSERACT_AVAILABLE:
            logger.warning(
                "OCR requested but Tesseract is not available or configured."
            )

        if pdf_document.is_encrypted:
            logger.warning("PDF is encrypted. Authentication may be required.")
            try:
                pdf_document.authenticate("")
            except Exception as auth_e:
                logger.error(f"Failed to authenticate encrypted PDF: {auth_e}")
                md_lines.append("*Error: Failed to authenticate encrypted PDF.*\n\n")

        total_pages = pdf_document.page_count
        update_progress(operation, 30, f"Processing {total_pages} pages")

        for page_num in range(total_pages):
            logger.debug(f"Processing page {page_num + 1}")
            page = pdf_document.load_page(page_num)
            text = _extract_text_from_page(page)
            md_lines.append(f"## Page {page_num + 1}\n\n")

            # Update progress for each page
            progress = 30 + int((page_num + 1) / total_pages * 60)
            update_progress(operation, progress, f"Page {page_num + 1}/{total_pages}")

            if not text.strip() and ocr_available:
                logger.info(f"No text found on page {page_num + 1}, attempting OCR")
                try:
                    zoom = ocr_dpi / 72
                    # Use get_pixmap() which is the correct method
                    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))  # type: ignore
                    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)

                    # Apply basic enhancements (deskewing requires enhanced_ocr engine)
                    img = _enhance_image_for_ocr(img)

                    text = pytesseract.image_to_string(
                        img, lang=ocr_lang, config=f"--psm {ocr_psm} --oem {ocr_oem}"
                    )
                    if text.strip():
                        ocr_used = True
                        paragraphs = _process_paragraphs(text)
                        md_lines.extend(f"{para}\n\n" for para in paragraphs)
                        md_lines.append("*Text extracted using OCR technology*\n\n")
                    else:
                        empty_pages += 1
                        md_lines.append(
                            "*No text could be extracted from this page, even with OCR.*\n\n"
                        )
                except Exception as ocr_error:
                    logger.exception(f"OCR error on page {page_num + 1}")
                    empty_pages += 1
                    md_lines.append(
                        f"*OCR processing error on this page: {ocr_error}*\n\n"
                    )
            elif text.strip():
                paragraphs = _process_paragraphs(text)
                md_lines.extend(f"{para}\n\n" for para in paragraphs)
            else:
                empty_pages += 1
                md_lines.append("*No extractable text found on this page.*\n\n")

            if page_num < pdf_document.page_count - 1:
                md_lines.append("---\n\n")  # Page separator

        # Add summary notes
        if empty_pages > 0:
            note = f"*Note: {empty_pages} out of {pdf_document.page_count} pages had no extractable text{', even with OCR' if ocr_available else ''}.*\n\n"
            md_lines.insert(1, note)  # Insert after title
        if ocr_used:
            ocr_note = "*Note: OCR was used. Results may contain errors.*\n\n"
            md_lines.insert(1, ocr_note)

        pdf_document.close()

        update_progress(operation, 95, "Saving Markdown file")

        with open(output_path, "w", encoding="utf-8") as md_file:
            md_file.write("".join(md_lines))

        # Record conversion for trial tracking
        record_conversion_attempt(
            converter_name="pdf2md",
            input_file=str(input_path),
            output_file=str(output_path),
            success=True,
        )

        # Complete operation
        complete_operation(operation, success=True)

        logger.info(f"PDF converted to Markdown: {output_path}")
        return output_path

    except Exception as e:
        logger.exception("Error during PDF to Markdown conversion")
        raise RuntimeError(f"Error converting PDF to Markdown: {e}") from e


# --- Functions for specific engines --- #


def convert_pdf_to_md_with_ocr(
    input_path: str | Path, output_path: str | Path | None = None, **kwargs: Any
) -> Path:
    """Convert a PDF file to Markdown using OCR for pages with no extractable text.
    (Essentially calls convert_pdf_to_md with auto_ocr=True implicitly)
    """
    logger = get_log_manager().get_converter_logger("pdf2md_ocr")
    logger.info("Using standard OCR engine for PDF to Markdown.")
    # Ensures auto_ocr is treated as true for this function
    kwargs["auto_ocr"] = True
    return convert_pdf_to_md(input_path, output_path, **kwargs)


@converter(
    source_format="pdf",
    target_format="md",
    description="Convert PDF to Markdown with enhanced OCR (deskewing, preprocessing)",
    input_formats=["pdf"],
    max_file_size_mb=500,
    priority=30,  # Lower priority (requires Tesseract)
    version="1.0.0",
)
def convert_pdf_to_md_with_enhanced_ocr(
    input_path: str | Path, output_path: str | Path | None = None, **kwargs: Any
) -> Path:
    """Convert PDF to Markdown with advanced OCR techniques (deskewing, full preprocessing)."""
    # Start operation tracking
    logger = get_log_manager().get_converter_logger("pdf2md_enhanced_ocr")
    operation = start_operation(
        "pdf2md_enhanced_ocr",
        message=f"Converting {Path(input_path).name} with enhanced OCR",
        total_steps=100,
    )

    # Publish conversion started event
    publish(
        ConversionEvent(
            event_type=EventTypes.CONVERSION_STARTED,
            source="pdf2md_enhanced_ocr",
            input_file=str(input_path),
            conversion_type="pdf2md_enhanced_ocr",
            data={
                "operation_id": operation,
            },
        )
    )

    try:
        # License validation and feature gating (PDF→MD is paid-only)
        check_feature_access("pdf2md")

        # Convert to Path for validation
        input_path = Path(input_path).resolve()

        # Check file size limit
        check_file_size_limit(str(input_path))

        if fitz is None:
            logger.error("PyMuPDF is required.")
            raise_validation_error("PyMuPDF is required.")
        if not TESSERACT_AVAILABLE:
            logger.error("Tesseract is required for enhanced OCR.")
            raise ImportError("Tesseract is required.")
        if not OPENCV_AVAILABLE:
            logger.warning(
                "OpenCV not found. Enhanced image preprocessing will be limited."
            )

        if not input_path.exists():
            logger.error(f"Input file not found: {input_path}")
            raise FileNotFoundError(f"Input file not found: {input_path}")
        if input_path.suffix.lower() != ".pdf":
            logger.error(f"Invalid input file type: {input_path.suffix}")
            raise ValueError(f"Input file must be a PDF: {input_path}")

        update_progress(operation, 10, "File validated")

        output_path = (
            Path(output_path).resolve()
            if output_path
            else input_path.with_suffix(".md")
        )
        output_path.parent.mkdir(parents=True, exist_ok=True)

        update_progress(operation, 20, "Opening PDF document")

        config = ConfigManager()
        settings = config.get_environment_config()
        lang = kwargs.get("lang", settings.get("ocr_languages", "eng"))
        dpi = kwargs.get("dpi", settings.get("ocr_dpi", 300))
        force_ocr = kwargs.get("force_ocr", settings.get("force_ocr", False))
        psm = kwargs.get("psm", settings.get("ocr_psm", 1))
        oem = kwargs.get("oem", settings.get("ocr_oem", 3))

        logger.info(
            f"Converting {input_path} to Markdown with Enhanced OCR (lang={lang}, dpi={dpi})"
        )

        update_progress(operation, 25, "Opening PDF with enhanced OCR settings")

        pdf_document = fitz.open(str(input_path))
        md_lines = [f"# {input_path.stem}\n\n"]
        empty_pages = 0
        ocr_used_pages = 0

        total_pages = pdf_document.page_count
        update_progress(
            operation, 30, f"Processing {total_pages} pages with enhanced OCR"
        )

        if pdf_document.is_encrypted:
            logger.warning("PDF is encrypted. Authentication may be required.")
            try:
                pdf_document.authenticate("")
            except Exception as auth_e:
                logger.error(f"Failed to authenticate encrypted PDF: {auth_e}")
                md_lines.append("*Error: Failed to authenticate encrypted PDF.*\n\n")

        for page_num in range(pdf_document.page_count):
            logger.debug(f"Processing page {page_num + 1} with enhanced OCR")
            page = pdf_document.load_page(page_num)
            text = "" if force_ocr else _extract_text_from_page(page)
            md_lines.append(f"## Page {page_num + 1}\n\n")

            # Update progress for each page
            progress = 30 + int((page_num + 1) / total_pages * 60)
            update_progress(
                operation,
                progress,
                f"Enhanced OCR: Page {page_num + 1}/{total_pages}",
            )

            if not text.strip() or force_ocr:
                logger.info(f"Using enhanced OCR on page {page_num + 1}")
                try:
                    zoom = dpi / 72
                    # Use get_pixmap() - fixed linter error
                    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))  # type: ignore
                    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)

                    # Full preprocessing pipeline
                    img = _deskew_image(img)  # Deskew first
                    img = _enhance_image_for_ocr(img)  # Then enhance

                    text = pytesseract.image_to_string(
                        img, lang=lang, config=f"--psm {psm} --oem {oem}"
                    )
                    if text.strip():
                        ocr_used_pages += 1
                        paragraphs = _process_paragraphs(text)
                        md_lines.extend(f"{para}\n\n" for para in paragraphs)
                        md_lines.append(
                            "*Text extracted using enhanced OCR technology*\n\n"
                        )
                    else:
                        empty_pages += 1
                        md_lines.append(
                            "*No text could be extracted from this page, even with enhanced OCR.*\n\n"
                        )
                except Exception as ocr_error:
                    logger.exception(f"Enhanced OCR error on page {page_num + 1}")
                    empty_pages += 1
                    md_lines.append(
                        f"*Enhanced OCR processing error on this page: {ocr_error}*\n\n"
                    )
            else:
                paragraphs = _process_paragraphs(text)
                md_lines.extend(f"{para}\n\n" for para in paragraphs)

            if page_num < pdf_document.page_count - 1:
                md_lines.append("---\n\n")

        # Add summary notes
        if empty_pages > 0:
            note = f"*Note: {empty_pages} out of {pdf_document.page_count} pages had no extractable text, even with enhanced OCR.*\n\n"
            md_lines.insert(1, note)
        if ocr_used_pages > 0:
            ocr_note = f"*Note: Enhanced OCR was used on {ocr_used_pages} pages. Results may contain errors.*\n\n"
            md_lines.insert(1, ocr_note)

        pdf_document.close()

        update_progress(operation, 95, "Saving Markdown file")

        with open(output_path, "w", encoding="utf-8") as md_file:
            md_file.write("".join(md_lines))

        # Record conversion for trial tracking
        record_conversion_attempt(
            converter_name="pdf2md",
            input_file=str(input_path),
            output_file=str(output_path),
            success=True,
        )

        # Complete operation
        complete_operation(operation, success=True)

        logger.info(f"PDF converted to Markdown with enhanced OCR: {output_path}")
        return output_path
    except Exception as e:
        logger.exception("Error during PDF to Markdown conversion with enhanced OCR")
        raise RuntimeError(f"Error converting PDF to Markdown: {e}") from e


@converter(
    source_format="pdf",
    target_format="md",
    description="Convert PDF to Markdown optimized for LLM consumption (PyMuPDF4LLM)",
    input_formats=["pdf"],
    max_file_size_mb=500,
    priority=20,  # Medium priority (requires PyMuPDF4LLM)
    version="1.0.0",
)
def convert_pdf_to_md_with_pymupdf4llm(
    input_path: str | Path, output_path: str | Path | None = None, **kwargs: Any
) -> Path:
    """Convert a PDF file to Markdown using PyMuPDF4LLM."""
    # Start operation tracking
    logger = get_log_manager().get_converter_logger("pdf2md_pymupdf4llm")
    operation = start_operation(
        "pdf2md_pymupdf4llm",
        message=f"Converting {Path(input_path).name} with PyMuPDF4LLM",
        total_steps=100,
    )

    # Publish conversion started event
    publish(
        ConversionEvent(
            event_type=EventTypes.CONVERSION_STARTED,
            source="pdf2md_pymupdf4llm",
            input_file=str(input_path),
            conversion_type="pdf2md_pymupdf4llm",
            data={
                "operation_id": operation,
            },
        )
    )

    try:
        # License validation and feature gating (PDF→MD is paid-only)
        check_feature_access("pdf2md")

        # Convert to Path for validation
        input_path = Path(input_path).resolve()

        # Check file size limit
        check_file_size_limit(str(input_path))

        if not PYMUPDF4LLM_AVAILABLE:
            logger.error("PyMuPDF4LLM is required for this engine.")
            raise_validation_error("PyMuPDF4LLM is required.")

        if not input_path.exists():
            logger.error(f"Input file not found: {input_path}")
            raise FileNotFoundError(f"Input file not found: {input_path}")
        if input_path.suffix.lower() != ".pdf":
            logger.error(f"Invalid input file type: {input_path.suffix}")
            raise ValueError(f"Input file must be a PDF: {input_path}")

        update_progress(operation, 10, "File validated")

        output_path = (
            Path(output_path).resolve()
            if output_path
            else input_path.with_suffix(".md")
        )
        output_path.parent.mkdir(parents=True, exist_ok=True)

        logger.info(f"Converting {input_path} to Markdown using PyMuPDF4LLM")

        update_progress(operation, 20, "Opening PDF for LLM-optimized conversion")

        # PyMuPDF4LLM might have its own options, pass kwargs if needed
        update_progress(operation, 40, "Processing PDF with PyMuPDF4LLM")
        markdown_text = parse_pdf_to_markdown(str(input_path), **kwargs)

        update_progress(operation, 80, "Optimizing markdown for LLM consumption")

        update_progress(operation, 95, "Saving Markdown file")
        with open(output_path, "w", encoding="utf-8") as md_file:
            md_file.write(markdown_text)

        # Record conversion for trial tracking
        record_conversion_attempt(
            converter_name="pdf2md",
            input_file=str(input_path),
            output_file=str(output_path),
            success=True,
        )

        # Complete operation
        complete_operation(operation, success=True)

        logger.info(f"PDF converted to Markdown (PyMuPDF4LLM): {output_path}")
        return output_path
    except Exception as e:
        logger.exception("Error during PDF to Markdown conversion using PyMuPDF4LLM")
        raise RuntimeError(f"Error converting PDF to Markdown: {e}") from e
