"""Markdown to HTML conversion.

This module provides functionality to convert Markdown files to HTML format.
Uses the markdown library with common extensions for rich HTML output.
"""

import time
from pathlib import Path

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
from transmutation_codex.core.events import ConversionEvent

# Setup logger
log_manager = get_log_manager()
logger = log_manager.get_converter_logger("md2html")

# Try to import markdown library
try:
    import markdown
    from markdown.extensions import (
        codehilite,
        fenced_code,
        tables,
        toc,
    )

    MARKDOWN_AVAILABLE = True
    logger.debug("Markdown library available")
except ImportError:
    MARKDOWN_AVAILABLE = False
    logger.warning("Markdown library not found. Install with: uv add markdown")


@converter(
    source_format="md",
    target_format="html",
    name="md_to_html_convert_md_to_html",
    priority=50,
    version="1.0.0",
)
def convert_md_to_html(
    input_path: str | Path,
    output_path: str | Path | None = None,
    css_style: str = "default",
    include_toc: bool = True,
    code_highlighting: bool = True,
    **options,
) -> Path:
    """Convert Markdown file to HTML.

    Args:
        input_path: Path to input Markdown file
        output_path: Path for output HTML file (optional)
        css_style: CSS styling option ('default', 'minimal', 'github', 'none')
        include_toc: Include table of contents
        code_highlighting: Enable code syntax highlighting
        **options: Additional options

    Returns:
        Path to the generated HTML file

    Raises:
        ImportError: If markdown library is not available
        FileNotFoundError: If input file doesn't exist
        Exception: If conversion fails
    """
    # Check if markdown library is available
    if not MARKDOWN_AVAILABLE:
        raise ImportError(
            "Markdown library is required for MD to HTML conversion. "
            "Install with: uv add markdown"
        )

    # Convert to Path objects
    input_path = Path(input_path)
    if output_path:
        output_path = Path(output_path)
    else:
        output_path = input_path.with_suffix(".html")

    # Start operation tracking
    operation = start_operation(
        "conversion",
        100,
        description=f"Converting {input_path.name} to HTML",
    )

    # Publish conversion started event
    publish(
        ConversionEvent(
            event_type="conversion.started",
            conversion_type="md2html",
            plugin_name="md_to_html_convert_md_to_html",
            input_file=str(input_path),
            output_file=str(output_path),
        )
    )

    logger.info(f"Starting Markdown to HTML conversion: {input_path}")
    logger.info(f"Output will be saved to: {output_path}")
    logger.info(
        f"Options: css={css_style}, toc={include_toc}, highlighting={code_highlighting}"
    )

    start_time = time.time()

    try:
        # License validation and feature gating (md2html is paid-only)
        check_feature_access("md2html")

        # Convert to Path for validation
        input_path = Path(input_path).resolve()

        # Check file size limit
        check_file_size_limit(str(input_path))

        # Validate input file
        if not input_path.exists():
            raise FileNotFoundError(f"Input file not found: {input_path}")

        update_progress(operation, 20, f"Reading {input_path.name}...")

        # Read Markdown content
        with open(input_path, encoding="utf-8") as f:
            markdown_content = f.read()

        logger.debug(f"Read {len(markdown_content)} characters from {input_path.name}")
        update_progress(operation, 40, "Processing Markdown...")

        # Configure markdown extensions
        extensions = ["extra", "meta"]

        if include_toc:
            extensions.append("toc")

        if code_highlighting:
            extensions.extend(["fenced_code", "codehilite"])

        logger.debug(f"Using extensions: {extensions}")

        # Convert Markdown to HTML
        md = markdown.Markdown(extensions=extensions)
        html_content = md.convert(markdown_content)

        update_progress(operation, 60, "Generating HTML document...")

        # Get CSS styling
        css_content = _get_css_style(css_style)

        # Create complete HTML document
        html_document = _create_html_document(
            title=input_path.stem,
            body_content=html_content,
            css=css_content,
            toc_html=md.toc if include_toc and hasattr(md, "toc") else None,
        )

        update_progress(operation, 80, "Writing HTML file...")

        # Write HTML file
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html_document)

        duration = time.time() - start_time
        logger.info(f"Successfully converted {input_path.name} to HTML: {output_path}")
        logger.info(f"Conversion completed in {duration:.2f}s")

        # Complete operation
        # Record conversion for trial tracking
        record_conversion_attempt(
            converter_name="md2html",
            input_file=str(input_path),
            output_file=str(output_path),
            success=True,
        )

        complete_operation(operation, success=True)

        # Publish conversion completed event
        publish(
            ConversionEvent(
                event_type="conversion.completed",
                conversion_type="md2html",
                plugin_name="md_to_html_convert_md_to_html",
                input_file=str(input_path),
                output_file=str(output_path),
            )
        )

        return output_path

    except Exception as e:
        duration = time.time() - start_time
        logger.exception(f"Markdown to HTML conversion failed: {e}")

        # Publish conversion failed event
        publish(
            ConversionEvent(
                event_type="conversion.failed",
                conversion_type="md2html",
                plugin_name="md_to_html_convert_md_to_html",
                input_file=str(input_path),
                output_file=str(output_path) if output_path else None,
            )
        )

        raise


def _get_css_style(style: str) -> str:
    """Get CSS styling based on style option.

    Args:
        style: Style name ('default', 'minimal', 'github', 'none')

    Returns:
        CSS content as string
    """
    if style == "none":
        return ""

    if style == "minimal":
        return """
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        code {
            background-color: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
        }
        pre {
            background-color: #f4f4f4;
            padding: 10px;
            border-radius: 5px;
            overflow-x: auto;
        }
        """

    if style == "github":
        return """
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
            line-height: 1.6;
            max-width: 980px;
            margin: 0 auto;
            padding: 45px;
            background-color: #ffffff;
            color: #24292e;
        }
        h1, h2, h3, h4, h5, h6 {
            margin-top: 24px;
            margin-bottom: 16px;
            font-weight: 600;
            line-height: 1.25;
        }
        h1 { padding-bottom: 0.3em; border-bottom: 1px solid #eaecef; }
        h2 { padding-bottom: 0.3em; border-bottom: 1px solid #eaecef; }
        code {
            background-color: rgba(27,31,35,0.05);
            padding: 0.2em 0.4em;
            border-radius: 6px;
            font-family: SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
            font-size: 85%;
        }
        pre {
            background-color: #f6f8fa;
            padding: 16px;
            border-radius: 6px;
            overflow-x: auto;
        }
        pre code {
            background-color: transparent;
            padding: 0;
        }
        blockquote {
            padding: 0 1em;
            color: #6a737d;
            border-left: 0.25em solid #dfe2e5;
        }
        table {
            border-collapse: collapse;
            margin: 15px 0;
        }
        table th, table td {
            padding: 6px 13px;
            border: 1px solid #dfe2e5;
        }
        table tr:nth-child(2n) {
            background-color: #f6f8fa;
        }
        """

    # Default style
    return """
    body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        line-height: 1.8;
        max-width: 900px;
        margin: 0 auto;
        padding: 40px;
        color: #333;
        background-color: #fff;
    }
    h1, h2, h3, h4, h5, h6 {
        color: #2c3e50;
        margin-top: 1.5em;
        margin-bottom: 0.5em;
    }
    h1 { font-size: 2.5em; border-bottom: 2px solid #3498db; padding-bottom: 0.3em; }
    h2 { font-size: 2em; border-bottom: 1px solid #bdc3c7; padding-bottom: 0.3em; }
    h3 { font-size: 1.5em; }
    code {
        background-color: #ecf0f1;
        padding: 2px 8px;
        border-radius: 4px;
        font-family: 'Courier New', Courier, monospace;
        font-size: 0.9em;
        color: #e74c3c;
    }
    pre {
        background-color: #2c3e50;
        color: #ecf0f1;
        padding: 20px;
        border-radius: 8px;
        overflow-x: auto;
        line-height: 1.4;
    }
    pre code {
        background-color: transparent;
        padding: 0;
        color: #ecf0f1;
    }
    blockquote {
        border-left: 4px solid #3498db;
        padding-left: 20px;
        margin: 20px 0;
        color: #7f8c8d;
        font-style: italic;
    }
    a {
        color: #3498db;
        text-decoration: none;
    }
    a:hover {
        text-decoration: underline;
    }
    table {
        border-collapse: collapse;
        width: 100%;
        margin: 20px 0;
    }
    table th, table td {
        padding: 12px;
        border: 1px solid #bdc3c7;
        text-align: left;
    }
    table th {
        background-color: #34495e;
        color: white;
        font-weight: bold;
    }
    table tr:nth-child(even) {
        background-color: #ecf0f1;
    }
    img {
        max-width: 100%;
        height: auto;
    }
    """


def _create_html_document(
    title: str, body_content: str, css: str, toc_html: str | None = None
) -> str:
    """Create complete HTML document with metadata.

    Args:
        title: Document title
        body_content: Main HTML content
        css: CSS styling
        toc_html: Optional table of contents HTML

    Returns:
        Complete HTML document as string
    """
    toc_section = ""
    if toc_html and toc_html.strip():
        toc_section = f"""
        <nav id="toc">
            <h2>Table of Contents</h2>
            {toc_html}
        </nav>
        <hr>
        """

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="generator" content="AiChemist Transmutation Codex">
    <title>{title}</title>
    <style>
        {css}
        #toc {{
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }}
        #toc h2 {{
            margin-top: 0;
        }}
        #toc ul {{
            list-style-type: none;
            padding-left: 20px;
        }}
    </style>
</head>
<body>
    {toc_section}
    {body_content}
</body>
</html>
"""
