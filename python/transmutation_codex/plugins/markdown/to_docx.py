"""Markdown to DOCX conversion using Pandoc.

This module provides functionality to convert Markdown files to Microsoft Word DOCX format.
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
logger = log_manager.get_converter_logger("md2docx")


def get_pandoc_path() -> str:
    """Attempts to find the path to the pandoc executable.

    Checks bundled location (production), common installation locations, and the system PATH.

    Returns:
        Path to pandoc executable

    Raises:
        FileNotFoundError: If pandoc is not found.
    """
    # Check for bundled Pandoc first (production deployment)
    try:
        # License validation and feature gating (md2docx is paid-only)
        check_feature_access("md2docx")

        # Convert to Path for validation
        input_path = Path(input_path).resolve()

        # Check file size limit
        check_file_size_limit(str(input_path))

        import sys

        if getattr(sys, "frozen", False):
            # Running as compiled executable (PyInstaller)
            bundled_path = Path(sys._MEIPASS) / "resources" / "pandoc" / "pandoc.exe"
            if bundled_path.exists():
                logger.info(f"Found bundled Pandoc at: {bundled_path}")
                return str(bundled_path)
    except Exception as e:
        logger.debug(f"Could not check for bundled Pandoc: {e}")

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
    source_format="md",
    target_format="docx",
    name="md_to_docx_convert_md_to_docx",
    priority=50,
    version="1.0.0",
)
def convert_md_to_docx(
    input_path: str | Path,
    output_path: str | Path | None = None,
    reference_docx: str | Path | None = None,
    **options: Any,
) -> Path:
    """Converts a Markdown file to a DOCX document using pypandoc.

    Args:
        input_path: Path to the input Markdown file (as str or Path).
        output_path: Path to save the output DOCX file (as str or Path).
                     If None, uses input filename with .docx extension.
        reference_docx: Path to a reference DOCX file for styling (as str or Path).
        **options: Additional keyword arguments.

    Returns:
        Path object of the generated DOCX file.

    Raises:
        FileNotFoundError: If the input Markdown file or Pandoc is not found.
        RuntimeError: If Pandoc conversion fails.
    """
    # Convert to Path objects
    input_path = Path(input_path)
    if output_path:
        output_path = Path(output_path)
    else:
        output_path = input_path.with_suffix(".docx")

    # Start operation tracking
    operation = start_operation(
        "conversion",
        100,
        description=f"Converting {input_path.name} to DOCX",
    )

    # Publish conversion started event
    publish(
        ConversionEvent(
            event_type="conversion.started",
            conversion_type="md2docx",
            plugin_name="md_to_docx_convert_md_to_docx",
            input_file=str(input_path),
            output_file=str(output_path),
        )
    )

    logger.info(f"Starting Markdown to DOCX conversion: {input_path}")
    logger.info(f"Output will be saved to: {output_path}")

    start_time = time.time()

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

        update_progress(operation, 50, "Converting Markdown to DOCX...")

        # Build extra args
        extra_args = ["--standalone"]
        if reference_docx:
            extra_args.append(f"--reference-doc={reference_docx}")

        # Perform conversion
        pypandoc.convert_file(
            str(input_path),
            to="docx",
            format="markdown",
            outputfile=str(output_path),
            extra_args=extra_args,
        )

        update_progress(operation, 90, "Finalizing DOCX file...")

        duration = time.time() - start_time
        logger.info(f"Successfully converted {input_path.name} to DOCX: {output_path}")
        logger.info(f"Conversion completed in {duration:.2f}s")

        # Complete operation
        # Record conversion for trial tracking
        record_conversion_attempt(
            converter_name="md2docx",
            input_file=str(input_path),
            output_file=str(output_path),
            success=True,
        )

        complete_operation(operation, success=True)

        # Publish conversion completed event
        publish(
            ConversionEvent(
                event_type="conversion.completed",
                conversion_type="md2docx",
                plugin_name="md_to_docx_convert_md_to_docx",
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
                conversion_type="md2docx",
                plugin_name="md_to_docx_convert_md_to_docx",
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


# Alias for backward compatibility
markdown_to_docx = convert_md_to_docx


if __name__ == "__main__":
    # Basic example for testing the converter directly
    # This part of the code is now handled by the transmutation_codex.core.events
    # and transmutation_codex.core.registry.converter decorators.
    # The original test logic is kept for direct execution if needed,
    # but it will not trigger the new event/progress tracking.

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    )

    # Create dummy files for testing
    test_md_content = """
# Markdown to DOCX Test

This is a test document for converting Markdown to DOCX using Pandoc.

- Item 1
- Item 2

**Bold text** and *italic text*.

```python
print("Hello, Pandoc!")
```
    """
    test_md_file = Path("test_input.md")
    output_docx_file = Path("test_output.docx")

    with open(test_md_file, "w", encoding="utf-8") as f:
        f.write(test_md_content)

    def sample_progress_callback(percentage: int, message: str):
        print(f"Progress: {percentage}% - {message}")

    try:
        print(f"Attempting to convert {test_md_file!s} to {output_docx_file!s}...")
        # Attempt to find pandoc before conversion (optional, but good for pre-check)
        try:
            print(f"Pandoc found at: {get_pandoc_path()}")
        except FileNotFoundError as e:
            print(f"Error: {e}")
            print(
                "Please ensure Pandoc is installed and in your system PATH or common locations."
            )
            exit(1)

        # Pass progress_callback via kwargs for testing
        converted_file_path = markdown_to_docx(
            test_md_file, output_docx_file, progress_callback=sample_progress_callback
        )
        print(f"Conversion successful! Output file: {converted_file_path!s}")
    except FileNotFoundError as e:
        print(f"Error: {e}")
        print(
            "Please ensure Pandoc is installed and in your system PATH or common locations."
        )
    except RuntimeError as e:
        print(f"Runtime error during conversion: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
    finally:
        # Clean up dummy files
        if os.path.exists(test_md_file):
            os.remove(test_md_file)
        # if os.path.exists(output_docx_file): # Keep output for inspection
        #     os.remove(output_docx_file)
        pass
