"""Security utilities for the Transmutation Codex.

This module provides security helper functions for safe file operations,
path sanitization, and content validation to prevent security vulnerabilities.
All functions are stateless and focus on input sanitization and validation.
"""

import hashlib
import os
import re
import urllib.parse
from pathlib import Path

from transmutation_codex.core import ErrorCode, get_log_manager

# Setup logger
logger = get_log_manager().get_logger("transmutation_codex.utils.security")

# Dangerous file extensions that should never be processed
DANGEROUS_EXTENSIONS = {
    "exe",
    "bat",
    "cmd",
    "com",
    "scr",
    "pif",
    "vbs",
    "js",
    "jar",
    "dll",
    "sys",
    "scf",
    "lnk",
    "inf",
    "reg",
    "ps1",
    "psm1",
}

# Maximum filename length
MAX_FILENAME_LENGTH = 255

# Restricted directory names (Windows reserved names)
RESTRICTED_NAMES = {
    "CON",
    "PRN",
    "AUX",
    "NUL",
    "COM1",
    "COM2",
    "COM3",
    "COM4",
    "COM5",
    "COM6",
    "COM7",
    "COM8",
    "COM9",
    "LPT1",
    "LPT2",
    "LPT3",
    "LPT4",
    "LPT5",
    "LPT6",
    "LPT7",
    "LPT8",
    "LPT9",
}


def is_safe_path(file_path: str, base_directory: str | None = None) -> bool:
    """Check if a file path is safe from directory traversal attacks.

    Args:
        file_path: Path to validate
        base_directory: Optional base directory to restrict access to

    Returns:
        True if path is safe, False otherwise
    """
    if not file_path or not isinstance(file_path, str):
        return False

    try:
        # Normalize the path
        normalized_path = os.path.normpath(file_path)

        # Check for path traversal attempts
        if ".." in normalized_path.split(os.sep):
            return False

        # Check for absolute paths if base_directory is specified
        if base_directory:
            base_path = os.path.abspath(base_directory)
            full_path = os.path.abspath(os.path.join(base_path, normalized_path))

            # Ensure the resolved path is within the base directory
            try:
                os.path.relpath(full_path, base_path)
            except ValueError:
                # relpath raises ValueError if paths are on different drives (Windows)
                return False

            if not full_path.startswith(base_path + os.sep) and full_path != base_path:
                return False

        # Check for dangerous patterns
        if any(
            pattern in normalized_path.lower()
            for pattern in ["../", "..\\", "%2e%2e", "%252e"]
        ):
            return False

        return True

    except (OSError, ValueError):
        return False


def sanitize_filename(filename: str, replacement_char: str = "_") -> str:
    """Sanitize a filename by removing or replacing dangerous characters.

    Args:
        filename: Original filename
        replacement_char: Character to replace dangerous characters with

    Returns:
        Sanitized filename
    """
    if not filename or not isinstance(filename, str):
        return "unnamed_file"

    # Remove leading/trailing whitespace
    filename = filename.strip()

    if not filename:
        return "unnamed_file"

    # Remove or replace dangerous characters
    # Keep only alphanumeric, dots, hyphens, underscores, and spaces
    sanitized = re.sub(r'[<>:"/\\|?*\x00-\x1f]', replacement_char, filename)

    # Replace multiple consecutive replacement characters with a single one
    sanitized = re.sub(f"{re.escape(replacement_char)}+", replacement_char, sanitized)

    # Remove trailing dots and spaces (Windows restriction)
    sanitized = sanitized.rstrip(". ")

    # Check if filename is a Windows reserved name
    name_without_ext = os.path.splitext(sanitized)[0].upper()
    if name_without_ext in RESTRICTED_NAMES:
        sanitized = f"{replacement_char}{sanitized}"

    # Ensure filename isn't too long
    if len(sanitized) > MAX_FILENAME_LENGTH:
        name, ext = os.path.splitext(sanitized)
        max_name_length = MAX_FILENAME_LENGTH - len(ext)
        sanitized = name[:max_name_length] + ext

    # Ensure we have a valid filename
    if not sanitized or sanitized in (".", ".."):
        return "unnamed_file"

    return sanitized


def is_safe_file_extension(file_path: str) -> bool:
    """Check if a file extension is safe to process.

    Args:
        file_path: Path to the file

    Returns:
        True if extension is safe, False otherwise
    """
    logger.debug(f"Checking file extension safety: {file_path}")
    if not file_path:
        error_code = ErrorCode.UTILS_SECURITY_CHECK_FAILED
        logger.error(f"[{error_code}] Empty file path")
        return False

    try:
        path = Path(file_path)
        extension = path.suffix.lower().lstrip(".")

        if not extension:
            logger.debug("File has no extension, considered safe")
            return True  # Files without extensions are generally safe

        is_safe = extension not in DANGEROUS_EXTENSIONS
        if not is_safe:
            error_code = ErrorCode.SECURITY_DANGEROUS_FILE_TYPE
            logger.error(f"[{error_code}] Dangerous file extension detected: .{extension}")
        else:
            logger.debug(f"File extension is safe: .{extension}")
        return is_safe

    except Exception as e:
        error_code = ErrorCode.UTILS_SECURITY_CHECK_FAILED
        logger.error(f"[{error_code}] Error checking file extension: {file_path}: {e}", exc_info=True)
        return False


def validate_file_content_basic(
    file_path: str, max_size_bytes: int = 100 * 1024 * 1024
) -> tuple[bool, str | None]:
    """Perform basic validation of file content.

    Args:
        file_path: Path to the file
        max_size_bytes: Maximum file size in bytes

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not file_path:
        return False, "File path is required"

    try:
        path = Path(file_path)

        if not path.exists():
            return False, "File does not exist"

        if not path.is_file():
            return False, "Path is not a file"

        # Check file size
        file_size = path.stat().st_size
        if file_size > max_size_bytes:
            return False, f"File too large: {file_size} bytes (max: {max_size_bytes})"

        if file_size == 0:
            return False, "File is empty"

        # Check file extension
        if not is_safe_file_extension(file_path):
            return False, f"Dangerous file extension: {path.suffix}"

        return True, None

    except (OSError, ValueError) as e:
        return False, f"Error validating file: {e!s}"


def create_secure_temp_path(
    base_dir: str, prefix: str = "transmutation_", suffix: str = ""
) -> str:
    """Create a secure temporary file path.

    Args:
        base_dir: Base directory for temporary files
        prefix: Filename prefix
        suffix: Filename suffix

    Returns:
        Secure temporary file path
    """
    if not base_dir:
        raise ValueError("Base directory is required")

    # Sanitize inputs
    safe_prefix = sanitize_filename(prefix)
    safe_suffix = sanitize_filename(suffix)

    # Generate a random filename component
    import uuid

    random_component = str(uuid.uuid4()).replace("-", "")[:16]

    # Construct filename
    filename = f"{safe_prefix}{random_component}{safe_suffix}"

    # Ensure the filename is safe
    filename = sanitize_filename(filename)

    # Create full path
    temp_path = os.path.join(base_dir, filename)

    # Ensure path is safe
    if not is_safe_path(temp_path, base_dir):
        raise ValueError("Generated path is not safe")

    return temp_path


def calculate_file_hash(file_path: str, algorithm: str = "sha256") -> str | None:
    """Calculate hash of a file for integrity checking.

    Args:
        file_path: Path to the file
        algorithm: Hash algorithm ('md5', 'sha1', 'sha256', 'sha512')

    Returns:
        Hex digest of file hash, or None if error
    """
    if not file_path or not os.path.isfile(file_path):
        return None

    try:
        hash_obj = hashlib.new(algorithm)

        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                hash_obj.update(chunk)

        return hash_obj.hexdigest()

    except (OSError, ValueError):
        return None


def is_path_within_directory(file_path: str, directory: str) -> bool:
    """Check if a file path is within a specific directory.

    Args:
        file_path: Path to check
        directory: Directory that should contain the file

    Returns:
        True if file is within directory, False otherwise
    """
    try:
        file_path = os.path.abspath(file_path)
        directory = os.path.abspath(directory)

        # Ensure directory path ends with separator for accurate comparison
        if not directory.endswith(os.sep):
            directory += os.sep

        return file_path.startswith(directory)

    except (OSError, ValueError):
        return False


def sanitize_url_component(component: str) -> str:
    """Sanitize a URL component for safe use.

    Args:
        component: URL component to sanitize

    Returns:
        Sanitized URL component
    """
    if not component:
        return ""

    # URL encode the component
    sanitized = urllib.parse.quote(component, safe="")

    # Limit length
    if len(sanitized) > 255:
        sanitized = sanitized[:255]

    return sanitized


def validate_directory_permissions(
    directory: str, required_permissions: str = "rw"
) -> tuple[bool, str | None]:
    """Validate directory permissions.

    Args:
        directory: Directory path to check
        required_permissions: Required permissions ('r', 'w', 'rw', 'x')

    Returns:
        Tuple of (has_permissions, error_message)
    """
    if not directory:
        return False, "Directory path is required"

    if not os.path.exists(directory):
        return False, f"Directory does not exist: {directory}"

    if not os.path.isdir(directory):
        return False, f"Path is not a directory: {directory}"

    try:
        # Check read permission
        if "r" in required_permissions and not os.access(directory, os.R_OK):
            return False, f"Directory is not readable: {directory}"

        # Check write permission
        if "w" in required_permissions and not os.access(directory, os.W_OK):
            return False, f"Directory is not writable: {directory}"

        # Check execute permission
        if "x" in required_permissions and not os.access(directory, os.X_OK):
            return False, f"Directory is not executable: {directory}"

        return True, None

    except OSError as e:
        return False, f"Error checking directory permissions: {e!s}"


def secure_file_copy_validation(
    source: str, destination: str, base_directory: str | None = None
) -> tuple[bool, str | None]:
    """Validate a file copy operation for security.

    Args:
        source: Source file path
        destination: Destination file path
        base_directory: Optional base directory to restrict operations to

    Returns:
        Tuple of (is_safe, error_message)
    """
    # Validate source file
    if not is_safe_path(source, base_directory):
        return False, "Source path is not safe"

    if not os.path.isfile(source):
        return False, "Source is not a valid file"

    if not is_safe_file_extension(source):
        return False, "Source file has dangerous extension"

    # Validate destination path
    if not is_safe_path(destination, base_directory):
        return False, "Destination path is not safe"

    # Ensure destination directory exists and is writable
    dest_dir = os.path.dirname(destination)
    if dest_dir:
        is_valid, error = validate_directory_permissions(dest_dir, "w")
        if not is_valid:
            return False, error

    # Ensure we're not overwriting a dangerous file type
    if os.path.exists(destination) and not is_safe_file_extension(destination):
        return False, "Destination file has dangerous extension"

    return True, None


def clean_user_input(user_input: str, max_length: int = 1000) -> str:
    """Clean and sanitize user input for safe processing.

    Args:
        user_input: Raw user input
        max_length: Maximum allowed length

    Returns:
        Cleaned user input
    """
    if not user_input or not isinstance(user_input, str):
        return ""

    # Remove null bytes and control characters
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", user_input)

    # Limit length
    if len(cleaned) > max_length:
        cleaned = cleaned[:max_length]

    # Strip leading/trailing whitespace
    cleaned = cleaned.strip()

    return cleaned
