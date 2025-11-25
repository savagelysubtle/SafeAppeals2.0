"""
Verify Docling setup and trigger model download.
This script uses DocumentConverter to pre-download models to HuggingFace cache.
Models will be automatically used by docling-serve at runtime.
"""

import os
import sys

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


def main():
    print("=" * 60)
    print("Docling Model Setup for SafeAppeals Navigator")
    print("=" * 60)
    print()

    # Check for HuggingFace token
    hf_token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")

    if not hf_token:
        print("❌ ERROR: No HuggingFace token found!")
        print()
        print("Please set HF_TOKEN in .env file:")
        print("  HF_TOKEN=hf_your_token_here")
        print()
        print("Get a token at: https://huggingface.co/settings/tokens")
        print("Accept model terms: https://huggingface.co/ds4sd/docling-layout-heron")
        sys.exit(1)

    print("✓ HuggingFace token found")
    print()

    try:
        # Import Docling
        print("📦 Importing Docling...")
        from docling.document_converter import DocumentConverter

        print("✓ Docling imported successfully")
        print()

        # Initialize converter - this triggers model download to HuggingFace cache
        print("⏳ Initializing DocumentConverter (downloads models automatically)...")
        print("   This may take 5-10 minutes on first run:")
        print("   - Layout detection models (~100MB)")
        print("   - Table structure models (~90MB)")
        print("   - OCR models (~70MB)")
        print()
        print("   Models will be cached in your HuggingFace directory")
        print("   (~/.cache/huggingface or %USERPROFILE%\\.cache\\huggingface)")
        print()

        converter = DocumentConverter()

        print()
        print("=" * 60)
        print("✅ SUCCESS! Docling is ready to use")
        print("=" * 60)
        print()

        # Find cache location
        cache_home = os.environ.get("HF_HOME") or os.path.join(
            os.path.expanduser("~"), ".cache", "huggingface"
        )

        print("Models are cached at:", cache_home)
        print()
        print("Next steps:")
        print("  1. ✓ Models are now cached by HuggingFace")
        print("  2. ✓ docling-serve will use these models automatically")
        print("  3. ✓ SafeAppeals will start docling-serve on launch")
        print("  4. ✓ No HF_TOKEN needed at runtime (models are cached)")
        print()
        print("You can now launch SafeAppeals and use Docling PDF extraction!")
        print()

    except ImportError as e:
        print("❌ ERROR: Could not import docling")
        print()
        print("Please install Python dependencies:")
        print("  uv pip install -r pyproject.toml")
        print()
        print(f"Details: {e}")
        sys.exit(1)
    except Exception as e:
        print()
        print("❌ ERROR: Model download failed")
        print()
        print(f"Details: {e}")
        print()
        print("Common issues:")
        print("  - Invalid HF_TOKEN")
        print(
            "  - Haven't accepted model terms at https://huggingface.co/ds4sd/docling-layout-heron"
        )
        print("  - Network connectivity issues")
        print()
        print("Try:")
        print("  1. Check .env has correct HF_TOKEN=hf_...")
        print("  2. Accept terms at https://huggingface.co/ds4sd/docling-layout-heron")
        print("  3. Run script again")
        sys.exit(1)


if __name__ == "__main__":
    main()
