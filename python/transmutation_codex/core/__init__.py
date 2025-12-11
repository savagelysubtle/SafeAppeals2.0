"""Core modules for the Transmutation Codex.

This package contains the fundamental business logic and architecture
components that define the application's behavior and are heavily
depended upon by other modules.
"""

# Core business logic modules
from .config_manager import (
    ConfigManager,
    ConversionPreset,
    UserPreferences,
    configure_manager,
    get_config_manager,
    get_conversion_preset,
    get_environment_config,
    get_user_preferences,
    update_user_preferences,
)
from .dependency_checker import DependencyChecker, get_dependency_checker
from .events import (
    ConversionEvent,
    ErrorEvent,
    Event,
    EventBus,
    EventHandler,
    EventPriority,
    EventTypes,
    ProgressEvent,
    emit,
    get_event_bus,
    publish,
    subscribe,
    unsubscribe,
)
from .error_codes import ErrorCode, ErrorCategory, get_error_message
from .exceptions import (
    BatchProcessingError,
    ConfigurationError,
    ConversionError,
    DependencyError,
    FileOperationError,
    LicenseError,
    OCRError,
    PluginError,
    ProgressError,
    SecurityError,
    TransmutationError,
    TransmutationMemoryError,
    TransmutationTimeoutError,
    TrialExpiredError,
    ValidationError,
    raise_conversion_error,
    raise_dependency_error,
    raise_license_error,
    raise_ocr_error,
    raise_security_error,
    raise_trial_expired_error,
    raise_validation_error,
)

from .licensing_stubs import (
    check_feature_access,
    check_file_size_limit,
    record_conversion_attempt,
)
from .logger import LogManager
from .presets import (
    ConversionPreset as PresetConversionPreset,
)
from .presets import (
    PresetManager,
    get_preset_manager,
)
from .progress import (
    OperationProgress,
    OperationStatus,
    ProgressStep,
    ProgressTracker,
    cancel_operation,
    complete_operation,
    get_operation,
    get_progress_tracker,
    start_operation,
    update_progress,
)
from .registry import (
    PluginInfo,
    PluginRegistry,
    converter,
    get_registry,
    register_converter,
)

# Singleton instance for LogManager
_log_manager_instance: LogManager | None = None


def get_log_manager() -> LogManager:
    """Get or create the singleton LogManager instance.

    This ensures consistent initialization across the codebase and prevents
    issues with logs_dir path resolution.

    Returns:
        LogManager: The singleton LogManager instance with proper configuration.

    Examples:
        >>> from transmutation_codex.core import get_log_manager
        >>> logger = get_log_manager().get_converter_logger("md2pdf")
        >>> logger.info("Converting markdown to PDF")
    """
    global _log_manager_instance
    if _log_manager_instance is None:
        _log_manager_instance = LogManager()  # Will use project root
    return _log_manager_instance


# Core module exports (alphabetically sorted)
__all__ = [
    "BatchProcessingError",
    "ConfigManager",
    "ConfigurationError",
    "ConversionError",
    "ConversionEvent",
    "ConversionPreset",
    "DependencyChecker",
    "DependencyError",
    "ErrorCategory",
    "ErrorCode",
    "ErrorEvent",
    "Event",
    "EventBus",
    "EventHandler",
    "EventPriority",
    "EventTypes",
    "FileOperationError",
    "LicenseError",
    "LogManager",
    "OCRError",
    "OperationProgress",
    "OperationStatus",
    "PluginError",
    "PluginInfo",
    "PluginRegistry",
    "PresetConversionPreset",
    "PresetManager",
    "ProgressError",
    "ProgressEvent",
    "ProgressStep",
    "ProgressTracker",
    "SecurityError",
    "TransmutationError",
    "TransmutationMemoryError",
    "TransmutationTimeoutError",
    "TrialExpiredError",
    "UserPreferences",
    "ValidationError",
    "cancel_operation",
    "check_feature_access",
    "check_file_size_limit",
    "complete_operation",
    "configure_manager",
    "converter",
    "emit",
    "get_config_manager",
    "get_conversion_preset",
    "get_dependency_checker",
    "get_environment_config",
    "get_error_message",
    "get_event_bus",
    "get_log_manager",
    "get_operation",
    "get_preset_manager",
    "get_progress_tracker",
    "get_registry",
    "get_user_preferences",
    "publish",
    "raise_conversion_error",
    "raise_dependency_error",
    "raise_license_error",
    "raise_ocr_error",
    "raise_security_error",
    "raise_trial_expired_error",
    "raise_validation_error",
    "record_conversion_attempt",
    "register_converter",
    "start_operation",
    "subscribe",
    "unsubscribe",
    "update_progress",
    "update_user_preferences",
]
