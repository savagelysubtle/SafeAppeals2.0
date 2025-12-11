"""DOCX to EPUB converter.

This module provides functionality to convert DOCX files to EPUB format.
Supports various EPUB generation options and styling.
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
    from docx import Document

    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False

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
logger = get_log_manager().get_converter_logger("docx2epub")


@converter(
    source_format="docx",
    target_format="epub",
    description="Convert DOCX to EPUB format",
    required_dependencies=["ebooklib", "docx", "bs4"],
    priority=10,
    version="1.0.0",
)
def convert_docx_to_epub(
    input_path: str | Path,
    output_path: str | Path | None = None,
    **kwargs: Any,
) -> Path:
    """Convert DOCX file to EPUB format.

    This function converts DOCX files to EPUB format while preserving
    text content and basic formatting.

    Args:
        input_path: Path to input DOCX file
        output_path: Path for output EPUB file (auto-generated if None)
        **kwargs: Additional options:
            - `title` (str): EPUB title (defaults to filename).
            - `author` (str): EPUB author.
            - `language` (str): EPUB language code.
                              Defaults to "en".
            - `css_style` (str): CSS style ("default", "minimal", "print").
                               Defaults to "default".
            - `include_toc` (bool): Whether to include table of contents.
                                   Defaults to True.
            - `chapter_split` (str): How to split chapters ("none", "heading1", "heading2").
                                   Defaults to "heading1".

    Returns:
        Path: The path to the generated EPUB file.

    Raises:
        ValidationError: If input or output paths are invalid, or dependencies are missing.
        ConversionError: If the conversion process fails.
    """
    logger.info(f"Attempting to convert DOCX to EPUB: {input_path}")

    # Validate dependencies
    if not EBOOKLIB_AVAILABLE:
        raise_conversion_error("ebooklib is required for EPUB generation")
    if not DOCX_AVAILABLE:
        raise_conversion_error("docx is required for DOCX conversion")
    if not BS4_AVAILABLE:
        raise_conversion_error("beautifulsoup4 is required for HTML parsing")

    # Start operation
    operation_id = start_operation(
        f"Converting DOCX to EPUB: {Path(input_path).name}", total_steps=100
    )

    try:
        # Check licensing and file size
        check_feature_access("docx2epub")
        check_file_size_limit(input_path)
        record_conversion_attempt("docx2epub", str(input_path))

        # Convert paths
        input_path = Path(input_path)
        if output_path is None:
            output_path = input_path.with_suffix(".epub")
        else:
            output_path = Path(output_path)

        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)

        logger.info(f"Converting DOCX to EPUB: {input_path} -> {output_path}")

        # Parse options
        title = kwargs.get("title", input_path.stem)
        author = kwargs.get("author", "Unknown")
        language = kwargs.get("language", "en")
        css_style = kwargs.get("css_style", "default")
        include_toc = kwargs.get("include_toc", True)
        chapter_split = kwargs.get("chapter_split", "heading1")

        update_progress(operation_id, 10, "Loading DOCX file...")

        # Load DOCX file
        try:
            doc = Document(input_path)
        except Exception as e:
            raise_conversion_error(f"Failed to load DOCX file: {e}")

        logger.info(f"DOCX loaded: {len(doc.paragraphs)} paragraphs")

        update_progress(operation_id, 20, "Processing DOCX content...")

        # Extract content from DOCX
        html_content = _docx_to_html(doc)

        update_progress(operation_id, 30, "Creating EPUB book...")

        # Create EPUB book
        book = epub.EpubBook()

        # Set metadata
        book.set_identifier(f"docx2epub-{input_path.stem}")
        book.set_title(title)
        book.set_language(language)
        book.add_author(author)

        # Add CSS
        css_content = _get_css_style(css_style)
        nav_css = epub.EpubItem(
            uid="nav_css",
            file_name="style/nav.css",
            media_type="text/css",
            content=css_content,
        )
        book.add_item(nav_css)

        update_progress(operation_id, 40, "Processing HTML content...")

        # Parse HTML and create chapters
        soup = BeautifulSoup(html_content, "html.parser")

        # Split content into chapters if requested
        if chapter_split != "none":
            chapters = _split_html_into_chapters(soup, chapter_split)
        else:
            chapters = [soup]

        update_progress(operation_id, 50, "Creating EPUB chapters...")

        # Create EPUB chapters
        spine = ["nav"]
        toc = []

        for i, chapter_html in enumerate(chapters):
            chapter_title = f"Chapter {i + 1}"

            # Try to extract title from first heading
            first_heading = chapter_html.find(["h1", "h2", "h3", "h4", "h5", "h6"])
            if first_heading:
                chapter_title = first_heading.get_text().strip()

            # Create chapter
            chapter = epub.EpubHtml(
                title=chapter_title, file_name=f"chapter_{i + 1}.xhtml", lang=language
            )
            chapter.content = str(chapter_html)
            chapter.add_item(nav_css)

            book.add_item(chapter)
            spine.append(chapter)
            toc.append(chapter)

        update_progress(operation_id, 70, "Adding navigation...")

        # Add navigation
        book.toc = toc
        book.spine = spine

        # Add navigation file
        book.add_item(epub.EpubNcx())
        book.add_item(epub.EpubNav())

        update_progress(operation_id, 90, "Saving EPUB file...")

        # Write EPUB file
        try:
            epub.write_epub(str(output_path), book, {})
        except Exception as e:
            raise_conversion_error(f"Failed to save EPUB file: {e}")

        # Publish success event
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_COMPLETED,
                input_file=str(input_path),
                output_file=str(output_path),
                conversion_type="docx2epub",
            )
        )

        complete_operation(operation_id, {"output_path": str(output_path)})
        logger.info(f"DOCX to EPUB conversion completed: {output_path}")

        return output_path

    except Exception as e:
        logger.exception(f"DOCX to EPUB conversion failed: {e}")
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_FAILED,
                input_file=str(input_path),
                conversion_type="docx2epub",
            )
        )
        raise_conversion_error(f"DOCX to EPUB conversion failed: {e}")


def _docx_to_html(doc: Document) -> str:
    """Convert DOCX document to HTML."""
    html_parts = ["<div>"]

    for paragraph in doc.paragraphs:
        if not paragraph.text.strip():
            continue

        # Check if it's a heading
        if paragraph.style.name.startswith("Heading"):
            level = int(paragraph.style.name[-1])
            html_parts.append(f"<h{level}>{paragraph.text}</h{level}>")
        else:
            # Regular paragraph
            html_parts.append(f"<p>{paragraph.text}</p>")

    html_parts.append("</div>")
    return "\n".join(html_parts)


def _get_css_style(style: str) -> str:
    """Get CSS style based on style name."""
    if style == "minimal":
        return """
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1, h2, h3 { color: #333; }
        p { margin-bottom: 15px; }
        """
    elif style == "print":
        return """
        body { font-family: Times, serif; margin: 20px; }
        h1, h2, h3 { color: #000; }
        p { margin-bottom: 15px; }
        """
    else:  # default
        return """
        body { font-family: Georgia, serif; margin: 40px; line-height: 1.6; }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        h3 { color: #7f8c8d; }
        p { margin-bottom: 15px; }
        """


def _split_html_into_chapters(soup, split_level: str) -> list:
    """Split HTML content into chapters based on heading level."""
    chapters = []
    current_chapter = BeautifulSoup("<div></div>", "html.parser")

    # Find all elements
    elements = soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "div"])

    for element in elements:
        if element.name in ["h1", "h2", "h3", "h4", "h5", "h6"]:
            level = int(element.name[1])

            if split_level == "heading1" and level == 1:
                if current_chapter.find_all():
                    chapters.append(current_chapter)
                    current_chapter = BeautifulSoup("<div></div>", "html.parser")
            elif split_level == "heading2" and level <= 2:
                if current_chapter.find_all():
                    chapters.append(current_chapter)
                    current_chapter = BeautifulSoup("<div></div>", "html.parser")

        # Add element to current chapter
        current_chapter.div.append(element)

    # Add the last chapter
    if current_chapter.find_all():
        chapters.append(current_chapter)

    return chapters
