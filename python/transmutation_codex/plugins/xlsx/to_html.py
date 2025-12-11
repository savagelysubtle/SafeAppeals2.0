"""Excel to HTML converter.

This module converts Excel spreadsheets to HTML format with interactive tables
and styling.
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
logger = get_log_manager().get_converter_logger("xlsx2html")


@converter(
    source_format="xlsx",
    target_format="html",
    description="Convert Excel to interactive HTML tables",
    required_dependencies=["openpyxl", "pandas"],
    priority=10,
    version="1.0.0",
)
def convert_xlsx_to_html(
    input_path: str | Path,
    output_path: str | Path | None = None,
    **kwargs: Any,
) -> Path:
    """Convert Excel spreadsheet to HTML format.

    This function converts Excel files (.xlsx, .xls) to HTML format with
    interactive tables, styling, and navigation between sheets.

    Args:
        input_path: Path to input Excel file
        output_path: Path for output HTML file (auto-generated if None)
        **kwargs: Additional options:
            - include_styling: Include CSS styling (default: True)
            - include_navigation: Include sheet navigation (default: True)
            - table_class: CSS class for tables (default: 'excel-table')
            - max_rows: Maximum rows to display per sheet (default: 1000)
            - include_index: Include row/column indices (default: False)

    Returns:
        Path: Path to generated HTML file

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
    operation_id = start_operation(f"Converting Excel to HTML: {Path(input_path).name}", total_steps=100)

    try:
        # Check licensing and file size
        check_feature_access("xlsx2html")
        check_file_size_limit(input_path)
        record_conversion_attempt("xlsx2html", str(input_path))

        # Convert paths
        input_path = Path(input_path)
        if output_path is None:
            output_path = input_path.with_suffix(".html")
        else:
            output_path = Path(output_path)

        logger.info(f"Converting Excel to HTML: {input_path} -> {output_path}")

        # Parse options
        include_styling = kwargs.get("include_styling", True)
        include_navigation = kwargs.get("include_navigation", True)
        table_class = kwargs.get("table_class", "excel-table")
        max_rows = kwargs.get("max_rows", 1000)
        include_index = kwargs.get("include_index", False)

        update_progress(operation_id, 10, "Loading Excel file...")

        # Load Excel file using pandas
        try:
            excel_file = pd.ExcelFile(input_path)
        except Exception as e:
            raise_conversion_error(f"Failed to load Excel file: {e}")

        update_progress(operation_id, 20, "Processing worksheets...")

        # Generate HTML content
        html_parts = []

        # HTML header
        html_parts.append("<!DOCTYPE html>")
        html_parts.append("<html lang='en'>")
        html_parts.append("<head>")
        html_parts.append("    <meta charset='UTF-8'>")
        html_parts.append(
            "    <meta name='viewport' content='width=device-width, initial-scale=1.0'>"
        )
        html_parts.append(f"    <title>Excel Export: {input_path.stem}</title>")

        if include_styling:
            html_parts.append("    <style>")
            html_parts.append(
                "        body { font-family: Arial, sans-serif; margin: 20px; }"
            )
            html_parts.append("        .sheet-nav { margin-bottom: 20px; }")
            html_parts.append(
                "        .sheet-nav a { margin-right: 10px; padding: 5px 10px; background: #f0f0f0; text-decoration: none; border-radius: 3px; }"
            )
            html_parts.append("        .sheet-nav a:hover { background: #e0e0e0; }")
            html_parts.append(
                "        .sheet-nav a.active { background: #007acc; color: white; }"
            )
            html_parts.append("        .sheet-content { display: none; }")
            html_parts.append("        .sheet-content.active { display: block; }")
            html_parts.append(
                "        .excel-table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }"
            )
            html_parts.append(
                "        .excel-table th, .excel-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }"
            )
            html_parts.append(
                "        .excel-table th { background-color: #f2f2f2; font-weight: bold; }"
            )
            html_parts.append(
                "        .excel-table tr:nth-child(even) { background-color: #f9f9f9; }"
            )
            html_parts.append(
                "        .excel-table tr:hover { background-color: #f5f5f5; }"
            )
            html_parts.append("    </style>")

        html_parts.append("</head>")
        html_parts.append("<body>")
        html_parts.append(f"<h1>Excel Export: {input_path.stem}</h1>")

        # Sheet navigation
        if include_navigation and len(excel_file.sheet_names) > 1:
            html_parts.append("<div class='sheet-nav'>")
            for i, sheet_name in enumerate(excel_file.sheet_names):
                active_class = "active" if i == 0 else ""
                html_parts.append(
                    f"    <a href='#sheet-{i}' onclick='showSheet({i})' class='{active_class}'>{sheet_name}</a>"
                )
            html_parts.append("</div>")

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
                    html_parts.append(
                        f"<div id='sheet-{sheet_idx}' class='sheet-content {'active' if sheet_idx == 0 else ''}'>"
                    )
                    html_parts.append(f"<h2>{sheet_name}</h2>")
                    html_parts.append("<p>This sheet is empty.</p>")
                    html_parts.append("</div>")
                    continue

                # Convert to HTML
                html_parts.append(
                    f"<div id='sheet-{sheet_idx}' class='sheet-content {'active' if sheet_idx == 0 else ''}'>"
                )
                html_parts.append(f"<h2>{sheet_name}</h2>")

                # Convert DataFrame to HTML
                table_html = df.to_html(
                    classes=table_class,
                    index=include_index,
                    escape=False,
                    table_id=f"table-{sheet_idx}",
                )

                html_parts.append(table_html)
                html_parts.append("</div>")

            except Exception as e:
                logger.warning(f"Failed to process sheet {sheet_name}: {e}")
                html_parts.append(
                    f"<div id='sheet-{sheet_idx}' class='sheet-content {'active' if sheet_idx == 0 else ''}'>"
                )
                html_parts.append(f"<h2>{sheet_name}</h2>")
                html_parts.append(f"<p>Error processing sheet: {e}</p>")
                html_parts.append("</div>")

        # JavaScript for sheet navigation
        if include_navigation and len(excel_file.sheet_names) > 1:
            html_parts.append("<script>")
            html_parts.append("function showSheet(sheetIndex) {")
            html_parts.append("    // Hide all sheets")
            html_parts.append(
                "    var sheets = document.querySelectorAll('.sheet-content');"
            )
            html_parts.append("    for (var i = 0; i < sheets.length; i++) {")
            html_parts.append("        sheets[i].classList.remove('active');")
            html_parts.append("    }")
            html_parts.append("    // Show selected sheet")
            html_parts.append(
                "    document.getElementById('sheet-' + sheetIndex).classList.add('active');"
            )
            html_parts.append("    // Update navigation")
            html_parts.append(
                "    var navLinks = document.querySelectorAll('.sheet-nav a');"
            )
            html_parts.append("    for (var i = 0; i < navLinks.length; i++) {")
            html_parts.append("        navLinks[i].classList.remove('active');")
            html_parts.append("    }")
            html_parts.append("    event.target.classList.add('active');")
            html_parts.append("}")
            html_parts.append("</script>")

        html_parts.append("</body>")
        html_parts.append("</html>")

        update_progress(operation_id, 90, "Writing HTML file...")

        # Write HTML file
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(html_parts))

        # Publish success event
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_COMPLETED,
                input_file=str(input_path),
                output_file=str(output_path),
                conversion_type="xlsx2html",
            )
        )

        complete_operation(operation_id, {"output_path": str(output_path)})
        logger.info(f"Excel to HTML conversion completed: {output_path}")

        return output_path

    except Exception as e:
        logger.exception(f"Excel to HTML conversion failed: {e}")
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_FAILED,
                input_file=str(input_path),
                conversion_type="xlsx2html",
            )
        )
        raise_conversion_error(f"Excel to HTML conversion failed: {e}")

