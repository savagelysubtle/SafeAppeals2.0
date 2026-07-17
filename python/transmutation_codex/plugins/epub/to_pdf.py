"""EPUB to PDF converter.

This module provides functionality to convert EPUB files to PDF format.
Supports various PDF generation options and styling.
"""

from pathlib import Path
from typing import Any

try:
    import ebooklib
    from ebooklib import epub

    EBOOKLIB_AVAILABLE = True
except ImportError:
    EBOOKLIB_AVAILABLE = False

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        PageBreak,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
    )

    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False

try:
    from bs4 import BeautifulSoup

    BS4_AVAILABLE = True
except ImportError:
    BS4_AVAILABLE = False

from transmutation_codex.core import (
    check_feature_access,
    check_file_size_limit,
    complete_operation,
    get_log_manager,
    publish,
    record_conversion_attempt,
    start_operation,
    update_progress,
)
from transmutation_codex.core.decorators import converter
from transmutation_codex.core.events import ConversionEvent, EventTypes
from transmutation_codex.core.exceptions import raise_conversion_error

# Setup logger
logger = get_log_manager().get_converter_logger("epub2pdf")


@converter(
    source_format="epub",
    target_format="pdf",
    description="Convert EPUB to PDF with formatting preservation",
    required_dependencies=["ebooklib", "reportlab", "bs4"],
    priority=10,
    version="1.0.0",
)
def convert_epub_to_pdf(
    input_path: str | Path,
    output_path: str | Path | None = None,
    **kwargs: Any,
) -> Path:
    """Convert EPUB file to PDF format.

    This function converts EPUB files to PDF format while preserving
    text content and basic formatting.

    Args:
        input_path: Path to input EPUB file
        output_path: Path for output PDF file (auto-generated if None)
        **kwargs: Additional options:
            - `page_size` (str): Page size for the PDF (e.g., "A4", "Letter").
                                Defaults to "A4".
            - `orientation` (str): Page orientation ("portrait" or "landscape").
                                 Defaults to "portrait".
            - `font_size` (int): Font size for the PDF.
                               Defaults to 12.
            - `margin` (float): Page margin in inches.
                              Defaults to 0.75.
            - `include_toc` (bool): Whether to include table of contents.
                                   Defaults to True.
            - `chapter_breaks` (bool): Whether to add page breaks between chapters.
                                     Defaults to True.

    Returns:
        Path: The path to the generated PDF file.

    Raises:
        ValidationError: If input or output paths are invalid, or dependencies are missing.
        ConversionError: If the conversion process fails.
    """
    logger.info(f"Attempting to convert EPUB to PDF: {input_path}")

    # Validate dependencies
    if not EBOOKLIB_AVAILABLE:
        raise_conversion_error("ebooklib is required for EPUB conversion")
    if not REPORTLAB_AVAILABLE:
        raise_conversion_error("reportlab is required for PDF generation")
    if not BS4_AVAILABLE:
        raise_conversion_error("beautifulsoup4 is required for HTML parsing")

    # Start operation
    operation_id = start_operation(
        f"Converting EPUB to PDF: {Path(input_path).name}", total_steps=100
    )

    try:
        # Check licensing and file size
        check_feature_access("epub2pdf")
        check_file_size_limit(input_path)
        record_conversion_attempt("epub2pdf", str(input_path))

        # Convert paths
        input_path = Path(input_path)
        if output_path is None:
            output_path = input_path.with_suffix(".pdf")
        else:
            output_path = Path(output_path)

        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)

        logger.info(f"Converting EPUB to PDF: {input_path} -> {output_path}")

        # Parse options
        page_size = kwargs.get("page_size", "A4")
        orientation = kwargs.get("orientation", "portrait")
        font_size = kwargs.get("font_size", 12)
        margin = kwargs.get("margin", 0.75)
        include_toc = kwargs.get("include_toc", True)
        chapter_breaks = kwargs.get("chapter_breaks", True)

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

        update_progress(operation_id, 10, "Loading EPUB file...")

        # Load EPUB file
        try:
            book = epub.read_epub(str(input_path))
        except Exception as e:
            raise_conversion_error(f"Failed to load EPUB file: {e}")

        logger.info(f"EPUB loaded: {book.get_metadata('DC', 'title')}")

        update_progress(operation_id, 20, "Processing EPUB content...")

        # Create PDF document
        doc = SimpleDocTemplate(
            str(output_path),
            pagesize=pagesize,
            rightMargin=margin * inch,
            leftMargin=margin * inch,
            topMargin=margin * inch,
            bottomMargin=margin * inch,
        )

        # Get styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "EPUBTitle",
            parent=styles["Heading1"],
            fontSize=font_size + 4,
            spaceAfter=12,
            alignment=1,  # Center alignment
        )
        chapter_style = ParagraphStyle(
            "EPUBChapter",
            parent=styles["Heading2"],
            fontSize=font_size + 2,
            spaceAfter=6,
            spaceBefore=12,
        )
        normal_style = ParagraphStyle(
            "EPUBNormal",
            parent=styles["Normal"],
            fontSize=font_size,
            spaceAfter=6,
        )

        story = []

        # Add title page
        title = book.get_metadata("DC", "title")
        if title:
            story.append(Paragraph(title[0][0], title_style))
            story.append(Spacer(1, 0.5 * inch))

        # Add author
        author = book.get_metadata("DC", "creator")
        if author:
            story.append(Paragraph(f"by {author[0][0]}", normal_style))
            story.append(Spacer(1, 0.3 * inch))

        # Add table of contents if requested
        if include_toc:
            story.append(Paragraph("Table of Contents", chapter_style))
            story.append(Spacer(1, 0.2 * inch))

            # Get spine items
            spine_items = book.spine
            for i, (item_id, _) in enumerate(spine_items):
                item = book.get_item_with_id(item_id)
                if item and item.get_name():
                    story.append(Paragraph(f"{i + 1}. {item.get_name()}", normal_style))

            story.append(PageBreak())

        update_progress(operation_id, 30, "Converting chapters...")

        # Process chapters
        spine_items = book.spine
        total_items = len(spine_items)

        for i, (item_id, _) in enumerate(spine_items):
            logger.info(f"Processing chapter {i + 1}/{total_items}")
            update_progress(
                operation_id,
                30 + (i / total_items) * 60,
                f"Processing chapter {i + 1}",
            )

            item = book.get_item_with_id(item_id)
            if not item:
                continue

            # Add chapter title
            if item.get_name():
                story.append(Paragraph(item.get_name(), chapter_style))

            # Process content
            content = item.get_content()
            if content:
                # Parse HTML content
                soup = BeautifulSoup(content, "html.parser")

                # Extract text and basic formatting
                for element in soup.find_all(
                    ["p", "div", "h1", "h2", "h3", "h4", "h5", "h6"]
                ):
                    text = element.get_text().strip()
                    if text:
                        if element.name in ["h1", "h2", "h3", "h4", "h5", "h6"]:
                            # Headings
                            level = int(element.name[1])
                            heading_style = ParagraphStyle(
                                f"Heading{level}",
                                parent=styles[f"Heading{level}"],
                                fontSize=max(font_size, font_size + 4 - level),
                                spaceAfter=6,
                                spaceBefore=12,
                            )
                            story.append(Paragraph(text, heading_style))
                        else:
                            # Regular paragraphs
                            story.append(Paragraph(text, normal_style))

            # Add page break between chapters
            if chapter_breaks and i < total_items - 1:
                story.append(PageBreak())

        update_progress(operation_id, 90, "Generating PDF...")

        # Build PDF
        doc.build(story)

        # Publish success event
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_COMPLETED,
                input_file=str(input_path),
                output_file=str(output_path),
                conversion_type="epub2pdf",
            )
        )

        complete_operation(operation_id, {"output_path": str(output_path)})
        logger.info(f"EPUB to PDF conversion completed: {output_path}")

        return output_path

    except Exception as e:
        logger.exception(f"EPUB to PDF conversion failed: {e}")
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_FAILED,
                input_file=str(input_path),
                conversion_type="epub2pdf",
            )
        )
        raise_conversion_error(f"EPUB to PDF conversion failed: {e}")
