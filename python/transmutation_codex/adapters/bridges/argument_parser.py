"""Argument parsing for bridge CLI interface.

This module handles parsing and validation of command-line arguments
for the electron bridge, providing a clean interface for bridge operations.
"""

import argparse
import json
from pathlib import Path
from typing import Any

from transmutation_codex.core import ErrorCode, get_log_manager

from .base import BridgeValidationError, validate_file_exists, validate_output_directory

# Setup logger
logger = get_log_manager().get_bridge_logger()


class BridgeArguments:
    """Parsed and validated bridge arguments.

    This class encapsulates all arguments passed to the bridge,
    providing convenient access and validation.
    """

    def __init__(
        self,
        mode: str,
        conversion_type: str | None = None,
        input_path: str | None = None,
        output_path: str | None = None,
        input_files: list[str] | None = None,
        output_dir: str | None = None,
        options: dict[str, Any] | None = None,
    ):
        """Initialize bridge arguments.

        Args:
            mode: Operation mode (convert, batch, merge)
            conversion_type: Type of conversion (e.g., pdf2md)
            input_path: Input file path (for single conversion)
            output_path: Output file path (for single conversion)
            input_files: List of input files (for batch)
            output_dir: Output directory (for batch)
            options: Additional conversion options
        """
        self.mode = mode
        self.conversion_type = conversion_type
        self.input_path = input_path
        self.output_path = output_path
        self.input_files = input_files or []
        self.output_dir = output_dir
        self.options = options or {}

    def validate(self) -> None:
        """Validate the arguments based on operation mode.

        Raises:
            BridgeValidationError: If validation fails
        """
        logger.debug(f"Validating arguments for mode: {self.mode}")
        try:
            if self.mode == "convert":
                self._validate_convert()
            elif self.mode == "batch":
                self._validate_batch()
            elif self.mode == "merge":
                self._validate_merge()
            else:
                error_code = ErrorCode.BRIDGE_INVALID_MODE
                logger.error(f"[{error_code}] Unknown mode: {self.mode}")
                raise BridgeValidationError(f"Unknown mode: {self.mode}")
            logger.debug("Argument validation passed")
        except BridgeValidationError:
            raise
        except Exception as e:
            error_code = ErrorCode.BRIDGE_VALIDATION_FAILED
            logger.error(f"[{error_code}] Validation error: {e}", exc_info=True)
            raise BridgeValidationError(f"Validation failed: {e}") from e

    def _validate_convert(self) -> None:
        """Validate arguments for single conversion mode."""
        logger.debug("Validating convert mode arguments")
        if not self.conversion_type:
            error_code = ErrorCode.BRIDGE_INVALID_ARGUMENTS
            logger.error(f"[{error_code}] Conversion type is required for convert mode")
            raise BridgeValidationError("Conversion type is required for convert mode")

        if not self.input_path:
            error_code = ErrorCode.BRIDGE_INVALID_ARGUMENTS
            logger.error(f"[{error_code}] Input path is required for convert mode")
            raise BridgeValidationError("Input path is required for convert mode")

        # Validate input file exists
        validate_file_exists(self.input_path, "Input file")

        # Validate output directory if provided
        if self.output_path:
            validate_output_directory(str(Path(self.output_path).parent))

    def _validate_batch(self) -> None:
        """Validate arguments for batch conversion mode."""
        if not self.conversion_type:
            raise BridgeValidationError("Conversion type is required for batch mode")

        if not self.input_files:
            raise BridgeValidationError("Input files list is required for batch mode")

        # Validate all input files exist
        for i, file_path in enumerate(self.input_files):
            try:
                validate_file_exists(file_path, f"Input file {i + 1}")
            except BridgeValidationError as e:
                raise BridgeValidationError(f"File {i + 1}: {e}") from e

        # Validate output directory
        if self.output_dir:
            validate_output_directory(self.output_dir)

    def _validate_merge(self) -> None:
        """Validate arguments for PDF merge mode."""
        if not self.input_files:
            raise BridgeValidationError("Input files list is required for merge mode")

        if len(self.input_files) < 2:
            raise BridgeValidationError("At least 2 PDF files are required for merging")

        # Validate all input files exist and are PDFs
        for i, file_path in enumerate(self.input_files):
            try:
                validate_file_exists(file_path, f"PDF file {i + 1}")
                if not file_path.lower().endswith(".pdf"):
                    raise BridgeValidationError(
                        f"File {i + 1} is not a PDF: {file_path}"
                    )
            except BridgeValidationError as e:
                raise BridgeValidationError(f"File {i + 1}: {e}") from e

        # Auto-generate output path if not provided
        if not self.output_path:
            from pathlib import Path

            # Use first input file's directory and create merged.pdf
            first_file = Path(self.input_files[0])
            self.output_path = str(first_file.parent / "merged.pdf")


def parse_bridge_arguments(args: list[str] | None = None) -> BridgeArguments:
    """Parse command-line arguments for the bridge.

    Args:
        args: List of arguments (defaults to sys.argv)

    Returns:
        Parsed and validated BridgeArguments

    Raises:
        BridgeValidationError: If argument parsing or validation fails
    """
    parser = argparse.ArgumentParser(
        description="Electron Bridge for AiChemist Transmutation Codex",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Single file conversion
  %(prog)s convert --type pdf2md --input file.pdf --output file.md

  # Batch conversion
  %(prog)s batch --type pdf2md --input-files file1.pdf file2.pdf --output-dir ./output

  # PDF merging
  %(prog)s merge --input-files file1.pdf file2.pdf --output merged.pdf

  # With options
  %(prog)s convert --type pdf2md --input file.pdf --options '{"engine": "enhanced_ocr"}'
        """,
    )

    # Subcommands
    subparsers = parser.add_subparsers(
        dest="mode", required=True, help="Operation mode"
    )

    # Convert subcommand (single file conversion)
    convert_parser = subparsers.add_parser("convert", help="Convert a single file")
    convert_parser.add_argument(
        "--type",
        dest="conversion_type",
        required=True,
        help="Conversion type (e.g., pdf2md, md2pdf)",
    )
    convert_parser.add_argument(
        "--input", dest="input_path", required=True, help="Input file path"
    )
    convert_parser.add_argument(
        "--output",
        dest="output_path",
        help="Output file path (optional, auto-generated if not provided)",
    )
    convert_parser.add_argument(
        "--options", dest="options_json", help="Conversion options as JSON string"
    )

    # Batch subcommand (multiple file conversion)
    batch_parser = subparsers.add_parser("batch", help="Convert multiple files")
    batch_parser.add_argument(
        "--type",
        dest="conversion_type",
        required=True,
        help="Conversion type (e.g., pdf2md, md2pdf)",
    )
    batch_parser.add_argument(
        "--input-files",
        dest="input_files",
        nargs="+",
        required=True,
        help="List of input file paths",
    )
    batch_parser.add_argument(
        "--output-dir", dest="output_dir", help="Output directory for converted files"
    )
    batch_parser.add_argument(
        "--options", dest="options_json", help="Conversion options as JSON string"
    )

    # Merge subcommand (PDF merging)
    merge_parser = subparsers.add_parser("merge", help="Merge multiple PDFs")
    merge_parser.add_argument(
        "--input-files",
        dest="input_files",
        nargs="+",
        required=True,
        help="List of PDF files to merge",
    )
    merge_parser.add_argument(
        "--output",
        dest="output_path",
        required=True,
        help="Output file path for merged PDF",
    )

    # Parse arguments
    try:
        parsed = parser.parse_args(args)
    except SystemExit as e:
        # argparse calls sys.exit on error, we want to raise instead
        raise BridgeValidationError("Invalid arguments") from e

    # Parse options JSON if provided
    options = {}
    if hasattr(parsed, "options_json") and parsed.options_json:
        logger.debug(f"Parsing options JSON: {parsed.options_json[:200]}...")
        try:
            options = json.loads(parsed.options_json)
            logger.debug(f"Successfully parsed options: {list(options.keys())}")
        except json.JSONDecodeError as e:
            error_code = ErrorCode.BRIDGE_INVALID_ARGUMENTS
            logger.error(f"[{error_code}] Invalid options JSON: {e}", exc_info=True)
            raise BridgeValidationError(f"Invalid options JSON: {e}") from e

    # Create BridgeArguments instance
    bridge_args = BridgeArguments(
        mode=parsed.mode,
        conversion_type=getattr(parsed, "conversion_type", None),
        input_path=getattr(parsed, "input_path", None),
        output_path=getattr(parsed, "output_path", None),
        input_files=getattr(parsed, "input_files", None),
        output_dir=getattr(parsed, "output_dir", None),
        options=options,
    )

    # Validate the arguments
    bridge_args.validate()

    return bridge_args


def parse_legacy_arguments(args: list[str] | None = None) -> BridgeArguments:
    """Parse legacy-style arguments (for backward compatibility).

    The old electron bridge used this format (from GUI):
        electron_bridge.py pdf2md --input-files file1.pdf --output-dir /path --lang eng --dpi 300

    Where:
        - First positional argument is conversion_type (e.g., pdf2md, md2pdf, merge_to_pdf)
        - --input-files: One or more input files
        - --output-dir: Optional output directory
        - Additional converter options (--lang, --dpi, etc.)

    This function converts that to the new BridgeArguments format.

    Args:
        args: List of arguments (defaults to sys.argv)

    Returns:
        Parsed BridgeArguments
    """
    parser = argparse.ArgumentParser(description="Electron Bridge (Legacy Mode)")

    # Positional argument for conversion type (the REAL old way)
    parser.add_argument(
        "conversion_type",
        help="Type of conversion (e.g., pdf2md, md2pdf, merge_to_pdf)",
    )

    # Required input files
    parser.add_argument(
        "--input-files", nargs="+", required=True, help="One or more input file paths"
    )

    # Optional arguments
    parser.add_argument("--output-dir", help="Output directory for converted files")
    parser.add_argument("--output", dest="output_path", help="Single output file path")

    # Converter options (will be collected as additional options)
    parser.add_argument("--engine", help="Conversion engine")
    parser.add_argument("--lang", help="OCR language(s)")
    parser.add_argument("--dpi", type=int, help="OCR DPI")
    parser.add_argument("--force-ocr", action="store_true", help="Force OCR")
    parser.add_argument("--psm", type=int, help="Tesseract PSM")
    parser.add_argument("--oem", type=int, help="Tesseract OEM")
    parser.add_argument("--page-break-marker", help="Page break marker for MD2PDF")
    parser.add_argument("--output-file-name", help="Output filename for merged PDF")

    # Premium converter options
    # Excel/CSV options
    parser.add_argument("--sheet-name", help="Excel sheet name to convert")
    parser.add_argument(
        "--include-charts",
        action="store_true",
        help="Include charts in Excel conversion",
    )
    parser.add_argument(
        "--preserve-formatting", action="store_true", help="Preserve Excel formatting"
    )

    # PowerPoint options
    parser.add_argument("--slide-range", help="Slide range (e.g., '1-5' or '1,3,5')")
    parser.add_argument(
        "--include-notes", action="store_true", help="Include speaker notes"
    )

    # Image options (shared by PowerPoint and Image converters)
    parser.add_argument("--image-quality", type=int, help="Image quality (1-100)")
    parser.add_argument(
        "--image-format", help="Output image format (png, jpg, tiff, etc.)"
    )
    parser.add_argument("--resize", help="Resize image (e.g., '800x600')")
    parser.add_argument("--crop", help="Crop image (e.g., '100,100,400,300')")

    # Advanced PDF options
    parser.add_argument(
        "--compression-level", type=int, help="PDF compression level (0-9)"
    )
    parser.add_argument("--user-password", help="PDF user password")
    parser.add_argument("--owner-password", help="PDF owner password")
    parser.add_argument("--watermark-text", help="Watermark text")
    parser.add_argument("--watermark-image", help="Watermark image path")
    parser.add_argument("--page-range", help="Page range (e.g., '1-5' or '1,3,5')")
    parser.add_argument("--rotate", type=int, help="Rotate pages (90, 180, 270)")
    parser.add_argument("--remove-pages", help="Pages to remove (e.g., '1,3,5')")

    # EPUB options
    parser.add_argument("--epub-title", help="EPUB title")
    parser.add_argument("--epub-author", help="EPUB author")
    parser.add_argument("--epub-language", help="EPUB language (e.g., 'en')")
    parser.add_argument(
        "--include-images", action="store_true", help="Include images in EPUB"
    )
    parser.add_argument("--toc-depth", type=int, help="Table of contents depth")

    # TXT to PDF specific options
    parser.add_argument(
        "--font-name", help="Font name for TXT to PDF (default: Helvetica)"
    )
    parser.add_argument(
        "--font-size", type=int, help="Font size for TXT to PDF (default: 10)"
    )

    # DOCX to PDF quality options (LibreOffice v1.1)
    parser.add_argument(
        "--use-lossless-compression",
        action="store_true",
        help="Use lossless compression for images in DOCX to PDF",
    )
    parser.add_argument(
        "--reduce-image-resolution",
        action="store_true",
        help="Reduce image resolution to 300 DPI in DOCX to PDF",
    )
    parser.add_argument(
        "--export-bookmarks",
        action="store_true",
        help="Export document bookmarks in DOCX to PDF",
    )
    parser.add_argument(
        "--export-notes",
        action="store_true",
        help="Export document comments/notes in DOCX to PDF",
    )
    parser.add_argument(
        "--pdfa", action="store_true", help="Create PDF/A-1b compliant output"
    )
    parser.add_argument(
        "--timeout", type=int, help="Conversion timeout in seconds (default: 120)"
    )

    # OCRmyPDF-specific options for pdf2editable
    parser.add_argument(
        "--output-type", help="OCRmyPDF output type (pdf, pdfa, pdfa-1, pdfa-2, pdfa-3)"
    )
    parser.add_argument(
        "--pdf-renderer", help="OCRmyPDF PDF renderer (auto, hocr, sandwich)"
    )
    parser.add_argument("--deskew", action="store_true", help="Deskew pages before OCR")
    parser.add_argument("--clean", action="store_true", help="Clean pages before OCR")
    parser.add_argument(
        "--redo-ocr",
        action="store_true",
        help="Redo OCR on pages that already have text",
    )

    parsed = parser.parse_args(args)

    # Determine mode based on conversion type and arguments
    conversion_type = parsed.conversion_type.lower()

    if conversion_type == "merge_to_pdf" or conversion_type == "merge":
        mode = "merge"
    elif len(parsed.input_files) > 1 or parsed.output_dir:
        mode = "batch"
    else:
        mode = "convert"

    # Determine output path - for merge, check both --output and --output-file-name
    output_path = parsed.output_path
    if mode == "merge" and not output_path and hasattr(parsed, "output_file_name"):
        output_path = parsed.output_file_name

    # Collect converter options from parsed args
    options = {}
    for key, value in vars(parsed).items():
        if (
            key
            not in [
                "conversion_type",
                "input_files",
                "output_dir",
                "output_path",
                "output_file_name",
            ]
            and value is not None
        ):
            options[key] = value

    bridge_args = BridgeArguments(
        mode=mode,
        conversion_type=conversion_type,
        input_path=parsed.input_files[0] if mode == "convert" else None,
        output_path=output_path,
        input_files=parsed.input_files if mode in ["batch", "merge"] else None,
        output_dir=parsed.output_dir,
        options=options,
    )

    bridge_args.validate()

    return bridge_args
