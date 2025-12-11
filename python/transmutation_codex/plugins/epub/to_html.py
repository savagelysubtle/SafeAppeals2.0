"""EPUB to HTML converter.

This module provides functionality to convert EPUB files to HTML format.
Supports various HTML generation options and styling.
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
logger = get_log_manager().get_converter_logger("epub2html")


@converter(
    source_format="epub",
    target_format="html",
    description="Convert EPUB to HTML with formatting preservation",
    required_dependencies=["ebooklib", "bs4"],
    priority=10,
    version="1.0.0",
)
def convert_epub_to_html(
    input_path: str | Path,
    output_path: str | Path | None = None,
    **kwargs: Any,
) -> Path:
    """Convert EPUB file to HTML format.

    This function converts EPUB files to HTML format while preserving
    text content and formatting.

    Args:
        input_path: Path to input EPUB file
        output_path: Path for output HTML file (auto-generated if None)
        **kwargs: Additional options:
            - `include_css` (bool): Whether to include CSS styling.
                                  Defaults to True.
            - `include_navigation` (bool): Whether to include navigation.
                                         Defaults to True.
            - `single_file` (bool): Whether to create a single HTML file.
                                   Defaults to True.
            - `preserve_images` (bool): Whether to preserve images.
                                      Defaults to True.
            - `css_style` (str): CSS style ("default", "minimal", "print").
                               Defaults to "default".

    Returns:
        Path: The path to the generated HTML file.

    Raises:
        ValidationError: If input or output paths are invalid, or dependencies are missing.
        ConversionError: If the conversion process fails.
    """
    logger.info(f"Attempting to convert EPUB to HTML: {input_path}")

    # Validate dependencies
    if not EBOOKLIB_AVAILABLE:
        raise_conversion_error("ebooklib is required for EPUB conversion")
    if not BS4_AVAILABLE:
        raise_conversion_error("beautifulsoup4 is required for HTML parsing")

    # Start operation
    operation_id = start_operation(
        f"Converting EPUB to HTML: {Path(input_path).name}", total_steps=100
    )

    try:
        # Check licensing and file size
        check_feature_access("epub2html")
        check_file_size_limit(input_path)
        record_conversion_attempt("epub2html", str(input_path))

        # Convert paths
        input_path = Path(input_path)
        if output_path is None:
            output_path = input_path.with_suffix(".html")
        else:
            output_path = Path(output_path)

        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)

        logger.info(f"Converting EPUB to HTML: {input_path} -> {output_path}")

        # Parse options
        include_css = kwargs.get("include_css", True)
        include_navigation = kwargs.get("include_navigation", True)
        single_file = kwargs.get("single_file", True)
        preserve_images = kwargs.get("preserve_images", True)
        css_style = kwargs.get("css_style", "default")

        update_progress(operation_id, 10, "Loading EPUB file...")

        # Load EPUB file
        try:
            book = epub.read_epub(str(input_path))
        except Exception as e:
            raise_conversion_error(f"Failed to load EPUB file: {e}")

        logger.info(f"EPUB loaded: {book.get_metadata('DC', 'title')}")

        update_progress(operation_id, 20, "Processing EPUB content...")

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

        # Title
        title = book.get_metadata("DC", "title")
        if title:
            html_parts.append(f"    <title>{title[0][0]}</title>")
        else:
            html_parts.append(f"    <title>{input_path.stem}</title>")

        # CSS styling
        if include_css:
            css_content = _get_css_style(css_style)
            html_parts.append("    <style>")
            html_parts.append(css_content)
            html_parts.append("    </style>")

        html_parts.append("</head>")
        html_parts.append("<body>")

        # Add title and metadata
        if title:
            html_parts.append(f"    <header><h1>{title[0][0]}</h1></header>")

        author = book.get_metadata("DC", "creator")
        if author:
            html_parts.append(f"    <p class='author'>by {author[0][0]}</p>")

        # Add navigation if requested
        if include_navigation:
            html_parts.append("    <nav class='toc'>")
            html_parts.append("        <h2>Table of Contents</h2>")
            html_parts.append("        <ul>")

            spine_items = book.spine
            for i, (item_id, _) in enumerate(spine_items):
                item = book.get_item_with_id(item_id)
                if item and item.get_name():
                    html_parts.append(
                        f"            <li><a href='#chapter-{i + 1}'>{item.get_name()}</a></li>"
                    )

            html_parts.append("        </ul>")
            html_parts.append("    </nav>")

        html_parts.append("    <main>")

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

            # Add chapter section
            html_parts.append(f"        <section id='chapter-{i + 1}' class='chapter'>")

            # Add chapter title
            if item.get_name():
                html_parts.append(f"            <h2>{item.get_name()}</h2>")

            # Process content
            content = item.get_content()
            if content:
                # Parse HTML content
                soup = BeautifulSoup(content, "html.parser")

                # Clean up the content
                _clean_html_content(soup)

                # Add content to HTML
                html_parts.append(str(soup))

            html_parts.append("        </section>")

        html_parts.append("    </main>")
        html_parts.append("</body>")
        html_parts.append("</html>")

        update_progress(operation_id, 90, "Saving HTML file...")

        # Write HTML file
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(html_parts))

        # Publish success event
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_COMPLETED,
                input_file=str(input_path),
                output_file=str(output_path),
                conversion_type="epub2html",
            )
        )

        complete_operation(operation_id, {"output_path": str(output_path)})
        logger.info(f"EPUB to HTML conversion completed: {output_path}")

        return output_path

    except Exception as e:
        logger.exception(f"EPUB to HTML conversion failed: {e}")
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_FAILED,
                input_file=str(input_path),
                conversion_type="epub2html",
            )
        )
        raise_conversion_error(f"EPUB to HTML conversion failed: {e}")


def _clean_html_content(soup: "BeautifulSoup") -> None:
    """Clean up HTML content for better formatting.

    Args:
        soup: BeautifulSoup object containing HTML content
    """
    # Remove script and style elements
    for element in soup(["script", "style"]):
        element.decompose()

    # Clean up whitespace
    for element in soup.find_all():
        if element.string:
            element.string = element.string.strip()

    # Remove empty elements
    for element in soup.find_all():
        if not element.get_text().strip() and not element.find_all():
            element.decompose()


def _get_css_style(style: str) -> str:
    """Get CSS style based on style name."""
    if style == "minimal":
        return """
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1, h2, h3 { color: #333; }
        .toc { margin-bottom: 30px; }
        .chapter { margin-bottom: 30px; }
        """
    elif style == "print":
        return """
        body { font-family: Times, serif; margin: 20px; }
        h1, h2, h3 { color: #000; }
        .toc { margin-bottom: 30px; }
        .chapter { margin-bottom: 30px; page-break-after: always; }
        """
    else:  # default
        return """
        body { font-family: Georgia, serif; margin: 40px; line-height: 1.6; }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        h3 { color: #7f8c8d; }
        .author { font-style: italic; color: #7f8c8d; margin-bottom: 30px; }
        .toc { background: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 30px; }
        .toc ul { list-style: none; padding: 0; }
        .toc li { margin: 5px 0; }
        .toc a { text-decoration: none; color: #3498db; }
        .toc a:hover { text-decoration: underline; }
        .chapter { margin-bottom: 40px; }
        p { margin-bottom: 15px; }
        """
