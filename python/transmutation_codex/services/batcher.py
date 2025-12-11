"""Batch Processing Engine.

This module provides a centralized, reusable batch processing engine for converting
files between different formats, with support for concurrent processing and progress tracking.
"""

import concurrent.futures
import threading
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

from transmutation_codex.core import (
    ConfigManager,
    ErrorCode,
    get_log_manager,
    get_registry,
)

# Setup logger
logger = get_log_manager().get_batch_logger()

# Type aliases
ProgressCallback = Callable[[int, int, str, bool, float, str | None], None]
ConversionResult = tuple[Path, bool, float, str | None]
BatchSummary = dict[str, Any]


def _process_single_file_wrapper(
    converter_func: Callable[..., Path],
    input_path: Path,
    output_dir: Path | None,
    converter_options: dict[str, Any],
) -> ConversionResult:
    """Wraps the processing of a single file, handling timing and errors.

    This function is intended to be run in a separate thread or process
    by the batch processor. It calls the provided converter function
    and records the outcome.

    Args:
        converter_func (Callable[..., Path]): The actual converter function
            (e.g., convert_pdf_to_md). It should accept an input path
            as its first argument, an optional output_path keyword argument,
            and other **converter_options. It must return the Path to the
            output file.
        input_path (Path): The absolute path to the input file.
        output_dir (Path | None): The directory where the output file should be
            saved. If None, the converter function is expected to handle the
            output path (e.g., save next to input file).
        converter_options (dict[str, Any]): A dictionary of options specific
            to the converter_func. This will be passed as **kwargs.
            If 'output_path' is set by this wrapper, it will be included here.

    Returns:
        ConversionResult: A tuple containing:
            - output_path (Path): The path to the generated (or attempted) output file.
              Will have a '.failed' suffix if conversion failed.
            - success (bool): True if conversion was successful, False otherwise.
            - duration (float): Time taken for the conversion in seconds.
            - error_message (str | None): An error message if conversion failed,
              None otherwise.
    """
    start_time = time.time()
    error_msg = None
    output_path = input_path.with_suffix(".failed")  # Default fail path

    logger.info(f"Starting processing for: {input_path.name}")
    try:
        # Determine output path if not specified
        if output_dir:
            # Construct output path in the specified directory
            # The converter function should handle the final extension
            output_path_option = output_dir / input_path.name
            converter_options["output_path"] = output_path_option
            logger.debug(f"Setting potential output path: {output_path_option}")
        else:
            # If no output_dir, converter usually defaults to same dir as input
            # Remove explicit output_path if it was set from a previous failed run
            converter_options.pop("output_path", None)

        # Call the converter function
        try:
            result_path = converter_func(input_path, **converter_options)
            success = True
            logger.info(
                f"Successfully processed: {input_path.name} -> {result_path.name}"
            )
            return result_path, success, time.time() - start_time, None

        except Exception as first_error:
            # Special handling for PDF to Editable: retry with force-ocr if it fails
            # Check if this is a PDF to Editable conversion
            output_path_obj = converter_options.get("output_path")
            is_editable_conversion = output_path_obj and (
                str(output_path_obj).endswith(".editable")
                or str(output_path_obj).endswith("editable_pdf")
            )

            if is_editable_conversion:
                # Check if the error is about existing text
                error_msg_check = str(first_error).lower()
                if (
                    "already has text" in error_msg_check
                    or "priorocrfound" in error_msg_check
                ):
                    logger.info(
                        f"PDF already has text, retrying with force-ocr enabled for {input_path.name}"
                    )

                    # Retry with force_ocr enabled
                    retry_options = converter_options.copy()
                    retry_options["force_ocr"] = True

                    result_path = converter_func(input_path, **retry_options)
                    success = True
                    logger.info(f"Retry with force-ocr succeeded for {input_path.name}")
                    return result_path, success, time.time() - start_time, None

            # Re-raise if retry didn't apply or failed
            raise

    except Exception as e:
        error_code = ErrorCode.SERVICE_BATCH_FILE_PROCESSING_FAILED
        logger.error(f"[{error_code}] Error processing {input_path.name}: {e}", exc_info=True)
        error_msg = str(e)
        # Use the output path determined earlier if possible, otherwise default fail path
        failed_output_path = converter_options.get("output_path", output_path)
        return (
            failed_output_path.with_suffix(".failed"),
            False,
            time.time() - start_time,
            error_msg,
        )


def run_batch(
    conversion_type: str,
    input_files: list[str | Path],
    output_dir: str | Path | None = None,
    max_workers: int | None = None,
    progress_callback: ProgressCallback | None = None,
    **converter_options: Any,
) -> BatchSummary:
    """Runs a batch conversion job with concurrent processing.

    This function orchestrates the conversion of multiple files using a
    thread pool. It dynamically loads the appropriate converter based on
    `conversion_type`.

    Args:
        conversion_type (str): The type of conversion to perform (e.g.,
            "pdf2md", "md2pdf"). This key is used to look up the
            converter module and function.
        input_files (list[str | Path]): A list of input file paths.
            Can be strings or Path objects.
        output_dir (str | Path | None): The directory where all output files
            will be saved. If None, converters might save outputs next to
            their respective input files (behavior depends on the specific
            converter). Defaults to None.
        max_workers (int | None): The maximum number of worker threads to use.
            If None, the value is sourced from the application configuration,
            defaulting to 4 if not set there.
        progress_callback (ProgressCallback | None): An optional callback function
            invoked after each file is processed. It receives:
            (current_index, total_files, input_file_path_str, success_status,
            processing_time_seconds, error_message_or_none). Defaults to None.
        **converter_options (Any): Additional keyword arguments passed directly
            to the individual converter functions. These are specific to the
            `conversion_type` being used.

    Returns:
        BatchSummary: A dictionary summarizing the batch operation, including
            total files, number successful, number failed, total time, and
            a list of detailed results for each file.

    Raises:
        ValueError: If `conversion_type` is unsupported.
        ImportError: If the converter module or function for the specified
            `conversion_type` cannot be imported or found.
    """
    # Convert paths
    input_paths: list[Path] = [Path(f) for f in input_files]
    output_dir_path: Path | None = Path(output_dir) if output_dir else None

    # Get configuration
    config = ConfigManager()
    # app_settings = config.get_config("application") # Removed unused variable
    # Use max_workers from args, then config, then default
    if max_workers is None:
        env_config = config.get_environment_config()
        max_workers = env_config.get("max_workers", 4)
    logger.info(
        f"Running batch conversion: {conversion_type} with {max_workers} workers"
    )

    # Ensure output dir exists
    if output_dir_path:
        output_dir_path.mkdir(parents=True, exist_ok=True)
        logger.debug(f"Ensured output directory exists: {output_dir_path}")

    # Import plugins to trigger auto-registration
    logger.debug("Importing plugins to trigger auto-registration")
    try:
        import transmutation_codex.plugins  # noqa: F401
        logger.debug("Successfully imported plugins")
    except ImportError as e:
        error_code = ErrorCode.BRIDGE_PLUGIN_LOAD_FAILED
        logger.error(f"[{error_code}] Failed to import plugins: {e}", exc_info=True)
        raise

    # Get the plugin registry
    registry = get_registry()

    # Parse conversion type (e.g., "pdf2md" -> "pdf", "md")
    logger.debug(f"Parsing conversion type: {conversion_type}")
    if "2" not in conversion_type:
        error_code = ErrorCode.SERVICE_BATCH_INVALID_CONVERSION_TYPE
        logger.error(f"[{error_code}] Invalid conversion type format: {conversion_type}")
        raise ValueError(
            f"Invalid conversion type format: {conversion_type}. Expected format: source2target"
        )

    source_format, target_format = conversion_type.split("2", 1)

    # Get converter from registry
    try:
        plugin_info = registry.get_converter(source_format, target_format)

        if not plugin_info:
            error_code = ErrorCode.SERVICE_BATCH_CONVERTER_NOT_FOUND
            # Get available conversions for better error message
            available = registry.get_available_conversions()
            available_str = ", ".join(
                f"{src}2{tgt}" for src, targets in available.items() for tgt in targets
            )
            logger.error(
                f"[{error_code}] No converter found for '{conversion_type}'. Available: {available_str}"
            )
            raise ValueError(
                f"Unsupported conversion type: {conversion_type}. "
                f"Available: {available_str or 'none'}"
            )

        logger.info(
            f"Using converter for batch: {plugin_info.name} "
            f"(priority: {plugin_info.priority}, version: {plugin_info.version})"
        )
        converter_callable = plugin_info.converter_function

    except (ImportError, AttributeError, ValueError) as e:
        error_code = ErrorCode.SERVICE_BATCH_CONVERTER_NOT_FOUND
        logger.error(f"[{error_code}] Failed to get converter for {conversion_type}: {e}", exc_info=True)
        raise ImportError(f"Failed to load converter for {conversion_type}: {e}") from e

    total_files = len(input_paths)
    successful = 0
    failed = 0
    results = []
    start_time = time.time()
    progress_lock = (
        threading.Lock()
    )  # Lock for updating shared counters if callback does
    processed_count = 0

    logger.info(f"Starting batch processing of {total_files} files.")

    # Use ThreadPoolExecutor
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_file = {
            executor.submit(
                _process_single_file_wrapper,
                converter_callable,  # Pass the specific function/method
                input_path,
                output_dir_path,
                converter_options.copy(),  # Pass copy to avoid race conditions if modified
            ): input_path
            for input_path in input_paths
        }

        for future in concurrent.futures.as_completed(future_to_file):
            input_path = future_to_file[future]
            with progress_lock:
                processed_count += 1
                current_index = processed_count

            try:
                output_path, success, proc_time, error = future.result()
                if success:
                    successful += 1
                else:
                    failed += 1

                result = {
                    "input_path": str(input_path),
                    "output_path": str(output_path),
                    "success": success,
                    "time": proc_time,
                    "error": error,
                }
                results.append(result)
                logger.debug(
                    f"Completed {input_path.name} (Success: {success}, Time: {proc_time:.2f}s)"
                )

                if progress_callback:
                    try:
                        progress_callback(
                            current_index,
                            total_files,
                            str(input_path),
                            success,
                            proc_time,
                            error,
                        )
                    except Exception as cb_err:
                        logger.error(
                            f"Progress callback failed for {input_path.name}: {cb_err}"
                        )

            except Exception as e:
                error_code = ErrorCode.SERVICE_BATCH_FILE_PROCESSING_FAILED
                logger.error(
                    f"[{error_code}] Error processing future result for {input_path.name}: {e}",
                    exc_info=True,
                )
                failed += 1
                results.append(
                    {
                        "input_path": str(input_path),
                        "output_path": str(input_path.with_suffix(".failed")),
                        "success": False,
                        "time": time.time() - start_time,  # Use total time as estimate
                        "error": str(e),
                        "error_code": error_code,
                    }
                )
                # Optionally call progress callback for the failure
                if progress_callback:
                    try:
                        progress_callback(
                            current_index,
                            total_files,
                            str(input_path),
                            False,
                            0.0,
                            str(e),
                        )
                    except Exception as cb_err:
                        logger.error(
                            f"Progress callback failed for {input_path.name} after future exception: {cb_err}"
                        )

    # Prepare summary
    total_time = time.time() - start_time
    logger.info(
        f"Batch processing finished in {total_time:.2f}s. Successful: {successful}, Failed: {failed}"
    )
    summary = {
        "total_files": total_files,
        "successful": successful,
        "failed": failed,
        "total_time": total_time,
        "results": sorted(
            results, key=lambda x: x["input_path"]
        ),  # Sort results by input path
    }

    return summary
