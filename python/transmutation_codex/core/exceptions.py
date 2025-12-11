"""Exception classes for the Transmutation Codex.

This module defines the exception hierarchy for all transmutation operations,
providing specific error types for different failure modes and enabling
precise error handling throughout the application.
"""

from typing import Any


class TransmutationError(Exception):
    """Base exception for all transmutation operations.

    This is the root exception that all other transmutation-related
    exceptions inherit from, enabling catch-all error handling.
    """

    def __init__(
        self,
        message: str,
        details: dict[str, Any] | None = None,
        error_code: str | None = None,
    ):
        """Initialize the exception.

        Args:
            message: Human-readable error message
            details: Optional dictionary with additional error details
            error_code: Optional standardized error code for tracking
        """
        super().__init__(message)
        self.message = message
        self.details = details or {}
        self.error_code = error_code

    def __str__(self) -> str:
        """Return string representation of the exception."""
        if self.details:
            detail_str = ", ".join(f"{k}={v}" for k, v in self.details.items())
            return f"{self.message} ({detail_str})"
        return self.message

    def to_dict(self) -> dict[str, Any]:
        """Convert exception to dictionary for serialization."""
        result = {
            "type": self.__class__.__name__,
            "message": self.message,
            "details": self.details,
        }
        if self.error_code:
            result["error_code"] = self.error_code
        return result


class ValidationError(TransmutationError):
    """Raised when input validation fails.

    This exception is raised when user inputs, file paths, formats,
    or other parameters fail validation checks.
    """

    def __init__(
        self,
        message: str,
        field: str | None = None,
        value: Any | None = None,
        error_code: str | None = None,
    ):
        """Initialize validation error.

        Args:
            message: Error message
            field: Name of the field that failed validation
            value: The invalid value that caused the error
            error_code: Optional standardized error code for tracking
        """
        details = {}
        if field:
            details["field"] = field
        if value is not None:
            details["value"] = str(value)
        if error_code:
            details["error_code"] = error_code

        super().__init__(message, details, error_code)
        self.field = field
        self.value = value


class ConversionError(TransmutationError):
    """Raised when document conversion fails.

    This exception covers all document conversion failures, including
    format-specific errors, processing failures, and output generation errors.
    """

    def __init__(
        self,
        message: str,
        source_format: str | None = None,
        target_format: str | None = None,
        source_file: str | None = None,
        error_code: str | None = None,
    ):
        """Initialize conversion error.

        Args:
            message: Error message
            source_format: Source document format
            target_format: Target document format
            source_file: Source file path
            error_code: Optional standardized error code for tracking
        """
        details = {}
        if source_format:
            details["source_format"] = source_format
        if target_format:
            details["target_format"] = target_format
        if source_file:
            details["source_file"] = source_file
        if error_code:
            details["error_code"] = error_code

        super().__init__(message, details, error_code)
        self.source_format = source_format
        self.target_format = target_format
        self.source_file = source_file


class OCRError(ConversionError):
    """Raised when OCR processing fails.

    This exception is specifically for OCR-related failures when processing
    scanned PDFs or image-based documents.
    """

    def __init__(
        self,
        message: str,
        language: str | None = None,
        dpi: int | None = None,
        page_number: int | None = None,
    ):
        """Initialize OCR error.

        Args:
            message: Error message
            language: OCR language setting
            dpi: DPI setting used for OCR
            page_number: Page number where OCR failed
        """
        details = {}
        if language:
            details["language"] = language
        if dpi:
            details["dpi"] = dpi
        if page_number is not None:
            details["page_number"] = page_number

        super().__init__(message, details=details)
        self.language = language
        self.dpi = dpi
        self.page_number = page_number


class PluginError(TransmutationError):
    """Raised when plugin operations fail.

    This exception covers plugin loading, registration, and execution failures.
    """

    def __init__(
        self, message: str, plugin_name: str | None = None, operation: str | None = None
    ):
        """Initialize plugin error.

        Args:
            message: Error message
            plugin_name: Name of the plugin that failed
            operation: Operation that was being performed
        """
        details = {}
        if plugin_name:
            details["plugin_name"] = plugin_name
        if operation:
            details["operation"] = operation

        super().__init__(message, details)
        self.plugin_name = plugin_name
        self.operation = operation


class ConfigurationError(TransmutationError):
    """Raised when configuration is invalid or missing.

    This exception covers configuration file errors, missing settings,
    and invalid configuration values.
    """

    def __init__(
        self,
        message: str,
        config_key: str | None = None,
        config_file: str | None = None,
    ):
        """Initialize configuration error.

        Args:
            message: Error message
            config_key: Configuration key that caused the error
            config_file: Configuration file path
        """
        details = {}
        if config_key:
            details["config_key"] = config_key
        if config_file:
            details["config_file"] = config_file

        super().__init__(message, details)
        self.config_key = config_key
        self.config_file = config_file


class SecurityError(TransmutationError):
    """Raised when security validation fails.

    This exception covers path traversal attempts, dangerous file types,
    and other security-related violations.
    """

    def __init__(
        self,
        message: str,
        security_check: str | None = None,
        attempted_path: str | None = None,
    ):
        """Initialize security error.

        Args:
            message: Error message
            security_check: Type of security check that failed
            attempted_path: Path that triggered the security violation
        """
        details = {}
        if security_check:
            details["security_check"] = security_check
        if attempted_path:
            details["attempted_path"] = attempted_path

        super().__init__(message, details)
        self.security_check = security_check
        self.attempted_path = attempted_path


class ProgressError(TransmutationError):
    """Raised when progress tracking operations fail.

    This exception covers progress tracking initialization, updates,
    and completion failures.
    """

    def __init__(
        self,
        message: str,
        operation_id: str | None = None,
        current_step: int | None = None,
        total_steps: int | None = None,
    ):
        """Initialize progress error.

        Args:
            message: Error message
            operation_id: ID of the operation being tracked
            current_step: Current step number
            total_steps: Total number of steps
        """
        details = {}
        if operation_id:
            details["operation_id"] = operation_id
        if current_step is not None:
            details["current_step"] = current_step
        if total_steps is not None:
            details["total_steps"] = total_steps

        super().__init__(message, details)
        self.operation_id = operation_id
        self.current_step = current_step
        self.total_steps = total_steps


class DependencyError(TransmutationError):
    """Raised when external dependencies are missing or invalid.

    This exception covers missing Tesseract, pandoc, or other external
    tools required for document conversion.
    """

    def __init__(
        self,
        message: str,
        dependency_name: str | None = None,
        required_version: str | None = None,
        found_version: str | None = None,
    ):
        """Initialize dependency error.

        Args:
            message: Error message
            dependency_name: Name of the missing dependency
            required_version: Required version of the dependency
            found_version: Found version (if any)
        """
        details = {}
        if dependency_name:
            details["dependency_name"] = dependency_name
        if required_version:
            details["required_version"] = required_version
        if found_version:
            details["found_version"] = found_version

        super().__init__(message, details)
        self.dependency_name = dependency_name
        self.required_version = required_version
        self.found_version = found_version


class FileOperationError(TransmutationError):
    """Raised when file operations fail.

    This exception covers file reading, writing, copying, moving,
    and other file system operations.
    """

    def __init__(
        self,
        message: str,
        operation: str | None = None,
        file_path: str | None = None,
        permissions: str | None = None,
    ):
        """Initialize file operation error.

        Args:
            message: Error message
            operation: File operation that failed (read, write, copy, etc.)
            file_path: Path to the file involved in the operation
            permissions: Required permissions for the operation
        """
        details = {}
        if operation:
            details["operation"] = operation
        if file_path:
            details["file_path"] = file_path
        if permissions:
            details["permissions"] = permissions

        super().__init__(message, details)
        self.operation = operation
        self.file_path = file_path
        self.permissions = permissions


class BatchProcessingError(TransmutationError):
    """Raised when batch processing operations fail.

    This exception covers failures in batch conversion operations,
    including partial failures and resource exhaustion.
    """

    def __init__(
        self,
        message: str,
        total_files: int | None = None,
        processed_files: int | None = None,
        failed_files: int | None = None,
    ):
        """Initialize batch processing error.

        Args:
            message: Error message
            total_files: Total number of files in batch
            processed_files: Number of successfully processed files
            failed_files: Number of failed files
        """
        details = {}
        if total_files is not None:
            details["total_files"] = total_files
        if processed_files is not None:
            details["processed_files"] = processed_files
        if failed_files is not None:
            details["failed_files"] = failed_files

        super().__init__(message, details)
        self.total_files = total_files
        self.processed_files = processed_files
        self.failed_files = failed_files


class TransmutationMemoryError(TransmutationError):
    """Raised when memory-related issues occur during processing.

    This exception covers out-of-memory conditions and memory allocation
    failures during document processing.

    Note: Named TransmutationMemoryError to avoid shadowing Python's builtin MemoryError.
    """

    def __init__(
        self,
        message: str,
        operation: str | None = None,
        file_size: int | None = None,
        available_memory: int | None = None,
    ):
        """Initialize memory error.

        Args:
            message: Error message
            operation: Operation that caused the memory issue
            file_size: Size of file being processed
            available_memory: Available memory in bytes
        """
        details = {}
        if operation:
            details["operation"] = operation
        if file_size is not None:
            details["file_size"] = file_size
        if available_memory is not None:
            details["available_memory"] = available_memory

        super().__init__(message, details)
        self.operation = operation
        self.file_size = file_size
        self.available_memory = available_memory


class TransmutationTimeoutError(TransmutationError):
    """Raised when operations exceed time limits.

    This exception covers conversion timeouts and other time-based failures.

    Note: Named TransmutationTimeoutError to avoid shadowing Python's builtin TimeoutError.
    """

    def __init__(
        self,
        message: str,
        operation: str | None = None,
        timeout_seconds: int | None = None,
        elapsed_seconds: float | None = None,
    ):
        """Initialize timeout error.

        Args:
            message: Error message
            operation: Operation that timed out
            timeout_seconds: Configured timeout in seconds
            elapsed_seconds: Actual elapsed time
        """
        details = {}
        if operation:
            details["operation"] = operation
        if timeout_seconds is not None:
            details["timeout_seconds"] = timeout_seconds
        if elapsed_seconds is not None:
            details["elapsed_seconds"] = elapsed_seconds

        super().__init__(message, details)
        self.operation = operation
        self.timeout_seconds = timeout_seconds
        self.elapsed_seconds = elapsed_seconds


class LicenseError(TransmutationError):
    """Raised when license validation or verification fails.

    This exception covers invalid license keys, expired licenses,
    feature access denial, and license activation failures.
    """

    def __init__(
        self,
        message: str,
        license_type: str | None = None,
        feature: str | None = None,
        reason: str | None = None,
    ):
        """Initialize license error.

        Args:
            message: Error message
            license_type: Type of license (free, trial, paid)
            feature: Feature that requires a license
            reason: Specific reason for license failure
        """
        details = {}
        if license_type:
            details["license_type"] = license_type
        if feature:
            details["feature"] = feature
        if reason:
            details["reason"] = reason

        super().__init__(message, details)
        self.license_type = license_type
        self.feature = feature
        self.reason = reason


class TrialExpiredError(LicenseError):
    """Raised when trial period has expired.

    This exception is raised when the user's trial has expired
    (either by time or conversion count) and they attempt to use
    restricted features.
    """

    def __init__(
        self,
        message: str,
        conversions_used: int | None = None,
        trial_limit: int | None = None,
    ):
        """Initialize trial expired error.

        Args:
            message: Error message
            conversions_used: Number of conversions already used
            trial_limit: Maximum conversions allowed in trial
        """
        details = {}
        if conversions_used is not None:
            details["conversions_used"] = conversions_used
        if trial_limit is not None:
            details["trial_limit"] = trial_limit

        super().__init__(message, license_type="trial", reason="expired")
        self.conversions_used = conversions_used
        self.trial_limit = trial_limit


# Convenience functions for raising common exceptions


def raise_validation_error(
    message: str,
    field: str | None = None,
    value: Any | None = None,
    error_code: str | None = None,
) -> None:
    """Raise a ValidationError with the given parameters."""
    raise ValidationError(message, field, value, error_code)


def raise_conversion_error(
    message: str,
    source_format: str | None = None,
    target_format: str | None = None,
    source_file: str | None = None,
    error_code: str | None = None,
) -> None:
    """Raise a ConversionError with the given parameters."""
    raise ConversionError(message, source_format, target_format, source_file, error_code)


def raise_ocr_error(
    message: str,
    language: str | None = None,
    dpi: int | None = None,
    page_number: int | None = None,
) -> None:
    """Raise an OCRError with the given parameters."""
    raise OCRError(message, language, dpi, page_number)


def raise_security_error(
    message: str, security_check: str | None = None, attempted_path: str | None = None
) -> None:
    """Raise a SecurityError with the given parameters."""
    raise SecurityError(message, security_check, attempted_path)


def raise_dependency_error(
    message: str,
    dependency_name: str | None = None,
    required_version: str | None = None,
    found_version: str | None = None,
) -> None:
    """Raise a DependencyError with the given parameters."""
    raise DependencyError(message, dependency_name, required_version, found_version)


def raise_license_error(
    message: str,
    license_type: str | None = None,
    feature: str | None = None,
    reason: str | None = None,
) -> None:
    """Raise a LicenseError with the given parameters."""
    raise LicenseError(message, license_type, feature, reason)


def raise_trial_expired_error(
    message: str,
    conversions_used: int | None = None,
    trial_limit: int | None = None,
) -> None:
    """Raise a TrialExpiredError with the given parameters."""
    raise TrialExpiredError(message, conversions_used, trial_limit)
