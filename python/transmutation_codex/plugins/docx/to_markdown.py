"""DOCX to Markdown conversion using Pandoc.

This module provides functionality to convert Microsoft Word DOCX files to Markdown format.
Uses pypandoc which wraps the Pandoc universal document converter.
"""

import os
import platform
import subprocess
import time
from pathlib import Path
from typing import Any

import pypandoc

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
from transmutation_codex.core.events import ConversionEvent

# Setup logger
log_manager = get_log_manager()
logger = log_manager.get_converter_logger("docx2md")


def get_pandoc_path() -> str:
    """Attempts to find the path to the pandoc executable.

    Checks common installation locations and the system PATH.

    Returns:
        Path to pandoc executable

    Raises:
        FileNotFoundError: If pandoc is not found.
    """
    # Common locations for pandoc
    common_paths = []
    if platform.system() == "Windows":
        # Using raw strings (r"...") for default paths to avoid issues with backslashes.
        program_files = os.environ.get("ProgramFiles", r"C:\Program Files")
        program_files_x86 = os.environ.get(
            "ProgramFiles(x86)", r"C:\Program Files (x86)"
        )
        local_app_data = os.environ.get(
            "LOCALAPPDATA",
            os.path.join(os.environ.get("USERPROFILE", ""), "AppData", "Local"),
        )

        common_paths.extend(
            [
                os.path.join(program_files, "Pandoc", "pandoc.exe"),
                os.path.join(program_files_x86, "Pandoc", "pandoc.exe"),
                os.path.join(local_app_data, "Pandoc", "pandoc.exe"),
            ]
        )
    elif platform.system() == "Linux":
        common_paths.extend(
            [
                "/usr/bin/pandoc",
                "/usr/local/bin/pandoc",
                os.path.expanduser("~/.local/bin/pandoc"),
            ]
        )
    elif platform.system() == "Darwin":  # macOS
        common_paths.extend(
            [
                "/usr/local/bin/pandoc",
                "/opt/homebrew/bin/pandoc",  # Apple Silicon Homebrew
            ]
        )

    for path in common_paths:
        if os.path.exists(path) and os.access(path, os.X_OK):
            logger.info(f"Found pandoc at: {path}")
            return path

    # Check PATH if not found in common locations
    try:
        # License validation and feature gating (docx2md is paid-only)
        check_feature_access("docx2md")

        # Convert to Path for validation
        input_path = Path(input_path).resolve()

        # Check file size limit
        check_file_size_limit(str(input_path))

        # Use `where` on Windows, `which` on Unix-like systems
        cmd = (
            ["where", "pandoc"]
            if platform.system() == "Windows"
            else ["which", "pandoc"]
        )
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        pandoc_path = result.stdout.strip().splitlines()[
            0
        ]  # Take the first result if multiple
        if os.path.exists(pandoc_path) and os.access(pandoc_path, os.X_OK):
            logger.info(f"Found pandoc in PATH: {pandoc_path}")
            return pandoc_path
    except (subprocess.CalledProcessError, FileNotFoundError, IndexError) as e:
        logger.warning(f"Pandoc not found in PATH: {e}")
        pass  # Continue to raise FileNotFoundError if not found

    logger.error("Pandoc executable not found in common locations or PATH.")
    raise FileNotFoundError(
        "Pandoc executable not found. Please ensure pandoc is installed and in your PATH."
    )


@converter(
    source_format="docx",
    target_format="md",
    name="docx_to_md_convert_docx_to_markdown",
    priority=50,
    version="1.0.0",
)
def convert_docx_to_markdown(
    input_path: str | Path,
    output_path: str | Path | None = None,
    extract_media: bool = True,
    **options: Any,
) -> Path:
    """Converts a DOCX document to a Markdown file using pypandoc.

    Args:
        input_path: Path to the input DOCX file (as str or Path).
        output_path: Path to save the output Markdown file (as str or Path).
                     If None, uses input filename with .md extension.
        extract_media: If True, extracts media files to a directory (default: True).
        **options: Additional keyword arguments.

    Returns:
        Path object of the generated Markdown file.

    Raises:
        FileNotFoundError: If the input DOCX file or Pandoc is not found.
        RuntimeError: If Pandoc conversion fails.
    """
    # Convert to Path objects
    input_path = Path(input_path)
    if output_path:
        output_path = Path(output_path)
    else:
        output_path = input_path.with_suffix(".md")

    # Start operation tracking
    operation = start_operation(
        "conversion",
        100,
        description=f"Converting {input_path.name} to Markdown",
    )

    # Publish conversion started event
    publish(
        ConversionEvent(
            event_type="conversion.started",
            conversion_type="docx2md",
            plugin_name="docx_to_md_convert_docx_to_markdown",
            input_file=str(input_path),
            output_file=str(output_path),
        )
    )

    logger.info(f"Starting DOCX to Markdown conversion: {input_path}")
    logger.info(f"Output will be saved to: {output_path}")

    start_time = time.time()
    original_pandoc_env = None  # Initialize before try block

    try:
        # Validate input file
        if not input_path.exists():
            raise FileNotFoundError(f"Input file not found: {input_path}")

        update_progress(operation, 10, "Validating Pandoc installation...")

        # Set PANDOC_PATH environment variable for pypandoc
        original_pandoc_env = os.environ.get("PANDOC_PATH")
        try:
            pandoc_executable_path = get_pandoc_path()
            os.environ["PANDOC_PATH"] = pandoc_executable_path
            logger.info(f"Using Pandoc at: {pandoc_executable_path}")
        except FileNotFoundError as e:
            logger.error(f"Pandoc not found: {e}. Cannot proceed with conversion.")
            raise

        update_progress(operation, 30, "Pandoc initialized. Starting conversion...")

        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)

        update_progress(operation, 50, "Converting DOCX to Markdown...")

        # Build extra args
        extra_args = ["--standalone", "--wrap=none"]

        # Handle media extraction
        if extract_media:
            media_dir = output_path.parent / f"{output_path.stem}_media"
            extra_args.append(f"--extract-media={media_dir}")
            logger.info(f"Media will be extracted to: {media_dir}")

        # Perform conversion
        pypandoc.convert_file(
            str(input_path),
            to="markdown",
            format="docx",
            outputfile=str(output_path),
            extra_args=extra_args,
        )

        update_progress(operation, 90, "Finalizing Markdown file...")

        duration = time.time() - start_time
        logger.info(
            f"Successfully converted {input_path.name} to Markdown: {output_path}"
        )
        logger.info(f"Conversion completed in {duration:.2f}s")

        # Complete operation
        # Record conversion for trial tracking
        record_conversion_attempt(
            converter_name="docx2md",
            input_file=str(input_path),
            output_file=str(output_path),
            success=True,
        )

        complete_operation(operation, success=True)

        # Publish conversion completed event
        publish(
            ConversionEvent(
                event_type="conversion.completed",
                conversion_type="docx2md",
                plugin_name="docx_to_md_convert_docx_to_markdown",
                input_file=str(input_path),
                output_file=str(output_path),
            )
        )

        return output_path

    except FileNotFoundError:
        # Already logged in get_pandoc_path
        raise
    except Exception as e:
        duration = time.time() - start_time
        error_message = f"Pandoc conversion failed: {e}"
        logger.exception(error_message)

        # Publish conversion failed event
        publish(
            ConversionEvent(
                event_type="conversion.failed",
                conversion_type="docx2md",
                plugin_name="docx_to_md_convert_docx_to_markdown",
                input_file=str(input_path),
                output_file=str(output_path) if output_path else None,
            )
        )

        raise RuntimeError(error_message) from e

    finally:
        # Restore original PANDOC_PATH if it was set
        if original_pandoc_env is None:
            if "PANDOC_PATH" in os.environ:
                del os.environ["PANDOC_PATH"]
                logger.debug("Restored PANDOC_PATH: unset.")
        else:
            os.environ["PANDOC_PATH"] = original_pandoc_env
            logger.debug(f"Restored PANDOC_PATH to: {original_pandoc_env}")


# Aliases for backward compatibility and plugin system
docx_to_markdown = convert_docx_to_markdown
convert_docx_to_md = convert_docx_to_markdown
docx_to_md = convert_docx_to_markdown


if __name__ == "__main__":
    # Basic example for testing the converter directly
    import logging

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    )

    import argparse

    parser = argparse.ArgumentParser(
        description="Convert DOCX to Markdown using Pandoc"
    )
    parser.add_argument("input_file", type=Path, help="Path to input DOCX file")
    parser.add_argument(
        "output_file",
        type=Path,
        nargs="?",
        help="Path to output Markdown file (optional)",
    )
    parser.add_argument(
        "--no-extract-media",
        action="store_true",
        help="Do not extract media from DOCX",
    )

    args = parser.parse_args()

    try:
        result = convert_docx_to_markdown(
            args.input_file,
            args.output_file,
            extract_media=not args.no_extract_media,
        )
        print(f"Successfully converted to: {result}")
    except Exception as e:
        print(f"Conversion failed: {e}")
        raise
