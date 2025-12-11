"""Markdown to PDF converter.

This module converts Markdown documents to PDF format, preserving structure.
"""

import re
from pathlib import Path
from typing import Any

try:
    from markdown_pdf import MarkdownPdf, Section
    MARKDOWN_PDF_AVAILABLE = True
except ImportError:
    MARKDOWN_PDF_AVAILABLE = False
    MarkdownPdf = None
    Section = None

from transmutation_codex.core import (
    ConfigManager,
    ConversionEvent,
    ErrorCode,
    EventTypes,
    check_feature_access,
    check_file_size_limit,
    complete_operation,
    get_log_manager,
    publish,
    raise_conversion_error,
    raise_validation_error,
    record_conversion_attempt,
    start_operation,
    update_progress,
)
from transmutation_codex.core.decorators import converter

# Setup logger
logger = get_log_manager().get_converter_logger("md2pdf")

# HTML styling for tables to be injected
TABLE_STYLE = """
<style>
table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1em;
}
th, td {
    padding: 8px;
    border: 1px solid #ddd;
    text-align: left;
}
th {
    background-color: #f2f2f2;
    font-weight: bold;
}
tr:nth-child(even) {
    background-color: #f9f9f9;
}
.pagebreak {
    page-break-after: always;
}
</style>
"""


@converter(
    source_format="md",
    target_format="pdf",
    description="Convert Markdown to PDF with table styling and page breaks",
    input_formats=["md", "markdown"],
    max_file_size_mb=50,
    required_dependencies=["markdown_pdf"],
    priority=10,
    version="1.0.0",
)
def convert_md_to_pdf(
    input_path: str | Path,
    output_path: str | Path | None = None,
    **kwargs: Any,  # Accept additional options
) -> Path:
    """Converts a Markdown file to a PDF document.

    This function utilizes the `markdown_pdf` library to perform the conversion.
    It preprocesses the Markdown content to handle custom page break markers
    and injects basic CSS for table styling if no style tags are present.
    The document title is extracted from the first H1 header or defaults to the
    input filename. Metadata (title, author) is added to the PDF.

    Args:
        input_path (str | Path): The path to the input Markdown file.
        output_path (str | Path | None): The path where the output PDF file will be
            saved. If None, it defaults to the same name as the input file but
            with a ".pdf" extension, in the same directory. Defaults to None.
        **kwargs (Any): Additional options. Currently supports:
            - `page_break_marker` (str): A string that, when found in the
              Markdown, will be treated as a page break. Defaults to the value
              in `md2pdf` config or "<!-- pagebreak -->". Common LaTeX commands
              `\\pagebreak` and `\\newpage` are also recognized.

    Returns:
        Path: The absolute path to the generated PDF file.

    Raises:
        FileNotFoundError: If `input_path` does not exist.
        RuntimeError: For any errors encountered during file operations or
            PDF generation by the `markdown_pdf` library.
    """
    # Start operation tracking
    operation = start_operation(
        "md2pdf", message=f"Converting {Path(input_path).name} to PDF", total_steps=100
    )

    # Publish conversion started event
    publish(
        ConversionEvent(
            event_type=EventTypes.CONVERSION_STARTED,
            source="md2pdf",
            data={
                "operation_id": operation,
                "input_file": str(input_path),
                "conversion_type": "md2pdf",
            },
        )
    )

    try:
        logger.info(f"Starting Markdown to PDF conversion: {input_path}")

        # License validation and feature gating
        try:
            check_feature_access("md2pdf")  # Check if user has access to MD→PDF conversion
            logger.debug("Feature access check passed for md2pdf")
        except Exception as e:
            logger.error(f"Feature access denied for md2pdf: {e}", exc_info=True)
            raise

        # Convert to Path for validation
        input_path = Path(input_path).resolve()
        logger.debug(f"Resolved input path: {input_path}")

        # Check file size limit (free tier: 5MB, paid: unlimited)
        try:
            check_file_size_limit(str(input_path))
            logger.debug("File size check passed")
        except Exception as e:
            logger.error(f"File size limit exceeded: {e}", exc_info=True)
            raise

        if not MARKDOWN_PDF_AVAILABLE:
            error_code = ErrorCode.CONVERSION_MD2PDF_LIBRARY_MISSING
            logger.error(f"[{error_code}] markdown_pdf library is required but not installed")
            raise_validation_error(
                "markdown_pdf is required. Install it with: pip install markdown-pdf",
                error_code=error_code,
            )

        if not input_path.exists():
            error_code = ErrorCode.VALIDATION_FILE_NOT_FOUND
            logger.error(f"[{error_code}] Input file not found: {input_path}")
            raise FileNotFoundError(f"Input file not found: {input_path}")

        output_path = (
            Path(output_path).resolve()
            if output_path
            else input_path.with_suffix(".pdf")
        )
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Update progress: file validation complete
        update_progress(operation, 10, "File validated")

        # Get config
        config = ConfigManager()
        settings = config.get_environment_config()

        # Get options from kwargs or config
        page_break_marker = kwargs.get(
            "page_break_marker", settings.get("page_break_marker", "<!-- pagebreak -->")
        )
        # respect_html_breaks is handled by the library by default

        logger.info(
            f"Converting {input_path} to PDF using marker: '{page_break_marker}'"
        )

        # Update progress: reading file
        update_progress(operation, 20, "Reading markdown file")
        logger.debug("Reading markdown file content")

        try:
            with open(input_path, encoding="utf-8") as md_file:
                markdown_content = md_file.read()
            logger.debug(f"Successfully read {len(markdown_content)} characters from markdown file")
        except Exception as e:
            error_code = ErrorCode.CONVERSION_MD2PDF_READ_FAILED
            logger.error(f"[{error_code}] Failed to read markdown file: {input_path}", exc_info=True)
            raise_conversion_error(
                f"Failed to read markdown file: {e}",
                source_format="md",
                target_format="pdf",
                source_file=str(input_path),
                error_code=error_code,
            )

        # Extract title
        title_match = re.search(r"^#\s+(.+)$", markdown_content, re.MULTILINE)
        title = title_match.group(1) if title_match else input_path.name
        logger.debug(f"Using title: {title}")

        # Update progress: preprocessing
        update_progress(operation, 30, "Preprocessing markdown")

        # Preprocess markdown for page breaks
        break_token = "<!-- pagebreak -->"
        if page_break_marker and page_break_marker != break_token:
            markdown_content = markdown_content.replace(page_break_marker, break_token)
            logger.info(
                f"Replaced custom marker '{page_break_marker}' with '{break_token}'"
            )

        markdown_content = markdown_content.replace("\\pagebreak", break_token)
        markdown_content = markdown_content.replace("\\newpage", break_token)

        # Inject table style if not present
        has_style_tag = "<style" in markdown_content
        if not has_style_tag:
            markdown_content = TABLE_STYLE + markdown_content
            logger.debug("Injected default table styles.")

        # Update progress: generating PDF
        update_progress(operation, 50, "Generating PDF")

        pdf = MarkdownPdf()
        pdf.meta["title"] = title
        pdf.meta["author"] = settings.get("application_name", "MDtoPDF Converter")

        if break_token in markdown_content:
            sections = markdown_content.split(break_token)
            logger.info(f"Document split into {len(sections)} sections by page breaks.")
            update_progress(operation, 60, f"Processing {len(sections)} sections")
            for i, section_content in enumerate(sections):
                if section_content.strip():
                    if i > 0 and not has_style_tag and "<style" not in section_content:
                        section_content = TABLE_STYLE + section_content
                    pdf.add_section(Section(section_content, toc=True))
                    # Update progress for each section
                    progress = 60 + int((i + 1) / len(sections) * 30)
                    update_progress(
                        operation, progress, f"Section {i + 1}/{len(sections)}"
                    )
        else:
            logger.info("No page breaks found.")
            pdf.add_section(Section(markdown_content, toc=True))
            update_progress(operation, 90, "Single section processed")

        # Update progress: saving
        update_progress(operation, 95, "Saving PDF")
        logger.debug(f"Saving PDF to: {output_path}")

        try:
            pdf.save(str(output_path))
            logger.debug(f"Successfully saved PDF to: {output_path}")
        except Exception as e:
            error_code = ErrorCode.CONVERSION_MD2PDF_SAVE_FAILED
            logger.error(f"[{error_code}] Failed to save PDF file: {output_path}", exc_info=True)
            raise_conversion_error(
                f"Failed to save PDF file: {e}",
                source_format="md",
                target_format="pdf",
                source_file=str(input_path),
                error_code=error_code,
            )

        # Record conversion for trial tracking
        record_conversion_attempt(
            converter_name="md2pdf",
            input_file=str(input_path),
            output_file=str(output_path),
            success=True,
        )

        # Complete operation
        complete_operation(operation, success=True)

        logger.info(f"Successfully converted Markdown to PDF: {output_path}")
        return output_path

    except FileNotFoundError as e:
        error_code = ErrorCode.VALIDATION_FILE_NOT_FOUND
        logger.error(f"[{error_code}] File not found during conversion: {e}", exc_info=True)
        complete_operation(operation, success=False)
        raise
    except Exception as e:
        error_code = ErrorCode.CONVERSION_MD2PDF_GENERATION_FAILED
        logger.error(f"[{error_code}] Error converting Markdown to PDF: {e}", exc_info=True)
        complete_operation(operation, success=False)
        raise_conversion_error(
            f"Markdown to PDF conversion failed: {e}",
            source_format="md",
            target_format="pdf",
            source_file=str(input_path) if isinstance(input_path, Path) else str(input_path),
            error_code=error_code,
        )

