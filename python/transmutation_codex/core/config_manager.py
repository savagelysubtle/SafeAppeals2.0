"""Advanced configuration management for the Transmutation Codex.

This module provides enhanced configuration management beyond basic settings,
including user preferences, conversion presets, and environment-specific
configurations with validation and persistence.
"""

import os
from copy import deepcopy
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

import yaml

from .exceptions import ConfigurationError


@dataclass
class ConversionPreset:
    """Configuration preset for document conversions."""

    name: str
    source_format: str
    target_format: str
    options: dict[str, Any] = field(default_factory=dict)
    description: str = ""
    author: str = ""
    version: str = "1.0.0"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class UserPreferences:
    """User-specific preferences."""

    default_output_directory: str | None = None
    preferred_ocr_language: str = "eng"
    default_ocr_dpi: int = 300
    enable_caching: bool = True
    cache_ttl_hours: float = 24.0
    max_cache_size: int = 1000
    auto_cleanup_temp_files: bool = True
    temp_file_retention_hours: float = 1.0
    enable_progress_notifications: bool = True
    preferred_conversion_presets: list[str] = field(default_factory=list)
    gui_theme: str = "light"
    cli_output_verbosity: str = "normal"  # quiet, normal, verbose

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class ConfigManager:
    """Advanced configuration manager for the Transmutation Codex.

    This class manages user preferences, conversion presets, and
    environment-specific configurations with validation and persistence.
    """

    def __init__(self, config_dir: str | None = None):
        """Initialize the configuration manager.

        Args:
            config_dir: Directory for configuration files (default: user config dir)
        """
        if config_dir is None:
            # Use platform-appropriate config directory
            config_dir = self._get_default_config_dir()

        self.config_dir = Path(config_dir)
        self.config_dir.mkdir(parents=True, exist_ok=True)

        # Configuration files
        self.preferences_file = self.config_dir / "preferences.yaml"
        self.presets_file = self.config_dir / "presets.yaml"
        self.environment_file = self.config_dir / "environment.yaml"

        # Load configurations
        self._user_preferences = self._load_user_preferences()
        self._conversion_presets: dict[str, ConversionPreset] = (
            self._load_conversion_presets()
        )
        self._environment_config = self._load_environment_config()

    def _get_default_config_dir(self) -> str:
        """Get the default configuration directory for the platform."""
        if os.name == "nt":  # Windows
            base_dir = os.environ.get("APPDATA", os.path.expanduser("~"))
            return os.path.join(base_dir, "AiChemist", "TransmutationCodex")
        else:  # Unix-like
            base_dir = os.environ.get(
                "XDG_CONFIG_HOME", os.path.expanduser("~/.config")
            )
            return os.path.join(base_dir, "aichemist", "transmutation-codex")

    def _load_user_preferences(self) -> UserPreferences:
        """Load user preferences from file."""
        try:
            if self.preferences_file.exists():
                with open(self.preferences_file, encoding="utf-8") as f:
                    data = yaml.safe_load(f) or {}
                return UserPreferences(**data)
        except Exception:
            pass

        return UserPreferences()

    def _load_conversion_presets(self) -> dict[str, ConversionPreset]:
        """Load conversion presets from file."""
        presets = {}

        try:
            if self.presets_file.exists():
                with open(self.presets_file, encoding="utf-8") as f:
                    data = yaml.safe_load(f) or {}

                for preset_data in data.get("presets", []):
                    preset = ConversionPreset(**preset_data)
                    presets[preset.name] = preset
        except Exception:
            pass

        # Add default presets if none exist
        if not presets:
            presets.update(self._get_default_presets())

        return presets

    def _load_environment_config(self) -> dict[str, Any]:
        """Load environment-specific configuration."""
        config = {
            "tesseract_path": None,
            "pandoc_path": None,
            "temp_directory": None,
            "max_memory_usage_mb": 1024,
            "max_file_size_mb": 100,
            "enable_debug_logging": False,
            "plugin_directories": [],
            "external_tools": {},
        }

        try:
            if self.environment_file.exists():
                with open(self.environment_file, encoding="utf-8") as f:
                    data = yaml.safe_load(f) or {}
                config.update(data)
        except Exception:
            pass

        return config

    def _get_default_presets(self) -> dict[str, ConversionPreset]:
        """Get default conversion presets."""
        return {
            "md_to_pdf_standard": ConversionPreset(
                name="md_to_pdf_standard",
                source_format="md",
                target_format="pdf",
                description="Standard Markdown to PDF conversion",
                options={"margin": "1in", "font_size": "12pt"},
            ),
            "md_to_pdf_presentation": ConversionPreset(
                name="md_to_pdf_presentation",
                source_format="md",
                target_format="pdf",
                description="Markdown to PDF for presentations",
                options={
                    "margin": "0.5in",
                    "font_size": "14pt",
                    "page_orientation": "landscape",
                },
            ),
            "pdf_to_md_ocr": ConversionPreset(
                name="pdf_to_md_ocr",
                source_format="pdf",
                target_format="md",
                description="PDF to Markdown with OCR for scanned documents",
                options={"use_ocr": True, "ocr_dpi": 300, "ocr_language": "eng"},
            ),
            "pdf_to_md_llm_optimized": ConversionPreset(
                name="pdf_to_md_llm_optimized",
                source_format="pdf",
                target_format="md",
                description="PDF to Markdown optimized for LLM processing",
                options={"use_pymupdf4llm": True, "preserve_formatting": False},
            ),
        }

    def save_user_preferences(self) -> None:
        """Save user preferences to file."""
        try:
            with open(self.preferences_file, "w", encoding="utf-8") as f:
                yaml.dump(self._user_preferences.to_dict(), f, default_flow_style=False)
        except Exception as e:
            raise ConfigurationError(f"Failed to save user preferences: {e!s}")

    def save_conversion_presets(self) -> None:
        """Save conversion presets to file."""
        try:
            presets_data = {
                "presets": [
                    preset.to_dict() for preset in self._conversion_presets.values()
                ]
            }

            with open(self.presets_file, "w", encoding="utf-8") as f:
                yaml.dump(presets_data, f, default_flow_style=False)
        except Exception as e:
            raise ConfigurationError(f"Failed to save conversion presets: {e!s}")

    def save_environment_config(self) -> None:
        """Save environment configuration to file."""
        try:
            with open(self.environment_file, "w", encoding="utf-8") as f:
                yaml.dump(self._environment_config, f, default_flow_style=False)
        except Exception as e:
            raise ConfigurationError(f"Failed to save environment config: {e!s}")

    # User Preferences Methods

    def get_user_preferences(self) -> UserPreferences:
        """Get current user preferences."""
        return deepcopy(self._user_preferences)

    def update_user_preferences(self, **kwargs) -> None:
        """Update user preferences."""
        for key, value in kwargs.items():
            if hasattr(self._user_preferences, key):
                setattr(self._user_preferences, key, value)
            else:
                raise ConfigurationError(f"Unknown preference: {key}")

        self.save_user_preferences()

    def reset_user_preferences(self) -> None:
        """Reset user preferences to defaults."""
        self._user_preferences = UserPreferences()
        self.save_user_preferences()

    # Conversion Presets Methods

    def get_conversion_presets(self) -> dict[str, ConversionPreset]:
        """Get all conversion presets."""
        return deepcopy(self._conversion_presets)

    def get_conversion_preset(self, name: str) -> ConversionPreset | None:
        """Get a specific conversion preset."""
        preset = self._conversion_presets.get(name)
        return deepcopy(preset) if preset else None

    def add_conversion_preset(self, preset: ConversionPreset) -> None:
        """Add a new conversion preset."""
        self._conversion_presets[preset.name] = preset
        self.save_conversion_presets()

    def update_conversion_preset(self, name: str, **updates) -> None:
        """Update an existing conversion preset."""
        if name not in self._conversion_presets:
            raise ConfigurationError(f"Preset not found: {name}")

        preset = self._conversion_presets[name]
        for key, value in updates.items():
            if hasattr(preset, key):
                setattr(preset, key, value)
            else:
                raise ConfigurationError(f"Unknown preset attribute: {key}")

        self.save_conversion_presets()

    def remove_conversion_preset(self, name: str) -> bool:
        """Remove a conversion preset."""
        if name in self._conversion_presets:
            del self._conversion_presets[name]
            self.save_conversion_presets()
            return True
        return False

    def get_presets_for_conversion(
        self, source_format: str, target_format: str
    ) -> list[ConversionPreset]:
        """Get presets for a specific conversion type."""
        matching_presets = []

        for preset in self._conversion_presets.values():
            if (
                preset.source_format.lower() == source_format.lower()
                and preset.target_format.lower() == target_format.lower()
            ):
                matching_presets.append(deepcopy(preset))

        return matching_presets

    # Environment Configuration Methods

    def get_environment_config(self) -> dict[str, Any]:
        """Get environment configuration."""
        return deepcopy(self._environment_config)

    def update_environment_config(self, **kwargs) -> None:
        """Update environment configuration."""
        self._environment_config.update(kwargs)
        self.save_environment_config()

    def get_tool_path(self, tool_name: str) -> str | None:
        """Get path to external tool."""
        return self._environment_config.get(f"{tool_name}_path")

    def set_tool_path(self, tool_name: str, path: str) -> None:
        """Set path to external tool."""
        self._environment_config[f"{tool_name}_path"] = path
        self.save_environment_config()

    # Configuration Validation

    def validate_configuration(self) -> list[str]:
        """Validate current configuration and return list of issues.

        Returns:
            List of validation error messages
        """
        issues = []

        # Validate user preferences
        prefs = self._user_preferences

        if prefs.default_output_directory:
            if not os.path.exists(prefs.default_output_directory):
                issues.append(
                    f"Default output directory does not exist: {prefs.default_output_directory}"
                )
            elif not os.access(prefs.default_output_directory, os.W_OK):
                issues.append(
                    f"Default output directory is not writable: {prefs.default_output_directory}"
                )

        if prefs.default_ocr_dpi < 72 or prefs.default_ocr_dpi > 1200:
            issues.append(f"Invalid OCR DPI: {prefs.default_ocr_dpi} (must be 72-1200)")

        if prefs.cache_ttl_hours <= 0:
            issues.append(
                f"Invalid cache TTL: {prefs.cache_ttl_hours} (must be positive)"
            )

        if prefs.max_cache_size <= 0:
            issues.append(
                f"Invalid max cache size: {prefs.max_cache_size} (must be positive)"
            )

        # Validate environment configuration
        env = self._environment_config

        if env.get("temp_directory") and not os.path.exists(env["temp_directory"]):
            issues.append(f"Temp directory does not exist: {env['temp_directory']}")

        if env.get("max_memory_usage_mb", 0) <= 0:
            issues.append(f"Invalid max memory usage: {env.get('max_memory_usage_mb')}")

        if env.get("max_file_size_mb", 0) <= 0:
            issues.append(f"Invalid max file size: {env.get('max_file_size_mb')}")

        # Validate external tool paths
        for tool in ["tesseract", "pandoc"]:
            path = env.get(f"{tool}_path")
            if path and not os.path.exists(path):
                issues.append(f"{tool.title()} path does not exist: {path}")

        # Validate conversion presets
        for preset_name, preset in self._conversion_presets.items():
            if not preset.source_format or not preset.target_format:
                issues.append(f"Preset '{preset_name}' missing source or target format")

        return issues

    # Configuration Export/Import

    def export_configuration(self, export_path: str) -> None:
        """Export all configuration to a file."""
        try:
            export_data = {
                "user_preferences": self._user_preferences.to_dict(),
                "conversion_presets": [
                    preset.to_dict() for preset in self._conversion_presets.values()
                ],
                "environment_config": self._environment_config,
                "export_timestamp": str(Path().absolute()),
                "version": "1.0.0",
            }

            with open(export_path, "w", encoding="utf-8") as f:
                yaml.dump(export_data, f, default_flow_style=False)

        except Exception as e:
            raise ConfigurationError(f"Failed to export configuration: {e!s}")

    def import_configuration(self, import_path: str, overwrite: bool = False) -> None:
        """Import configuration from a file."""
        try:
            with open(import_path, encoding="utf-8") as f:
                import_data = yaml.safe_load(f)

            if not isinstance(import_data, dict):
                raise ConfigurationError("Invalid configuration file format")

            # Import user preferences
            if "user_preferences" in import_data:
                if overwrite:
                    self._user_preferences = UserPreferences(
                        **import_data["user_preferences"]
                    )
                else:
                    # Merge with existing preferences
                    for key, value in import_data["user_preferences"].items():
                        if hasattr(self._user_preferences, key):
                            setattr(self._user_preferences, key, value)

            # Import conversion presets
            if "conversion_presets" in import_data:
                for preset_data in import_data["conversion_presets"]:
                    preset = ConversionPreset(**preset_data)
                    if overwrite or preset.name not in self._conversion_presets:
                        self._conversion_presets[preset.name] = preset

            # Import environment configuration
            if "environment_config" in import_data:
                if overwrite:
                    self._environment_config = import_data["environment_config"]
                else:
                    self._environment_config.update(import_data["environment_config"])

            # Save all configurations
            self.save_user_preferences()
            self.save_conversion_presets()
            self.save_environment_config()

        except Exception as e:
            raise ConfigurationError(f"Failed to import configuration: {e!s}")


# Global configuration manager instance
_global_config_manager = None


def get_config_manager() -> ConfigManager:
    """Get the global configuration manager instance."""
    global _global_config_manager
    if _global_config_manager is None:
        _global_config_manager = ConfigManager()
    return _global_config_manager


def configure_manager(config_dir: str | None = None) -> None:
    """Configure the global configuration manager."""
    global _global_config_manager
    _global_config_manager = ConfigManager(config_dir)


# Convenience functions for working with the global config manager


def get_user_preferences() -> UserPreferences:
    """Get user preferences from global config manager."""
    return get_config_manager().get_user_preferences()


def update_user_preferences(**kwargs) -> None:
    """Update user preferences in global config manager."""
    get_config_manager().update_user_preferences(**kwargs)


def get_conversion_preset(name: str) -> ConversionPreset | None:
    """Get conversion preset from global config manager."""
    return get_config_manager().get_conversion_preset(name)


def get_environment_config() -> dict[str, Any]:
    """Get environment configuration from global config manager."""
    return get_config_manager().get_environment_config()
