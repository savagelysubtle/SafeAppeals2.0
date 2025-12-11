"""DOCX to PDF conversion using Pandoc.

This module provides functionality to convert Microsoft Word DOCX files to PDF format.
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
logger = log_manager.get_converter_logger("docx2pdf")


def _check_pdf_engine_available(engine: str) -> bool:
    """Check if a specific PDF engine is available on the system.

    Args:
        engine: Name of the PDF engine to check (pdflatex, xelatex, wkhtmltopdf, etc.)

    Returns:
        True if the engine is available, False otherwise
    """
    # First, try PATH
    try:
        cmd = ["where", engine] if platform.system() == "Windows" else ["which", engine]
        result = subprocess.run(
            cmd, capture_output=True, text=True, check=False, timeout=5
        )
        if result.returncode == 0:
            logger.debug(f"PDF engine '{engine}' found in PATH")
            return True
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        logger.debug(f"Could not check PATH for '{engine}': {e}")

    # Fallback: Check common MiKTeX installation locations on Windows
    if platform.system() == "Windows" and engine in ["pdflatex", "xelatex", "lualatex"]:
        common_miktex_paths = [
            f"C:\\Program Files\\MiKTeX\\miktex\\bin\\x64\\{engine}.exe",
            f"C:\\Program Files (x86)\\MiKTeX\\miktex\\bin\\{engine}.exe",
            os.path.join(
                os.environ.get("LOCALAPPDATA", ""),
                f"Programs\\MiKTeX\\miktex\\bin\\x64\\{engine}.exe",
            ),
        ]

        for path in common_miktex_paths:
            if os.path.exists(path) and os.access(path, os.X_OK):
                logger.debug(f"PDF engine '{engine}' found at: {path}")
                # Add to PATH for this process if not already there
                miktex_bin = os.path.dirname(path)
                if miktex_bin not in os.environ.get("PATH", ""):
                    os.environ["PATH"] = f"{miktex_bin};{os.environ.get('PATH', '')}"
                    logger.info(f"Added MiKTeX bin to process PATH: {miktex_bin}")
                return True

    logger.debug(f"PDF engine '{engine}' is NOT available")
    return False


def _get_available_pdf_engine(prefer_quality: bool = False) -> str:
    """Detect and return the first available PDF engine.

    Tries engines in order of preference:
    - If prefer_quality=True: Prioritizes quality (xelatex > lualatex > pdflatex > wkhtmltopdf)
    - If prefer_quality=False: Prioritizes compatibility (wkhtmltopdf > pdflatex > xelatex > lualatex)

    Args:
        prefer_quality: If True, prefer LaTeX engines for better typography.
                        If False, prefer wkhtmltopdf for compatibility.

    Returns:
        Name of first available PDF engine

    Raises:
        RuntimeError: If no PDF engines are available
    """
    if prefer_quality:
        # Order for best quality: LaTeX engines produce superior typography
        engines_to_try = ["xelatex", "lualatex", "pdflatex", "wkhtmltopdf"]
        logger.info("Preferring quality: trying LaTeX engines first")
    else:
        # Order for compatibility: wkhtmltopdf doesn't require LaTeX
        engines_to_try = ["wkhtmltopdf", "pdflatex", "xelatex", "lualatex"]
        logger.info("Preferring compatibility: trying wkhtmltopdf first")

    for engine in engines_to_try:
        if _check_pdf_engine_available(engine):
            logger.info(f"Selected PDF engine: {engine}")
            return engine

    raise RuntimeError(
        "No PDF engines available. Please install one of the following:\n"
        "  - wkhtmltopdf: https://wkhtmltopdf.org/downloads.html (faster, basic quality)\n"
        "  - MiKTeX (xelatex/lualatex/pdflatex): https://miktex.org/download (slower, professional quality)\n"
    )


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
        cmd = (
            ["where", "pandoc"]
            if platform.system() == "Windows"
            else ["which", "pandoc"]
        )
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        pandoc_path = result.stdout.strip().splitlines()[0]
        if os.path.exists(pandoc_path) and os.access(pandoc_path, os.X_OK):
            logger.info(f"Found pandoc in PATH: {pandoc_path}")
            return pandoc_path
    except (subprocess.CalledProcessError, FileNotFoundError, IndexError) as e:
        logger.warning(f"Pandoc not found in PATH: {e}")
        pass

    logger.error("Pandoc executable not found in common locations or PATH.")
    raise FileNotFoundError(
        "Pandoc executable not found. Please ensure pandoc is installed and in your PATH. "
        "Install with: choco install pandoc"
    )


@converter(
    source_format="docx",
    target_format="pdf",
    name="docx_to_pdf_convert_docx_to_pdf",
    priority=50,
    version="1.0.0",
)
def convert_docx_to_pdf(
    input_path: str | Path,
    output_path: str | Path | None = None,
    pdf_engine: str = "auto",
    prefer_quality: bool = False,  # Changed default to False for better compatibility
    margin: str = "1in",
    font_size: int = 11,
    line_spacing: float = 1.15,
    **options: Any,
) -> Path:
    """Converts a DOCX document to a PDF file using pypandoc.

    Args:
        input_path: Path to the input DOCX file (as str or Path).
        output_path: Path to save the output PDF file (as str or Path).
                     If None, uses input filename with .pdf extension.
        pdf_engine: PDF engine to use. Options: "auto" (detect available),
                    "pdflatex", "xelatex", "lualatex", "wkhtmltopdf".
                    Default is "auto" which auto-detects based on prefer_quality.
        prefer_quality: If True and pdf_engine="auto", prioritizes LaTeX engines
                        for better typography (requires MiKTeX setup).
                        If False (default), prioritizes wkhtmltopdf for speed
                        and compatibility. Default is False.
        margin: Page margins (default: "1in"). Examples: "0.75in", "2cm".
        font_size: Base font size in points (default: 11).
        line_spacing: Line height multiplier (default: 1.15).
        **options: Additional keyword arguments.

    Returns:
        Path object of the generated PDF file.

    Raises:
        FileNotFoundError: If the input DOCX file or Pandoc is not found.
        RuntimeError: If Pandoc conversion fails or no PDF engine is available.
    """
    # License validation and feature gating (docx2pdf is paid-only)
    check_feature_access("docx2pdf")

    # Convert to Path objects
    input_path = Path(input_path)
    if output_path:
        output_path = Path(output_path)
    else:
        output_path = input_path.with_suffix(".pdf")

    # Start operation tracking
    operation = start_operation(
        "conversion",
        100,
        description=f"Converting {input_path.name} to PDF",
    )

    # Publish conversion started event
    publish(
        ConversionEvent(
            event_type="conversion.started",
            conversion_type="docx2pdf",
            plugin_name="docx_to_pdf_convert_docx_to_pdf",
            input_file=str(input_path),
            output_file=str(output_path),
        )
    )

    logger.info(f"Starting DOCX to PDF conversion: {input_path}")
    logger.info(f"Output will be saved to: {output_path}")

    start_time = time.time()

    # Set PANDOC_PATH environment variable for pypandoc
    original_pandoc_env = os.environ.get("PANDOC_PATH")

    try:
        # Validate input file
        if not input_path.exists():
            raise FileNotFoundError(f"Input file not found: {input_path}")

        update_progress(operation, 10, "Validating Pandoc installation...")
        try:
            pandoc_executable_path = get_pandoc_path()
            os.environ["PANDOC_PATH"] = pandoc_executable_path
            logger.info(f"Using Pandoc at: {pandoc_executable_path}")
        except FileNotFoundError as e:
            logger.error(f"Pandoc not found: {e}. Cannot proceed with conversion.")
            raise

        update_progress(operation, 20, "Detecting PDF engine...")

        # Auto-detect PDF engine if set to "auto"
        if pdf_engine == "auto":
            try:
                pdf_engine = _get_available_pdf_engine(prefer_quality=prefer_quality)
                logger.info(f"Auto-detected PDF engine: {pdf_engine}")
            except RuntimeError as e:
                logger.error(f"PDF engine detection failed: {e}")
                raise

        logger.info(f"PDF Engine: {pdf_engine} (quality mode: {prefer_quality})")

        update_progress(operation, 30, "Pandoc initialized. Starting conversion...")

        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)

        update_progress(operation, 50, "Converting DOCX to PDF...")

        # Build extra args with configurable formatting
        extra_args = [
            f"--pdf-engine={pdf_engine}",
            # Improve typography and formatting
            f"--variable=geometry:margin={margin}",
            f"--variable=fontsize={font_size}pt",
            f"--variable=linestretch={line_spacing}",
            # Better font rendering (professional serif fonts)
            "--variable=mainfont:Georgia",
            "--variable=sansfont:Arial",
            "--variable=monofont:Courier New",
            # Preserve formatting
            "--preserve-tabs",
            "--standalone",
            # Better handling of special characters
            "--toc-depth=3",
        ]

        # Engine-specific optimizations
        if pdf_engine == "wkhtmltopdf":
            # wkhtmltopdf-specific options for better rendering
            # Note: Pandoc passes limited options to wkhtmltopdf
            extra_args.extend([
                "--dpi=300",
            ])
        # Note: XeLaTeX/LuaLaTeX have better Unicode support by default
        # but don't specify CJK fonts that may not be installed

        # MiKTeX workaround: Clean PATH of problematic entries
        original_path = os.environ.get("PATH", "")
        if pdf_engine in ["pdflatex", "xelatex", "lualatex"]:
            # Remove Cloudflare and other problematic paths that confuse MiKTeX
            cleaned_paths = [
                p
                for p in original_path.split(";")
                if "cloudflare" not in p.lower() and os.path.exists(p)
            ]
            os.environ["PATH"] = ";".join(cleaned_paths)
            logger.debug(
                f"Cleaned PATH for MiKTeX (removed {len(original_path.split(';')) - len(cleaned_paths)} problematic entries)"
            )

        try:
            # Perform conversion
            pypandoc.convert_file(
                str(input_path),
                to="pdf",
                format="docx",
                outputfile=str(output_path),
                extra_args=extra_args,
            )
        finally:
            # Restore original PATH
            if pdf_engine in ["pdflatex", "xelatex", "lualatex"]:
                os.environ["PATH"] = original_path

        update_progress(operation, 90, "Finalizing PDF file...")

        duration = time.time() - start_time
        logger.info(f"Successfully converted {input_path.name} to PDF: {output_path}")
        logger.info(f"Conversion completed in {duration:.2f}s")

        # Complete operation
        # Record conversion for trial tracking
        record_conversion_attempt(
            converter_name="docx2pdf",
            input_file=str(input_path),
            output_file=str(output_path),
            success=True,
        )

        complete_operation(operation, success=True)

        # Publish conversion completed event
        publish(
            ConversionEvent(
                event_type="conversion.completed",
                conversion_type="docx2pdf",
                plugin_name="docx_to_pdf_convert_docx_to_pdf",
                input_file=str(input_path),
                output_file=str(output_path),
            )
        )

        return output_path

    except FileNotFoundError:
        # Already logged
        complete_operation(operation, success=False)

        publish(
            ConversionEvent(
                event_type="conversion.failed",
                conversion_type="docx2pdf",
                plugin_name="docx_to_pdf_convert_docx_to_pdf",
                input_file=str(input_path),
                output_file=str(output_path) if output_path else None,
            )
        )
        raise
    except Exception as e:
        duration = time.time() - start_time
        error_message = f"Pandoc conversion failed: {e}"
        logger.exception(error_message)

        complete_operation(operation, success=False)

        # Publish conversion failed event
        publish(
            ConversionEvent(
                event_type="conversion.failed",
                conversion_type="docx2pdf",
                plugin_name="docx_to_pdf_convert_docx_to_pdf",
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
docx_to_pdf = convert_docx_to_pdf


if __name__ == "__main__":
    # Basic example for testing the converter directly
    import logging

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    )

    import argparse

    parser = argparse.ArgumentParser(description="Convert DOCX to PDF using Pandoc")
    parser.add_argument("input_file", type=Path, help="Path to input DOCX file")
    parser.add_argument(
        "output_file",
        type=Path,
        nargs="?",
        help="Path to output PDF file (optional)",
    )
    parser.add_argument(
        "--pdf-engine",
        default="auto",
        choices=["auto", "pdflatex", "xelatex", "lualatex", "wkhtmltopdf"],
        help="PDF engine to use (default: auto)",
    )

    args = parser.parse_args()

    try:
        result = convert_docx_to_pdf(
            args.input_file,
            args.output_file,
            pdf_engine=args.pdf_engine,
        )
        print(f"Successfully converted to: {result}")
    except Exception as e:
        print(f"Conversion failed: {e}")
        raise
