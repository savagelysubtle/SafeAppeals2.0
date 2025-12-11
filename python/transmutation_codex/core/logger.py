import json
import logging
import logging.config
import os
import sys
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

# Store the original LogRecord factory
_original_log_record_factory = logging.getLogRecordFactory()

# This will hold the session_id once LogManager is initialized
_CURRENT_SESSION_ID = "uninitialized_session"


def _session_id_log_record_factory(*args: Any, **kwargs: Any) -> logging.LogRecord:
    """Custom LogRecord factory that adds the LogManager's session_id."""
    record = _original_log_record_factory(*args, **kwargs)
    record.session_id = _CURRENT_SESSION_ID  # Add session_id to every record
    return record


class SessionIdFilter(logging.Filter):
    """A logging filter to add a session ID to log records."""

    def __init__(self, session_id: str, name: str = "") -> None:
        """Initializes the SessionIdFilter.

        Args:
            session_id (str): The session ID to add to log records.
            name (str): The name of the filter. Defaults to "".
        """
        super().__init__(name)
        self.session_id = session_id

    def filter(self, record: logging.LogRecord) -> bool:
        """Adds the session ID to the log record.

        Args:
            record (logging.LogRecord): The log record to process.

        Returns:
            bool: Always True to indicate the record should be processed.
        """
        record.session_id = self.session_id
        return True


class JsonFormatter(logging.Formatter):
    """Formats log records as JSON strings, prefixed for Electron bridge."""

    def __init__(
        self, session_id: str, fmt: str | None = None, datefmt: str | None = None
    ) -> None:
        """Initializes the JsonFormatter.

        Args:
            session_id (str): The active session ID.
            fmt (Optional[str]): The log record format. Not directly used for JSON
                structure but kept for compatibility. Defaults to None.
            datefmt (Optional[str]): The date format string. Defaults to None.
        """
        super().__init__(fmt, datefmt)
        self.session_id = session_id  # Store session_id if needed directly, though filter is preferred

    def format(self, record: logging.LogRecord) -> str:
        """Formats a log record as a JSON string prefixed with 'LOG_MESSAGE:'.

        Includes standard log fields as well as the session_id.

        Args:
            record (logging.LogRecord): The log record to format.

        Returns:
            str: The JSON formatted log message with prefix.
        """
        log_entry = {
            "timestamp": self.formatTime(record, self.datefmt),
            "session_id": getattr(
                record, "session_id", self.session_id
            ),  # Fallback if filter not used
            "level": record.levelname,
            "name": record.name,
            "module": record.module,
            "funcName": record.funcName,
            "lineno": record.lineno,
            "message": record.getMessage(),
        }
        # Handle exc_info if present
        if record.exc_info:
            log_entry["exc_info"] = self.formatException(record.exc_info)

        return f"LOG_MESSAGE:{json.dumps(log_entry)}"

    def formatTime(self, record: logging.LogRecord, datefmt: str | None = None) -> str:
        """Return the creation time of the specified LogRecord as formatted text.

        This method should be called from format() by a formatter which
        wants to make use of a formatted time. If datefmt (a string) is
        specified, it is used with datetime.strftime() to format the time;
        otherwise, the ISO8601 format is used.
        Ensures handling of microseconds and UTC (Z) if specified in datefmt.
        """
        dt = datetime.fromtimestamp(record.created, tz=UTC)
        if datefmt:
            # Ensure 'Z' is handled if present for UTC representation
            # Basic str.replace, consider more robust if complex datefmts used
            if "%fZ" in datefmt:
                return dt.strftime(datefmt.replace("%fZ", ".%f")) + "Z"
            if "Z" in datefmt and not datefmt.endswith("Z"):  # Z not as a directive
                return dt.strftime(datefmt)
            if datefmt.endswith("Z"):  # Z as a literal at the end for UTC
                return dt.strftime(datefmt[:-1]) + "Z"
            return dt.strftime(datefmt)
        else:
            return dt.isoformat(timespec="milliseconds")


class LogManager:
    """Manages logging configuration and provides logging utilities.

    This class implements the singleton pattern and configures logging
    programmatically for both file output and structured JSON output to stdout
    for integration with an Electron GUI.
    """

    _instance = None
    _initialized = False  # Class attribute for initialization flag

    def __new__(cls, *args: Any, **kwargs: Any) -> "LogManager":
        """Creates a new LogManager instance if one doesn't exist (Singleton pattern).

        Args:
            *args: Variable length argument list.
            **kwargs: Arbitrary keyword arguments.

        Returns:
            LogManager: The singleton instance of the LogManager.
        """
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            # _initialized flag is instance-specific, set in __init__
            cls._instance._initialized = (
                False  # Ensure instance starts as not initialized
            )
        return cls._instance

    def __init__(self, logs_dir: Path | None = None) -> None:
        """Initializes the LogManager. Called only once for the singleton.

        Sets up paths, generates a session ID, creates log directories, and
        applies programmatic logging configurations.

        Args:
            logs_dir (Optional[Path]): The base directory where log files will be
                stored. If None, automatically determines the appropriate location:
                - Development mode: PROJECT_ROOT/logs (where pyproject.toml is located)
                - Production mode: AppData directory (platform-specific)
        """
        if self._initialized:  # Check instance attribute
            return

        global _CURRENT_SESSION_ID  # Allow modification of the module-level variable
        self.session_id = self.generate_session_id()
        _CURRENT_SESSION_ID = self.session_id  # Set it for the factory

        # Set the custom LogRecord factory *before* any logging is configured by this manager.
        # This ensures all LogRecord instances created henceforth will have session_id.
        logging.setLogRecordFactory(_session_id_log_record_factory)

        # Determine logs directory based on development vs production mode
        if logs_dir is None:
            if self._is_development_mode():
                # Development: Use project root
                project_root = self._find_project_root()
                self.logs_dir = project_root / "logs"
            else:
                # Production: Use platform-specific AppData directory
                self.logs_dir = self._get_app_data_dir() / "logs"
        else:
            self.logs_dir = logs_dir

        self._create_log_directories()
        self._configure_programmatic_logging()

        self.root_logger = logging.getLogger()  # Get the root logger
        self._initialized = True  # Set instance attribute

    @staticmethod
    def _find_project_root() -> Path:
        """Find the project root directory by looking for pyproject.toml.

        Searches up the directory tree from the current file location until
        it finds a directory containing pyproject.toml.

        Returns:
            Path: The project root directory.
        """
        current = Path(__file__).resolve()

        # Search up the directory tree for pyproject.toml
        for parent in [current] + list(current.parents):
            if (parent / "pyproject.toml").exists():
                return parent

        # Fallback: 4 levels up from this file
        # logger.py -> core/ -> transmutation_codex/ -> src/ -> project_root/
        return current.parent.parent.parent.parent

    @staticmethod
    def _is_development_mode() -> bool:
        """Detect if running in development mode vs production/installed mode.

        Development indicators:
        - Running from source (pyproject.toml exists)
        - DEV_MODE environment variable set to true

        Returns:
            bool: True if in development mode, False if production/installed.
        """
        # Check environment variable first
        dev_mode_env = os.getenv("DEV_MODE", "").lower()
        if dev_mode_env in ("true", "1", "yes"):
            return True
        if dev_mode_env in ("false", "0", "no"):
            return False

        # Auto-detect: if pyproject.toml exists in tree, we're in development
        try:
            current = Path(__file__).resolve()
            for parent in [current] + list(current.parents):
                if (parent / "pyproject.toml").exists():
                    return True
        except Exception:
            pass

        # Default to production mode if unsure
        return False

    @staticmethod
    def _get_app_data_dir() -> Path:
        """Get platform-specific application data directory.

        Returns platform-appropriate paths:
        - Windows: %APPDATA%/AiChemist (e.g., C:/Users/Name/AppData/Roaming/AiChemist)
        - macOS: ~/Library/Application Support/AiChemist
        - Linux: ~/.local/share/aichemist

        Returns:
            Path: Application data directory path.
        """
        import platform

        system = platform.system()

        if system == "Windows":
            # Windows: Use APPDATA environment variable
            appdata = os.getenv("APPDATA")
            if appdata:
                return Path(appdata) / "AiChemist"
            # Fallback to user profile
            return Path.home() / "AppData" / "Roaming" / "AiChemist"

        elif system == "Darwin":
            # macOS: Use Application Support
            return Path.home() / "Library" / "Application Support" / "AiChemist"

        else:
            # Linux and others: Use XDG_DATA_HOME or fallback to ~/.local/share
            xdg_data_home = os.getenv("XDG_DATA_HOME")
            if xdg_data_home:
                return Path(xdg_data_home) / "aichemist"
            return Path.home() / ".local" / "share" / "aichemist"

    def _create_log_directories(self) -> None:
        """Creates the necessary directory structure for log files.

        Ensures that the main log directory `logs/python` exists.
        Other component-specific directories can be created by `add_file_handler`
        if needed.
        """
        python_logs_dir = self.logs_dir / "python"
        python_logs_dir.mkdir(parents=True, exist_ok=True)
        # Example: Create other specific directories if always needed
        # (python_logs_dir / "converters").mkdir(exist_ok=True)
        # (python_logs_dir / "batch_processor").mkdir(exist_ok=True)

    def _configure_programmatic_logging(self) -> None:
        """Configures logging programmatically.

        Sets up a root logger with two handlers:
        1. A StreamHandler outputting JSON to stdout for the Electron bridge.
        2. A FileHandler for general application logging to a session-specific file.
        """
        # Get the root logger instance.
        root_logger = logging.getLogger()

        # Ensure we have a clean slate by removing any existing handlers from the root logger.
        # This prevents conflicts or duplicate messages if logging was configured elsewhere.
        if root_logger.hasHandlers():
            for handler in root_logger.handlers[:]:
                root_logger.removeHandler(handler)
                handler.close()  # Close the handler before removing

        # Set the desired level for the root logger.
        # All messages at this level or higher will be processed by the root logger
        # and then potentially by its handlers, subject to their own levels.
        root_logger.setLevel(logging.DEBUG)

        # Add session ID filter to the root logger itself.
        # This ensures any child logger will also have its records pass through this filter
        # if the records propagate to the root.
        # With the LogRecord factory, this filter might be redundant for adding session_id,
        # but kept if it serves other filtering purposes or as a safeguard.
        session_filter = SessionIdFilter(self.session_id)
        root_logger.addFilter(session_filter)

        # 1. JSON Formatter and StreamHandler for stdout (Electron bridge)
        json_formatter = JsonFormatter(
            session_id=self.session_id, datefmt="%Y-%m-%dT%H:%M:%S.%fZ"
        )
        stdout_handler = logging.StreamHandler(sys.stdout)
        stdout_handler.setFormatter(json_formatter)
        stdout_handler.setLevel(logging.INFO)  # Example: INFO level for GUI
        stdout_handler.addFilter(session_filter)  # Add filter to handler
        root_logger.addHandler(stdout_handler)

        # 2. Standard Formatter and FileHandler for persistent logs
        log_file_path = self.logs_dir / "python" / f"app_session_{self.session_id}.log"
        file_formatter = logging.Formatter(
            "%(asctime)s - %(session_id)s - %(name)s - %(levelname)s - %(module)s.%(funcName)s:%(lineno)d - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        file_handler = logging.FileHandler(log_file_path, encoding="utf-8")
        file_handler.setFormatter(file_formatter)
        file_handler.setLevel(logging.DEBUG)  # Example: DEBUG level for file logs
        file_handler.addFilter(session_filter)  # Add filter to handler
        root_logger.addHandler(file_handler)

        # Use the root_logger's info method, which should now be properly configured.
        root_logger.info(
            f"Logging configured programmatically. Session ID: {self.session_id}. "
            f"File log: {log_file_path}"
        )

    def get_logger(self, name: str) -> logging.Logger:
        """Gets a logger instance with the specified name, prefixed.

        The logger name will be prefixed with 'aichemist_codex.' to ensure
        all application logs are under a common namespace.

        Args:
            name (str): The specific name for the logger (e.g., `__name__` from
                the calling module).

        Returns:
            logging.Logger: A configured logger instance.
        """
        logger_name = f"aichemist_codex.{name}"
        return logging.getLogger(logger_name)

    def generate_session_id(self) -> str:
        """Creates a unique session ID.

        Combines a timestamp with a short UUID for uniqueness.

        Returns:
            str: A string representing the unique session ID (e.g.,
                 "20231027_153000_a1b2c3d4").
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        return f"{timestamp}_{unique_id}"

    def get_converter_logger(self, converter_type: str) -> logging.Logger:
        """Gets a logger specifically for a converter.

        Args:
            converter_type (str): Type of converter (e.g., 'pdf2md', 'md2pdf').

        Returns:
            logging.Logger: A configured logger for the specified converter,
                            e.g., `aichemist_codex.converters.pdf2md`.
        """
        return self.get_logger(f"converters.{converter_type}")

    def get_batch_logger(self) -> logging.Logger:
        """Gets a logger specifically for batch processing operations.

        Returns:
            logging.Logger: A configured logger instance named
                            `aichemist_codex.batch_processor`.
        """
        return self.get_logger("batch_processor")

    def get_bridge_logger(self) -> logging.Logger:
        """Gets a logger specifically for the Electron bridge operations.

        Returns:
            logging.Logger: A configured logger instance named
                            `aichemist_codex.electron_bridge`.
        """
        return self.get_logger("electron_bridge")

    def add_file_handler(
        self,
        logger: logging.Logger,
        filepath: str | Path,
        level: int = logging.DEBUG,
        formatter: logging.Formatter | None = None,
    ) -> None:
        """Adds a file handler to a given logger instance.

        Ensures the directory for the log file exists.

        Args:
            logger (logging.Logger): The logger instance to add the handler to.
            filepath (str | Path): Absolute or relative path for the log file.
                If relative, it's based on the current working directory.
                It's recommended to use paths generated via
                `create_session_file_path` or absolute paths.
            level (int): Logging level for this handler. Defaults to `logging.DEBUG`.
            formatter (Optional[logging.Formatter]): Custom formatter. If None,
                a default formatter including session_id is used.
        """
        try:
            log_path = Path(filepath)
            log_path.parent.mkdir(parents=True, exist_ok=True)

            handler = logging.FileHandler(log_path, encoding="utf-8")
            handler.setLevel(level)

            if formatter is None:
                formatter = logging.Formatter(
                    "%(asctime)s - %(session_id)s - %(name)s - %(levelname)s - %(message)s",
                    datefmt="%Y-%m-%d %H:%M:%S",
                )
            handler.setFormatter(formatter)
            # Add session filter if this handler is for a logger not descending from root
            # or if finer control per handler is needed.
            # For now, relying on root logger's filter.
            # session_filter = SessionIdFilter(self.session_id)
            # handler.addFilter(session_filter)

            logger.addHandler(handler)
            # Use a general logger for LogManager's own messages if needed,
            # or print for setup diagnostics.
            # print(f"Added file handler for {log_path} to logger {logger.name}")
        except Exception as e:
            # Log this error using a basic configuration or print,
            # as the main logging might not be fully set up or could be the source of error.
            print(
                f"CRITICAL: Failed to add file handler for {filepath} "
                f"to logger {logger.name}: {e}"
            )

    def create_session_file_path(
        self, component_path: str, filename_base: str, extension: str = "log"
    ) -> Path:
        """Creates an absolute log file path with session ID for a component.

        The path will be structured under `logs_dir/python/component_path/`.

        Args:
            component_path (str): The sub-path for the component relative to
                `logs_dir/python/` (e.g., "converters/pdf2md", "utils").
            filename_base (str): The base name for the log file (e.g., "conversion_details").
            extension (str): The file extension without a leading dot. Defaults to "log".

        Returns:
            Path: The absolute `Path` object for the log file.
        """
        target_dir = self.logs_dir / "python" / component_path
        target_dir.mkdir(parents=True, exist_ok=True)

        session_filename = f"{filename_base}_{self.session_id}.{extension}"
        return target_dir / session_filename


# Example of how LogManager might be used (typically not in this file):
# if __name__ == "__main__":
#     # Initialize LogManager (usually done at application startup)
#     # The first call to LogManager() or LogManager(logs_dir=Path("my_app_logs"))
#     # will initialize the singleton.
#     log_manager = LogManager()

#     # Get a logger for the current module or a specific component
#     module_logger = log_manager.get_logger(__name__)
#     module_logger.info("LogManager example: Info message from module.")
#     module_logger.debug("LogManager example: Debug message, check file log.")

#     converter_logger = log_manager.get_converter_logger("test_converter")
#     converter_logger.warning("LogManager example: Warning from test_converter.")

#     try:
#         x = 1 / 0
#     except ZeroDivisionError:
#         module_logger.error("LogManager example: An error occurred!", exc_info=True)

#     # Example of adding a specific handler
#     # custom_log_path = log_manager.create_session_file_path("custom_component", "special_ops")
#     # special_logger = log_manager.get_logger("custom_component.special_ops")
#     # log_manager.add_file_handler(special_logger, custom_log_path, level=logging.INFO)
#     # special_logger.info("This goes to the special_ops session log and stdout.")
#     # module_logger.info("This info still goes to general logs and stdout.")

#     print(f"Logs are being managed. Session ID: {log_manager.session_id}")
#     print(f"Main session log likely at: {log_manager.logs_dir / 'python' / f'app_session_{log_manager.session_id}.log'}")
