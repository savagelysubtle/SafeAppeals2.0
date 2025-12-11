"""Bridge adapters for frontend communication.

This package provides bridge implementations for connecting the Python backend
to various frontend applications (primarily Electron).

The bridge is organized into modular components:
- base: Common utilities and message sending
- progress_reporter: Progress reporting functionality
- argument_parser: CLI argument parsing and validation
- conversion_handler: Conversion execution logic
- electron_bridge: Main entry point
"""

from .base import (
    BridgeError,
    BridgeValidationError,
    BridgeConversionError,
    send_json_message,
    send_progress,
    send_result,
    send_error,
)

from .progress_reporter import (
    ProgressReporter,
    BatchProgressReporter,
    create_progress_callback,
)

from .argument_parser import (
    BridgeArguments,
    parse_bridge_arguments,
    parse_legacy_arguments,
)

from .conversion_handler import (
    handle_single_conversion,
    handle_batch_conversion,
    handle_pdf_merge,
    handle_conversion,
)

__all__ = [
    # Base utilities
    "BridgeError",
    "BridgeValidationError",
    "BridgeConversionError",
    "send_json_message",
    "send_progress",
    "send_result",
    "send_error",
    # Progress reporting
    "ProgressReporter",
    "BatchProgressReporter",
    "create_progress_callback",
    # Argument parsing
    "BridgeArguments",
    "parse_bridge_arguments",
    "parse_legacy_arguments",
    # Conversion handling
    "handle_single_conversion",
    "handle_batch_conversion",
    "handle_pdf_merge",
    "handle_conversion",
]
