"""Excel to CSV converter.

This module converts Excel spreadsheets to CSV format, handling multiple sheets.
"""

from pathlib import Path
from typing import Any

try:
    import openpyxl

    OPENPYXL_AVAILABLE = True
except ImportError:
    OPENPYXL_AVAILABLE = False
    openpyxl = None

try:
    import pandas as pd

    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False
    pd = None

from transmutation_codex.core import (
    ConversionEvent,
    EventTypes,
    check_feature_access,
    check_file_size_limit,
    complete_operation,
    get_log_manager,
    publish,
    raise_conversion_error,
    record_conversion_attempt,
    start_operation,
    update_progress,
)
from transmutation_codex.core.decorators import converter

# Setup logger
logger = get_log_manager().get_converter_logger("xlsx2csv")


@converter(
    source_format="xlsx",
    target_format="csv",
    description="Convert Excel to CSV format",
    required_dependencies=["openpyxl", "pandas"],
    priority=10,
    version="1.0.0",
)
def convert_xlsx_to_csv(
    input_path: str | Path,
    output_path: str | Path | None = None,
    **kwargs: Any,
) -> Path:
    """Convert Excel spreadsheet to CSV format.

    This function converts Excel files (.xlsx, .xls) to CSV format. For files
    with multiple sheets, it creates separate CSV files for each sheet.

    Args:
        input_path: Path to input Excel file
        output_path: Path for output CSV file (auto-generated if None)
        **kwargs: Additional options:
            - sheet_name: Specific sheet to convert (default: None, converts all)
            - encoding: CSV encoding (default: 'utf-8')
            - separator: CSV separator (default: ',')
            - include_index: Include row indices (default: False)
            - max_rows: Maximum rows to export (default: None)

    Returns:
        Path: Path to generated CSV file (or directory if multiple sheets)

    Raises:
        ConversionError: If conversion fails
        ValidationError: If input validation fails
    """
    # Validate dependencies
    if not OPENPYXL_AVAILABLE:
        raise_conversion_error("openpyxl is required for Excel conversion")
    if not PANDAS_AVAILABLE:
        raise_conversion_error("pandas is required for Excel conversion")

    # Start operation
    operation_id = start_operation(f"Converting Excel to CSV: {Path(input_path).name}", total_steps=100)

    try:
        # Check licensing and file size
        check_feature_access("xlsx2csv")
        check_file_size_limit(input_path)
        record_conversion_attempt("xlsx2csv", str(input_path))

        # Convert paths
        input_path = Path(input_path)
        if output_path is None:
            output_path = input_path.with_suffix(".csv")
        else:
            output_path = Path(output_path)

        logger.info(f"Converting Excel to CSV: {input_path} -> {output_path}")

        # Parse options
        sheet_name = kwargs.get("sheet_name", None)
        encoding = kwargs.get("encoding", "utf-8")
        separator = kwargs.get("separator", ",")
        include_index = kwargs.get("include_index", False)
        max_rows = kwargs.get("max_rows", None)

        update_progress(operation_id, 10, "Loading Excel file...")

        # Load Excel file using pandas
        try:
            excel_file = pd.ExcelFile(input_path)
        except Exception as e:
            raise_conversion_error(f"Failed to load Excel file: {e}")

        update_progress(operation_id, 20, "Processing worksheets...")

        # Determine which sheets to process
        if sheet_name:
            if sheet_name not in excel_file.sheet_names:
                raise_conversion_error(f"Sheet '{sheet_name}' not found in Excel file")
            sheets_to_process = [sheet_name]
        else:
            sheets_to_process = excel_file.sheet_names

        # Process sheets
        total_sheets = len(sheets_to_process)
        output_files = []

        for sheet_idx, current_sheet in enumerate(sheets_to_process):
            logger.info(f"Processing sheet: {current_sheet}")
            update_progress(
                operation_id,
                20 + (sheet_idx / total_sheets) * 60,
                f"Processing sheet: {current_sheet}",
            )

            try:
                # Read sheet data
                df = pd.read_excel(input_path, sheet_name=current_sheet, nrows=max_rows)

                # Determine output file path
                if len(sheets_to_process) == 1:
                    # Single sheet - use provided output path
                    sheet_output_path = output_path
                else:
                    # Multiple sheets - create separate files
                    if output_path.is_dir():
                        sheet_output_path = output_path / f"{current_sheet}.csv"
                    else:
                        # Create directory based on output path
                        output_dir = output_path.parent / f"{output_path.stem}_sheets"
                        output_dir.mkdir(exist_ok=True)
                        sheet_output_path = output_dir / f"{current_sheet}.csv"

                # Convert DataFrame to CSV
                df.to_csv(
                    sheet_output_path,
                    index=include_index,
                    sep=separator,
                    encoding=encoding,
                )

                output_files.append(str(sheet_output_path))
                logger.info(f"Exported sheet '{current_sheet}' to: {sheet_output_path}")

            except Exception as e:
                logger.warning(f"Failed to process sheet {current_sheet}: {e}")
                continue

        if not output_files:
            raise_conversion_error("No sheets were successfully converted")

        update_progress(operation_id, 90, "Conversion completed...")

        # Determine final output path
        if len(output_files) == 1:
            final_output = Path(output_files[0])
        else:
            # Multiple files - return directory
            final_output = Path(output_files[0]).parent

        # Publish success event
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_COMPLETED,
                input_file=str(input_path),
                output_file=str(output_path),
                conversion_type="conversion",
            )
        )

        complete_operation(
            operation_id, {"output_path": str(final_output), "files": output_files}
        )
        logger.info(f"Excel to CSV conversion completed: {final_output}")

        return final_output

    except Exception as e:
        logger.exception(f"Excel to CSV conversion failed: {e}")
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_FAILED,
                input_file=str(input_path),
                conversion_type="conversion",
            )
        )
        raise_conversion_error(f"Conversion failed: {e}")

