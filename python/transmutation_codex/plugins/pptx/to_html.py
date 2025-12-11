"""PowerPoint to HTML converter.

This module converts PowerPoint presentations to HTML format.
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
logger = get_log_manager().get_converter_logger("pptx2html")


@converter(
    source_format="pptx",
    target_format="html",
    description="Convert PowerPoint presentation to HTML",
    required_dependencies=["pptx"],
    priority=10,
    version="1.0.0",
)
def convert_pptx_to_html(
    input_path: str | Path,
    output_path: str | Path | None = None,
    **kwargs: Any,
) -> Path:
    """Convert PowerPoint presentation to HTML format.

    This function converts PowerPoint files (.pptx, .ppt) to HTML format with
    slide navigation and styling.

    Args:
        input_path: Path to input PowerPoint file
        output_path: Path for output HTML file (auto-generated if None)
        **kwargs: Additional options:
            - include_navigation: Include slide navigation (default: True)
            - include_notes: Include speaker notes (default: False)
            - slide_style: CSS style for slides (default: 'slide')
            - title: Document title (default: filename)

    Returns:
        Path: Path to generated HTML file

    Raises:
        ConversionError: If conversion fails
        ValidationError: If input validation fails
    """
    # Validate dependencies
    if not PPTX_AVAILABLE:
        raise_conversion_error("python-pptx is required for PowerPoint conversion")

    # Start operation
    operation_id = start_operation(
        f"Converting PowerPoint to HTML: {Path(input_path).name}", total_steps=100
    )

    try:
        # Check licensing and file size
        check_feature_access("pptx2html")
        check_file_size_limit(input_path)
        record_conversion_attempt("pptx2html", str(input_path))

        # Convert paths
        input_path = Path(input_path)
        if output_path is None:
            output_path = input_path.with_suffix(".html")
        else:
            output_path = Path(output_path)

        logger.info(f"Converting PowerPoint to HTML: {input_path} -> {output_path}")

        # Parse options
        include_navigation = kwargs.get("include_navigation", True)
        include_notes = kwargs.get("include_notes", False)
        slide_style = kwargs.get("slide_style", "slide")
        title = kwargs.get("title", input_path.stem)

        update_progress(operation_id, 10, "Loading PowerPoint file...")

        # Load PowerPoint file
        try:
            presentation = Presentation(str(input_path))
        except Exception as e:
            raise_conversion_error(f"Failed to load PowerPoint file: {e}")

        update_progress(operation_id, 20, "Processing slides...")

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
        html_parts.append(f"    <title>{title}</title>")
        html_parts.append("    <style>")
        html_parts.append(
            "        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }"
        )
        html_parts.append(
            "        .presentation { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }"
        )
        html_parts.append(
            "        .slide-nav { margin-bottom: 20px; text-align: center; }"
        )
        html_parts.append(
            "        .slide-nav a { margin: 0 5px; padding: 8px 12px; background: #007acc; color: white; text-decoration: none; border-radius: 4px; }"
        )
        html_parts.append("        .slide-nav a:hover { background: #005a9e; }")
        html_parts.append("        .slide-nav a.active { background: #005a9e; }")
        html_parts.append(
            "        .slide { display: none; margin-bottom: 30px; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }"
        )
        html_parts.append("        .slide.active { display: block; }")
        html_parts.append(
            "        .slide-title { font-size: 24px; font-weight: bold; margin-bottom: 15px; color: #333; }"
        )
        html_parts.append(
            "        .slide-content { font-size: 16px; line-height: 1.6; color: #555; }"
        )
        html_parts.append("        .slide-content p { margin-bottom: 10px; }")
        html_parts.append(
            "        .slide-content ul, .slide-content ol { margin-left: 20px; }"
        )
        html_parts.append(
            "        .notes { margin-top: 15px; padding: 10px; background: #f9f9f9; border-left: 4px solid #007acc; font-style: italic; }"
        )
        html_parts.append(
            "        .slide-number { font-size: 14px; color: #666; margin-bottom: 10px; }"
        )
        html_parts.append("    </style>")
        html_parts.append("</head>")
        html_parts.append("<body>")
        html_parts.append("<div class='presentation'>")
        html_parts.append(f"<h1>{title}</h1>")

        # Slide navigation
        if include_navigation and len(presentation.slides) > 1:
            html_parts.append("<div class='slide-nav'>")
            for i in range(len(presentation.slides)):
                active_class = "active" if i == 0 else ""
                html_parts.append(
                    f"    <a href='#slide-{i}' onclick='showSlide({i})' class='{active_class}'>Slide {i + 1}</a>"
                )
            html_parts.append("</div>")

        # Process slides
        total_slides = len(presentation.slides)

        for slide_idx, slide in enumerate(presentation.slides):
            logger.info(f"Processing slide {slide_idx + 1}/{total_slides}")
            update_progress(
                operation_id,
                20 + (slide_idx / total_slides) * 60,
                f"Processing slide {slide_idx + 1}",
            )

            active_class = "active" if slide_idx == 0 else ""
            html_parts.append(
                f"<div id='slide-{slide_idx}' class='slide {active_class}'>"
            )
            html_parts.append(f"<div class='slide-number'>Slide {slide_idx + 1}</div>")

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
                            html_parts.append(f"<div class='slide-title'>{text}</div>")
                        else:
                            html_parts.append(
                                f"<div class='slide-content'>{text}</div>"
                            )
            else:
                html_parts.append(
                    "<div class='slide-content'><em>No text content</em></div>"
                )

            # Add speaker notes if requested
            if include_notes and hasattr(slide, "notes_slide"):
                notes_slide = slide.notes_slide
                if hasattr(notes_slide, "notes_text_frame"):
                    notes_text = notes_slide.notes_text_frame.text
                    if notes_text.strip():
                        html_parts.append(
                            f"<div class='notes'><strong>Notes:</strong> {notes_text}</div>"
                        )

            html_parts.append("</div>")

        html_parts.append("</div>")

        # JavaScript for slide navigation
        if include_navigation and len(presentation.slides) > 1:
            html_parts.append("<script>")
            html_parts.append("function showSlide(slideIndex) {")
            html_parts.append("    // Hide all slides")
            html_parts.append("    var slides = document.querySelectorAll('.slide');")
            html_parts.append("    for (var i = 0; i < slides.length; i++) {")
            html_parts.append("        slides[i].classList.remove('active');")
            html_parts.append("    }")
            html_parts.append("    // Show selected slide")
            html_parts.append(
                "    document.getElementById('slide-' + slideIndex).classList.add('active');"
            )
            html_parts.append("    // Update navigation")
            html_parts.append(
                "    var navLinks = document.querySelectorAll('.slide-nav a');"
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
                conversion_type="conversion",
            )
        )

        complete_operation(
            operation_id,
            {"output_path": str(output_path), "slides_count": total_slides},
        )
        logger.info(
            f"PowerPoint to HTML conversion completed: {output_path} ({total_slides} slides)"
        )

        return output_path

    except Exception as e:
        logger.exception(f"PowerPoint to HTML conversion failed: {e}")
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_FAILED,
                input_file=str(input_path),
                conversion_type="conversion",
            )
        )
        raise_conversion_error(f"Conversion failed: {e}")
