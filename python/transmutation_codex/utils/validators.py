"""Validation utilities for the Transmutation Codex.

This module provides pure validation functions for file paths, formats, sizes,
and other parameters used throughout the document conversion system.
All functions are stateless and have no side effects.
"""

import os
import re
from pathlib import Path

from transmutation_codex.core import ErrorCode, get_log_manager

# Setup logger
logger = get_log_manager().get_logger("transmutation_codex.utils.validators")

# Supported formats for conversion
SUPPORTED_INPUT_FORMATS = {"pdf", "md", "markdown", "html", "htm", "txt", "docx", "doc"}

SUPPORTED_OUTPUT_FORMATS = {"pdf", "md", "markdown", "html", "htm", "txt", "docx"}

# OCR language codes supported by Tesseract
SUPPORTED_OCR_LANGUAGES = {
    "eng",
    "fra",
    "deu",
    "spa",
    "ita",
    "por",
    "rus",
    "jpn",
    "kor",
    "chi_sim",
    "chi_tra",
}

# Maximum file size limits (in MB)
DEFAULT_MAX_FILE_SIZE_MB = 100
OCR_MAX_FILE_SIZE_MB = 500


def validate_file_path(file_path: str) -> tuple[bool, str | None]:
    """Validate that a file path is safe and accessible.

    Args:
        file_path: Path to validate

    Returns:
        Tuple of (is_valid, error_message)
    """
    logger.debug(f"Validating file path: {file_path}")
    if not file_path or not isinstance(file_path, str):
        error_code = ErrorCode.UTILS_VALIDATION_FAILED
        logger.error(f"[{error_code}] File path must be a non-empty string")
        return False, "File path must be a non-empty string"

    if len(file_path.strip()) == 0:
        error_code = ErrorCode.UTILS_VALIDATION_FAILED
        logger.error(f"[{error_code}] File path cannot be empty or whitespace")
        return False, "File path cannot be empty or whitespace"

    try:
        path = Path(file_path)

        # Check for path traversal attempts
        if ".." in path.parts:
            error_code = ErrorCode.SECURITY_PATH_TRAVERSAL
            logger.error(f"[{error_code}] Path traversal detected in file path: {file_path}")
            return False, "Path traversal detected in file path"

        # Check if path exists
        if not path.exists():
            error_code = ErrorCode.VALIDATION_FILE_NOT_FOUND
            logger.error(f"[{error_code}] File does not exist: {file_path}")
            return False, f"File does not exist: {file_path}"

        # Check if it's a file (not directory)
        if not path.is_file():
            error_code = ErrorCode.VALIDATION_INVALID_FORMAT
            logger.error(f"[{error_code}] Path is not a file: {file_path}")
            return False, f"Path is not a file: {file_path}"

        # Check if file is readable
        if not os.access(path, os.R_OK):
            error_code = ErrorCode.FILE_OPERATION_PERMISSION_DENIED
            logger.error(f"[{error_code}] File is not readable: {file_path}")
            return False, f"File is not readable: {file_path}"

        logger.debug(f"File path validation passed: {file_path}")
        return True, None

    except (OSError, ValueError) as e:
        error_code = ErrorCode.UTILS_VALIDATION_FAILED
        logger.error(f"[{error_code}] Invalid file path: {file_path}: {e}", exc_info=True)
        return False, f"Invalid file path: {e!s}"


def validate_output_path(output_path: str) -> tuple[bool, str | None]:
    """Validate that an output path is safe and writable.

    Args:
        output_path: Output path to validate

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not output_path or not isinstance(output_path, str):
        return False, "Output path must be a non-empty string"

    if len(output_path.strip()) == 0:
        return False, "Output path cannot be empty or whitespace"

    try:
        path = Path(output_path)

        # Check for path traversal attempts
        if ".." in path.parts:
            return False, "Path traversal detected in output path"

        # Check if parent directory exists and is writable
        parent_dir = path.parent
        if not parent_dir.exists():
            return False, f"Output directory does not exist: {parent_dir}"

        if not os.access(parent_dir, os.W_OK):
            return False, f"Output directory is not writable: {parent_dir}"

        # If file exists, check if it's writable
        if path.exists():
            if not path.is_file():
                return False, f"Output path exists but is not a file: {output_path}"
            if not os.access(path, os.W_OK):
                return False, f"Output file is not writable: {output_path}"

        return True, None

    except (OSError, ValueError) as e:
        return False, f"Invalid output path: {e!s}"


def validate_file_format(
    file_path: str, expected_formats: list[str]
) -> tuple[bool, str | None]:
    """Validate that a file has one of the expected formats.

    Args:
        file_path: Path to the file
        expected_formats: List of acceptable file extensions (without dots)

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not file_path or not isinstance(file_path, str):
        return False, "File path must be a non-empty string"

    if not expected_formats:
        return False, "Expected formats list cannot be empty"

    try:
        path = Path(file_path)
        file_extension = path.suffix.lower().lstrip(".")

        if not file_extension:
            return False, f"File has no extension: {file_path}"

        # Normalize expected formats
        normalized_formats = [fmt.lower().lstrip(".") for fmt in expected_formats]

        if file_extension not in normalized_formats:
            return (
                False,
                f"Unsupported file format '.{file_extension}'. Expected: {', '.join(normalized_formats)}",
            )

        return True, None

    except Exception as e:
        return False, f"Error validating file format: {e!s}"


def validate_file_size(
    file_path: str, max_size_mb: int = DEFAULT_MAX_FILE_SIZE_MB
) -> tuple[bool, str | None]:
    """Validate that a file size is within acceptable limits.

    Args:
        file_path: Path to the file
        max_size_mb: Maximum file size in megabytes

    Returns:
        Tuple of (is_valid, error_message)
    """
    logger.debug(f"Validating file size: {file_path} (max: {max_size_mb}MB)")
    if not file_path or not isinstance(file_path, str):
        error_code = ErrorCode.UTILS_VALIDATION_FAILED
        logger.error(f"[{error_code}] File path must be a non-empty string")
        return False, "File path must be a non-empty string"

    if max_size_mb <= 0:
        error_code = ErrorCode.UTILS_VALIDATION_FAILED
        logger.error(f"[{error_code}] Maximum file size must be positive: {max_size_mb}")
        return False, "Maximum file size must be positive"

    try:
        path = Path(file_path)

        if not path.exists():
            error_code = ErrorCode.VALIDATION_FILE_NOT_FOUND
            logger.error(f"[{error_code}] File does not exist: {file_path}")
            return False, f"File does not exist: {file_path}"

        file_size_bytes = path.stat().st_size
        file_size_mb = file_size_bytes / (1024 * 1024)
        logger.debug(f"File size: {file_size_mb:.2f}MB")

        if file_size_mb > max_size_mb:
            error_code = ErrorCode.VALIDATION_FILE_TOO_LARGE
            logger.error(f"[{error_code}] File too large: {file_size_mb:.2f}MB (max: {max_size_mb}MB)")
            return False, f"File too large: {file_size_mb:.2f}MB (max: {max_size_mb}MB)"

        logger.debug(f"File size validation passed: {file_size_mb:.2f}MB")
        return True, None

    except (OSError, ValueError) as e:
        error_code = ErrorCode.UTILS_VALIDATION_FAILED
        logger.error(f"[{error_code}] Error checking file size for {file_path}: {e}", exc_info=True)
        return False, f"Error checking file size: {e!s}"


def validate_ocr_language(lang_code: str) -> tuple[bool, str | None]:
    """Validate OCR language code.

    Args:
        lang_code: Tesseract language code (e.g., 'eng', 'fra', 'eng+fra')

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not lang_code or not isinstance(lang_code, str):
        return False, "Language code must be a non-empty string"

    # Handle multiple languages separated by '+'
    languages = [lang.strip() for lang in lang_code.split("+")]

    for lang in languages:
        if not lang:
            return False, "Empty language code detected"

        if lang not in SUPPORTED_OCR_LANGUAGES:
            supported = ", ".join(sorted(SUPPORTED_OCR_LANGUAGES))
            return False, f"Unsupported language '{lang}'. Supported: {supported}"

    return True, None


def validate_ocr_dpi(dpi: int) -> tuple[bool, str | None]:
    """Validate OCR DPI setting.

    Args:
        dpi: Dots per inch for OCR scanning

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not isinstance(dpi, int):
        return False, "DPI must be an integer"

    if dpi < 72:
        return False, "DPI too low (minimum: 72)"

    if dpi > 1200:
        return False, "DPI too high (maximum: 1200)"

    return True, None


def validate_conversion_type(conversion_type: str) -> tuple[bool, str | None]:
    """Validate conversion type specification.

    Args:
        conversion_type: Conversion type in format 'source2target' (e.g., 'md2pdf')

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not conversion_type or not isinstance(conversion_type, str):
        return False, "Conversion type must be a non-empty string"

    # Parse conversion type (e.g., 'md2pdf' -> 'md', 'pdf')
    pattern = r"^([a-zA-Z]+)2([a-zA-Z]+)$"
    match = re.match(pattern, conversion_type.lower())

    if not match:
        return (
            False,
            f"Invalid conversion type format: '{conversion_type}'. Expected format: 'source2target'",
        )

    source_format, target_format = match.groups()

    # Validate source format
    if source_format not in SUPPORTED_INPUT_FORMATS:
        supported = ", ".join(sorted(SUPPORTED_INPUT_FORMATS))
        return (
            False,
            f"Unsupported source format '{source_format}'. Supported: {supported}",
        )

    # Validate target format
    if target_format not in SUPPORTED_OUTPUT_FORMATS:
        supported = ", ".join(sorted(SUPPORTED_OUTPUT_FORMATS))
        return (
            False,
            f"Unsupported target format '{target_format}'. Supported: {supported}",
        )

    return True, None


def validate_batch_inputs(input_paths: list[str]) -> tuple[bool, str | None]:
    """Validate a list of input files for batch processing.

    Args:
        input_paths: List of file paths to validate

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not input_paths:
        return False, "Input paths list cannot be empty"

    if not isinstance(input_paths, list):
        return False, "Input paths must be a list"

    if len(input_paths) > 100:
        return (
            False,
            f"Too many files for batch processing: {len(input_paths)} (max: 100)",
        )

    for i, path in enumerate(input_paths):
        is_valid, error = validate_file_path(path)
        if not is_valid:
            return False, f"File {i + 1}: {error}"

    return True, None


def get_file_extension(file_path: str) -> str | None:
    """Get the file extension from a file path.

    Args:
        file_path: Path to the file

    Returns:
        File extension without dot, or None if no extension
    """
    try:
        path = Path(file_path)
        extension = path.suffix.lower().lstrip(".")
        return extension if extension else None
    except Exception:
        return None


def is_supported_input_format(file_path: str) -> bool:
    """Check if a file format is supported for input.

    Args:
        file_path: Path to the file

    Returns:
        True if format is supported, False otherwise
    """
    extension = get_file_extension(file_path)
    return extension in SUPPORTED_INPUT_FORMATS if extension else False


def is_supported_output_format(file_path: str) -> bool:
    """Check if a file format is supported for output.

    Args:
        file_path: Path to the file

    Returns:
        True if format is supported, False otherwise
    """
    extension = get_file_extension(file_path)
    return extension in SUPPORTED_OUTPUT_FORMATS if extension else False
