"""Base utilities and common functions for bridges.

This module provides shared functionality used by different bridge implementations,
particularly for communication between Python backend and frontend applications.
"""

import json
import sys
from typing import Any

from transmutation_codex.core import ErrorCode, get_log_manager

# Setup logger
logger = get_log_manager().get_bridge_logger()


class BridgeError(Exception):
    """Base exception for bridge-related errors."""
    pass


class BridgeValidationError(BridgeError):
    """Raised when bridge input validation fails."""
    pass


class BridgeConversionError(BridgeError):
    """Raised when conversion fails in bridge context."""
    pass


def send_json_message(message_type: str, data: dict[str, Any]) -> None:
    """Send a JSON message to stdout with a specific prefix.

    This is the primary communication mechanism between Python backend
    and Electron/JavaScript frontend. Messages are prefixed with a type
    identifier and followed by JSON data.

    Args:
        message_type: Type prefix (e.g., "PROGRESS", "RESULT", "ERROR", "LOG_MESSAGE")
        data: Dictionary to serialize as JSON

    Example:
        send_json_message("PROGRESS", {"step": 1, "total": 10, "message": "Starting"})
        # Output: PROGRESS:{"step":1,"total":10,"message":"Starting"}
    """
    try:
        json_str = json.dumps(data, ensure_ascii=False)
        logger.debug(f"Sending {message_type} message: {json_str[:200]}...")
        print(f"{message_type}:{json_str}", flush=True)
    except (TypeError, ValueError) as e:
        error_code = ErrorCode.BRIDGE_JSON_SERIALIZATION_FAILED
        logger.error(f"[{error_code}] Failed to serialize {message_type} message: {e}", exc_info=True)
        # Fallback if data isn't JSON serializable
        error_data = {"error": f"Failed to serialize message: {e}", "type": message_type, "error_code": error_code}
        try:
            print(f"ERROR:{json.dumps(error_data)}", flush=True)
        except Exception:
            # Last resort: print raw error
            print(f"ERROR:{{\"error\":\"Critical: Failed to serialize error message\",\"type\":\"{message_type}\"}}", flush=True)


def send_progress(
    current: int,
    total: int,
    message: str,
    progress_type: str = "single_progress",
    filename: str = ""
) -> None:
    """Send a progress update message.

    Args:
        current: Current step number
        total: Total number of steps
        message: Progress message
        progress_type: Type of progress (single_progress, batch_progress, etc.)
        filename: Optional filename being processed
    """
    send_json_message("PROGRESS", {
        "current": current,
        "total": total,
        "message": message,
        "type": progress_type,
        "filename": filename
    })


def send_result(success: bool, message: str, data: dict[str, Any] | None = None) -> None:
    """Send a result message indicating success or failure.

    Args:
        success: Whether the operation succeeded
        message: Result message
        data: Optional additional data
    """
    result_data = {
        "success": success,
        "message": message,
        **(data or {})
    }
    send_json_message("RESULT", result_data)


def send_error(error_message: str, error_type: str = "unknown", details: dict[str, Any] | None = None) -> None:
    """Send an error message.

    Args:
        error_message: Error message
        error_type: Type of error
        details: Optional error details
    """
    error_data = {
        "error": error_message,
        "type": error_type,
        **(details or {})
    }
    send_json_message("ERROR", error_data)


def send_batch_result(summary: dict[str, Any]) -> None:
    """Send batch processing results.

    Args:
        summary: Batch processing summary with keys:
            - total_files: Total number of files processed
            - successful: Number of successful conversions
            - failed: Number of failed conversions
            - total_time: Total processing time
            - results: List of individual file results
    """
    send_json_message("RESULT", {
        "success": summary.get("failed", 0) == 0,
        "message": f"Batch complete: {summary.get('successful', 0)}/{summary.get('total_files', 0)} successful",
        "batch_summary": summary
    })


def validate_file_exists(file_path: str, file_description: str = "File") -> None:
    """Validate that a file exists.

    Args:
        file_path: Path to validate
        file_description: Description for error message

    Raises:
        BridgeValidationError: If file doesn't exist
    """
    from pathlib import Path

    logger.debug(f"Validating file exists: {file_path}")
    path = Path(file_path)
    if not path.exists():
        error_code = ErrorCode.VALIDATION_FILE_NOT_FOUND
        logger.error(f"[{error_code}] {file_description} not found: {file_path}")
        raise BridgeValidationError(f"{file_description} not found: {file_path}")
    if not path.is_file():
        error_code = ErrorCode.VALIDATION_INVALID_FORMAT
        logger.error(f"[{error_code}] {file_description} is not a file: {file_path}")
        raise BridgeValidationError(f"{file_description} is not a file: {file_path}")
    logger.debug(f"File validation passed: {file_path}")


def validate_output_directory(output_path: str | None) -> None:
    """Validate that output directory exists or can be created.

    Args:
        output_path: Path to validate (can be None)

    Raises:
        BridgeValidationError: If directory validation fails
    """
    if not output_path:
        logger.debug("Output path not provided, skipping validation")
        return

    from pathlib import Path

    logger.debug(f"Validating output directory: {output_path}")
    path = Path(output_path)

    # If it's an existing directory, ensure it's writable
    if path.exists() and path.is_dir():
        # Check write permissions
        test_file = path / ".write_test"
        try:
            test_file.touch()
            test_file.unlink()
            logger.debug(f"Output directory is writable: {output_path}")
        except (PermissionError, OSError) as e:
            error_code = ErrorCode.BRIDGE_OUTPUT_DIRECTORY_INVALID
            logger.error(f"[{error_code}] Output directory is not writable: {output_path}", exc_info=True)
            raise BridgeValidationError(f"Output directory is not writable: {output_path}") from e

    # If it's a file path, ensure parent directory exists
    elif not path.is_dir():
        parent = path.parent
        if not parent.exists():
            error_code = ErrorCode.BRIDGE_OUTPUT_DIRECTORY_INVALID
            logger.error(f"[{error_code}] Output directory does not exist: {parent}")
            raise BridgeValidationError(f"Output directory does not exist: {parent}")
        logger.debug(f"Output directory validation passed: {parent}")


def format_file_size(size_bytes: int) -> str:
    """Format file size in human-readable format.

    Args:
        size_bytes: Size in bytes

    Returns:
        Formatted string (e.g., "1.5 MB")
    """
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} TB"


def format_duration(seconds: float) -> str:
    """Format duration in human-readable format.

    Args:
        seconds: Duration in seconds

    Returns:
        Formatted string (e.g., "2m 30s")
    """
    if seconds < 60:
        return f"{seconds:.1f}s"

    minutes = int(seconds // 60)
    remaining_seconds = int(seconds % 60)

    if minutes < 60:
        return f"{minutes}m {remaining_seconds}s"

    hours = minutes // 60
    remaining_minutes = minutes % 60
    return f"{hours}h {remaining_minutes}m"


def safe_exit(code: int = 0) -> None:
    """Safely exit the bridge process.

    Args:
        code: Exit code (0 for success, non-zero for error)
    """
    sys.exit(code)
