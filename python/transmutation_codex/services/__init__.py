"""Services for batch processing and file operations.

This package contains higher-level business logic services that orchestrate
multiple operations, such as batch file processing and PDF merging.
"""

from .batcher import run_batch
from .merger import merge_multiple_pdfs_to_single_pdf

__all__ = [
    "merge_multiple_pdfs_to_single_pdf",
    "run_batch",
]
