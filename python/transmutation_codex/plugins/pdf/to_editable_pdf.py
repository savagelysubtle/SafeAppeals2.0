"""PDF to Editable PDF Converter using OCRmyPDF.

This module provides functionality to convert non-editable (e.g., scanned) PDFs
into PDFs with a text layer, making them searchable and text-selectable.
It relies on OCRmyPDF, which in turn uses the Tesseract OCR engine.
"""

import os
import shutil
import sys
from pathlib import Path
from typing import Any

import ocrmypdf

# Import specific exceptions directly
from ocrmypdf.exceptions import InputFileError, MissingDependencyError

from transmutation_codex.core import (
    ConfigManager,
    LogManager,
    check_feature_access,
    check_file_size_limit,
    record_conversion_attempt,
)
from transmutation_codex.core.decorators import converter
from transmutation_codex.core.events import ConversionEvent, EventTypes, publish
from transmutation_codex.core.progress import (
    complete_operation,
    start_operation,
    update_progress,
)

# Setup logger using the LogManager singleton
log_manager = LogManager()
logger = log_manager.get_converter_logger("pdf2editable")


def _get_app_dir() -> Path:
    """Get application directory (for both development and production).

    Returns:
        Path to application root directory
    """
    if getattr(sys, "frozen", False):
        # Running as compiled executable (PyInstaller)
        return Path(sys._MEIPASS)
    else:
        # Running as script (development)
        # Navigate up from this file to project root
        return Path(__file__).parent.parent.parent.parent


def _get_bundled_tesseract_path() -> Path | None:
    """Get path to bundled Tesseract executable.

    This function looks for Tesseract bundled with the application.
    It supports both development (running as script) and production
    (running as compiled executable with PyInstaller).

    Returns:
        Path to bundled tesseract.exe or None if not found
    """
    try:
        # License validation and feature gating (pdf2editable is paid-only)
        check_feature_access("pdf2editable")

        # Convert to Path for validation
        input_path = Path(input_path).resolve()

        # Check file size limit
        check_file_size_limit(str(input_path))

        app_dir = _get_app_dir()
        logger.debug(f"Searching for Tesseract from app dir: {app_dir}")

        # Check relative to application
        possible_locations = [
            app_dir / "resources" / "tesseract" / "tesseract.exe",
            app_dir / "bin" / "tesseract" / "tesseract.exe",
            app_dir / "tesseract" / "tesseract.exe",
        ]

        for path in possible_locations:
            if path.exists():
                logger.debug(f"Found bundled Tesseract at: {path}")
                return path

        logger.debug("No bundled Tesseract found in expected locations")
        return None
    except Exception as e:
        logger.debug(f"Could not locate bundled Tesseract: {e}")
        return None


def _get_bundled_ghostscript_path() -> Path | None:
    """Get path to bundled Ghostscript executable.

    This function looks for Ghostscript bundled with the application.
    It supports both development (running as script) and production
    (running as compiled executable with PyInstaller).

    Returns:
        Path to bundled gswin64c.exe or None if not found
    """
    try:
        app_dir = _get_app_dir()
        logger.debug(f"Searching for Ghostscript from app dir: {app_dir}")

        # Check relative to application
        possible_locations = [
            app_dir / "resources" / "ghostscript" / "gswin64c.exe",
            app_dir / "bin" / "ghostscript" / "gswin64c.exe",
            app_dir / "ghostscript" / "gswin64c.exe",
        ]

        for path in possible_locations:
            if path.exists():
                logger.debug(f"Found bundled Ghostscript at: {path}")
                return path

        logger.debug("No bundled Ghostscript found in expected locations")
        return None
    except Exception as e:
        logger.debug(f"Could not locate bundled Ghostscript: {e}")
        return None


def _configure_tesseract_path() -> None:
    """Configure Tesseract PATH dynamically.

    This function attempts to locate Tesseract in the following order:
    1. Check for bundled Tesseract (production deployment)
    2. Check if 'tesseract' is already in system PATH
    3. Check user configuration for custom Tesseract path
    4. Search common installation directories (Windows)
    5. If not found, log warning and rely on OCRmyPDF's search
    """
    # 1. Check bundled Tesseract FIRST (production deployment)
    bundled_path = _get_bundled_tesseract_path()
    if bundled_path and bundled_path.exists():
        tesseract_dir = str(bundled_path.parent)
        if tesseract_dir not in os.environ.get("PATH", ""):
            os.environ["PATH"] = tesseract_dir + os.pathsep + os.environ.get("PATH", "")
            logger.info(f"Using bundled Tesseract: {tesseract_dir}")
            return
        else:
            logger.debug("Bundled Tesseract directory already in PATH")
            return

    # 2. Check if tesseract is already in PATH
    if shutil.which("tesseract"):
        logger.debug("Tesseract found in system PATH")
        return

    # 3. Check user configuration
    try:
        config = ConfigManager()
        env_config = config.get_environment_config()
        custom_path = env_config.get("tesseract_path")

        if custom_path and os.path.exists(custom_path):
            tesseract_dir = os.path.dirname(custom_path)
            if tesseract_dir not in os.environ.get("PATH", ""):
                os.environ["PATH"] = (
                    tesseract_dir + os.pathsep + os.environ.get("PATH", "")
                )
                logger.info(
                    f"Added custom Tesseract directory to PATH: {tesseract_dir}"
                )
                return
    except Exception as e:
        logger.debug(f"Could not check config for Tesseract path: {e}")

    # 4. Search common Windows installation directories
    if os.name == "nt":  # Windows
        common_locations = [
            Path(os.environ.get("ProgramFiles", "C:\\Program Files"))
            / "Tesseract-OCR"
            / "tesseract.exe",
            Path(os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)"))
            / "Tesseract-OCR"
            / "tesseract.exe",
            Path(os.environ.get("LOCALAPPDATA", ""))
            / "Programs"
            / "Tesseract-OCR"
            / "tesseract.exe",
        ]

        for tesseract_path in common_locations:
            if tesseract_path.exists():
                tesseract_dir = str(tesseract_path.parent)
                if tesseract_dir not in os.environ.get("PATH", ""):
                    os.environ["PATH"] = (
                        tesseract_dir + os.pathsep + os.environ.get("PATH", "")
                    )
                    logger.info(f"Found and added Tesseract to PATH: {tesseract_dir}")
                    return

    # 5. If we get here, Tesseract wasn't found
    logger.warning(
        "Tesseract not found in bundled resources, system PATH, user config, or common locations. "
        "OCRmyPDF will search for it, but conversion may fail. "
        "See docs/TESSERACT_CONFIGURATION.md for installation instructions."
    )


# Configure Tesseract PATH at module load time
_configure_tesseract_path()


def _configure_ghostscript_path() -> None:
    """Configure Ghostscript PATH dynamically.

    This function attempts to locate Ghostscript in the following order:
    1. Check for bundled Ghostscript (production deployment)
    2. Check if 'gswin64c' is already in system PATH
    3. Search common installation directories (Windows)
    4. If not found, log warning (OCRmyPDF will try its own search)
    """
    # 1. Check bundled Ghostscript FIRST (production deployment)
    bundled_path = _get_bundled_ghostscript_path()
    if bundled_path and bundled_path.exists():
        gs_dir = str(bundled_path.parent)
        if gs_dir not in os.environ.get("PATH", ""):
            os.environ["PATH"] = gs_dir + os.pathsep + os.environ.get("PATH", "")
            logger.info(f"Using bundled Ghostscript: {gs_dir}")
            return
        else:
            logger.debug("Bundled Ghostscript directory already in PATH")
            return

    # 2. Check if ghostscript is already in PATH
    if shutil.which("gswin64c") or shutil.which("gs"):
        logger.debug("Ghostscript found in system PATH")
        return

    # 3. Search common Windows installation directories
    if os.name == "nt":  # Windows
        # Ghostscript installs in versioned directories like C:\Program Files\gs\gs10.03.1
        gs_base_dir = Path(os.environ.get("ProgramFiles", "C:\\Program Files")) / "gs"
        if gs_base_dir.exists():
            # Find the latest version directory
            gs_versions = sorted(gs_base_dir.glob("gs*"), reverse=True)
            for gs_version_dir in gs_versions:
                gs_bin_dir = gs_version_dir / "bin"
                gs_exe = gs_bin_dir / "gswin64c.exe"
                if gs_exe.exists():
                    gs_path_str = str(gs_bin_dir)
                    if gs_path_str not in os.environ.get("PATH", ""):
                        os.environ["PATH"] = (
                            gs_path_str + os.pathsep + os.environ.get("PATH", "")
                        )
                        logger.info(
                            f"Found and added Ghostscript to PATH: {gs_path_str}"
                        )
                        return

    # 4. If we get here, Ghostscript wasn't found
    logger.warning(
        "Ghostscript not found in bundled resources, system PATH, or common locations. "
        "OCRmyPDF will search for it, but conversion may fail. "
        "Install with: choco install ghostscript"
    )


# Configure both Tesseract and Ghostscript at module load time
_configure_ghostscript_path()

try:
    import fitz  # PyMuPDF
except ImportError:
    logger.error("PyMuPDF is required. Install with: uv add pymupdf")
    fitz = None

try:
    from pdfminer.converter import PDFPageAggregator
    from pdfminer.high_level import extract_text
    from pdfminer.layout import LAParams, LTChar, LTFigure, LTTextBox, LTTextLine
    from pdfminer.pdfinterp import PDFPageInterpreter, PDFResourceManager
    from pdfminer.pdfpage import PDFPage
except ImportError:
    logger.error("pdfminer.six not found. Install with: uv add pdfminer.six")
    extract_text = None
    LAParams = None
    PDFResourceManager = None
    PDFPageInterpreter = None
    PDFPageAggregator = None
    PDFPage = None
    LTTextBox = None
    LTTextLine = None
    LTChar = None
    LTFigure = None


@converter(
    source_format="pdf",
    target_format="editable",
    description="Convert scanned PDF to searchable/editable PDF using OCRmyPDF",
    priority=40,
)
def convert_pdf_to_editable(
    input_path: str | Path,
    output_path: str | Path | None = None,
    lang: str = "eng",
    force_ocr: bool = False,
    **kwargs: Any,
) -> Path:
    """Converts a PDF to an editable PDF by adding an OCR text layer.

    "Editable" here means the PDF will have selectable and searchable text.
    It does not mean the PDF structure becomes like a word processing document.

    Args:
        input_path: Path to the input PDF file.
        output_path: Path to save the output editable PDF file.
                     If None, it defaults to the input directory with "_editable" suffix.
        lang: Language(s) for OCR, e.g., "eng" for English, "eng+fra" for English and French.
              This corresponds to Tesseract language codes.
        force_ocr: If True, forces OCR on pages that already have text.
                   Otherwise, OCRmyPDF tries to respect existing text.
        **kwargs: Additional keyword arguments to pass to ocrmypdf.ocr().
                  Useful for advanced options like --deskew, --clean, etc.

    Returns:
        Path to the generated editable PDF file.

    Raises:
        FileNotFoundError: If the input_path does not exist.
        MissingDependencyError: If Tesseract or its language packs are not installed correctly.
        InputFileError: If OCRmyPDF encounters an issue with the input file.
        Exception: For other unexpected errors during conversion.
    """
    # Start progress tracking
    operation = start_operation(
        "pdf2editable",
        message=f"Converting {Path(input_path).name} to editable PDF",
        total_steps=100,
    )

    # Publish conversion started event
    publish(
        ConversionEvent(
            event_type=EventTypes.CONVERSION_STARTED,
            source="pdf2editable",
            data={
                "operation_id": operation,
                "input_file": str(input_path),
                "conversion_type": "pdf2editable",
            },
        )
    )

    try:
        # Resolve the input path to an absolute path and check if it exists.
        # This helps in providing clearer error messages and ensures the path is valid.
        input_path = Path(input_path).resolve()
        update_progress(operation, 10, "Validating input file")

        if not input_path.exists():
            logger.error(f"Input PDF not found: {input_path}")
            raise FileNotFoundError(f"Input PDF not found: {input_path}")

        # Determine the output path if not provided.
        # The convention is to save the output in the same directory as the input,
        # with "_editable" appended to the original filename before the extension.
        if output_path is None:
            output_path = input_path.with_name(
                f"{input_path.stem}_editable{input_path.suffix}"
            )
        else:
            # If an output_path is provided, resolve it to an absolute path.
            # Also, ensure the parent directory for the output file exists.
            output_path = Path(output_path).resolve()
            output_path.parent.mkdir(parents=True, exist_ok=True)

        update_progress(operation, 20, "Preparing OCR configuration")
        logger.info(f"Starting PDF to Editable PDF conversion for: {input_path.name}")
        logger.info(f"Output will be saved to: {output_path}")
        logger.info(f"OCR Language: {lang}, Force OCR: {force_ocr}")
        if kwargs:
            logger.info(f"Additional OCRmyPDF options: {kwargs}")

        update_progress(operation, 30, "Starting OCR processing")
        # This is the core call to OCRmyPDF.
        # `input_file` and `output_file` are the primary arguments.
        # `language` specifies the OCR language(s).
        # `force_ocr` controls whether to re-OCR pages with existing text.
        # `redo_ocr`, `output_type`, `clean`, `deskew`, `pdf_renderer` etc.,
        # will now come from kwargs if provided by the user via the GUI.
        # If not in kwargs, OCRmyPDF's defaults for those parameters will apply.
        ocrmypdf.ocr(
            input_file=input_path,
            output_file=output_path,
            language=lang,
            force_ocr=force_ocr,
            progress_bar=False,  # Assuming progress is handled by electron_bridge
            **kwargs,
        )

        update_progress(operation, 100, "Conversion complete")
        logger.info(
            f"Successfully converted {input_path.name} to editable PDF: {output_path}"
        )

        # Publish completion event
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_COMPLETED,
                source="pdf2editable",
                data={
                    "operation_id": operation,
                    "output_file": str(output_path),
                    "conversion_type": "pdf2editable",
                },
            )
        )

        # Record conversion for trial tracking
        record_conversion_attempt(
            converter_name="pdf2editable",
            input_file=str(input_path),
            output_file=str(output_path),
            success=True,
        )

        complete_operation(operation, success=True)
        return output_path

    except MissingDependencyError as e:
        # This is a common error if Tesseract, Ghostscript, or language packs are not installed.
        logger.error(
            f"Missing dependency for OCRmyPDF (likely Tesseract, Ghostscript, or language packs): {e}"
        )
        logger.error(
            f"Please ensure both Tesseract OCR and Ghostscript are installed and in your system PATH. "
            f"Required language packs (e.g., for '{lang}') must also be installed. "
            f"Install Ghostscript with: choco install ghostscript"
        )
        complete_operation(operation, success=False)

        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_FAILED,
                source="pdf2editable",
                data={
                    "operation_id": operation,
                    "error": str(e),
                    "conversion_type": "pdf2editable",
                },
            )
        )
        raise  # Re-raise the exception to be handled by the calling code (e.g., electron_bridge)

    except InputFileError as e:
        logger.error(
            f"OCRmyPDF encountered an issue with the input file {input_path.name}: {e}"
        )
        complete_operation(operation, success=False)

        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_FAILED,
                source="pdf2editable",
                data={
                    "operation_id": operation,
                    "error": str(e),
                    "conversion_type": "pdf2editable",
                },
            )
        )
        raise

    except Exception as e:
        # Catch any other unexpected exceptions during the OCR process.
        logger.exception(
            f"An unexpected error occurred during PDF to Editable PDF conversion for {input_path.name}: {e}"
        )
        complete_operation(operation, success=False)

        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_FAILED,
                source="pdf2editable",
                data={
                    "operation_id": operation,
                    "error": str(e),
                    "conversion_type": "pdf2editable",
                },
            )
        )
        raise


if __name__ == "__main__":
    # This section provides a simple way to test the converter directly from the command line.
    # It's useful for development and debugging.
    # Example usage:
    # python src/mdtopdf/converters/pdf_to_editable_pdf.py path/to/your/scanned.pdf path/to/your/output_editable.pdf --lang eng

    import argparse
    import logging  # Import logging for basicConfig

    # Configure basic logging for the command-line test.
    # This helps in seeing log messages when running the script directly.
    # This will set up a simple console logger.
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    # The main LogManager instance for the converter will still be created
    # when convert_pdf_to_editable is called, using its own configuration.
    # This basicConfig is primarily for the __main__ block's direct operations.

    parser = argparse.ArgumentParser(
        description="Convert a scanned PDF to an editable PDF using OCRmyPDF."
    )
    parser.add_argument("input_pdf", type=Path, help="Path to the input PDF file.")
    parser.add_argument(
        "output_pdf",
        type=Path,
        nargs="?",  # Makes output_pdf optional
        help="Path to the output editable PDF file (optional). Defaults to input_directory/input_name_editable.pdf",
    )
    parser.add_argument(
        "--lang",
        default="eng",
        help="OCR language(s) for Tesseract (e.g., 'eng', 'fra', 'eng+fra'). Default: 'eng'.",
    )
    parser.add_argument(
        "--force-ocr",
        action="store_true",
        help="Force OCR even if text is already present.",
    )
    # Add more arguments for other ocrmypdf options if needed for testing, e.g., --deskew

    args = parser.parse_args()

    try:
        logger.info("Running PDF to Editable PDF converter from command line...")
        # Call the conversion function with arguments from the command line.
        result_path = convert_pdf_to_editable(
            args.input_pdf, args.output_pdf, lang=args.lang, force_ocr=args.force_ocr
        )
        logger.info(f"Command line conversion successful. Output at: {result_path}")
    except FileNotFoundError:
        logger.error(f"Error: Input file not found at {args.input_pdf}")
    except MissingDependencyError:
        logger.error(
            "Error: Missing Tesseract or other OCRmyPDF dependency. "
            "Ensure Tesseract is installed and in PATH with required language data."
        )
    except Exception as e:
        logger.error(f"An error occurred during command line conversion: {e}")
