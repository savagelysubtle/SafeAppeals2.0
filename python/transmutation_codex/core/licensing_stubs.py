"""Licensing stubs for SafeAppeals integration.

This module provides stub functions for licensing functionality that was removed
from the SafeAppeals version. These stubs allow converters to call licensing
functions without errors, but they do nothing (no-op).
"""

from typing import Any


def check_feature_access(feature: str) -> bool:
    """Stub for feature access check - always returns True.

    Args:
        feature: Feature identifier (e.g., "md2pdf", "pdf2md")

    Returns:
        bool: Always True (no restrictions)
    """
    return True


def check_file_size_limit(file_path: str) -> bool:
    """Stub for file size limit check - always returns True.

    Args:
        file_path: Path to file to check

    Returns:
        bool: Always True (no size restrictions)
    """
    return True


def record_conversion_attempt(
    conversion_type: str,
    file_path: str | None = None,
    **kwargs: Any
) -> None:
    """Stub for conversion attempt recording - does nothing.

    Args:
        conversion_type: Type of conversion (e.g., "md2pdf")
        file_path: Optional path to file being converted
        **kwargs: Additional parameters (ignored)
    """
    pass  # No-op

