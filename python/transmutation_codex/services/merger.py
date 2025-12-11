# pdf_merger.py
"""Handles the merging of multiple PDF files into a single PDF document."""

from pathlib import Path

import PyPDF2
from PyPDF2.errors import PdfReadError

from transmutation_codex.core import ErrorCode, get_log_manager

logger = get_log_manager().get_converter_logger("pdf_merger")


def merge_multiple_pdfs_to_single_pdf(
    input_paths: list[str | Path], output_path: str | Path
) -> Path:
    """Merges multiple PDF files into a single PDF document.

    This function takes a list of paths to PDF files and an output path
    for the merged PDF. It uses the PyPDF2 library to perform the merge.

    Args:
        input_paths (List[Union[str, Path]]): A list of file paths for the PDF
            documents to be merged. Each path can be a string or a Path object.
            Requires at least two PDF files.
        output_path (Union[str, Path]): The file path where the merged PDF
            document will be saved. Can be a string or a Path object.

    Returns:
        Path: The absolute path to the successfully created merged PDF file.

    Raises:
        ValueError: If fewer than two input paths are provided, if any input
            file is not a PDF, or if the output path is invalid.
        FileNotFoundError: If any of the input PDF files do not exist.
        PyPDF2.errors.PdfReadError: If an input PDF file is corrupted or
            cannot be read by PyPDF2.
        Exception: For other unexpected errors during the merging process.

    Example:
        >>> from pathlib import Path
        >>> # Assume pdf1.pdf, pdf2.pdf exist
        >>> # merged_output.pdf will be created in the current directory
        >>> try:
        ...     # Create dummy PDF files for example
        ...     from PyPDF2 import PdfWriter
        ...
        ...     writer1 = PdfWriter()
        ...     writer1.add_blank_page(width=210, height=297)  # A4 size
        ...     with open("pdf1.pdf", "wb") as f1:
        ...         writer1.write(f1)
        ...     writer2 = PdfWriter()
        ...     writer2.add_blank_page(width=210, height=297)
        ...     with open("pdf2.pdf", "wb") as f2:
        ...         writer2.write(f2)
        ...
        ...     merged_file = merge_multiple_pdfs_to_single_pdf(
        ...         input_paths=["pdf1.pdf", "pdf2.pdf"],
        ...         output_path="merged_output.pdf",
        ...     )
        ...     print(f"Merged PDF created at: {merged_file}")
        ... finally:
        ...     # Clean up dummy files
        ...     Path("pdf1.pdf").unlink(missing_ok=True)
        ...     Path("pdf2.pdf").unlink(missing_ok=True)
        ...     Path("merged_output.pdf").unlink(missing_ok=True)
        Merged PDF created at: ...merged_output.pdf
    """
    logger.info(f"Starting PDF merge operation for {len(input_paths)} files")

    # Validate that at least two input paths are provided.
    # Merging requires a minimum of two documents.
    if not input_paths or len(input_paths) < 2:
        error_code = ErrorCode.SERVICE_MERGE_INVALID_INPUT
        error_msg = "At least two PDF files are required for merging."
        logger.error(f"[{error_code}] {error_msg}")
        raise ValueError(error_msg)

    # Convert all input paths to Path objects and validate them.
    # This ensures consistent path handling and allows for easy checks.
    logger.debug(f"Validating {len(input_paths)} input PDF files")
    validated_input_paths: list[Path] = []
    for i, p in enumerate(input_paths, 1):
        current_path = Path(p)
        logger.debug(f"Validating input file {i}/{len(input_paths)}: {current_path.name}")
        # Check if the file exists.
        if not current_path.exists():
            error_code = ErrorCode.VALIDATION_FILE_NOT_FOUND
            error_msg = f"Input PDF file not found: {current_path}"
            logger.error(f"[{error_code}] {error_msg}")
            raise FileNotFoundError(error_msg)
        # Check if the file has a .pdf extension.
        if current_path.suffix.lower() != ".pdf":
            error_code = ErrorCode.VALIDATION_INVALID_FORMAT
            error_msg = f"Input file is not a PDF: {current_path}. Only PDF files can be merged."
            logger.error(f"[{error_code}] {error_msg}")
            raise ValueError(error_msg)
        validated_input_paths.append(current_path.resolve())
        logger.debug(f"Successfully validated input file {i}: {current_path.name}")

    # Convert output path to a Path object and resolve it to an absolute path.
    # This ensures the output path is well-defined.
    output_path_obj = Path(output_path).resolve()

    # Ensure the output directory exists; if not, create it.
    # This prevents errors if the output path points to a non-existent directory.
    output_path_obj.parent.mkdir(parents=True, exist_ok=True)

    # Check if the output path is a directory; if so, raise an error as a specific filename is needed.
    if output_path_obj.is_dir():
        error_code = ErrorCode.BRIDGE_OUTPUT_DIRECTORY_INVALID
        error_msg = f"Output path cannot be a directory. Please specify a full file path for the merged PDF: {output_path_obj}"
        logger.error(f"[{error_code}] {error_msg}")
        raise ValueError(error_msg)

    # Ensure the output path has a .pdf extension.
    if output_path_obj.suffix.lower() != ".pdf":
        error_code = ErrorCode.VALIDATION_INVALID_FORMAT
        error_msg = f"Output file path must end with .pdf: {output_path_obj}"
        logger.error(f"[{error_code}] {error_msg}")
        raise ValueError(error_msg)

    logger.debug(f"Output path validated: {output_path_obj}")

    logger.info(
        f"Starting PDF merge operation for {len(validated_input_paths)} files. Output to: {output_path_obj}"
    )

    # Initialize the PdfMerger object from PyPDF2.
    # This object will accumulate the pages from all input PDFs.
    pdf_merger = PyPDF2.PdfMerger()

    try:
        # Iterate through each validated input PDF path.
        for i, pdf_path in enumerate(validated_input_paths, 1):
            logger.debug(f"Appending PDF {i}/{len(validated_input_paths)}: {pdf_path.name}")
            try:
                # The append method adds all pages from the given PDF to the merger.
                # It can raise PdfReadError if the PDF is corrupted.
                pdf_merger.append(str(pdf_path))
                logger.debug(f"Successfully appended {pdf_path.name} to the merge list.")
            except PdfReadError as e:
                error_code = ErrorCode.SERVICE_MERGE_PDF_CORRUPTED
                error_msg = f"Error reading PDF file {pdf_path.name}: {e}. The file might be corrupted or password-protected."
                logger.error(f"[{error_code}] {error_msg}", exc_info=True)
                pdf_merger.close()
                raise PdfReadError(error_msg) from e
            except Exception as e:
                error_code = ErrorCode.SERVICE_MERGE_PDF_READ_FAILED
                error_msg = f"Error reading PDF file {pdf_path.name}: {e}"
                logger.error(f"[{error_code}] {error_msg}", exc_info=True)
                pdf_merger.close()
                raise

        logger.debug(f"All PDFs appended, writing merged PDF to: {output_path_obj}")
        # Write the merged PDF to the specified output file.
        # The 'wb' mode is for writing in binary, which is required for PDF files.
        try:
            with open(output_path_obj, "wb") as f_out:
                pdf_merger.write(f_out)
            logger.debug(f"Successfully wrote merged PDF to: {output_path_obj}")
        except Exception as e:
            error_code = ErrorCode.SERVICE_MERGE_PDF_WRITE_FAILED
            error_msg = f"Error writing merged PDF to {output_path_obj}: {e}"
            logger.error(f"[{error_code}] {error_msg}", exc_info=True)
            pdf_merger.close()
            raise

        logger.info(
            f"Successfully merged {len(validated_input_paths)} PDFs into {output_path_obj}"
        )

    except PdfReadError:
        # Re-raise PdfReadError (already handled above)
        raise
    except Exception as e:
        # Catch any other unexpected exceptions during the process.
        error_code = ErrorCode.SERVICE_MERGE_PDF_WRITE_FAILED
        error_msg = f"An unexpected error occurred during PDF merging: {e}"
        logger.error(f"[{error_code}] {error_msg}", exc_info=True)
        # Close the merger.
        pdf_merger.close()
        raise
    finally:
        # Always close the PdfMerger object to free up resources.
        # This is good practice, especially if files were opened by the merger.
        pdf_merger.close()

    # Return the absolute path to the created merged PDF file.
    return output_path_obj


# Example of how this function might be called (for testing or direct use):
if __name__ == "__main__":
    # This block is for demonstration and basic testing when the script is run directly.
    # It's not typically executed when imported as a module.
    print("Demonstrating PDF merging (requires PyPDF2 and dummy PDF files).")

    # Create dummy logger for demonstration if LogManager isn't fully set up for direct script run
    if not logger.handlers:
        logging.basicConfig(level=logging.DEBUG)
        logger = logging.getLogger("pdf_merger_main")

    # Create some dummy PDF files for the example to work.
    # In a real scenario, these files would already exist.
    dummy_pdf_content_paths = []
    try:
        # Create a temporary directory for dummy files
        temp_dir = Path("temp_pdf_merge_test")
        temp_dir.mkdir(exist_ok=True)

        for i in range(1, 4):  # Create 3 dummy PDFs
            writer = PyPDF2.PdfWriter()
            writer.add_blank_page(width=210, height=297)  # Standard A4 page
            writer.add_outline_item(f"Dummy Page from PDF {i}", writer.pages[0])
            file_path = temp_dir / f"dummy_input_{i}.pdf"
            with open(file_path, "wb") as f:
                writer.write(f)
            writer.close()  # Close the writer
            dummy_pdf_content_paths.append(file_path)
            logger.info(f"Created dummy PDF: {file_path}")

        if len(dummy_pdf_content_paths) >= 2:
            output_file = temp_dir / "merged_demonstration_output.pdf"
            logger.info(
                f"Attempting to merge: {dummy_pdf_content_paths} into {output_file}"
            )

            merged_path = merge_multiple_pdfs_to_single_pdf(
                dummy_pdf_content_paths, output_file
            )
            logger.info(f"Demonstration merge successful! Output: {merged_path}")
            print(f"Merged PDF created at: {merged_path.resolve()}")
            # You can manually check the 'merged_demonstration_output.pdf' file.
        else:
            logger.warning("Not enough dummy PDFs created to demonstrate merge.")

    except ImportError:
        logger.error(
            "PyPDF2 is not installed. Cannot run demonstration. pip install PyPDF2"
        )
        print("PyPDF2 is not installed. Run 'pip install PyPDF2' to run this example.")
    except FileNotFoundError as fnf_e:
        logger.error(f"File not found during demonstration: {fnf_e}")
        print(f"File not found: {fnf_e}")
    except Exception as e:
        logger.exception("Error during PDF merger demonstration:")
        print(f"An error occurred during the demonstration: {e}")
    finally:
        # Clean up dummy files and directory
        import shutil

        if Path("temp_pdf_merge_test").exists():
            logger.info("Cleaning up temporary test directory and files...")
            shutil.rmtree("temp_pdf_merge_test")
            logger.info("Cleanup complete.")
