import copy
import json
import os
from collections.abc import MutableMapping
from pathlib import Path
from typing import Any

import yaml


# Deep merge utility function
def deep_merge(
    source: MutableMapping[Any, Any], destination: MutableMapping[Any, Any]
) -> MutableMapping[Any, Any]:
    """Deeply merges source dictionary into destination dictionary.
    Modifies destination in place.

    Args:
        source (MutableMapping[Any, Any]): The source dictionary to merge from.
        destination (MutableMapping[Any, Any]): The destination dictionary to merge into.

    Returns:
        MutableMapping[Any, Any]: The `destination` dictionary with merged values.
    """
    for key, value in source.items():
        if isinstance(value, MutableMapping):
            # Get node or create one
            node = destination.setdefault(key, {})
            if isinstance(node, MutableMapping):
                deep_merge(value, node)
            # If the destination node is not a dictionary, the source value replaces it
            # This handles cases where default might have a scalar but user/env has a dict
            else:
                destination[key] = copy.deepcopy(
                    value
                )  # Use deepcopy for nested structures
        else:
            destination[key] = value
    return destination


class ConfigManager:
    """Manages configuration settings from multiple sources.

    This class implements the singleton pattern to ensure only one
    configuration manager is active throughout the application.
    """

    _instance = None

    def __new__(cls, *args, **kwargs):
        """Creates a new ConfigManager instance if one doesn't exist (Singleton pattern).

        Args:
            *args: Variable length argument list.
            **kwargs: Arbitrary keyword arguments.

        Returns:
            ConfigManager: The singleton instance of the ConfigManager.
        """
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, config_dir: Path | str | None = None):
        """Initializes the ConfigManager, loading configurations from files and environment.

        This constructor is called only once due to the singleton pattern implemented
        in `__new__`. It sets up configuration paths, loads default, user, and
        Electron configurations, and applies environment variable overrides.

        Automatically loads production_config.yaml in production mode.

        Args:
            config_dir (Path | str | None): The directory where configuration files
                (e.g., `default_config.yaml`, `user_config.yaml`) are located.
                If None, defaults to a directory named "config" in the current
                working directory. Defaults to None.
        """
        if getattr(self, "_initialized", False):
            return

        # Set up paths
        self.config_dir = Path(config_dir) if config_dir is not None else Path("config")

        # Load configurations in order (later configs override earlier ones)
        self.default_config = self._load_yaml("default_config.yaml")

        # Load production config if in production mode
        self.production_config = {}
        if self._is_production_mode():
            self.production_config = self._load_yaml("production_config.yaml")

        self.user_config = self._load_yaml("user_config.yaml")
        self.electron_config = self._load_json("electron_config.json")

        # Environment overrides
        self.env_overrides = self._load_environment_variables()

        # Mark as initialized
        self._initialized = True

    @staticmethod
    def _is_production_mode() -> bool:
        """Detect if running in production mode.

        Production mode indicators:
        - NODE_ENV=production
        - DEV_MODE=false
        - No pyproject.toml in parent directories

        Returns:
            bool: True if in production mode.
        """
        # Check NODE_ENV
        node_env = os.getenv("NODE_ENV", "").lower()
        if node_env == "production":
            return True

        # Check DEV_MODE
        dev_mode = os.getenv("DEV_MODE", "").lower()
        if dev_mode in ("false", "0", "no"):
            return True
        if dev_mode in ("true", "1", "yes"):
            return False

        # Auto-detect: if pyproject.toml doesn't exist in tree, we're in production
        try:
            current = Path(__file__).resolve()
            for parent in [current] + list(current.parents):
                if (parent / "pyproject.toml").exists():
                    return False  # Found pyproject.toml = development mode
        except Exception:
            pass

        # Default to production mode if unsure
        return True

    def _load_yaml(self, filename: str) -> dict[str, Any]:
        """Loads a YAML configuration file from the config directory.

        Args:
            filename (str): The name of the YAML file (e.g., "default_config.yaml").

        Returns:
            dict[str, Any]: The loaded configuration as a dictionary. Returns an
                empty dictionary if the file is not found, cannot be parsed, or
                is empty.
        """
        config_path = self.config_dir / filename
        if not config_path.exists():
            return {}
        try:
            with open(config_path, encoding="utf-8") as f:
                config = yaml.safe_load(f)
                return config if config is not None else {}
        except FileNotFoundError:
            return {}
        except (yaml.YAMLError, Exception) as e:
            print(f"Error loading config file {config_path}: {e}")
            return {}

    def _load_json(self, filename: str) -> dict[str, Any]:
        """Loads a JSON configuration file from the config directory.

        Args:
            filename (str): The name of the JSON file (e.g., "electron_config.json").

        Returns:
            dict[str, Any]: The loaded configuration as a dictionary. Returns an
                empty dictionary if the file is not found or cannot be parsed.
        """
        config_path = self.config_dir / filename
        if not config_path.exists():
            return {}
        try:
            with open(config_path, encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            return {}
        except (json.JSONDecodeError, Exception) as e:
            print(f"Error loading config file {config_path}: {e}")
            return {}

    def _load_environment_variables(self) -> dict[str, Any]:
        """Load configuration from environment variables.

        For variables like MDTOPDF_FEATURE_NEW_FLAG=True, creates:
        {'feature': {'new_flag': True}}

        For MDTOPDF_CONVERTERS_PDF2MD_TIMEOUT=120, creates:
        {'converters': {'pdf2md': {'timeout': 120}}}
        """
        prefix = "MDTOPDF_"
        config: dict[str, Any] = {}

        for env_key, value_str in os.environ.items():
            if not env_key.startswith(prefix):
                continue

            # For debugging purposes, print the environment variables being processed
            # print(f"Processing env var: {env_key}={value_str}")

            # Remove prefix and split by underscore
            parts = env_key[len(prefix) :].lower().split("_")
            if len(parts) < 2:
                continue  # Need at least a section and a key

            # First part is the top-level section
            section = parts[0]
            current = config.setdefault(section, {})

            # Special case for converters section with 3+ parts
            # MDTOPDF_CONVERTERS_PDF2MD_TIMEOUT → converters.pdf2md.timeout
            if section == "converters" and len(parts) >= 3:
                converter_type = parts[1]
                converter_dict = current.setdefault(converter_type, {})

                # Join remaining parts with underscore for the key
                key_name = "_".join(parts[2:])

                # Convert and store the value
                converter_dict[key_name] = self._convert_env_value(value_str)

            # Standard case for 2-part env vars
            # MDTOPDF_SECTION_KEY → section.key
            elif len(parts) == 2:
                current[parts[1]] = self._convert_env_value(value_str)

            # Handle 3+ part env vars (not converters)
            # MDTOPDF_FEATURE_NEW_FLAG → feature.new_flag
            else:
                # Join all parts after the section with underscore
                key_name = "_".join(parts[1:])
                current[key_name] = self._convert_env_value(value_str)

        return config

    def _convert_env_value(self, value_str: str) -> Any:
        """Converts an environment variable string to a Python native type.

        Attempts to convert to boolean (True/False for "true"/"yes"/"1" or
        "false"/"no"/"0"), then integer, then float. If all conversions fail,
        returns the original string.

        Args:
            value_str (str): The string value from the environment variable.

        Returns:
            Any: The converted value (bool, int, float, or str).
        """
        if value_str.lower() in ("true", "yes", "1"):
            return True
        elif value_str.lower() in ("false", "no", "0"):
            return False
        else:
            try:
                return int(value_str)
            except ValueError:
                try:
                    return float(value_str)
                except ValueError:
                    return value_str

    def get_config(self, section: str) -> dict[str, Any]:
        """Get configuration for a specific section, merging from all sources.

        Priority order (highest to lowest):
        1. Environment variables
        2. User configuration
        3. Production configuration (if in production mode)
        4. Default configuration

        Performs a deep merge.

        Args:
            section: Section name to retrieve

        Returns:
            Dictionary containing deeply merged configuration for the section
        """
        # Start with a deep copy of the default section to avoid modifying it
        merged_config = copy.deepcopy(self.default_config.get(section, {}))

        # Merge production config if available
        if self.production_config:
            prod_section = self.production_config.get(section, {})
            if isinstance(prod_section, MutableMapping):
                deep_merge(prod_section, merged_config)

        # Merge user config into the result
        user_section = self.user_config.get(section, {})
        if isinstance(
            user_section, MutableMapping
        ):  # Ensure it's a dict-like structure
            deep_merge(user_section, merged_config)

        # Merge environment overrides into the result
        env_section = self.env_overrides.get(section, {})
        if isinstance(env_section, MutableMapping):  # Ensure it's a dict-like structure
            deep_merge(env_section, merged_config)

        return merged_config

    def get_electron_config(self) -> dict[str, Any]:
        """Gets the Electron-specific configuration.

        This configuration is typically loaded from `electron_config.json` and is
        not merged with other configuration sources by default.

        Returns:
            dict[str, Any]: A dictionary containing the Electron configuration.
        """
        # Electron config is typically standalone, no deep merge applied here
        # unless specific requirements arise.
        return self.electron_config

    def get_converter_config(self, converter_type: str) -> dict[str, Any]:
        """Get configuration for a specific converter, performing a deep merge.

        Args:
            converter_type: Type of converter (e.g., 'pdf2md', 'md2pdf')

        Returns:
            Dictionary containing merged configuration for the converter
        """
        # Get the top-level 'converters' section using the deep merge logic
        converters_config = self.get_config("converters")

        # Return the specific converter's config from the merged result
        return converters_config.get(converter_type, {})

    def save_user_config(self, config: dict[str, Any]) -> None:
        """Saves the provided configuration dictionary to the user_config.yaml file.

        Ensures the configuration directory exists before writing. After saving,
        it reloads the `self.user_config` attribute.

        Args:
            config (dict[str, Any]): The user configuration dictionary to save.
        """
        try:
            self.config_dir.mkdir(parents=True, exist_ok=True)
            config_path = self.config_dir / "user_config.yaml"
            with open(config_path, "w", encoding="utf-8") as f:
                yaml.dump(config, f, default_flow_style=False, sort_keys=False)

            self.user_config = self._load_yaml("user_config.yaml")
        except Exception as e:
            print(f"Error saving user config to {config_path}: {e}")

    def update_user_config(self, section: str, key: str, value: Any) -> None:
        """Updates a specific key-value pair in the user configuration and saves it.

        If the section does not exist in the current user configuration, it will be
        created. After updating, the entire user configuration is saved to disk.

        Args:
            section (str): The top-level section in the configuration (e.g., "application").
            key (str): The configuration key within the section to update.
            value (Any): The new value for the configuration key.
        """
        if section not in self.user_config:
            self.user_config[section] = {}

        self.user_config[section][key] = value
        self.save_user_config(self.user_config)

    def get_value(
        self,
        section: str,
        key: str,
        default: Any = None,
        value_type: type | None = None,
    ) -> Any:
        """Get a specific configuration value with type checking from the merged config."""
        # Use get_config to ensure deep merge has happened
        section_config = self.get_config(section)
        value = section_config.get(key, default)

        if value is None:
            return default

        if value_type is not None:
            try:
                if isinstance(value, value_type):
                    return value
                return value_type(value)
            except (ValueError, TypeError):
                print(
                    f"Warning: Config value '{section}.{key}' ('{value}') is not convertible to type {value_type.__name__}. Returning default."
                )
                return default

        return value
