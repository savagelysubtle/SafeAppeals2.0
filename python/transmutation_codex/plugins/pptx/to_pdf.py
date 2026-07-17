"""PowerPoint to PDF converter.

This module converts PowerPoint presentations to PDF format.
"""

from pathlib import Path
from typing import Any

try:
    from pptx import Presentation

    PPTX_AVAILABLE = True
except ImportError:
    PPTX_AVAILABLE = False
    Presentation = None

try:
    from reportlab.lib.pagesizes import A4, letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer

    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False

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
logger = get_log_manager().get_converter_logger("pptx2pdf")


@converter(
    source_format="pptx",
    target_format="pdf",
    description="Convert PowerPoint presentation to PDF",
    required_dependencies=["pptx", "reportlab"],
    priority=10,
    version="1.0.0",
)
def convert_pptx_to_pdf(
    input_path: str | Path,
    output_path: str | Path | None = None,
    **kwargs: Any,
) -> Path:
    """Convert PowerPoint presentation to PDF format.

    This function converts PowerPoint files (.pptx, .ppt) to PDF format by
    extracting text content and creating a formatted PDF document.

    Args:
        input_path: Path to input PowerPoint file
        output_path: Path for output PDF file (auto-generated if None)
        **kwargs: Additional options:
            - page_size: Page size ('A4', 'Letter', default: 'A4')
            - orientation: Page orientation ('portrait', 'landscape', default: 'portrait')
            - include_slide_numbers: Include slide numbers (default: True)
            - include_notes: Include speaker notes (default: False)
            - font_size: Font size for PDF (default: 12)
            - title: Document title (default: filename)

    Returns:
        Path: Path to generated PDF file

    Raises:
        ConversionError: If conversion fails
        ValidationError: If input validation fails
    """
    # Validate dependencies
    if not PPTX_AVAILABLE:
        raise_conversion_error("python-pptx is required for PowerPoint conversion")
    if not REPORTLAB_AVAILABLE:
        raise_conversion_error("reportlab is required for PDF generation")

    # Start operation
    operation_id = start_operation(
        f"Converting PowerPoint to PDF: {Path(input_path).name}", total_steps=100
    )

    try:
        # Check licensing and file size
        check_feature_access("pptx2pdf")
        check_file_size_limit(input_path)
        record_conversion_attempt("pptx2pdf", str(input_path))

        # Convert paths
        input_path = Path(input_path)
        if output_path is None:
            output_path = input_path.with_suffix(".pdf")
        else:
            output_path = Path(output_path)

        logger.info(f"Converting PowerPoint to PDF: {input_path} -> {output_path}")

        # Parse options
        page_size = kwargs.get("page_size", "A4")
        orientation = kwargs.get("orientation", "portrait")
        include_slide_numbers = kwargs.get("include_slide_numbers", True)
        include_notes = kwargs.get("include_notes", False)
        font_size = kwargs.get("font_size", 12)
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

        update_progress(operation_id, 10, "Loading PowerPoint file...")

        # Load PowerPoint file
        try:
            presentation = Presentation(str(input_path))
        except Exception as e:
            raise_conversion_error(f"Failed to load PowerPoint file: {e}")

        update_progress(operation_id, 20, "Extracting content...")

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
            "SlideTitle",
            parent=styles["Heading1"],
            fontSize=font_size + 4,
            spaceAfter=12,
            spaceBefore=12,
        )

        content_style = ParagraphStyle(
            "SlideContent", parent=styles["Normal"], fontSize=font_size, spaceAfter=6
        )

        story = []

        # Add document title
        story.append(Paragraph(f"<b>{title}</b>", title_style))
        story.append(Spacer(1, 12))

        # Process slides
        total_slides = len(presentation.slides)

        for slide_idx, slide in enumerate(presentation.slides):
            logger.info(f"Processing slide {slide_idx + 1}/{total_slides}")
            update_progress(
                operation_id,
                20 + (slide_idx / total_slides) * 60,
                f"Processing slide {slide_idx + 1}",
            )

            # Add slide number if requested
            if include_slide_numbers:
                story.append(Paragraph(f"<b>Slide {slide_idx + 1}</b>", title_style))

            # Extract text from slide
            slide_text = []
            for shape in slide.shapes:
                if hasattr(shape, "text") and shape.text.strip():
                    slide_text.append(shape.text.strip())

            # Add slide content
            if slide_text:
                for text in slide_text:
                    if text:
                        story.append(Paragraph(text, content_style))
            else:
                story.append(Paragraph("<i>No text content</i>", content_style))

            # Add speaker notes if requested
            if include_notes and hasattr(slide, "notes_slide"):
                notes_slide = slide.notes_slide
                if hasattr(notes_slide, "notes_text_frame"):
                    notes_text = notes_slide.notes_text_frame.text
                    if notes_text.strip():
                        story.append(
                            Paragraph(f"<b>Notes:</b> {notes_text}", content_style)
                        )

            # Add page break between slides (except for the last slide)
            if slide_idx < total_slides - 1:
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
                conversion_type="conversion",
            )
        )

        complete_operation(
            operation_id,
            {"output_path": str(output_path), "slides_count": total_slides},
        )
        logger.info(
            f"PowerPoint to PDF conversion completed: {output_path} ({total_slides} slides)"
        )

        return output_path

    except Exception as e:
        logger.exception(f"PowerPoint to PDF conversion failed: {e}")
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_FAILED,
                input_file=str(input_path),
                conversion_type="conversion",
            )
        )
        raise_conversion_error(f"Conversion failed: {e}")
