"""CSV to PDF converter.

This module converts CSV files to PDF format with formatted tables.
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
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False

from transmutation_codex.core import (
    ConversionEvent,
    ErrorCode,
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
logger = get_log_manager().get_converter_logger("csv2pdf")


@converter(
    source_format="csv",
    target_format="pdf",
    description="Convert CSV to formatted PDF tables",
    required_dependencies=["pandas", "reportlab"],
    priority=10,
    version="1.0.0",
)
def convert_csv_to_pdf(
    input_path: str | Path,
    output_path: str | Path | None = None,
    **kwargs: Any,
) -> Path:
    """Convert CSV file to PDF format.

    This function converts CSV files to PDF format with formatted tables,
    proper styling, and page breaks for large datasets.

    Args:
        input_path: Path to input CSV file
        output_path: Path for output PDF file (auto-generated if None)
        **kwargs: Additional options:
            - encoding: CSV encoding (default: 'utf-8')
            - separator: CSV separator (default: ',')
            - page_size: Page size ('A4', 'Letter', default: 'A4')
            - orientation: Page orientation ('portrait', 'landscape', default: 'portrait')
            - include_header: Include header row (default: True)
            - max_rows_per_page: Maximum rows per page (default: 50)
            - font_size: Font size for PDF (default: 8)
            - title: Document title (default: filename)

    Returns:
        Path: Path to generated PDF file

    Raises:
        ConversionError: If conversion fails
        ValidationError: If input validation fails
    """
    # Validate dependencies
    if not PANDAS_AVAILABLE:
        error_code = ErrorCode.DEPENDENCY_MISSING_LIBRARY
        logger.error(f"[{error_code}] pandas library is required but not installed")
        raise_conversion_error(
            "pandas is required for CSV conversion",
            source_format="csv",
            target_format="pdf",
            error_code=error_code,
        )
    if not REPORTLAB_AVAILABLE:
        error_code = ErrorCode.DEPENDENCY_MISSING_LIBRARY
        logger.error(f"[{error_code}] reportlab library is required but not installed")
        raise_conversion_error(
            "reportlab is required for PDF generation",
            source_format="csv",
            target_format="pdf",
            error_code=error_code,
        )

    # Start operation
    operation_id = start_operation(
        f"Converting CSV to PDF: {Path(input_path).name}", total_steps=100
    )

    try:
        logger.info(f"Starting CSV to PDF conversion: {input_path}")

        # Check licensing and file size
        try:
            check_feature_access("csv2pdf")
            logger.debug("Feature access check passed for csv2pdf")
        except Exception as e:
            logger.error(f"Feature access denied for csv2pdf: {e}", exc_info=True)
            raise

        try:
            check_file_size_limit(input_path)
            logger.debug("File size check passed")
        except Exception as e:
            logger.error(f"File size limit exceeded: {e}", exc_info=True)
            raise

        record_conversion_attempt("csv2pdf", str(input_path))

        # Convert paths
        input_path = Path(input_path)
        if output_path is None:
            output_path = input_path.with_suffix(".pdf")
        else:
            output_path = Path(output_path)

        logger.info(f"Converting CSV to PDF: {input_path} -> {output_path}")

        # Parse options
        encoding = kwargs.get("encoding", "utf-8")
        separator = kwargs.get("separator", ",")
        page_size = kwargs.get("page_size", "A4")
        orientation = kwargs.get("orientation", "portrait")
        include_header = kwargs.get("include_header", True)
        max_rows_per_page = kwargs.get("max_rows_per_page", 50)
        font_size = kwargs.get("font_size", 8)
        title = kwargs.get("title", input_path.stem)

        # Validate page size
        if page_size.lower() == "a4":
            pagesize = A4
        elif page_size.lower() == "letter":
            pagesize = letter
        else:
            raise_conversion_error(f"Invalid page size: {page_size}")

        # Validate orientation
        if orientation.lower() == "landscape":
            pagesize = (pagesize[1], pagesize[0])  # Swap width/height

        update_progress(operation_id, 10, "Reading CSV file...")

        # Read CSV file
        logger.debug(f"Reading CSV file with encoding={encoding}, separator={separator}")
        try:
            df = pd.read_csv(
                input_path,
                encoding=encoding,
                sep=separator,
                header=0 if include_header else None,
            )
            logger.debug(f"Successfully read CSV file: {len(df)} rows, {len(df.columns)} columns")
        except Exception as e:
            error_code = ErrorCode.CONVERSION_CSV2PDF_READ_FAILED
            logger.error(f"[{error_code}] Failed to read CSV file: {input_path}", exc_info=True)
            raise_conversion_error(
                f"Failed to read CSV file: {e}",
                source_format="csv",
                target_format="pdf",
                source_file=str(input_path),
                error_code=error_code,
            )

        update_progress(operation_id, 20, "Creating PDF document...")

        # Create PDF document
        doc = SimpleDocTemplate(
            str(output_path),
            pagesize=pagesize,
            rightMargin=0.5 * inch,
            leftMargin=0.5 * inch,
            topMargin=0.5 * inch,
            bottomMargin=0.5 * inch,
        )

        # Get styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "CustomTitle",
            parent=styles["Heading1"],
            fontSize=16,
            spaceAfter=12,
            alignment=1,  # Center alignment
        )

        story = []

        # Add title
        story.append(Paragraph(f"<b>{title}</b>", title_style))
        story.append(Spacer(1, 12))

        update_progress(operation_id, 30, "Processing data...")

        # Process data in chunks
        total_rows = len(df)
        chunk_size = max_rows_per_page

        for start_idx in range(0, total_rows, chunk_size):
            end_idx = min(start_idx + chunk_size, total_rows)
            chunk_df = df.iloc[start_idx:end_idx]

            # Convert to list of lists for table
            data = []

            # Add header if this is the first chunk and headers are included
            if start_idx == 0 and include_header:
                data.append(list(chunk_df.columns))

            # Add data rows
            for _, row in chunk_df.iterrows():
                data.append([str(cell) if pd.notna(cell) else "" for cell in row])

            if data:
                # Create table
                table = Table(data)

                # Style the table
                table_style = [
                    ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                    ("FONTSIZE", (0, 0), (-1, -1), font_size),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
                ]

                # Style header if present
                if include_header and start_idx == 0:
                    table_style.extend(
                        [
                            ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
                            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                            ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
                            ("BACKGROUND", (0, 1), (-1, -1), colors.beige),
                        ]
                    )
                else:
                    table_style.append(("BACKGROUND", (0, 0), (-1, -1), colors.beige))

                table.setStyle(TableStyle(table_style))
                story.append(table)

                # Add page break if not the last chunk
                if end_idx < total_rows:
                    from reportlab.platypus.flowables import PageBreak

                    story.append(PageBreak())

        update_progress(operation_id, 90, "Generating PDF...")
        logger.debug(f"Building PDF document with {len(story)} elements")

        # Build PDF
        try:
            doc.build(story)
            logger.debug(f"Successfully generated PDF: {output_path}")
        except Exception as e:
            error_code = ErrorCode.CONVERSION_CSV2PDF_GENERATION_FAILED
            logger.error(f"[{error_code}] Failed to generate PDF: {output_path}", exc_info=True)
            raise_conversion_error(
                f"Failed to generate PDF: {e}",
                source_format="csv",
                target_format="pdf",
                source_file=str(input_path),
                error_code=error_code,
            )

        # Publish success event
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_COMPLETED,
                input_file=str(input_path),
                output_file=str(output_path),
                conversion_type="conversion",
            )
        )

        complete_operation(operation_id, {"output_path": str(output_path)})
        logger.info(f"Successfully completed CSV to PDF conversion: {output_path}")

        return output_path

    except Exception as e:
        error_code = ErrorCode.CONVERSION_CSV2PDF_GENERATION_FAILED
        logger.error(f"[{error_code}] CSV to PDF conversion failed: {e}", exc_info=True)
        complete_operation(operation_id, success=False)
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_FAILED,
                input_file=str(input_path),
                conversion_type="conversion",
            )
        )
        raise_conversion_error(
            f"Conversion failed: {e}",
            source_format="csv",
            target_format="pdf",
            source_file=str(input_path),
            error_code=error_code,
        )
