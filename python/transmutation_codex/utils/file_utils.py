"""File operation utilities for the Transmutation Codex.

This module provides helper functions for common file operations,
format detection, and file system utilities used throughout the
document conversion system. All functions are stateless utilities.
"""

import mimetypes
import os
import shutil
import tempfile
from collections.abc import Generator
from pathlib import Path
from typing import Any

from transmutation_codex.core import ErrorCode, get_log_manager

# Setup logger
logger = get_log_manager().get_logger("transmutation_codex.utils.file_utils")

# Common MIME type mappings for document formats
MIME_TYPE_MAPPINGS = {
    "application/pdf": "pdf",
    "text/markdown": "md",
    "text/plain": "txt",
    "text/html": "html",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/msword": "doc",
    "application/vnd.oasis.opendocument.text": "odt",
    "application/rtf": "rtf",
    "application/epub+zip": "epub",
}

# Format detection by file signature (magic bytes)
FILE_SIGNATURES = {
    b"%PDF": "pdf",
    b"PK\x03\x04": "zip_based",  # Could be docx, epub, etc.
    b"\xd0\xcf\x11\xe0": "ole2",  # Could be doc, xls, ppt
    b"<!DOCTYPE html": "html",
    b"<html": "html",
    b"# ": "md",  # Simple markdown detection
    b"## ": "md",
    b"### ": "md",
}


def detect_file_format(file_path: str) -> str | None:
    """Detect file format using multiple methods.

    Args:
        file_path: Path to the file

    Returns:
        Detected format (extension without dot) or None
    """
    if not file_path or not os.path.isfile(file_path):
        return None

    # Method 1: File extension
    path = Path(file_path)
    extension = path.suffix.lower().lstrip(".")

    if extension:
        # Known extensions
        known_formats = {
            "pdf",
            "md",
            "markdown",
            "html",
            "htm",
            "txt",
            "docx",
            "doc",
            "odt",
            "rtf",
            "epub",
        }
        if extension in known_formats:
            return extension

    # Method 2: MIME type detection
    try:
        mime_type, _ = mimetypes.guess_type(file_path)
        if mime_type and mime_type in MIME_TYPE_MAPPINGS:
            return MIME_TYPE_MAPPINGS[mime_type]
    except Exception:
        pass

    # Method 3: File signature (magic bytes)
    try:
        with open(file_path, "rb") as f:
            header = f.read(20)

        for signature, format_type in FILE_SIGNATURES.items():
            if header.startswith(signature):
                if format_type == "zip_based":
                    # Additional detection for ZIP-based formats
                    return _detect_zip_based_format(file_path)
                elif format_type == "ole2":
                    # Additional detection for OLE2-based formats
                    return _detect_ole2_format(file_path)
                else:
                    return format_type
    except Exception:
        pass

    # Method 4: Content-based detection for text files
    try:
        return _detect_text_format(file_path)
    except Exception:
        pass

    return extension if extension else None


def _detect_zip_based_format(file_path: str) -> str:
    """Detect specific format for ZIP-based files."""
    try:
        import zipfile

        with zipfile.ZipFile(file_path, "r") as zip_file:
            file_list = zip_file.namelist()

            # DOCX detection
            if "word/document.xml" in file_list:
                return "docx"

            # EPUB detection
            if "META-INF/container.xml" in file_list:
                return "epub"

            # ODT detection
            if "content.xml" in file_list and "META-INF/manifest.xml" in file_list:
                return "odt"

    except Exception:
        pass

    return "zip"


def _detect_ole2_format(file_path: str) -> str:
    """Detect specific format for OLE2-based files."""
    # Simple heuristic: assume .doc if we can't determine otherwise
    path = Path(file_path)
    extension = path.suffix.lower().lstrip(".")

    if extension in ["doc", "xls", "ppt"]:
        return extension

    return "doc"  # Default assumption


def _detect_text_format(file_path: str) -> str | None:
    """Detect format for text-based files."""
    try:
        with open(file_path, encoding="utf-8", errors="ignore") as f:
            content = f.read(1024).lower()

        # HTML detection
        if any(tag in content for tag in ["<html", "<body", "<head", "<!doctype html"]):
            return "html"

        # Markdown detection
        if any(
            marker in content for marker in ["# ", "## ", "### ", "* ", "- ", "```"]
        ):
            return "md"

        # Default to txt for plain text
        return "txt"

    except Exception:
        pass

    return None


def get_file_info(file_path: str) -> dict[str, Any]:
    """Get comprehensive information about a file.

    Args:
        file_path: Path to the file

    Returns:
        Dictionary with file information
    """
    info = {
        "path": file_path,
        "exists": False,
        "size": 0,
        "size_mb": 0.0,
        "format": None,
        "extension": None,
        "name": None,
        "stem": None,
        "is_readable": False,
        "is_writable": False,
        "created": None,
        "modified": None,
    }

    if not file_path:
        return info

    try:
        path = Path(file_path)

        if path.exists():
            info["exists"] = True
            info["name"] = path.name
            info["stem"] = path.stem
            info["extension"] = path.suffix.lower().lstrip(".")

            if path.is_file():
                stat = path.stat()
                info["size"] = stat.st_size
                info["size_mb"] = stat.st_size / (1024 * 1024)
                info["created"] = stat.st_ctime
                info["modified"] = stat.st_mtime
                info["is_readable"] = os.access(path, os.R_OK)
                info["is_writable"] = os.access(path, os.W_OK)
                info["format"] = detect_file_format(file_path)

    except Exception:
        pass

    return info


def create_temp_file(
    suffix: str = "", prefix: str = "transmutation_", directory: str | None = None
) -> str:
    """Create a temporary file and return its path.

    Args:
        suffix: File suffix (e.g., '.pdf')
        prefix: File prefix
        directory: Directory to create temp file in

    Returns:
        Path to created temporary file
    """
    temp_fd, temp_path = tempfile.mkstemp(suffix=suffix, prefix=prefix, dir=directory)

    # Close the file descriptor since we only need the path
    os.close(temp_fd)

    return temp_path


def create_temp_directory(
    prefix: str = "transmutation_", parent_dir: str | None = None
) -> str:
    """Create a temporary directory and return its path.

    Args:
        prefix: Directory prefix
        parent_dir: Parent directory to create temp directory in

    Returns:
        Path to created temporary directory
    """
    return tempfile.mkdtemp(prefix=prefix, dir=parent_dir)


def safe_copy_file(source: str, destination: str, overwrite: bool = False) -> bool:
    """Safely copy a file with validation.

    Args:
        source: Source file path
        destination: Destination file path
        overwrite: Whether to overwrite existing files

    Returns:
        True if copy successful, False otherwise
    """
    logger.debug(f"Copying file: {source} -> {destination} (overwrite={overwrite})")
    try:
        source_path = Path(source)
        dest_path = Path(destination)

        # Validate source
        if not source_path.exists() or not source_path.is_file():
            error_code = ErrorCode.VALIDATION_FILE_NOT_FOUND
            logger.error(f"[{error_code}] Source file not found or not a file: {source}")
            return False

        # Check if destination exists
        if dest_path.exists() and not overwrite:
            logger.debug(f"Destination file exists and overwrite=False: {destination}")
            return False

        # Create destination directory if needed
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        logger.debug(f"Created destination directory: {dest_path.parent}")

        # Copy file
        shutil.copy2(source, destination)
        logger.debug(f"Successfully copied file: {source} -> {destination}")
        return True

    except Exception as e:
        error_code = ErrorCode.UTILS_FILE_COPY_FAILED
        logger.error(f"[{error_code}] Failed to copy file {source} -> {destination}: {e}", exc_info=True)
        return False


def safe_move_file(source: str, destination: str, overwrite: bool = False) -> bool:
    """Safely move a file with validation.

    Args:
        source: Source file path
        destination: Destination file path
        overwrite: Whether to overwrite existing files

    Returns:
        True if move successful, False otherwise
    """
    logger.debug(f"Moving file: {source} -> {destination} (overwrite={overwrite})")
    try:
        source_path = Path(source)
        dest_path = Path(destination)

        # Validate source
        if not source_path.exists() or not source_path.is_file():
            error_code = ErrorCode.VALIDATION_FILE_NOT_FOUND
            logger.error(f"[{error_code}] Source file not found or not a file: {source}")
            return False

        # Check if destination exists
        if dest_path.exists() and not overwrite:
            logger.debug(f"Destination file exists and overwrite=False: {destination}")
            return False

        # Create destination directory if needed
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        logger.debug(f"Created destination directory: {dest_path.parent}")

        # Move file
        shutil.move(source, destination)
        logger.debug(f"Successfully moved file: {source} -> {destination}")
        return True

    except Exception as e:
        error_code = ErrorCode.UTILS_FILE_OPERATION_FAILED
        logger.error(f"[{error_code}] Failed to move file {source} -> {destination}: {e}", exc_info=True)
        return False


def safe_delete_file(file_path: str) -> bool:
    """Safely delete a file.

    Args:
        file_path: Path to file to delete

    Returns:
        True if deletion successful, False otherwise
    """
    logger.debug(f"Deleting file: {file_path}")
    try:
        path = Path(file_path)
        if path.exists() and path.is_file():
            path.unlink()
            logger.debug(f"Successfully deleted file: {file_path}")
            return True
        logger.debug(f"File does not exist or is not a file: {file_path}")
        return False
    except Exception as e:
        error_code = ErrorCode.UTILS_FILE_DELETE_FAILED
        logger.error(f"[{error_code}] Failed to delete file {file_path}: {e}", exc_info=True)
        return False


def clean_directory(
    directory: str, pattern: str = "*", max_age_days: int | None = None
) -> int:
    """Clean files from a directory based on pattern and age.

    Args:
        directory: Directory to clean
        pattern: File pattern to match (e.g., '*.tmp')
        max_age_days: Maximum age in days (None = delete all matching)

    Returns:
        Number of files deleted
    """
    if not os.path.isdir(directory):
        return 0

    deleted_count = 0

    try:
        import time

        current_time = time.time()
        max_age_seconds = max_age_days * 24 * 3600 if max_age_days else None

        for file_path in Path(directory).glob(pattern):
            if file_path.is_file():
                try:
                    # Check age if specified
                    if max_age_seconds:
                        file_age = current_time - file_path.stat().st_mtime
                        if file_age < max_age_seconds:
                            continue

                    file_path.unlink()
                    deleted_count += 1

                except Exception:
                    continue

    except Exception:
        pass

    return deleted_count


def ensure_directory_exists(directory: str) -> bool:
    """Ensure a directory exists, creating it if necessary.

    Args:
        directory: Directory path

    Returns:
        True if directory exists or was created, False otherwise
    """
    try:
        Path(directory).mkdir(parents=True, exist_ok=True)
        return True
    except Exception:
        return False


def get_directory_size(directory: str) -> int:
    """Calculate total size of a directory in bytes.

    Args:
        directory: Directory path

    Returns:
        Total size in bytes
    """
    total_size = 0

    try:
        for dirpath, dirnames, filenames in os.walk(directory):
            for filename in filenames:
                file_path = os.path.join(dirpath, filename)
                try:
                    total_size += os.path.getsize(file_path)
                except Exception:
                    continue
    except Exception:
        pass

    return total_size


def find_files_by_extension(
    directory: str, extensions: list[str], recursive: bool = True
) -> list[str]:
    """Find files by extension in a directory.

    Args:
        directory: Directory to search
        extensions: List of extensions to match (without dots)
        recursive: Whether to search recursively

    Returns:
        List of matching file paths
    """
    if not os.path.isdir(directory):
        return []

    found_files = []

    try:
        # Normalize extensions
        normalized_exts = [ext.lower().lstrip(".") for ext in extensions]

        search_pattern = "**/*" if recursive else "*"

        for file_path in Path(directory).glob(search_pattern):
            if file_path.is_file():
                file_ext = file_path.suffix.lower().lstrip(".")
                if file_ext in normalized_exts:
                    found_files.append(str(file_path))

    except Exception:
        pass

    return found_files


def get_unique_filename(directory: str, base_name: str, extension: str = "") -> str:
    """Generate a unique filename in a directory.

    Args:
        directory: Target directory
        base_name: Base filename
        extension: File extension (with or without dot)

    Returns:
        Unique filename
    """
    if extension and not extension.startswith("."):
        extension = f".{extension}"

    filename = f"{base_name}{extension}"
    full_path = os.path.join(directory, filename)

    if not os.path.exists(full_path):
        return filename

    # Generate unique name with counter
    counter = 1
    while True:
        filename = f"{base_name}_{counter}{extension}"
        full_path = os.path.join(directory, filename)

        if not os.path.exists(full_path):
            return filename

        counter += 1

        # Prevent infinite loop
        if counter > 9999:
            import uuid

            unique_id = str(uuid.uuid4())[:8]
            return f"{base_name}_{unique_id}{extension}"


def read_file_chunks(file_path: str, chunk_size: int = 8192) -> Generator[bytes]:
    """Read file in chunks for memory-efficient processing.

    Args:
        file_path: Path to file
        chunk_size: Size of each chunk in bytes

    Yields:
        File chunks as bytes
    """
    try:
        with open(file_path, "rb") as f:
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                yield chunk
    except Exception:
        return


def backup_file(file_path: str, backup_suffix: str = ".bak") -> str | None:
    """Create a backup copy of a file.

    Args:
        file_path: Path to file to backup
        backup_suffix: Suffix for backup file

    Returns:
        Path to backup file, or None if failed
    """
    if not os.path.isfile(file_path):
        return None

    try:
        backup_path = f"{file_path}{backup_suffix}"

        # If backup exists, create numbered backup
        if os.path.exists(backup_path):
            counter = 1
            while True:
                numbered_backup = f"{file_path}{backup_suffix}.{counter}"
                if not os.path.exists(numbered_backup):
                    backup_path = numbered_backup
                    break
                counter += 1
                if counter > 999:  # Prevent infinite loop
                    return None

        shutil.copy2(file_path, backup_path)
        return backup_path

    except Exception:
        return None
