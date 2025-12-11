#!/usr/bin/env python
"""Electron Bridge - Main entry point for frontend communication.

This module provides the main entry point for the Electron bridge, handling
command-line arguments and routing to appropriate conversion handlers.

The bridge has been refactored into a modular architecture:
- base.py: Common utilities and message sending
- progress_reporter.py: Progress reporting to frontend
- argument_parser.py: CLI argument parsing
- conversion_handler.py: Conversion execution logic
"""

import sys
from pathlib import Path

# Resolve the project's 'backend' directory and add it to sys.path
_backend_dir_path = Path(__file__).resolve().parent.parent.parent.parent
if str(_backend_dir_path) not in sys.path:
    sys.path.insert(0, str(_backend_dir_path))

# Imports from the transmutation_codex package MUST come AFTER sys.path modification
from transmutation_codex.adapters.bridges.argument_parser import parse_legacy_arguments
from transmutation_codex.adapters.bridges.base import safe_exit, send_error
from transmutation_codex.adapters.bridges.conversion_handler import handle_conversion
from transmutation_codex.core import ErrorCode, get_log_manager


def main() -> int:
    """Main entry point for the electron bridge.

    Returns:
        Exit code (0 for success, non-zero for failure)
    """
    logger = None

    try:
        # Initialize logging
        logger = get_log_manager().get_bridge_logger()
        logger.info("Electron bridge starting")

        # Parse arguments (using legacy format for backward compatibility)
        args = parse_legacy_arguments()

        logger.info(f"Bridge mode: {args.mode}, type: {args.conversion_type}")

        # Handle the conversion
        exit_code = handle_conversion(args)

        logger.info(f"Electron bridge exiting with code {exit_code}")
        return exit_code

    except Exception as e:
        error_code = ErrorCode.BRIDGE_CONVERSION_EXECUTION_FAILED
        error_msg = f"Bridge error: {e}"

        if logger:
            logger.error(f"[{error_code}] {error_msg}", exc_info=True)
        else:
            print(f"ERROR: {error_msg}", file=sys.stderr)

        send_error(error_msg, "bridge_error", {"error_code": error_code})
        return 1


if __name__ == "__main__":
    exit_code = main()
    safe_exit(exit_code)
