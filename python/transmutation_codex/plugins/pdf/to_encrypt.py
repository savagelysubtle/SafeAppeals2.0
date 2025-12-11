"""PDF encrypt converter.

This module provides functionality to encrypt PDF files with password protection.
Supports user and owner passwords with various encryption levels.
"""

from pathlib import Path
from typing import Any

try:
    import pikepdf

    PIKEPDF_AVAILABLE = True
except ImportError:
    PIKEPDF_AVAILABLE = False

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
logger = get_log_manager().get_converter_logger("pdf2encrypt")


@converter(
    source_format="pdf",
    target_format="encrypt",
    description="Encrypt PDF with password protection",
    required_dependencies=["pikepdf"],
    priority=10,
    version="1.0.0",
)
def convert_pdf_to_encrypt(
    input_path: str | Path,
    output_path: str | Path | None = None,
    **kwargs: Any,
) -> Path:
    """Encrypt PDF file with password protection.

    This function encrypts a PDF file with password protection, supporting
    both user and owner passwords with various permission levels.

    Args:
        input_path: Path to input PDF file
        output_path: Path for output PDF file (auto-generated if None)
        **kwargs: Additional options:
            - `user_password` (str): User password for opening the PDF.
                                   Defaults to None (no user password).
            - `owner_password` (str): Owner password for full access.
                                     Defaults to None (no owner password).
            - `encryption_level` (str): Encryption level ("rc4", "aes128", "aes256").
                                       Defaults to "aes256".
            - `permissions` (dict): Permission settings:
                - `print` (bool): Allow printing. Defaults to True.
                - `modify` (bool): Allow modification. Defaults to True.
                - `copy` (bool): Allow copying text. Defaults to True.
                - `annotate` (bool): Allow annotations. Defaults to True.
                - `form_fill` (bool): Allow form filling. Defaults to True.
                - `extract` (bool): Allow text extraction. Defaults to True.
                - `assemble` (bool): Allow document assembly. Defaults to True.
                - `print_high` (bool): Allow high-quality printing. Defaults to True.

    Returns:
        Path: The path to the encrypted PDF file.

    Raises:
        ValidationError: If input or output paths are invalid, or dependencies are missing.
        ConversionError: If the encryption process fails.
    """
    logger.info(f"Attempting to encrypt PDF: {input_path}")

    # Validate dependencies
    if not PIKEPDF_AVAILABLE:
        raise_conversion_error("pikepdf is required for PDF encryption")

    # Start operation
    operation_id = start_operation(
        f"Encrypting PDF: {Path(input_path).name}", total_steps=100
    )

    try:
        # Check licensing and file size
        check_feature_access("pdf2encrypt")
        check_file_size_limit(input_path)
        record_conversion_attempt("pdf2encrypt", str(input_path))

        # Convert paths
        input_path = Path(input_path)
        if output_path is None:
            output_path = input_path.parent / f"{input_path.stem}_encrypted.pdf"
        else:
            output_path = Path(output_path)

        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)

        logger.info(f"Encrypting PDF: {input_path} -> {output_path}")

        # Parse options
        user_password = kwargs.get("user_password", None)
        owner_password = kwargs.get("owner_password", None)
        encryption_level = kwargs.get("encryption_level", "aes256")

        # Parse permissions
        permissions = kwargs.get("permissions", {})
        print_perm = permissions.get("print", True)
        modify_perm = permissions.get("modify", True)
        copy_perm = permissions.get("copy", True)
        annotate_perm = permissions.get("annotate", True)
        form_fill_perm = permissions.get("form_fill", True)
        extract_perm = permissions.get("extract", True)
        assemble_perm = permissions.get("assemble", True)
        print_high_perm = permissions.get("print_high", True)

        # Validate encryption level
        if encryption_level not in ["rc4", "aes128", "aes256"]:
            raise_conversion_error(f"Invalid encryption level: {encryption_level}")

        # Configure permissions
        permissions = pikepdf.Permissions(
            accessibility=True,
            extract=extract_perm,
            modify_annotation=annotate_perm,
            modify_assembly=assemble_perm,
            modify_form=form_fill_perm,
            modify_other=modify_perm,
            print_lowres=print_perm,
            print_highres=print_high_perm,
        )

        # Configure encryption
        if not user_password and not owner_password:
            logger.info(
                "No passwords provided - applying default permissions without encryption"
            )
            # No encryption, just save with default permissions
            encryption_params = {}
            logger.info("Default permissions configured (no encryption)")
        else:
            logger.info(f"Configuring encryption with level: {encryption_level}")
            if user_password:
                logger.info("User password provided")
            if owner_password:
                logger.info("Owner password provided")

            # Set encryption level (R parameter)
            if encryption_level == "rc4":
                R = 2  # RC4 40-bit
            elif encryption_level == "aes128":
                R = 4  # AES 128-bit
            elif encryption_level == "aes256":
                R = 6  # AES 256-bit
            else:
                R = 6  # Default to AES 256-bit

            # Create encryption object
            encryption_obj = pikepdf.Encryption(
                owner=owner_password or "",
                user=user_password or "",
                R=R,
                allow=permissions,
                aes=(encryption_level != "rc4"),
                metadata=True,
            )

            encryption_params = {"encryption": encryption_obj}
            logger.info(f"Encryption parameters configured: {encryption_level}")

        update_progress(operation_id, 10, "Loading PDF file...")

        # Load PDF file
        try:
            pdf = pikepdf.Pdf.open(input_path)
        except Exception as e:
            raise_conversion_error(f"Failed to load PDF file: {e}")

        total_pages = len(pdf.pages)
        logger.info(f"PDF has {total_pages} pages")

        update_progress(operation_id, 20, "Configuring encryption...")

        update_progress(operation_id, 30, "Applying encryption...")

        # Apply encryption
        try:
            pdf.save(output_path, **encryption_params)
            logger.info("Encryption applied successfully")

        except Exception as e:
            raise_conversion_error(f"Failed to save encrypted PDF: {e}")

        update_progress(operation_id, 90, "Verifying encryption...")

        # Verify encryption by trying to open without password
        if user_password or owner_password:
            try:
                test_pdf = pikepdf.Pdf.open(output_path)
                # If we can open without password, encryption failed
                logger.error("PDF opened without password - encryption failed")
                raise_conversion_error("Encryption verification failed")
            except pikepdf.PasswordError:
                # This is expected - PDF should require password
                logger.info("Encryption verified - PDF requires password")
            except Exception as e:
                logger.warning(f"Encryption verification inconclusive: {e}")
        else:
            # No encryption applied, just verify file was created
            logger.info("No encryption applied - file permissions set")

        update_progress(operation_id, 95, "Finalizing...")

        # Publish success event
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_COMPLETED,
                input_file=str(input_path),
                output_file=str(output_path),
                conversion_type="pdf2encrypt",
            )
        )

        complete_operation(
            operation_id,
            {
                "output_path": str(output_path),
                "encryption_level": encryption_level,
                "has_user_password": bool(user_password),
                "has_owner_password": bool(owner_password),
            },
        )
        logger.info(f"PDF encryption completed: {output_path}")

        return output_path

    except Exception as e:
        logger.exception(f"PDF encryption failed: {e}")
        publish(
            ConversionEvent(
                event_type=EventTypes.CONVERSION_FAILED,
                input_file=str(input_path),
                conversion_type="pdf2encrypt",
            )
        )
        raise_conversion_error(f"PDF encryption failed: {e}")
