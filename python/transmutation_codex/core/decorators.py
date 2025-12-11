"""Decorators for converter validation and enhancement.

This module provides decorators that add validation, error handling,
and other cross-cutting concerns to converter functions.
"""

from collections.abc import Callable
from functools import wraps
from pathlib import Path
from typing import Any

from transmutation_codex.core.dependency_checker import get_dependency_checker
from transmutation_codex.core.exceptions import (
    raise_validation_error,
)
from transmutation_codex.utils.validators import (
    validate_file_format,
    validate_file_path,
    validate_file_size,
    validate_output_path,
)


def validate_conversion(
    input_formats: list[str] | None = None,
    max_file_size_mb: int | None = None,
    required_dependencies: list[str] | None = None,
    validate_dependencies: bool = True,
):
    """Decorator to validate conversion inputs before execution.

    Args:
        input_formats: List of acceptable input formats (e.g., ['md', 'markdown'])
        max_file_size_mb: Maximum input file size in megabytes
        required_dependencies: List of required Python modules
        validate_dependencies: Whether to validate external dependencies

    Example:
        @validate_conversion(
            input_formats=['md', 'markdown'],
            max_file_size_mb=50
        )
        def convert_md_to_pdf(input_path, output_path, **options):
            # Validation happens automatically before this runs
            ...
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(
            input_path: str | Path, output_path: str | Path | None = None, **kwargs: Any
        ) -> Path:
            # Convert to Path objects
            input_path_obj = Path(input_path)

            # Validate input file exists and is readable
            is_valid, error = validate_file_path(str(input_path_obj))
            if not is_valid:
                raise_validation_error(f"Input validation failed: {error}")

            # Validate input format if specified
            if input_formats:
                is_valid, error = validate_file_format(
                    str(input_path_obj), input_formats
                )
                if not is_valid:
                    raise_validation_error(f"Format validation failed: {error}")

            # Validate file size if specified
            if max_file_size_mb:
                is_valid, error = validate_file_size(
                    str(input_path_obj), max_file_size_mb
                )
                if not is_valid:
                    raise_validation_error(f"File size validation failed: {error}")

            # Validate dependencies if enabled
            if validate_dependencies:
                # Extract converter type from function name
                converter_type = func.__name__.replace("convert_", "").replace(
                    "_to_", "2"
                )

                # Check dependencies for this converter
                dependency_checker = get_dependency_checker()
                if not dependency_checker.validate_converter(converter_type):
                    raise_validation_error(
                        f"Required dependencies not available for converter {converter_type}"
                    )

            # Validate required dependencies
            if required_dependencies:
                for dep in required_dependencies:
                    try:
                        __import__(dep)
                    except ImportError:
                        raise_validation_error(
                            f"Required dependency '{dep}' is not installed. "
                            f"Install with: pip install {dep}"
                        )

            # Validate output path if provided
            if output_path:
                output_path_obj = Path(output_path)
                # For directories, just check parent exists
                # For files, validate parent directory is writable
                if not output_path_obj.is_dir():
                    is_valid, error = validate_output_path(str(output_path_obj))
                    if not is_valid:
                        raise_validation_error(f"Output validation failed: {error}")

            # Call the original function
            return func(input_path, output_path, **kwargs)

        return wrapper

    return decorator


def validate_options(schema: dict[str, dict[str, Any]]):
    """Decorator to validate converter-specific options.

    Args:
        schema: Dictionary defining option validation rules
            Format: {
                'option_name': {
                    'type': type,
                    'required': bool (default False),
                    'default': Any,
                    'choices': list[Any],
                    'min': Any (for numeric types),
                    'max': Any (for numeric types),
                }
            }

    Example:
        @validate_options({
            'engine': {
                'type': str,
                'choices': ['basic', 'enhanced_ocr'],
                'default': 'basic'
            },
            'dpi': {
                'type': int,
                'min': 72,
                'max': 1200,
                'default': 300
            }
        })
        def convert_pdf_to_md(input_path, output_path, **options):
            # options are validated and have defaults applied
            engine = options['engine']  # Guaranteed to be valid
            dpi = options['dpi']  # Guaranteed to be in range
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(
            input_path: str | Path, output_path: str | Path | None = None, **kwargs: Any
        ) -> Path:
            validated_options = {}

            # Validate each option in schema
            for option_name, rules in schema.items():
                value = kwargs.get(option_name)

                # Check if required
                if rules.get("required", False) and value is None:
                    raise_validation_error(
                        f"Required option '{option_name}' is missing"
                    )

                # Apply default if not provided
                if value is None and "default" in rules:
                    value = rules["default"]

                # Skip validation if value is still None (optional field)
                if value is None:
                    continue

                # Validate type
                expected_type = rules.get("type")
                if expected_type and not isinstance(value, expected_type):
                    raise_validation_error(
                        f"Option '{option_name}' must be of type {expected_type.__name__}, "
                        f"got {type(value).__name__}"
                    )

                # Validate choices
                if "choices" in rules and value not in rules["choices"]:
                    raise_validation_error(
                        f"Option '{option_name}' must be one of {rules['choices']}, "
                        f"got '{value}'"
                    )

                # Validate min/max for numeric types
                if "min" in rules and value < rules["min"]:
                    raise_validation_error(
                        f"Option '{option_name}' must be >= {rules['min']}, got {value}"
                    )
                if "max" in rules and value > rules["max"]:
                    raise_validation_error(
                        f"Option '{option_name}' must be <= {rules['max']}, got {value}"
                    )

                validated_options[option_name] = value

            # Merge validated options with remaining kwargs
            final_options = {**kwargs, **validated_options}

            # Call original function with validated options
            return func(input_path, output_path, **final_options)

        return wrapper

    return decorator


def auto_register_converter(
    source_format: str,
    target_format: str,
    name: str | None = None,
    description: str = "",
    version: str = "1.0.0",
    author: str = "AiChemist Codex",
    priority: int = 50,
    supports_batch: bool = True,
    supports_options: bool = True,
):
    """Decorator to automatically register a converter with the plugin registry.

    This combines the converter function with automatic registration,
    eliminating the need for manual registry calls.

    Args:
        source_format: Source document format
        target_format: Target document format
        name: Plugin name (auto-generated if not provided)
        description: Plugin description
        version: Plugin version
        author: Plugin author
        priority: Plugin priority (lower = higher priority)
        supports_batch: Whether plugin supports batch processing
        supports_options: Whether plugin accepts conversion options

    Example:
        @auto_register_converter(
            source_format='md',
            target_format='pdf',
            description="Convert Markdown to PDF",
            priority=10
        )
        def convert_md_to_pdf(input_path, output_path, **options):
            # Converter is automatically registered on import
            ...
    """

    def decorator(func: Callable) -> Callable:
        from transmutation_codex.core import get_registry

        # Register the converter
        registry = get_registry()
        registry.register_converter(
            source_format=source_format,
            target_format=target_format,
            converter_function=func,
            name=name,
            description=description,
            version=version,
            author=author,
            priority=priority,
            supports_batch=supports_batch,
            supports_options=supports_options,
        )

        return func

    return decorator


def converter(source_format: str, target_format: str, **registration_kwargs: Any):
    """Combined decorator for validation and registration.

    This is a convenience decorator that combines common validation
    with automatic registration.

    Args:
        source_format: Source document format
        target_format: Target document format
        **registration_kwargs: Additional arguments for auto_register_converter

    Example:
        @converter(
            'md', 'pdf',
            description="High-quality Markdown to PDF",
            input_formats=['md', 'markdown'],
            max_file_size_mb=100
        )
        def convert_md_to_pdf(input_path, output_path, **options):
            ...
    """
    # Extract validation kwargs
    validation_kwargs = {}
    if "input_formats" in registration_kwargs:
        validation_kwargs["input_formats"] = registration_kwargs.pop("input_formats")
    if "max_file_size_mb" in registration_kwargs:
        validation_kwargs["max_file_size_mb"] = registration_kwargs.pop(
            "max_file_size_mb"
        )
    if "required_dependencies" in registration_kwargs:
        validation_kwargs["required_dependencies"] = registration_kwargs.pop(
            "required_dependencies"
        )

    def decorator(func: Callable) -> Callable:
        # Apply validation decorator
        if validation_kwargs:
            func = validate_conversion(**validation_kwargs)(func)

        # Apply registration decorator
        func = auto_register_converter(
            source_format=source_format,
            target_format=target_format,
            **registration_kwargs,
        )(func)

        return func

    return decorator
