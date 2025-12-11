#!/usr/bin/env python
"""Electron Bridge module for MDtoPDF Converter.

Provides interfaces between the converter and an Electron frontend with progress reporting.
"""

import argparse
import importlib
import json
import sys
import time
from collections.abc import Sequence
from pathlib import Path
from typing import Any

# Resolve the project's 'backend' directory and add it to sys.path
# This allows absolute imports of modules within the transmutation_codex package
# when electron_bridge.py is run as a script from its location in backend/transmutation_codex/adapters/bridges/
# __file__ is .../AiChemistTransmutationCodex/backend/transmutation_codex/adapters/bridges/electron_bridge.py
# .parent.parent.parent.parent is .../AiChemistTransmutationCodex/backend
_backend_dir_path = Path(__file__).resolve().parent.parent.parent.parent
if str(_backend_dir_path) not in sys.path:
    sys.path.insert(0, str(_backend_dir_path))

# Imports from the transmutation_codex package MUST come AFTER sys.path modification
from transmutation_codex.core import get_log_manager, get_registry
from transmutation_codex.services.batcher import run_batch


def _report_electron_progress(
    current_step: int,
    total_steps: int,
    message: str,
    progress_type: str = "single",
) -> None:
    """Reports single file progress to Electron via stdout.

    Formats the progress data as a JSON string prefixed with "PROGRESS:".

    Args:
        current_step (int): The current step in the process.
        total_steps (int): The total number of steps in the process.
        message (str): A message describing the current state.
        progress_type (str): A string indicating the type of progress report
            (e.g., "single_progress", "single_error", "single_complete").
            Defaults to "single".
    """
    progress = int((current_step / total_steps) * 100) if total_steps > 0 else 0
    progress_data = {
        "type": progress_type,  # e.g., "single_progress"
        "progress": progress,
        "message": message,
    }
    try:
        print(f"PROGRESS: {json.dumps(progress_data)}")
        sys.stdout.flush()
    except Exception as e:
        logger = get_log_manager().get_bridge_logger()
        logger.error(f"Failed to report progress: {e}")


def _report_electron_batch_progress(
    file_index: int,
    total_files: int,
    file_path_str: str,
    success: bool,
    processing_time: float,
    error_message: str | None,
    # Add shared state for overall progress if needed, e.g., counters
    # successful_count: list[int], # Use list for mutable integer
    # failed_count: list[int],
    # lock: threading.Lock
) -> None:
    """Callback function to report batch processing progress to Electron.

    This function is invoked by the `run_batch` function for each file processed
    in a batch operation. It formats the progress data as a JSON string
    prefixed with "BATCH_PROGRESS:" and prints it to stdout.

    Args:
        file_index (int): The 1-based index of the currently processed file.
        total_files (int): The total number of files in the batch.
        file_path_str (str): The string path of the input file being processed.
        success (bool): True if the file was processed successfully, False otherwise.
        processing_time (float): The time taken to process the file, in seconds.
        error_message (str | None): An error message if processing failed,
            otherwise None.
    """
    # Note: Direct updates to shared counters (successful/failed)
    # should happen outside this callback in the main thread
    # that iterates through batch_processor results for simplicity,
    # OR use locks if updating here.

    status = "success" if success else ("error" if error_message else "failed")
    file_name = Path(file_path_str).name

    # Calculate overall progress based on file index
    overall_progress = min(100, int((file_index / max(1, total_files)) * 100))

    progress_data = {
        "type": "batch_progress",
        "fileIndex": file_index,
        "totalFiles": total_files,
        "fileName": file_name,
        "status": status,
        "overallProgress": overall_progress,
        "time": round(processing_time, 2),
        "error": error_message,
    }
    try:
        print(f"BATCH_PROGRESS: {json.dumps(progress_data)}")
        sys.stdout.flush()
        logger = get_log_manager().get_bridge_logger()
        logger.debug(
            f"Reported batch progress: File {file_index}/{total_files} - {file_name} ({status})"
        )
    except Exception as e:
        logger = get_log_manager().get_bridge_logger()
        logger.error(f"Failed to report batch progress for {file_name}: {e}")


def check_file_extension_compatibility(conversion_type: str, input_path: Path) -> None:
    """Checks if the input file's extension is compatible with the conversion type.

    Args:
        conversion_type (str): The target conversion type (e.g., "pdf2md").
        input_path (Path): Path to the input file.

    Raises:
        ValueError: If the file extension is not compatible with the
            specified conversion type.
    """
    # ... (function remains the same, logging handled by caller)
    extension = input_path.suffix.lower()

    compatible = True
    expected = ""

    if conversion_type in ("md2pdf", "md2html"):
        if extension not in (".md", ".markdown"):
            compatible = False
            expected = ".md or .markdown"
    elif conversion_type in ("pdf2html", "pdf2md"):
        if extension != ".pdf":
            compatible = False
            expected = ".pdf"
    elif conversion_type == "html2pdf":
        if extension not in (".html", ".htm"):
            compatible = False
            expected = ".html or .htm"
    elif conversion_type == "docx2md":
        if extension not in (".docx", ".doc"):
            compatible = False
            expected = ".docx or .doc"
    elif conversion_type == "pdf2editable":
        if extension != ".pdf":
            compatible = False
            expected = ".pdf"
    # Add compatibility for md2docx
    elif conversion_type == "md2docx":
        if extension not in (".md", ".markdown"):
            compatible = False
            expected = ".md or .markdown"
    # Add compatibility for docx2pdf
    elif conversion_type == "docx2pdf":
        if extension not in (".docx"):
            compatible = False
            expected = ".docx"
    # Add compatibility for merge_to_pdf
    elif conversion_type == "merge_to_pdf":
        if extension != ".pdf":
            compatible = False
            expected = ".pdf (for all inputs)"
    # Add compatibility for txt2pdf
    elif conversion_type == "txt2pdf":
        if extension not in (".txt"):
            compatible = False
            expected = ".txt"

    if not compatible:
        error_msg = f"Input file {input_path.name} is not compatible with {conversion_type} conversion. Expected {expected}."
        logger = get_log_manager().get_bridge_logger()
        logger.error(error_msg)
        raise ValueError(error_msg)
    else:
        logger = get_log_manager().get_bridge_logger()
        logger.debug(f"File {input_path.name} compatible with {conversion_type}.")


def convert_with_progress(
    conversion_type: str,
    input_path: str | Path | Sequence[str | Path],
    output_path: str | Path | None = None,
    **kwargs: Any,
) -> Path:
    """Converts a single file or merges multiple files, reporting progress to Electron.

    For regular conversions, it handles a single input file.
    For 'merge_to_pdf', it expects `input_path` to be a list of PDF file paths
    and `output_path` to be the path for the single merged output PDF.

    Args:
        conversion_type (str): The type of conversion (e.g., "pdf2md", "merge_to_pdf").
        input_path (Union[str, Path, List[Union[str, Path]]]):
            Path to the input file for single conversions, or a list of paths
            for 'merge_to_pdf'.
        output_path (str | Path | None): The desired path for the output file.
            If None for single conversions, output is typically saved next to input.
            For 'merge_to_pdf', this should be the full path to the merged output PDF.
        **kwargs (Any): Additional keyword arguments.

    Returns:
        Path: The absolute path to the successfully converted/merged output file.

    Raises:
        FileNotFoundError: If any `input_path` does not exist.
        ValueError: If `conversion_type` is unknown, inputs are incompatible,
            or `output_path` is invalid for merging.
        ImportError: If required converter module cannot be loaded.
        RuntimeError: For other unexpected errors.
    """
    logger = get_log_manager().get_bridge_logger()

    # --- Input Validation and Path Handling ---
    if conversion_type == "merge_to_pdf":
        if not isinstance(input_path, Sequence) or isinstance(input_path, (str, bytes)):
            # bytes is included because str can be bytes-like for Path, but a sequence of paths is expected here.
            # isinstance(input_path, str) handles the case where a string (a sequence of chars) might be passed.
            err_msg = "For 'merge_to_pdf', 'input_path' must be a sequence (list, tuple) of file paths, not a single string or bytes."
            logger.error(err_msg)
            _report_electron_progress(100, 100, f"Error: {err_msg}", "single_error")
            raise ValueError(err_msg)
        if not input_path:  # Check if the sequence is empty
            err_msg = "For 'merge_to_pdf', 'input_path' sequence cannot be empty."
            logger.error(err_msg)
            _report_electron_progress(100, 100, f"Error: {err_msg}", "single_error")
            raise ValueError(err_msg)

        if output_path is None:
            err_msg = "For 'merge_to_pdf', 'output_path' (full path for merged PDF) must be specified."
            logger.error(err_msg)
            _report_electron_progress(100, 100, f"Error: {err_msg}", "single_error")
            raise ValueError(err_msg)

        resolved_input_paths: list[Path] = []
        for i_path in input_path:
            p = Path(i_path).resolve()
            if not p.exists():
                logger.error(f"Input file not found: {p}")
                raise FileNotFoundError(f"Input file not found: {p}")
            resolved_input_paths.append(p)
        # Use the first input's name for general logging if needed, or a generic merge message
        display_input_name = f"{len(resolved_input_paths)} PDFs"
        # output_path for merge_to_pdf is expected to be a full file path
        output_path_obj = Path(output_path).resolve()
        output_path_obj.parent.mkdir(parents=True, exist_ok=True)
        if output_path_obj.is_dir() or output_path_obj.suffix.lower() != ".pdf":
            err_msg = f"For 'merge_to_pdf', 'output_path' must be a full .pdf file path, not a directory or other type. Got: {output_path_obj}"
            logger.error(err_msg)
            _report_electron_progress(100, 100, f"Error: {err_msg}", "single_error")
            raise ValueError(err_msg)

    else:  # Single file conversion
        if not isinstance(input_path, (str, Path)):
            err_msg = f"For single conversion '{conversion_type}', 'input_path' must be a string or Path object. Got type: {type(input_path)}"
            logger.error(err_msg)
            _report_electron_progress(100, 100, f"Error: {err_msg}", "single_error")
            raise ValueError(err_msg)

        # Type has been narrowed to str | Path for the 'else' branch and this specific check.
        resolved_input_path = Path(input_path).resolve()
        if not resolved_input_path.exists():
            logger.error(f"Input file not found: {resolved_input_path}")
            raise FileNotFoundError(f"Input file not found: {resolved_input_path}")
        display_input_name = resolved_input_path.name

        # Handle single file output_path (directory or full path)
        if output_path is not None:
            output_path_obj = Path(output_path)
            if output_path_obj.is_dir():
                # Create a filename based on the input file, but with correct extension
                if conversion_type == "pdf2md":
                    output_path_obj = (
                        output_path_obj / resolved_input_path.with_suffix(".md").name
                    )
                elif conversion_type == "md2pdf":
                    output_path_obj = (
                        output_path_obj / resolved_input_path.with_suffix(".pdf").name
                    )
                elif conversion_type == "html2pdf":
                    output_path_obj = (
                        output_path_obj / resolved_input_path.with_suffix(".pdf").name
                    )
                elif conversion_type == "md2html":
                    output_path_obj = (
                        output_path_obj / resolved_input_path.with_suffix(".html").name
                    )
                elif conversion_type == "pdf2html":
                    output_path_obj = (
                        output_path_obj / resolved_input_path.with_suffix(".html").name
                    )
                elif conversion_type == "docx2md":
                    output_path_obj = (
                        output_path_obj / resolved_input_path.with_suffix(".md").name
                    )
                elif conversion_type == "pdf2editable":
                    output_path_obj = (
                        output_path_obj / f"{resolved_input_path.stem}_editable.pdf"
                    )
                elif conversion_type == "md2docx":
                    output_path_obj = (
                        output_path_obj / resolved_input_path.with_suffix(".docx").name
                    )
                elif conversion_type == "docx2pdf":
                    output_path_obj = (
                        output_path_obj / resolved_input_path.with_suffix(".pdf").name
                    )
                # Add output path logic for txt2pdf
                elif conversion_type == "txt2pdf":
                    output_path_obj = (
                        output_path_obj / resolved_input_path.with_suffix(".pdf").name
                    )
                # No specific output name generation for 'merge_to_pdf' here, as it's handled above.
                logger.info(
                    f"Output path is a directory, using file path: {output_path_obj}"
                )
            # If output_path is a file, it's used directly (resolved below)
        elif (
            output_path is None and conversion_type != "merge_to_pdf"
        ):  # For single conversion, output_path can be None
            # Default output path logic for single file converters if output_path is None
            if conversion_type == "pdf2md":
                output_path_obj = resolved_input_path.with_suffix(".md")
            elif conversion_type == "md2pdf":
                output_path_obj = resolved_input_path.with_suffix(".pdf")
            elif conversion_type == "html2pdf":
                output_path_obj = resolved_input_path.with_suffix(".pdf")
            elif conversion_type == "md2html":
                output_path_obj = resolved_input_path.with_suffix(".html")
            elif conversion_type == "pdf2html":
                output_path_obj = resolved_input_path.with_suffix(".html")
            elif conversion_type == "docx2md":
                output_path_obj = resolved_input_path.with_suffix(".md")
            elif conversion_type == "pdf2editable":
                output_path_obj = resolved_input_path.with_name(f"{resolved_input_path.stem}_editable.pdf")
            elif conversion_type == "md2docx":
                output_path_obj = resolved_input_path.with_suffix(".docx")
            elif conversion_type == "docx2pdf":
                output_path_obj = resolved_input_path.with_suffix(".pdf")
            elif conversion_type == "txt2pdf":
                output_path_obj = resolved_input_path.with_suffix(".pdf")
            # ... (add other single converters' default output path logic if needed)
            else:  # Fallback for other single converters, or let the converter handle it
                # This fallback should ideally not be hit if all common types are handled above.
                # If a new converter is added, its default output naming should be specified.
                new_suffix = ".converted" # Generic suffix if type is unknown
                if conversion_type.endswith("2pdf"): new_suffix = ".pdf"
                elif conversion_type.endswith("2md"): new_suffix = ".md"
                elif conversion_type.endswith("2html"): new_suffix = ".html"
                elif conversion_type.endswith("2docx"): new_suffix = ".docx"
                output_path_obj = resolved_input_path.with_suffix(new_suffix) if new_suffix != ".converted" else resolved_input_path.with_name(f"{resolved_input_path.stem}_converted{resolved_input_path.suffix}")
                logger.warning(f"Conversion type {conversion_type} has no explicit default output naming. Using generic: {output_path_obj.name}")

        if output_path is not None:  # Resolve if it was given
            output_path_obj = Path(output_path).resolve()  # Ensure it's resolved
            if output_path_obj.is_dir():  # if still a dir after specific naming, it means it was the root output_dir
                # This case should have been handled by the specific naming logic above.
                # If it's still a directory, it means the specific conversion type logic to form a file name failed or was not present.
                # For safety, we might default to a generic name or raise an error.
                # However, for merge_to_pdf, output_path_obj is already a file path.
                # For other types, they should have formed a file name.
                # If output_path_obj is *still* a directory for a single conversion type, this indicates an issue.
                # Let's assume the prior logic correctly formed a file path if output_path was a directory.
                pass  # Path should be a file now.
            output_path_obj.parent.mkdir(parents=True, exist_ok=True)

    logger.info(f"Starting conversion: {conversion_type} for {display_input_name}")
    _report_electron_progress(0, 100, "Initializing...", "single_progress")

    # Check compatibility before importing
    # For merge_to_pdf, compatibility is checked for each file in main() before calling this.
    # For single files, check here.
    if conversion_type != "merge_to_pdf":
        try:
            check_file_extension_compatibility(
                conversion_type, Path(resolved_input_path)
            )  # Use resolved_input_path
        except ValueError as e:
            _report_electron_progress(100, 100, f"Error: {e}", "single_error")
            raise

    _report_electron_progress(10, 100, "Loading converter from registry...", "single_progress")
    try:
        # Import plugins to trigger auto-registration
        import transmutation_codex.plugins  # noqa: F401

        # Get the plugin registry
        registry = get_registry()

        # Parse conversion type (e.g., "pdf2md" -> "pdf", "md")
        if "2" not in conversion_type:
            raise ValueError(f"Invalid conversion type format: {conversion_type}. Expected format: source2target")

        # Special handling for merge_to_pdf (not a standard converter)
        if conversion_type == "merge_to_pdf":
            # Fall back to old import method for non-converter operations
            module = importlib.import_module("transmutation_codex.services.merger")
            converter_callable = getattr(module, "merge_multiple_pdfs_to_single_pdf")
        else:
            source_format, target_format = conversion_type.split("2", 1)

            # Get converter from registry
            plugin_info = registry.get_converter(source_format, target_format)

            if not plugin_info:
                # Get available conversions for better error message
                available = registry.get_available_conversions()
                available_str = ", ".join(
                    f"{src}2{tgt}"
                    for src, targets in available.items()
                    for tgt in targets
                )
                raise ValueError(
                    f"No converter found for '{conversion_type}'. "
                    f"Available: {available_str or 'none'}"
                )

            logger.info(
                f"Using converter: {plugin_info.name} "
                f"(priority: {plugin_info.priority}, version: {plugin_info.version})"
            )
            converter_callable = plugin_info.converter_function

    except (ImportError, AttributeError, ValueError) as e:
        logger.exception(f"Failed to load converter for {conversion_type}: {e}")
        _report_electron_progress(
            100, 100, f"Error: Failed to load converter - {e}", "single_error"
        )
        raise ImportError(f"Failed to load converter: {e}") from e

    _report_electron_progress(20, 100, "Processing...", "single_progress")
    # Simulate incremental progress (real progress depends on the converter)
    for i in range(3, 9):
        time.sleep(0.05)
        _report_electron_progress(
            i * 10, 100, f"Converting ({i * 10}%)", "single_progress"
        )

    # Perform the actual conversion
    try:
        _report_electron_progress(90, 100, "Finalizing...", "single_progress")

        # Adapt call for merge_to_pdf
        if conversion_type == "merge_to_pdf":
            # 'resolved_input_paths' is a list[Path], 'output_path_obj' is a Path
            result_path = converter_callable(
                input_paths=resolved_input_paths,  # Pass as 'input_paths'
                output_path=output_path_obj,  # Pass as 'output_path'
            )
        else:
            # 'resolved_input_path' is a Path, 'output_path_obj' is a Path
            result_path = converter_callable(
                resolved_input_path, output_path_obj, **kwargs
            )  # output_path_obj should be the file path for single conv.

        _report_electron_progress(100, 100, "Complete", "single_complete")
        logger.info(f"Conversion successful: {result_path}")
        return result_path
    except Exception as e:
        logger.exception(f"Error during conversion: {e}")
        _report_electron_progress(100, 100, f"Error: {e}", "single_error")
        raise


def main() -> int:
    """Main entry point for the Electron bridge script.

    This function is executed when the script is run. It parses command-line
    arguments, determines whether to perform a single or batch conversion,
    invokes the appropriate conversion logic, and reports results/errors to
    Electron via stdout using prefixed JSON messages (PROGRESS:, RESULT:, ERROR:, BATCH_PROGRESS:, BATCH_RESULT:).

    The script expects arguments defining the conversion type, input file(s),
    optional output directory, and other converter-specific options.

    Returns:
        int: Exit code of the process. 0 for success, 1 for general errors,
             2 for argument parsing errors.
    """
    logger = get_log_manager().get_bridge_logger()

    parser = argparse.ArgumentParser(description="MDtoPDF Electron Bridge")

    # Fix command line args - better organize subparsers
    parser.add_argument(
        "conversion_type", help="Type of conversion (e.g., pdf2md, md2pdf)"
    )
    parser.add_argument(
        "--input-files", nargs="+", required=True, help="One or more input file paths"
    )
    parser.add_argument(
        "--output-dir", help="Output directory for converted files (optional)"
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=None,  # Default will be taken from config
        help="Number of worker threads for batch processing",
    )
    # Add known converter options as arguments
    # PDF2MD specific
    parser.add_argument(
        "--engine", help="Specify conversion engine (pdf2md, html2pdf, etc.)"
    )
    parser.add_argument("--lang", help="OCR language(s)")
    parser.add_argument("--dpi", type=int, help="OCR DPI")
    parser.add_argument(
        "--force-ocr", action="store_true", help="Force OCR on all pages"
    )
    parser.add_argument("--psm", type=int, help="Tesseract PSM")
    parser.add_argument("--oem", type=int, help="Tesseract OEM")
    # PDF2EDITABLE specific new options
    parser.add_argument(
        "--redo-ocr",
        action="store_true",
        help="Redo OCR, stripping old OCR but preserving visible text.",
    )
    parser.add_argument(
        "--clean", action="store_true", help="Use unpaper to clean image before OCR."
    )
    parser.add_argument(
        "--deskew", action="store_true", help="Deskew pages before OCR."
    )
    parser.add_argument(
        "--output-type",
        choices=["pdf", "pdfa"],
        help="Output type for PDF ('pdf' or 'pdfa'). Default: OCRmyPDF's default (usually 'pdfa' unless specified).",
    )
    parser.add_argument(
        "--pdf-renderer",
        choices=["auto", "hocr", "sandwich"],
        help="PDF renderer to use ('auto', 'hocr', 'sandwich'). Default: OCRmyPDF's default ('auto').",
    )
    # MD2PDF specific
    parser.add_argument("--page-break-marker", help="Custom page break marker")
    # DOCX2MD specific
    parser.add_argument("--style-map", help="Path to DOCX style map JSON")
    parser.add_argument("--image-dir", help="Directory for extracted DOCX images")
    # MD2DOCX specific
    parser.add_argument(
        "--reference-docx",
        help="Path to a reference DOCX file for styling output of md2docx conversion.",
    )
    # Add new argument for the output file name for merging
    parser.add_argument(
        "--output-file-name",
        help="The desired file name for the merged PDF (e.g., 'merged_document.pdf'). Used only with 'merge_to_pdf'.",
        default=None,
    )
    # TXT2PDF specific arguments
    parser.add_argument(
        "--font-name",
        help="Font name to use for TXT to PDF conversion (e.g., 'Helvetica', 'Times-Roman'). Default: 'Helvetica'.",
        default="Helvetica",
    )
    parser.add_argument(
        "--font-size",
        type=int,
        help="Font size to use for TXT to PDF conversion. Default: 10.",
        default=10,
    )
    # PDF2EDITABLE specific ( reusing --lang and --force-ocr from PDF2MD for consistency if applicable)
    # --lang is already defined for PDF2MD, can be reused.
    # --force-ocr is already defined for PDF2MD, can be reused.
    # If these need to be distinctly named or handled, new args would be added.
    # For now, assuming they can be shared if the meaning is consistent.

    try:
        args = parser.parse_args()
    except SystemExit as e:  # Catch argparse errors
        logger.error(f"Argument parsing error: {e}")
        # Send error message back to Electron if possible
        error_data = {"type": "error", "message": "Invalid command line arguments."}
        print(f"ERROR: {json.dumps(error_data)}")
        sys.stdout.flush()
        return 2  # Indicate argument error

    # --- Prepare options ---
    input_files_str = args.input_files
    output_dir = args.output_dir
    conversion_type = args.conversion_type
    max_workers = args.workers  # Will be None if not provided

    # Convert input file strings to Path objects
    input_files = [Path(f).resolve() for f in input_files_str]

    # --- Basic Input Validation ---
    invalid_files = []
    if conversion_type == "merge_to_pdf":
        if len(input_files) < 2:
            error_msg = "PDF merging requires at least two input files."
            logger.error(error_msg)
            error_data = {"type": "error", "message": error_msg}
            print(f"ERROR: {json.dumps(error_data)}")
            sys.stdout.flush()
            return 1
        # For merge_to_pdf, all input files must be PDFs.
        # Compatibility check for each file.
        for file_path in input_files:
            if not file_path.exists():
                invalid_files.append(str(file_path))
            else:
                try:
                    # Check extension compatibility for each file in the merge list
                    check_file_extension_compatibility(conversion_type, file_path)
                except ValueError as e:
                    logger.error(f"Input validation error for merge: {e}")
                    error_data = {"type": "error", "message": str(e)}
                    print(f"ERROR: {json.dumps(error_data)}")
                    sys.stdout.flush()
                    return 1
    else:  # For other conversion types
        for file_path in input_files:
            if not file_path.exists():
                invalid_files.append(str(file_path))
            else:
                # Check extension compatibility early only if file exists
                try:
                    check_file_extension_compatibility(conversion_type, file_path)
                except ValueError as e:
                    # Report error and exit if any file is incompatible
                    logger.error(f"Input validation error: {e}")
                    error_data = {"type": "error", "message": str(e)}
                    print(f"ERROR: {json.dumps(error_data)}")
                    sys.stdout.flush()
                    return 1

    if invalid_files:
        error_msg = f"Input file(s) not found: {', '.join(invalid_files)}"
        logger.error(error_msg)
        error_data = {"type": "error", "message": error_msg}
        print(f"ERROR: {json.dumps(error_data)}")
        sys.stdout.flush()
        return 1

    # Collect converter-specific options from args
    converter_options = {}
    if args.engine:
        converter_options["engine"] = args.engine
    if args.lang:
        converter_options["lang"] = args.lang
    if args.dpi:
        converter_options["dpi"] = args.dpi
    # Boolean flags: args.force_ocr will be True if --force-ocr is present, False otherwise.
    # We pass these directly to the converter function which expects booleans.
    converter_options["force_ocr"] = args.force_ocr
    converter_options["redo_ocr"] = args.redo_ocr
    converter_options["clean"] = args.clean
    converter_options["deskew"] = args.deskew

    if args.psm:
        converter_options["psm"] = args.psm
    if args.oem:
        converter_options["oem"] = args.oem
    if args.page_break_marker:
        converter_options["page_break_marker"] = args.page_break_marker
    if args.style_map:
        converter_options["style_map"] = args.style_map
    if args.image_dir:
        converter_options["image_dir"] = args.image_dir
    # Add reference_docx to converter_options
    if args.reference_docx:
        converter_options["reference_docx"] = args.reference_docx
    # Add TXT2PDF options
    if args.font_name:
        converter_options["font_name"] = args.font_name
    if args.font_size:
        converter_options["font_size"] = args.font_size

    # String choice options: these will be None if not provided, or the chosen string.
    if args.output_type:
        converter_options["output_type"] = args.output_type
    if args.pdf_renderer:
        converter_options["pdf_renderer"] = args.pdf_renderer

    logger.info(
        f"Received request: Type={conversion_type}, Inputs={len(input_files)}, Output={output_dir}, Workers={max_workers or 'Default'}"
    )
    logger.debug(f"Converter options from args: {converter_options}")

    try:
        if len(input_files) == 1 and conversion_type != "merge_to_pdf":
            # Single file conversion (excluding merge_to_pdf even if one file accidentally passed)
            logger.info("Processing as single file conversion.")
            input_path_single = input_files[0]
            output_path_arg = Path(output_dir) if output_dir else None

            result_path = convert_with_progress(
                conversion_type,
                input_path_single,  # Pass single path
                output_path_arg,
                **converter_options,
            )
            success_data = {
                "type": "single_result",
                "success": True,
                "outputPath": str(result_path),
            }
            print(f"RESULT: {json.dumps(success_data)}")
            sys.stdout.flush()
            return 0
        elif conversion_type == "merge_to_pdf":
            # PDF Merging (N files to 1 PDF)
            logger.info("Processing as PDF merge operation.")
            if not output_dir:
                error_msg = (
                    "Output directory (--output-dir) is required for PDF merging."
                )
                logger.error(error_msg)
                error_data = {"type": "error", "message": error_msg}
                print(f"ERROR: {json.dumps(error_data)}")
                sys.stdout.flush()
                return 1

            if not args.output_file_name:
                error_msg = (
                    "Output file name (--output-file-name) is required for PDF merging."
                )
                logger.error(error_msg)
                error_data = {"type": "error", "message": error_msg}
                print(f"ERROR: {json.dumps(error_data)}")
                sys.stdout.flush()
                return 1

            # Construct the full output path for the merged PDF
            output_merged_pdf_path = Path(output_dir) / args.output_file_name
            output_merged_pdf_path.parent.mkdir(
                parents=True, exist_ok=True
            )  # Ensure parent dir exists

            # Validate that the constructed path is a .pdf file
            if output_merged_pdf_path.suffix.lower() != ".pdf":
                error_msg = f"Output file name '{args.output_file_name}' must result in a .pdf file. Full path: {output_merged_pdf_path}"
                logger.error(error_msg)
                error_data = {"type": "error", "message": error_msg}
                print(f"ERROR: {json.dumps(error_data)}")
                sys.stdout.flush()
                return 1

            result_path = convert_with_progress(
                conversion_type,  # "merge_to_pdf"
                input_files,  # Pass list of Path objects
                output_merged_pdf_path,  # Pass the determined single output Path
                **converter_options,
            )
            success_data = {
                "type": "single_result",  # Report as single_result as it's one output file
                "success": True,
                "outputPath": str(result_path),
                "operation": "merge",  # Add context
                "inputCount": len(input_files),
            }
            print(f"RESULT: {json.dumps(success_data)}")
            sys.stdout.flush()
            return 0
        else:
            # Batch conversion (for 1-to-1 conversions with multiple files)
            logger.info("Processing as batch file conversion.")
            # Pass the callback to the batch processor
            summary = run_batch(
                conversion_type=conversion_type,
                input_files=input_files,  # type: ignore[arg-type] # Pass list of Path objects
                output_dir=output_dir,
                max_workers=max_workers,  # Pass None to use config default
                progress_callback=_report_electron_batch_progress,
                **converter_options,
            )
            # Report final batch summary
            print(f"BATCH_RESULT: {json.dumps(summary)}")
            sys.stdout.flush()
            # Return success if at least one file converted, otherwise error
            return 0 if summary["successful"] > 0 else 1

    except (ImportError, FileNotFoundError, ValueError) as e:
        logger.error(f"Configuration or Input Error: {e}")
        error_data = {"type": "error", "message": str(e)}
        print(f"ERROR: {json.dumps(error_data)}")
        sys.stdout.flush()
        return 1
    except Exception as e:
        logger.exception(f"Unhandled error during conversion: {e}")
        error_data = {"type": "error", "message": f"An unexpected error occurred: {e}"}
        print(f"ERROR: {json.dumps(error_data)}")
        sys.stdout.flush()
        return 1


if __name__ == "__main__":
    # Ensure LogManager can initialize if needed for the final message
    final_logger = None
    try:
        log_manager_init_check = get_log_manager()
        final_logger = log_manager_init_check.get_logger("main_entry")
    except Exception as init_err:
        # If logging setup fails critically, print error and exit
        print(
            f"ERROR: Failed to initialize logging system: {init_err}", file=sys.stderr
        )
        sys.exit(99)  # Use a distinct exit code for logging failure

    exit_code = main()  # Run the main logic

    # Log the final exit code if logger was obtained successfully
    if final_logger:
        final_logger.info(
            f"Electron bridge process finished with exit code: {exit_code}"
        )
    else:
        # Fallback print if logger failed but main ran
        print(f"INFO: Electron bridge process finished with exit code: {exit_code}")

    sys.exit(exit_code)
