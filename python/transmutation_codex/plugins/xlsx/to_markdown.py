"""Excel to Markdown converter.

This module converts Excel spreadsheets to Markdown format with table formatting.
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
logger = get_log_manager().get_converter_logger("xlsx2md")


@converter(
    source_format="xlsx",
    target_format="md",
    description="Convert Excel to Markdown tables",
    required_dependencies=["openpyxl", "pandas"],
    priority=10,
    version="1.0.0",
)
def convert_xlsx_to_markdown(
    input_path: str | Path,
    output_path: str | Path | None = None,
    **kwargs: Any,
) -> Path:
    """Convert Excel spreadsheet to Markdown format.

    This function converts Excel files (.xlsx, .xls) to Markdown format with
    properly formatted tables for each worksheet.

    Args:
        input_path: Path to input Excel file
        output_path: Path for output Markdown file (auto-generated if None)
        **kwargs: Additional options:
            - include_sheet_names: Include sheet names as headers (default: True)
            - max_rows: Maximum rows to export per sheet (default: 1000)
            - include_index: Include row indices (default: False)
            - table_format: Table format ('pipe', 'grid', default: 'pipe')

    Returns:
        Path: Path to generated Markdown file

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
    operation_id = start_operation(f"Converting Excel to Markdown: {Path(input_path).name}", total_steps=100)

    try:
        # Check licensing and file size
        check_feature_access("xlsx2md")
        check_file_size_limit(input_path)
        record_conversion_attempt("xlsx2md", str(input_path))

        # Convert paths
        input_path = Path(input_path)
        if output_path is None:
            output_path = input_path.with_suffix(".md")
        else:
            output_path = Path(output_path)

        logger.info(f"Converting Excel to Markdown: {input_path} -> {output_path}")

        # Parse options
        include_sheet_names = kwargs.get("include_sheet_names", True)
        max_rows = kwargs.get("max_rows", 1000)
        include_index = kwargs.get("include_index", False)
        table_format = kwargs.get("table_format", "pipe")

        update_progress(operation_id, 10, "Loading Excel file...")

        # Load Excel file using pandas
        try:
            excel_file = pd.ExcelFile(input_path)
        except Exception as e:
            raise_conversion_error(f"Failed to load Excel file: {e}")

        update_progress(operation_id, 20, "Processing worksheets...")

        # Generate Markdown content
        markdown_parts = []

        # Add title
        markdown_parts.append(f"# Excel Export: {input_path.stem}")
        markdown_parts.append("")

        # Process each sheet
        total_sheets = len(excel_file.sheet_names)

        for sheet_idx, sheet_name in enumerate(excel_file.sheet_names):
            logger.info(f"Processing sheet: {sheet_name}")
            update_progress(
                operation_id,
                20 + (sheet_idx / total_sheets) * 60,
                f"Processing sheet: {sheet_name}",
            )

            try:
                # Read sheet data
                df = pd.read_excel(input_path, sheet_name=sheet_name, nrows=max_rows)

                # Handle empty sheets
                if df.empty:
                    if include_sheet_names:
                        markdown_parts.append(f"## {sheet_name}")
                        markdown_parts.append("")
                    markdown_parts.append("*This sheet is empty.*")
                    markdown_parts.append("")
                    continue

                # Add sheet name as header
                if include_sheet_names:
                    markdown_parts.append(f"## {sheet_name}")
                    markdown_parts.append("")

                # Convert DataFrame to Markdown table
                if table_format == "pipe":
                    table_md = df.to_markdown(index=include_index, tablefmt="pipe")
                elif table_format == "grid":
                    table_md = df.to_markdown(index=include_index, tablefmt="grid")
                else:
                    table_md = df.to_markdown(index=include_index, tablefmt="pipe")

                markdown_parts.append(table_md)
                markdown_parts.append("")

            except Exception as e:
                logger.warning(f"Failed to process sheet {sheet_name}: {e}")
                if include_sheet_names:
                    markdown_parts.append(f"## {sheet_name}")
                    markdown_parts.append("")
                markdown_parts.append(f"*Error processing sheet: {e}*")
                markdown_parts.append("")

        update_progress(operation_id, 90, "Writing Markdown file...")

        # Write Markdown file
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(markdown_parts))

        # Publish success event
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_COMPLETED,
                input_file=str(input_path),
                output_file=str(output_path),
                conversion_type="xlsx2md",
            )
        )

        complete_operation(operation_id, {"output_path": str(output_path)})
        logger.info(f"Excel to Markdown conversion completed: {output_path}")

        return output_path

    except Exception as e:
        logger.exception(f"Excel to Markdown conversion failed: {e}")
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_FAILED,
                input_file=str(input_path),
                conversion_type="xlsx2md",
            )
        )
        raise_conversion_error(f"Excel to Markdown conversion failed: {e}")

