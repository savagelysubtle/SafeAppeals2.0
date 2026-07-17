"""Progress reporting for bridge communication.

This module provides a unified interface for reporting progress from conversion
operations to the frontend, with support for both single-file and batch operations.
"""

from typing import Any

from transmutation_codex.core import get_log_manager

from .base import send_progress, send_result, send_error

# Setup logger
logger = get_log_manager().get_bridge_logger()


class ProgressReporter:
    """Manages progress reporting for bridge operations.

    This class encapsulates progress tracking and reporting logic,
    providing a clean interface for conversion operations to report
    their status to the frontend.
    """

    def __init__(self, operation_type: str = "single"):
        """Initialize the progress reporter.

        Args:
            operation_type: Type of operation ("single" or "batch")
        """
        self.operation_type = operation_type
        self.current_file = ""
        self.total_steps = 100
        self.current_step = 0

    def report(
        self,
        current: int,
        total: int,
        message: str,
        filename: str = ""
    ) -> None:
        """Report progress for current operation.

        Args:
            current: Current step number
            total: Total number of steps
            message: Progress message
            filename: Optional filename being processed
        """
        self.current_step = current
        self.total_steps = total

        progress_type = f"{self.operation_type}_progress"
        logger.debug(f"Reporting progress: {current}/{total} - {message}")
        send_progress(current, total, message, progress_type, filename or self.current_file)

    def report_single(
        self,
        current: int,
        total: int,
        message: str
    ) -> None:
        """Report progress for single file conversion.

        Args:
            current: Current step number
            total: Total number of steps
            message: Progress message
        """
        send_progress(current, total, message, "single_progress", self.current_file)

    def report_batch(
        self,
        current: int,
        total: int,
        message: str,
        filename: str = ""
    ) -> None:
        """Report progress for batch conversion.

        Args:
            current: Current file number
            total: Total number of files
            message: Progress message
            filename: Current filename being processed
        """
        send_progress(current, total, message, "batch_progress", filename)

    def report_error(self, error_message: str, error_type: str = "conversion") -> None:
        """Report an error.

        Args:
            error_message: Error message
            error_type: Type of error
        """
        logger.error(f"Reporting error ({error_type}): {error_message}")
        progress_type = f"{self.operation_type}_error"
        send_progress(
            self.current_step,
            self.total_steps,
            f"Error: {error_message}",
            progress_type,
            self.current_file
        )
        send_error(error_message, error_type)

    def report_success(self, message: str, data: dict[str, Any] | None = None) -> None:
        """Report successful completion.

        Args:
            message: Success message
            data: Optional additional data
        """
        logger.info(f"Reporting success: {message}")
        send_result(True, message, data)

    def report_failure(self, message: str, data: dict[str, Any] | None = None) -> None:
        """Report operation failure.

        Args:
            message: Failure message
            data: Optional additional data
        """
        send_result(False, message, data)

    def set_current_file(self, filename: str) -> None:
        """Set the current file being processed.

        Args:
            filename: Name of the file
        """
        self.current_file = filename

    def start_operation(self, total_steps: int = 100, message: str = "Starting...") -> None:
        """Mark the start of an operation.

        Args:
            total_steps: Total number of steps expected
            message: Initial message
        """
        self.total_steps = total_steps
        self.current_step = 0
        self.report(0, total_steps, message)

    def complete_operation(self, message: str = "Complete") -> None:
        """Mark the completion of an operation.

        Args:
            message: Completion message
        """
        self.report(self.total_steps, self.total_steps, message)


class BatchProgressReporter(ProgressReporter):
    """Progress reporter specifically for batch operations.

    Extends ProgressReporter with batch-specific functionality.
    """

    def __init__(self):
        """Initialize batch progress reporter."""
        super().__init__(operation_type="batch")
        self.total_files = 0
        self.current_file_index = 0
        self.successful_files = 0
        self.failed_files = 0

    def start_batch(self, total_files: int) -> None:
        """Start a batch operation.

        Args:
            total_files: Total number of files to process
        """
        logger.info(f"Starting batch operation with {total_files} files")
        self.total_files = total_files
        self.current_file_index = 0
        self.successful_files = 0
        self.failed_files = 0
        self.report_batch(0, total_files, f"Starting batch of {total_files} files")

    def start_file(self, filename: str, index: int) -> None:
        """Start processing a file in the batch.

        Args:
            filename: Name of the file
            index: Index of the file (1-based)
        """
        self.current_file = filename
        self.current_file_index = index
        self.report_batch(
            index,
            self.total_files,
            f"Processing file {index}/{self.total_files}",
            filename
        )

    def complete_file(self, filename: str, success: bool) -> None:
        """Mark a file as complete.

        Args:
            filename: Name of the file
            success: Whether the file was processed successfully
        """
        if success:
            self.successful_files += 1
        else:
            self.failed_files += 1

    def complete_batch(self) -> None:
        """Complete the batch operation."""
        message = (
            f"Batch complete: {self.successful_files}/{self.total_files} successful, "
            f"{self.failed_files} failed"
        )
        logger.info(f"Batch operation complete: {self.successful_files}/{self.total_files} successful, {self.failed_files} failed")
        self.report_batch(self.total_files, self.total_files, message)
        self.report_success(message, {
            "total": self.total_files,
            "successful": self.successful_files,
            "failed": self.failed_files
        })


def create_progress_callback(reporter: ProgressReporter):
    """Create a progress callback function for use with converters.

    Args:
        reporter: ProgressReporter instance

    Returns:
        Callable that can be passed to conversion functions
    """
    def callback(current: int, total: int, message: str, filename: str = ""):
        """Progress callback function.

        Args:
            current: Current step
            total: Total steps
            message: Progress message
            filename: Optional filename
        """
        reporter.report(current, total, message, filename)

    return callback
