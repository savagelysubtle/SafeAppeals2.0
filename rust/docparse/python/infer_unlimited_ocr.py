#!/usr/bin/env python3
# Copyright (c) Safe Appeals. All rights reserved.
"""Best-effort Unlimited-OCR inference helper for sa-docparse sidecar.

Reads configuration from environment:
  SA_DOCPARSE_MODEL_DIR  — consent-installed model pack (required)
  SA_DOCPARSE_PDF_PATH   — input PDF path (required)
  SA_DOCPARSE_PAGE_FROM  — 1-based start page (default 1)
  SA_DOCPARSE_PAGE_TO    — 1-based end page (optional)
  SA_DOCPARSE_SOURCE_URI — logical source URI for anchors (optional)

Prints JSON to stdout: {"markdown": str, "pageCount": int}
Exits non-zero with a clear stderr message when torch/transformers are unavailable.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    return max(1, int(raw))


def _fail(message: str, code: int = 1) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(code)


def main() -> None:
    model_dir = os.environ.get("SA_DOCPARSE_MODEL_DIR", "").strip()
    pdf_path = os.environ.get("SA_DOCPARSE_PDF_PATH", "").strip()
    if not model_dir:
        _fail("SA_DOCPARSE_MODEL_DIR is not set")
    if not pdf_path or not Path(pdf_path).is_file():
        _fail(f"SA_DOCPARSE_PDF_PATH is missing or not a file: {pdf_path!r}")

    page_from = _env_int("SA_DOCPARSE_PAGE_FROM", 1)
    page_to_raw = os.environ.get("SA_DOCPARSE_PAGE_TO", "").strip()
    page_to = int(page_to_raw) if page_to_raw else None

    try:
        import torch  # noqa: F401
        from transformers import AutoModel, AutoProcessor
    except ImportError as exc:
        _fail(
            "Unlimited-OCR requires torch and transformers; install a CUDA/CPU stack "
            f"for the consent-installed model pack ({exc})"
        )

    config_path = Path(model_dir) / "config.json"
    if not config_path.is_file():
        _fail(f"model config.json not found in {model_dir}")

    try:
        processor = AutoProcessor.from_pretrained(
            model_dir, trust_remote_code=True, local_files_only=True
        )
        model = AutoModel.from_pretrained(
            model_dir,
            trust_remote_code=True,
            local_files_only=True,
            torch_dtype="auto",
        )
    except Exception as exc:  # best-effort bridge
        _fail(f"failed to load Unlimited-OCR model from {model_dir}: {exc}")

    # Best-effort: model-specific inference is pack-dependent. Emit a structured
    # placeholder so the sidecar protocol stays exercised when weights load but
    # full VLM decode is not wired for this pack revision.
    page_count = page_to if page_to and page_to >= page_from else page_from
    markdown = (
        f"<!-- Unlimited-OCR helper loaded model from {model_dir} -->\n"
        f"<!-- PDF: {pdf_path} pages {page_from}"
        f"{f'-{page_to}' if page_to else ''} -->\n\n"
        "_OCR inference placeholder: model loaded successfully; "
        "wire pack-specific decode for production markdown output._"
    )
    _ = (processor, model)
    print(json.dumps({"markdown": markdown, "pageCount": page_count}))


if __name__ == "__main__":
    main()
