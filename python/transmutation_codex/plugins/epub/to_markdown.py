"""EPUB to Markdown converter.

This module provides functionality to convert EPUB files to Markdown format.
Supports various Markdown generation options and formatting.
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
logger = get_log_manager().get_converter_logger("epub2md")


@converter(
    source_format="epub",
    target_format="md",
    description="Convert EPUB to Markdown format",
    required_dependencies=["ebooklib", "bs4"],
    priority=10,
    version="1.0.0",
)
def convert_epub_to_markdown(
    input_path: str | Path,
    output_path: str | Path | None = None,
    **kwargs: Any,
) -> Path:
    """Convert EPUB file to Markdown format.

    This function converts EPUB files to Markdown format while preserving
    text content and basic formatting.

    Args:
        input_path: Path to input EPUB file
        output_path: Path for output Markdown file (auto-generated if None)
        **kwargs: Additional options:
            - `include_toc` (bool): Whether to include table of contents.
                                   Defaults to True.
            - `chapter_breaks` (bool): Whether to add separators between chapters.
                                     Defaults to True.
            - `preserve_formatting` (bool): Whether to preserve basic formatting.
                                          Defaults to True.
            - `include_metadata` (bool): Whether to include EPUB metadata.
                                      Defaults to True.

    Returns:
        Path: The path to the generated Markdown file.

    Raises:
        ValidationError: If input or output paths are invalid, or dependencies are missing.
        ConversionError: If the conversion process fails.
    """
    logger.info(f"Attempting to convert EPUB to Markdown: {input_path}")

    # Validate dependencies
    if not EBOOKLIB_AVAILABLE:
        raise_conversion_error("ebooklib is required for EPUB conversion")
    if not BS4_AVAILABLE:
        raise_conversion_error("beautifulsoup4 is required for HTML parsing")

    # Start operation
    operation_id = start_operation(
        f"Converting EPUB to Markdown: {Path(input_path).name}", total_steps=100
    )

    try:
        # Check licensing and file size
        check_feature_access("epub2md")
        check_file_size_limit(input_path)
        record_conversion_attempt("epub2md", str(input_path))

        # Convert paths
        input_path = Path(input_path)
        if output_path is None:
            output_path = input_path.with_suffix(".md")
        else:
            output_path = Path(output_path)

        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)

        logger.info(f"Converting EPUB to Markdown: {input_path} -> {output_path}")

        # Parse options
        include_toc = kwargs.get("include_toc", True)
        chapter_breaks = kwargs.get("chapter_breaks", True)
        preserve_formatting = kwargs.get("preserve_formatting", True)
        include_metadata = kwargs.get("include_metadata", True)

        update_progress(operation_id, 10, "Loading EPUB file...")

        # Load EPUB file
        try:
            book = epub.read_epub(str(input_path))
        except Exception as e:
            raise_conversion_error(f"Failed to load EPUB file: {e}")

        logger.info(f"EPUB loaded: {book.get_metadata('DC', 'title')}")

        update_progress(operation_id, 20, "Processing EPUB content...")

        # Generate Markdown content
        markdown_parts = []

        # Add metadata if requested
        if include_metadata:
            title = book.get_metadata("DC", "title")
            if title:
                markdown_parts.append(f"# {title[0][0]}")
                markdown_parts.append("")

            author = book.get_metadata("DC", "creator")
            if author:
                markdown_parts.append(f"**Author:** {author[0][0]}")
                markdown_parts.append("")

            description = book.get_metadata("DC", "description")
            if description:
                markdown_parts.append(f"**Description:** {description[0][0]}")
                markdown_parts.append("")

            markdown_parts.append("---")
            markdown_parts.append("")

        # Add table of contents if requested
        if include_toc:
            markdown_parts.append("## Table of Contents")
            markdown_parts.append("")

            # Get spine items
            spine_items = book.spine
            for i, (item_id, _) in enumerate(spine_items):
                item = book.get_item_with_id(item_id)
                if item and item.get_name():
                    markdown_parts.append(
                        f"{i + 1}. [{item.get_name()}](#chapter-{i + 1})"
                    )

            markdown_parts.append("")
            markdown_parts.append("---")
            markdown_parts.append("")

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
                markdown_parts.append(f"## {item.get_name()} {{#chapter-{i + 1}}}")
                markdown_parts.append("")

            # Process content
            content = item.get_content()
            if content:
                # Parse HTML content
                soup = BeautifulSoup(content, "html.parser")

                # Convert to Markdown
                chapter_md = _html_to_markdown(soup, preserve_formatting)
                if chapter_md.strip():
                    markdown_parts.append(chapter_md)
                    markdown_parts.append("")

            # Add chapter break
            if chapter_breaks and i < total_items - 1:
                markdown_parts.append("---")
                markdown_parts.append("")

        update_progress(operation_id, 90, "Saving Markdown file...")

        # Write Markdown file
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(markdown_parts))

        # Publish success event
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_COMPLETED,
                input_file=str(input_path),
                output_file=str(output_path),
                conversion_type="epub2md",
            )
        )

        complete_operation(operation_id, {"output_path": str(output_path)})
        logger.info(f"EPUB to Markdown conversion completed: {output_path}")

        return output_path

    except Exception as e:
        logger.exception(f"EPUB to Markdown conversion failed: {e}")
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_FAILED,
                input_file=str(input_path),
                conversion_type="epub2md",
            )
        )
        raise_conversion_error(f"EPUB to Markdown conversion failed: {e}")


def _html_to_markdown(soup, preserve_formatting: bool) -> str:
    """Convert HTML content to Markdown."""
    markdown_parts = []

    for element in soup.find_all(
        ["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote"]
    ):
        if element.name in ["h1", "h2", "h3", "h4", "h5", "h6"]:
            # Headings
            level = int(element.name[1])
            text = element.get_text().strip()
            if text:
                markdown_parts.append(f"{'#' * level} {text}")
                markdown_parts.append("")

        elif element.name == "p":
            # Paragraphs
            text = element.get_text().strip()
            if text:
                markdown_parts.append(text)
                markdown_parts.append("")

        elif element.name == "blockquote":
            # Blockquotes
            text = element.get_text().strip()
            if text:
                lines = text.split("\n")
                for line in lines:
                    if line.strip():
                        markdown_parts.append(f"> {line.strip()}")
                markdown_parts.append("")

        elif element.name in ["ul", "ol"]:
            # Lists
            list_items = element.find_all("li", recursive=False)
            for li in list_items:
                text = li.get_text().strip()
                if text:
                    if element.name == "ul":
                        markdown_parts.append(f"- {text}")
                    else:
                        markdown_parts.append(f"1. {text}")
            markdown_parts.append("")

        elif element.name == "li":
            # List items (handled by parent ul/ol)
            continue

        elif element.name == "div":
            # Divs - just get text content
            text = element.get_text().strip()
            if text:
                markdown_parts.append(text)
                markdown_parts.append("")

    return "\n".join(markdown_parts)
