"""PDF to Excel converter.

This module extracts tables from PDF files and converts them to Excel format.
"""

from pathlib import Path
from typing import Any

try:
    import pandas as pd

    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False
    pd = None

try:
    import tabula

    TABULA_AVAILABLE = True
except ImportError:
    TABULA_AVAILABLE = False
    tabula = None

try:
    import openpyxl

    OPENPYXL_AVAILABLE = True
except ImportError:
    OPENPYXL_AVAILABLE = False
    openpyxl = None

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
logger = get_log_manager().get_converter_logger("pdf2xlsx")


@converter(
    source_format="pdf",
    target_format="xlsx",
    description="Extract tables from PDF and convert to Excel",
    required_dependencies=["pandas", "tabula", "openpyxl"],
    priority=10,
    version="1.0.0",
)
def convert_pdf_to_xlsx(
    input_path: str | Path,
    output_path: str | Path | None = None,
    **kwargs: Any,
) -> Path:
    """Extract tables from PDF and convert to Excel format.

    This function extracts tables from PDF files and converts them to Excel
    format (.xlsx). It uses tabula-py for table extraction.

    Args:
        input_path: Path to input PDF file
        output_path: Path for output Excel file (auto-generated if None)
        **kwargs: Additional options:
            - pages: Pages to extract ('all', '1', '1-3', default: 'all')
            - multiple_tables: Handle multiple tables per page (default: True)
            - guess: Guess table areas automatically (default: True)
            - lattice: Use lattice mode for table detection (default: False)
            - stream: Use stream mode for table detection (default: False)
            - area: Table area coordinates (default: None)
            - columns: Column coordinates (default: None)

    Returns:
        Path: Path to generated Excel file

    Raises:
        ConversionError: If conversion fails
        ValidationError: If input validation fails
    """
    # Validate dependencies
    if not PANDAS_AVAILABLE:
        raise_conversion_error("pandas is required for table processing")
    if not TABULA_AVAILABLE:
        raise_conversion_error("tabula-py is required for PDF table extraction")
    if not OPENPYXL_AVAILABLE:
        raise_conversion_error("openpyxl is required for Excel generation")

    # Start operation
    operation_id = start_operation(
        f"Extracting tables from PDF: {Path(input_path).name}", total_steps=100
    )

    try:
        # Check licensing and file size
        check_feature_access("pdf2xlsx")
        check_file_size_limit(input_path)
        record_conversion_attempt("pdf2xlsx", str(input_path))

        # Convert paths
        input_path = Path(input_path)
        if output_path is None:
            output_path = input_path.with_suffix(".xlsx")
        else:
            output_path = Path(output_path)

        logger.info(f"Extracting tables from PDF: {input_path} -> {output_path}")

        # Parse options
        pages = kwargs.get("pages", "all")
        multiple_tables = kwargs.get("multiple_tables", True)
        guess = kwargs.get("guess", True)
        lattice = kwargs.get("lattice", False)
        stream = kwargs.get("stream", False)
        area = kwargs.get("area", None)
        columns = kwargs.get("columns", None)

        update_progress(operation_id, 10, "Reading PDF file...")

        # Extract tables from PDF
        try:
            if multiple_tables:
                # Extract all tables
                tables = tabula.read_pdf(
                    str(input_path),
                    pages=pages,
                    multiple_tables=True,
                    guess=guess,
                    lattice=lattice,
                    stream=stream,
                    area=area,
                    columns=columns,
                )
            else:
                # Extract single table
                df = tabula.read_pdf(
                    str(input_path),
                    pages=pages,
                    multiple_tables=False,
                    guess=guess,
                    lattice=lattice,
                    stream=stream,
                    area=area,
                    columns=columns,
                )
                tables = [df] if df is not None else []

        except Exception as e:
            raise_conversion_error(f"Failed to extract tables from PDF: {e}")

        if not tables:
            raise_conversion_error("No tables found in PDF file")

        update_progress(operation_id, 30, "Processing extracted tables...")

        # Process tables
        processed_tables = []
        for i, table in enumerate(tables):
            if table is not None and not table.empty:
                # Clean up the table
                table = table.dropna(how="all")  # Remove completely empty rows
                table = table.dropna(
                    axis=1, how="all"
                )  # Remove completely empty columns

                if not table.empty:
                    processed_tables.append((f"Table_{i + 1}", table))

        if not processed_tables:
            raise_conversion_error("No valid tables found after processing")

        update_progress(operation_id, 60, "Creating Excel file...")

        # Create Excel file with multiple sheets
        try:
            with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
                for sheet_name, table in processed_tables:
                    table.to_excel(writer, sheet_name=sheet_name, index=False)

                    # Auto-adjust column widths
                    worksheet = writer.sheets[sheet_name]
                    for column in worksheet.columns:
                        max_length = 0
                        column_letter = column[0].column_letter

                        for cell in column:
                            try:
                                if len(str(cell.value)) > max_length:
                                    max_length = len(str(cell.value))
                            except:
                                pass

                        adjusted_width = min(max_length + 2, 50)
                        worksheet.column_dimensions[
                            column_letter
                        ].width = adjusted_width

        except Exception as e:
            raise_conversion_error(f"Failed to create Excel file: {e}")

        update_progress(operation_id, 90, "Conversion completed...")

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
            operation_id,
            {"output_path": str(output_path), "tables_count": len(processed_tables)},
        )
        logger.info(
            f"PDF to Excel conversion completed: {output_path} ({len(processed_tables)} tables)"
        )

        return output_path

    except Exception as e:
        logger.exception(f"PDF to Excel conversion failed: {e}")
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_FAILED,
                input_file=str(input_path),
                conversion_type="conversion",
            )
        )
        raise_conversion_error(f"Conversion failed: {e}")
