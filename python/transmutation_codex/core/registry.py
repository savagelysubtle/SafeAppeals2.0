"""Plugin registry system for the Transmutation Codex.

This module provides the central registry for managing document conversion
plugins, allowing dynamic registration and retrieval of conversion functions
based on format types. It implements the Factory pattern for plugin management.
"""

import inspect
from collections.abc import Callable
from dataclasses import dataclass

from .exceptions import PluginError, ValidationError


@dataclass
class PluginInfo:
    """Information about a registered plugin."""

    name: str
    source_format: str
    target_format: str
    converter_function: Callable
    description: str
    version: str
    author: str
    priority: int = 50  # Lower number = higher priority
    supports_batch: bool = False
    supports_options: bool = False
    required_dependencies: list[str] = None

    def __post_init__(self):
        if self.required_dependencies is None:
            self.required_dependencies = []

    @property
    def conversion_key(self) -> str:
        """Get the conversion key for this plugin."""
        return f"{self.source_format}2{self.target_format}"

    def __str__(self) -> str:
        return f"{self.name} ({self.conversion_key}) v{self.version}"


class PluginRegistry:
    """Central registry for document conversion plugins.

    This class manages the registration, discovery, and execution of
    conversion plugins, providing a unified interface for all document
    transformations.
    """

    def __init__(self):
        """Initialize the plugin registry."""
        self._plugins: dict[str, list[PluginInfo]] = {}
        self._aliases: dict[str, str] = {}
        self._cache: dict[str, PluginInfo] = {}

        # Set up format aliases
        self._setup_format_aliases()

    def _setup_format_aliases(self) -> None:
        """Set up common format aliases."""
        self._aliases.update(
            {
                "markdown": "md",
                "htm": "html",
                "docx": "docx",
                "doc": "doc",
                "pdf": "pdf",
                "txt": "txt",
            }
        )

    def normalize_format(self, format_name: str) -> str:
        """Normalize a format name using aliases.

        Args:
            format_name: Format name to normalize

        Returns:
            Normalized format name
        """
        if not format_name:
            return ""

        normalized = format_name.lower().strip()
        return self._aliases.get(normalized, normalized)

    def register_converter(
        self,
        source_format: str,
        target_format: str,
        converter_function: Callable,
        name: str | None = None,
        description: str = "",
        version: str = "1.0.0",
        author: str = "",
        priority: int = 50,
        supports_batch: bool = False,
        supports_options: bool = False,
        required_dependencies: list[str] | None = None,
    ) -> None:
        """Register a conversion plugin.

        Args:
            source_format: Source document format
            target_format: Target document format
            converter_function: Function that performs the conversion
            name: Plugin name (auto-generated if not provided)
            description: Plugin description
            version: Plugin version
            author: Plugin author
            priority: Plugin priority (lower = higher priority)
            supports_batch: Whether plugin supports batch processing
            supports_options: Whether plugin accepts conversion options
            required_dependencies: List of required external dependencies
        """
        # Normalize formats
        source_format = self.normalize_format(source_format)
        target_format = self.normalize_format(target_format)

        # Validate inputs
        if not source_format or not target_format:
            raise ValidationError("Source and target formats must be specified")

        if not callable(converter_function):
            raise ValidationError("Converter function must be callable")

        # Auto-generate name if not provided
        if not name:
            func_name = getattr(converter_function, "__name__", "unknown")
            name = f"{source_format}_to_{target_format}_{func_name}"

        # Validate function signature
        self._validate_converter_function(converter_function, supports_options)

        # Create plugin info
        plugin_info = PluginInfo(
            name=name,
            source_format=source_format,
            target_format=target_format,
            converter_function=converter_function,
            description=description,
            version=version,
            author=author,
            priority=priority,
            supports_batch=supports_batch,
            supports_options=supports_options,
            required_dependencies=required_dependencies or [],
        )

        # Register the plugin
        conversion_key = plugin_info.conversion_key
        if conversion_key not in self._plugins:
            self._plugins[conversion_key] = []

        self._plugins[conversion_key].append(plugin_info)

        # Sort by priority (lower number = higher priority)
        self._plugins[conversion_key].sort(key=lambda p: p.priority)

        # Clear cache for this conversion type
        self._cache.pop(conversion_key, None)

    def _validate_converter_function(
        self, func: Callable, supports_options: bool
    ) -> None:
        """Validate that a converter function has the expected signature.

        Args:
            func: Function to validate
            supports_options: Whether function should accept options
        """
        try:
            sig = inspect.signature(func)
            params = list(sig.parameters.keys())

            # Basic validation: should have at least input_path and output_path
            if len(params) < 2:
                raise ValidationError(
                    f"Converter function must have at least 2 parameters (input_path, output_path), "
                    f"got {len(params)}: {params}"
                )

            # Check for expected parameter names
            expected_params = ["input_path", "output_path"]
            for i, expected in enumerate(expected_params):
                if i < len(params) and params[i] != expected:
                    # Allow some flexibility in naming
                    pass  # Could add stricter validation here if needed

        except Exception as e:
            raise ValidationError(
                f"Error validating converter function signature: {e!s}"
            )

    def get_converter(
        self, source_format: str, target_format: str, plugin_name: str | None = None
    ) -> PluginInfo | None:
        """Get a converter plugin for the specified formats.

        Args:
            source_format: Source document format
            target_format: Target document format
            plugin_name: Specific plugin name (optional)

        Returns:
            PluginInfo if found, None otherwise
        """
        # Normalize formats
        source_format = self.normalize_format(source_format)
        target_format = self.normalize_format(target_format)

        conversion_key = f"{source_format}2{target_format}"

        # Check cache first
        cache_key = f"{conversion_key}:{plugin_name or 'default'}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        # Get available plugins for this conversion
        available_plugins = self._plugins.get(conversion_key, [])

        if not available_plugins:
            return None

        # If specific plugin requested, find it
        if plugin_name:
            for plugin in available_plugins:
                if plugin.name == plugin_name:
                    self._cache[cache_key] = plugin
                    return plugin
            return None

        # Return highest priority plugin (first in sorted list)
        best_plugin = available_plugins[0]
        self._cache[cache_key] = best_plugin
        return best_plugin

    def get_available_conversions(self) -> dict[str, list[str]]:
        """Get all available conversions.

        Returns:
            Dictionary mapping source formats to lists of target formats
        """
        conversions = {}

        for conversion_key in self._plugins.keys():
            if "2" in conversion_key:
                source, target = conversion_key.split("2", 1)
                if source not in conversions:
                    conversions[source] = []
                if target not in conversions[source]:
                    conversions[source].append(target)

        # Sort target formats for consistency
        for source in conversions:
            conversions[source].sort()

        return conversions

    def get_plugins_for_conversion(
        self, source_format: str, target_format: str
    ) -> list[PluginInfo]:
        """Get all plugins available for a conversion.

        Args:
            source_format: Source document format
            target_format: Target document format

        Returns:
            List of available plugins, sorted by priority
        """
        source_format = self.normalize_format(source_format)
        target_format = self.normalize_format(target_format)

        conversion_key = f"{source_format}2{target_format}"
        return self._plugins.get(conversion_key, []).copy()

    def list_plugins(self) -> list[PluginInfo]:
        """List all registered plugins.

        Returns:
            List of all registered plugins
        """
        all_plugins = []
        for plugin_list in self._plugins.values():
            all_plugins.extend(plugin_list)
        return all_plugins

    def unregister_plugin(self, plugin_name: str) -> bool:
        """Unregister a plugin by name.

        Args:
            plugin_name: Name of plugin to remove

        Returns:
            True if plugin was found and removed, False otherwise
        """
        for conversion_key, plugin_list in self._plugins.items():
            for i, plugin in enumerate(plugin_list):
                if plugin.name == plugin_name:
                    plugin_list.pop(i)
                    # Clear cache
                    self._cache.clear()
                    return True
        return False

    def is_conversion_supported(self, source_format: str, target_format: str) -> bool:
        """Check if a conversion is supported.

        Args:
            source_format: Source document format
            target_format: Target document format

        Returns:
            True if conversion is supported, False otherwise
        """
        return self.get_converter(source_format, target_format) is not None

    def get_supported_input_formats(self) -> set[str]:
        """Get all supported input formats.

        Returns:
            Set of supported input formats
        """
        formats = set()
        for conversion_key in self._plugins.keys():
            if "2" in conversion_key:
                source, _ = conversion_key.split("2", 1)
                formats.add(source)
        return formats

    def get_supported_output_formats(self) -> set[str]:
        """Get all supported output formats.

        Returns:
            Set of supported output formats
        """
        formats = set()
        for conversion_key in self._plugins.keys():
            if "2" in conversion_key:
                _, target = conversion_key.split("2", 1)
                formats.add(target)
        return formats

    def convert(
        self,
        input_path: str,
        output_path: str,
        source_format: str | None = None,
        target_format: str | None = None,
        plugin_name: str | None = None,
        **options,
    ) -> bool:
        """Perform a conversion using a registered plugin.

        Args:
            input_path: Path to input file
            output_path: Path to output file
            source_format: Source format (auto-detected if not provided)
            target_format: Target format (auto-detected if not provided)
            plugin_name: Specific plugin to use (optional)
            **options: Additional options to pass to the converter

        Returns:
            True if conversion successful, False otherwise

        Raises:
            PluginError: If no suitable plugin found or conversion fails
        """
        # Auto-detect formats if not provided
        if not source_format:
            from ..utils.file_utils import detect_file_format

            source_format = detect_file_format(input_path)
            if not source_format:
                raise PluginError(
                    "Could not detect source format", operation="format_detection"
                )

        if not target_format:
            from ..utils.file_utils import get_file_extension

            target_format = get_file_extension(output_path)
            if not target_format:
                raise PluginError(
                    "Could not detect target format from output path",
                    operation="format_detection",
                )

        # Get converter plugin
        plugin = self.get_converter(source_format, target_format, plugin_name)
        if not plugin:
            available = self.get_available_conversions()
            raise PluginError(
                f"No converter found for {source_format} -> {target_format}. "
                f"Available conversions: {available}",
                operation="plugin_lookup",
            )

        # Execute conversion
        try:
            if plugin.supports_options:
                result = plugin.converter_function(input_path, output_path, **options)
            else:
                result = plugin.converter_function(input_path, output_path)

            # Handle different return types
            if isinstance(result, bool):
                return result
            elif result is None:
                return True  # Assume success if no return value
            else:
                return bool(result)  # Convert to boolean

        except Exception as e:
            raise PluginError(
                f"Conversion failed with plugin '{plugin.name}': {e!s}",
                plugin_name=plugin.name,
                operation="conversion",
            ) from e

    def clear_cache(self) -> None:
        """Clear the plugin cache."""
        self._cache.clear()

    def get_plugin_info(self, plugin_name: str) -> PluginInfo | None:
        """Get information about a specific plugin.

        Args:
            plugin_name: Name of the plugin

        Returns:
            PluginInfo if found, None otherwise
        """
        for plugin_list in self._plugins.values():
            for plugin in plugin_list:
                if plugin.name == plugin_name:
                    return plugin
        return None


# Global registry instance
_global_registry = PluginRegistry()


def get_registry() -> PluginRegistry:
    """Get the global plugin registry instance."""
    return _global_registry


def register_converter(*args, **kwargs) -> None:
    """Register a converter with the global registry."""
    _global_registry.register_converter(*args, **kwargs)


def converter(source_format: str, target_format: str, **kwargs):
    """Decorator for registering converter functions.

    Args:
        source_format: Source document format
        target_format: Target document format
        **kwargs: Additional plugin registration options

    Example:
        @converter('md', 'pdf', description="Convert Markdown to PDF")
        def markdown_to_pdf(input_path: str, output_path: str) -> bool:
            # Implementation here
            return True
    """

    def decorator(func):
        register_converter(
            source_format=source_format,
            target_format=target_format,
            converter_function=func,
            **kwargs,
        )
        return func

    return decorator
