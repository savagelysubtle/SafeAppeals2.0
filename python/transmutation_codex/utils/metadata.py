"""Document metadata extraction utilities for the Transmutation Codex.

This module provides utilities for extracting and managing metadata from
various document formats, enabling rich document information processing
and preservation during conversions.
"""

from datetime import datetime
from pathlib import Path
from typing import Any

from transmutation_codex.core import ErrorCode, get_log_manager

# Setup logger
logger = get_log_manager().get_logger("transmutation_codex.utils.metadata")


def extract_file_metadata(file_path: str) -> dict[str, Any]:
    """Extract basic file system metadata.

    Args:
        file_path: Path to the file

    Returns:
        Dictionary containing file metadata
    """
    metadata = {
        "file_path": file_path,
        "file_name": None,
        "file_size": 0,
        "file_size_mb": 0.0,
        "created_time": None,
        "modified_time": None,
        "accessed_time": None,
        "file_extension": None,
        "format_detected": None,
    }

    try:
        path = Path(file_path)

        if path.exists():
            stat = path.stat()

            metadata.update(
                {
                    "file_name": path.name,
                    "file_size": stat.st_size,
                    "file_size_mb": round(stat.st_size / (1024 * 1024), 2),
                    "created_time": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                    "modified_time": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "accessed_time": datetime.fromtimestamp(stat.st_atime).isoformat(),
                    "file_extension": path.suffix.lower().lstrip(".")
                    if path.suffix
                    else None,
                }
            )

            # Try to detect format
            from .file_utils import detect_file_format

            detected_format = detect_file_format(file_path)
            if detected_format:
                metadata["format_detected"] = detected_format

    except Exception as e:
        error_code = ErrorCode.UTILS_METADATA_EXTRACTION_FAILED
        logger.error(f"[{error_code}] Failed to extract file metadata from {file_path}: {e}", exc_info=True)
        metadata["extraction_error"] = str(e)

    return metadata


def extract_pdf_metadata(file_path: str) -> dict[str, Any]:
    """Extract metadata from PDF files.

    Args:
        file_path: Path to PDF file

    Returns:
        Dictionary containing PDF metadata
    """
    metadata = {
        "format": "pdf",
        "title": None,
        "author": None,
        "subject": None,
        "creator": None,
        "producer": None,
        "creation_date": None,
        "modification_date": None,
        "page_count": 0,
        "is_encrypted": False,
        "has_text": False,
        "pdf_version": None,
    }

    try:
        import PyPDF2

        with open(file_path, "rb") as file:
            reader = PyPDF2.PdfReader(file)

            # Basic info
            metadata["page_count"] = len(reader.pages)
            metadata["is_encrypted"] = reader.is_encrypted

            # Document info
            if reader.metadata:
                doc_info = reader.metadata
                metadata.update(
                    {
                        "title": doc_info.get("/Title"),
                        "author": doc_info.get("/Author"),
                        "subject": doc_info.get("/Subject"),
                        "creator": doc_info.get("/Creator"),
                        "producer": doc_info.get("/Producer"),
                        "creation_date": str(doc_info.get("/CreationDate"))
                        if doc_info.get("/CreationDate")
                        else None,
                        "modification_date": str(doc_info.get("/ModDate"))
                        if doc_info.get("/ModDate")
                        else None,
                    }
                )

            # Check if PDF has text content
            try:
                if reader.pages:
                    first_page = reader.pages[0]
                    text = first_page.extract_text()
                    metadata["has_text"] = bool(text.strip())
            except:
                metadata["has_text"] = False

    except Exception as e:
        error_code = ErrorCode.UTILS_METADATA_EXTRACTION_FAILED
        logger.error(f"[{error_code}] Failed to extract PDF metadata from {file_path}: {e}", exc_info=True)
        metadata["extraction_error"] = str(e)

    return metadata


def extract_markdown_metadata(file_path: str) -> dict[str, Any]:
    """Extract metadata from Markdown files.

    Args:
        file_path: Path to Markdown file

    Returns:
        Dictionary containing Markdown metadata
    """
    metadata = {
        "format": "markdown",
        "title": None,
        "word_count": 0,
        "line_count": 0,
        "character_count": 0,
        "heading_count": 0,
        "link_count": 0,
        "image_count": 0,
        "code_block_count": 0,
        "frontmatter": None,
        "has_yaml_frontmatter": False,
        "headings": [],
    }

    try:
        with open(file_path, encoding="utf-8", errors="ignore") as file:
            content = file.read()

        lines = content.split("\n")
        metadata["line_count"] = len(lines)
        metadata["character_count"] = len(content)

        # Word count (approximate)
        words = content.split()
        metadata["word_count"] = len(words)

        # Extract YAML frontmatter
        if content.startswith("---\n"):
            try:
                end_pos = content.find("\n---\n", 4)
                if end_pos != -1:
                    frontmatter_text = content[4:end_pos]
                    metadata["frontmatter"] = frontmatter_text
                    metadata["has_yaml_frontmatter"] = True

                    # Try to parse YAML
                    try:
                        import yaml

                        parsed_frontmatter = yaml.safe_load(frontmatter_text)
                        if isinstance(parsed_frontmatter, dict):
                            metadata["title"] = parsed_frontmatter.get("title")
                            metadata.update(
                                {
                                    f"frontmatter_{k}": v
                                    for k, v in parsed_frontmatter.items()
                                }
                            )
                    except:
                        pass
            except:
                pass

        # Count various elements
        import re

        # Headings
        heading_pattern = r"^#{1,6}\s+(.+)$"
        headings = re.findall(heading_pattern, content, re.MULTILINE)
        metadata["heading_count"] = len(headings)
        metadata["headings"] = headings[:10]  # Limit to first 10

        # Links
        link_pattern = r"\[([^\]]+)\]\(([^)]+)\)"
        links = re.findall(link_pattern, content)
        metadata["link_count"] = len(links)

        # Images
        image_pattern = r"!\[([^\]]*)\]\(([^)]+)\)"
        images = re.findall(image_pattern, content)
        metadata["image_count"] = len(images)

        # Code blocks
        code_block_pattern = r"```[\s\S]*?```"
        code_blocks = re.findall(code_block_pattern, content)
        metadata["code_block_count"] = len(code_blocks)

        # Extract title from first heading if not in frontmatter
        if not metadata["title"] and headings:
            metadata["title"] = headings[0]

    except Exception as e:
        error_code = ErrorCode.UTILS_METADATA_EXTRACTION_FAILED
        logger.error(f"[{error_code}] Failed to extract Markdown metadata from {file_path}: {e}", exc_info=True)
        metadata["extraction_error"] = str(e)

    return metadata


def extract_html_metadata(file_path: str) -> dict[str, Any]:
    """Extract metadata from HTML files.

    Args:
        file_path: Path to HTML file

    Returns:
        Dictionary containing HTML metadata
    """
    metadata = {
        "format": "html",
        "title": None,
        "description": None,
        "author": None,
        "keywords": None,
        "language": None,
        "charset": None,
        "viewport": None,
        "word_count": 0,
        "link_count": 0,
        "image_count": 0,
        "heading_count": 0,
        "meta_tags": {},
        "has_doctype": False,
        "html_version": None,
    }

    try:
        with open(file_path, encoding="utf-8", errors="ignore") as file:
            content = file.read()

        # Check for DOCTYPE
        metadata["has_doctype"] = "<!DOCTYPE" in content.upper()

        # Try to parse with BeautifulSoup if available
        try:
            from bs4 import BeautifulSoup

            soup = BeautifulSoup(content, "html.parser")

            # Title
            title_tag = soup.find("title")
            if title_tag:
                metadata["title"] = title_tag.get_text().strip()

            # Meta tags
            meta_tags = soup.find_all("meta")
            for meta in meta_tags:
                if meta.get("name"):
                    metadata["meta_tags"][meta.get("name")] = meta.get("content", "")

                    # Extract common meta information
                    name = meta.get("name").lower()
                    content_val = meta.get("content", "")

                    if name == "description":
                        metadata["description"] = content_val
                    elif name == "author":
                        metadata["author"] = content_val
                    elif name == "keywords":
                        metadata["keywords"] = content_val
                    elif name == "viewport":
                        metadata["viewport"] = content_val

                if meta.get("charset"):
                    metadata["charset"] = meta.get("charset")
                elif meta.get("http-equiv") == "Content-Type":
                    content_type = meta.get("content", "")
                    if "charset=" in content_type:
                        charset = (
                            content_type.split("charset=")[1].split(";")[0].strip()
                        )
                        metadata["charset"] = charset

            # Language
            html_tag = soup.find("html")
            if html_tag and html_tag.get("lang"):
                metadata["language"] = html_tag.get("lang")

            # Count elements
            metadata["link_count"] = len(soup.find_all("a"))
            metadata["image_count"] = len(soup.find_all("img"))

            # Count headings
            heading_tags = soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6"])
            metadata["heading_count"] = len(heading_tags)

            # Word count (approximate from text content)
            text_content = soup.get_text()
            words = text_content.split()
            metadata["word_count"] = len(words)

        except ImportError:
            # Fallback to regex if BeautifulSoup not available
            import re

            # Extract title
            title_match = re.search(
                r"<title[^>]*>([^<]+)</title>", content, re.IGNORECASE
            )
            if title_match:
                metadata["title"] = title_match.group(1).strip()

            # Count links and images
            metadata["link_count"] = len(
                re.findall(r"<a\s+[^>]*href=", content, re.IGNORECASE)
            )
            metadata["image_count"] = len(
                re.findall(r"<img\s+[^>]*src=", content, re.IGNORECASE)
            )

            # Count headings
            heading_pattern = r"<h[1-6][^>]*>"
            metadata["heading_count"] = len(
                re.findall(heading_pattern, content, re.IGNORECASE)
            )

    except Exception as e:
        error_code = ErrorCode.UTILS_METADATA_EXTRACTION_FAILED
        logger.error(f"[{error_code}] Failed to extract HTML metadata from {file_path}: {e}", exc_info=True)
        metadata["extraction_error"] = str(e)

    return metadata


def extract_text_metadata(file_path: str) -> dict[str, Any]:
    """Extract metadata from plain text files.

    Args:
        file_path: Path to text file

    Returns:
        Dictionary containing text metadata
    """
    metadata = {
        "format": "text",
        "encoding": None,
        "word_count": 0,
        "line_count": 0,
        "character_count": 0,
        "paragraph_count": 0,
        "average_line_length": 0.0,
        "longest_line_length": 0,
        "has_unicode": False,
        "language_detected": None,
    }

    try:
        # Detect encoding
        import chardet

        with open(file_path, "rb") as file:
            raw_data = file.read()
            encoding_result = chardet.detect(raw_data)
            metadata["encoding"] = encoding_result.get("encoding", "utf-8")

        # Read with detected encoding
        try:
            with open(
                file_path, encoding=metadata["encoding"], errors="ignore"
            ) as file:
                content = file.read()
        except:
            with open(file_path, encoding="utf-8", errors="ignore") as file:
                content = file.read()
                metadata["encoding"] = "utf-8"

        # Basic counts
        metadata["character_count"] = len(content)

        lines = content.split("\n")
        metadata["line_count"] = len(lines)

        words = content.split()
        metadata["word_count"] = len(words)

        # Paragraph count (empty lines separate paragraphs)
        paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]
        metadata["paragraph_count"] = len(paragraphs)

        # Line statistics
        line_lengths = [len(line) for line in lines]
        if line_lengths:
            metadata["average_line_length"] = round(
                sum(line_lengths) / len(line_lengths), 2
            )
            metadata["longest_line_length"] = max(line_lengths)

        # Unicode detection
        metadata["has_unicode"] = any(ord(char) > 127 for char in content)

        # Language detection (if library available)
        try:
            from langdetect import detect

            metadata["language_detected"] = detect(
                content[:1000]
            )  # Use first 1000 chars
        except:
            pass

    except Exception as e:
        error_code = ErrorCode.UTILS_METADATA_EXTRACTION_FAILED
        logger.error(f"[{error_code}] Failed to extract text metadata from {file_path}: {e}", exc_info=True)
        metadata["extraction_error"] = str(e)

    return metadata


def extract_document_metadata(file_path: str) -> dict[str, Any]:
    """Extract comprehensive metadata from a document file.

    Args:
        file_path: Path to the document

    Returns:
        Dictionary containing all available metadata
    """
    # Start with file metadata
    metadata = extract_file_metadata(file_path)
    metadata["extraction_timestamp"] = datetime.now().isoformat()

    # Add format-specific metadata
    format_detected = metadata.get("format_detected") or metadata.get("file_extension")

    if format_detected == "pdf":
        pdf_metadata = extract_pdf_metadata(file_path)
        metadata.update(pdf_metadata)
    elif format_detected in ["md", "markdown"]:
        md_metadata = extract_markdown_metadata(file_path)
        metadata.update(md_metadata)
    elif format_detected in ["html", "htm"]:
        html_metadata = extract_html_metadata(file_path)
        metadata.update(html_metadata)
    elif format_detected == "txt":
        text_metadata = extract_text_metadata(file_path)
        metadata.update(text_metadata)

    return metadata


def add_conversion_metadata(
    metadata: dict[str, Any],
    source_file: str,
    target_file: str,
    conversion_type: str,
    success: bool,
    duration: float | None = None,
    error_message: str | None = None,
    plugin_info: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Add conversion-specific metadata to existing metadata.

    Args:
        metadata: Existing metadata dictionary
        source_file: Source file path
        target_file: Target file path
        conversion_type: Type of conversion performed
        success: Whether conversion was successful
        duration: Conversion duration in seconds
        error_message: Error message if conversion failed
        plugin_info: Information about the plugin used

    Returns:
        Updated metadata dictionary
    """
    conversion_metadata = {
        "conversion": {
            "source_file": source_file,
            "target_file": target_file,
            "conversion_type": conversion_type,
            "success": success,
            "timestamp": datetime.now().isoformat(),
            "duration_seconds": duration,
            "error_message": error_message,
            "plugin_info": plugin_info,
        }
    }

    # Merge with existing metadata
    updated_metadata = metadata.copy()
    updated_metadata.update(conversion_metadata)

    return updated_metadata


def preserve_metadata(
    source_path: str,
    target_path: str,
    additional_metadata: dict[str, Any] | None = None,
) -> bool:
    """Preserve metadata from source file to target file.

    Args:
        source_path: Source file path
        target_path: Target file path
        additional_metadata: Additional metadata to include

    Returns:
        True if metadata was preserved successfully
    """
    try:
        # Extract source metadata
        source_metadata = extract_document_metadata(source_path)

        # Add additional metadata if provided
        if additional_metadata:
            source_metadata.update(additional_metadata)

        # Create metadata file alongside target
        target_path_obj = Path(target_path)
        metadata_file = target_path_obj.with_suffix(
            target_path_obj.suffix + ".metadata.json"
        )

        import json

        with open(metadata_file, "w", encoding="utf-8") as f:
            json.dump(source_metadata, f, indent=2, ensure_ascii=False)

        return True

    except Exception:
        return False


def load_preserved_metadata(file_path: str) -> dict[str, Any] | None:
    """Load preserved metadata for a file.

    Args:
        file_path: Path to the file

    Returns:
        Metadata dictionary if found, None otherwise
    """
    try:
        file_path_obj = Path(file_path)
        metadata_file = file_path_obj.with_suffix(
            file_path_obj.suffix + ".metadata.json"
        )

        if metadata_file.exists():
            import json

            with open(metadata_file, encoding="utf-8") as f:
                return json.load(f)

    except Exception:
        pass

    return None
