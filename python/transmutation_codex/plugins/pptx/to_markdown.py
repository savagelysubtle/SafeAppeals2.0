"""PowerPoint to Markdown converter.

This module converts PowerPoint presentations to Markdown format.
"""

from pathlib import Path
from typing import Any

try:
    from pptx import Presentation

    PPTX_AVAILABLE = True
except ImportError:
    PPTX_AVAILABLE = False
    Presentation = None

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
logger = get_log_manager().get_converter_logger("pptx2md")


@converter(
    source_format="pptx",
    target_format="md",
    description="Convert PowerPoint presentation to Markdown",
    required_dependencies=["pptx"],
    priority=10,
    version="1.0.0",
)
def convert_pptx_to_markdown(
    input_path: str | Path,
    output_path: str | Path | None = None,
    **kwargs: Any,
) -> Path:
    """Convert PowerPoint presentation to Markdown format.

    This function converts PowerPoint files (.pptx, .ppt) to Markdown format
    with slide content organized as sections.

    Args:
        input_path: Path to input PowerPoint file
        output_path: Path for output Markdown file (auto-generated if None)
        **kwargs: Additional options:
            - include_slide_numbers: Include slide numbers (default: True)
            - include_notes: Include speaker notes (default: False)
            - title: Document title (default: filename)

    Returns:
        Path: Path to generated Markdown file

    Raises:
        ConversionError: If conversion fails
        ValidationError: If input validation fails
    """
    # Validate dependencies
    if not PPTX_AVAILABLE:
        raise_conversion_error("python-pptx is required for PowerPoint conversion")

    # Start operation
    operation_id = start_operation(
        f"Converting PowerPoint to Markdown: {Path(input_path).name}", total_steps=100
    )

    try:
        # Check licensing and file size
        check_feature_access("pptx2md")
        check_file_size_limit(input_path)
        record_conversion_attempt("pptx2md", str(input_path))

        # Convert paths
        input_path = Path(input_path)
        if output_path is None:
            output_path = input_path.with_suffix(".md")
        else:
            output_path = Path(output_path)

        logger.info(f"Converting PowerPoint to Markdown: {input_path} -> {output_path}")

        # Parse options
        include_slide_numbers = kwargs.get("include_slide_numbers", True)
        include_notes = kwargs.get("include_notes", False)
        title = kwargs.get("title", input_path.stem)

        update_progress(operation_id, 10, "Loading PowerPoint file...")

        # Load PowerPoint file
        try:
            presentation = Presentation(str(input_path))
        except Exception as e:
            raise_conversion_error(f"Failed to load PowerPoint file: {e}")

        update_progress(operation_id, 20, "Processing slides...")

        # Generate Markdown content
        markdown_parts = []

        # Add title
        markdown_parts.append(f"# {title}")
        markdown_parts.append("")

        # Process slides
        total_slides = len(presentation.slides)

        for slide_idx, slide in enumerate(presentation.slides):
            logger.info(f"Processing slide {slide_idx + 1}/{total_slides}")
            update_progress(
                operation_id,
                20 + (slide_idx / total_slides) * 60,
                f"Processing slide {slide_idx + 1}",
            )

            # Add slide header
            if include_slide_numbers:
                markdown_parts.append(f"## Slide {slide_idx + 1}")
            else:
                markdown_parts.append(f"## Slide {slide_idx + 1}")
            markdown_parts.append("")

            # Extract text from slide
            slide_text = []
            for shape in slide.shapes:
                if hasattr(shape, "text") and shape.text.strip():
                    slide_text.append(shape.text.strip())

            # Add slide content
            if slide_text:
                for text in slide_text:
                    if text:
                        # Simple text formatting
                        if (
                            len(text) > 50
                            and not text.startswith("•")
                            and not text.startswith("-")
                        ):
                            markdown_parts.append(f"**{text}**")
                        else:
                            markdown_parts.append(text)
                        markdown_parts.append("")
            else:
                markdown_parts.append("*No text content*")
                markdown_parts.append("")

            # Add speaker notes if requested
            if include_notes and hasattr(slide, "notes_slide"):
                notes_slide = slide.notes_slide
                if hasattr(notes_slide, "notes_text_frame"):
                    notes_text = notes_slide.notes_text_frame.text
                    if notes_text.strip():
                        markdown_parts.append("**Notes:**")
                        markdown_parts.append("")
                        markdown_parts.append(notes_text)
                        markdown_parts.append("")

            # Add separator between slides
            if slide_idx < total_slides - 1:
                markdown_parts.append("---")
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
                conversion_type="conversion",
            )
        )

        complete_operation(
            operation_id,
            {"output_path": str(output_path), "slides_count": total_slides},
        )
        logger.info(
            f"PowerPoint to Markdown conversion completed: {output_path} ({total_slides} slides)"
        )

        return output_path

    except Exception as e:
        logger.exception(f"PowerPoint to Markdown conversion failed: {e}")
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_FAILED,
                input_file=str(input_path),
                conversion_type="conversion",
            )
        )
        raise_conversion_error(f"Conversion failed: {e}")
