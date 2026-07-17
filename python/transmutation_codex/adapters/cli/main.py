"""Command-line interface for Transmutation Codex."""

import argparse
import logging
import sys

# Set UTF-8 encoding for stdout/stderr to handle emoji and special characters
if sys.platform == "win32":
    import io

    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

from transmutation_codex.adapters.cli.dependency_status import (
    check_converter_dependencies,
    check_dependency_status,
)
from transmutation_codex.core import get_log_manager


def create_parser() -> argparse.ArgumentParser:
    """Create the main argument parser."""
    parser = argparse.ArgumentParser(
        description="AiChemist Transmutation Codex - Document Conversion Toolkit",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Check all dependencies
  python -m transmutation_codex.adapters.cli.main --check-deps

  # Check dependencies for specific converter
  python -m transmutation_codex.adapters.cli.main --check-converter-deps pdf2md

  # Launch GUI
  python -m transmutation_codex.adapters.cli.main --gui
        """,
    )

    # Main actions
    action_group = parser.add_mutually_exclusive_group(required=True)
    action_group.add_argument(
        "--check-deps", action="store_true", help="Check dependency status"
    )
    action_group.add_argument(
        "--check-converter-deps",
        metavar="CONVERTER_TYPE",
        help="Check dependencies for specific converter (e.g., pdf2md, xlsx2pdf)",
    )
    action_group.add_argument(
        "--gui", action="store_true", help="Launch the GUI application"
    )

    # Output options
    parser.add_argument(
        "--output-format",
        choices=["text", "json"],
        default="text",
        help="Output format for dependency checks (default: text)",
    )

    # Logging options
    parser.add_argument(
        "--log-level",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        default="INFO",
        help="Set logging level (default: INFO)",
    )

    return parser


def main() -> None:
    """Main CLI entry point."""
    parser = create_parser()
    args = parser.parse_args()

    # Initialize logging
    log_manager = get_log_manager()
    # Note: LogManager configures level from config files
    # The --log-level arg can be used for overriding in future updates
    logger = log_manager.get_converter_logger("cli")

    # Set logger level dynamically if provided
    if args.log_level:
        logger.setLevel(getattr(logging, args.log_level))

    try:
        if args.check_deps:
            check_dependency_status(args.output_format)
        elif args.check_converter_deps:
            check_converter_dependencies(args.check_converter_deps)
        elif args.gui:
            # Import GUI launcher
            try:
                from transmutation_codex.adapters.cli.gui_launcher import launch_gui

                launch_gui()
            except ImportError:
                logger.error("GUI launcher not available")
                print("❌ GUI launcher not available")
                sys.exit(1)
        else:
            parser.print_help()
            sys.exit(1)

    except KeyboardInterrupt:
        logger.info("Operation cancelled by user")
        print("\n⚠️  Operation cancelled")
        sys.exit(1)
    except Exception as e:
        logger.error(f"CLI error: {e}")
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
