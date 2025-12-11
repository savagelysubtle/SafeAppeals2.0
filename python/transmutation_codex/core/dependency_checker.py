"""Dependency checker for external tools and libraries."""

import shutil
import subprocess
import sys
from pathlib import Path

from .logger import LogManager


class DependencyChecker:
    """Check for external dependencies required by converters."""

    def __init__(self):
        self.logger = LogManager().get_converter_logger("dependency_checker")

    def check_command(self, command: str, description: str = None) -> tuple[bool, str]:
        """Check if a system command is available.

        Args:
            command: Command name to check
            description: Human-readable description

        Returns:
            Tuple of (is_available, version_info)
        """
        if description is None:
            description = command

        if not shutil.which(command):
            return False, f"{description} not found in PATH"

        try:
            result = subprocess.run(
                [command, "--version"], capture_output=True, text=True, timeout=5
            )
            version = (
                result.stdout.split("\n")[0] if result.stdout else "Unknown version"
            )
            return True, f"{description}: {version}"
        except subprocess.TimeoutExpired:
            return True, f"{description}: Available (version check timeout)"
        except Exception as e:
            return True, f"{description}: Available (version check failed: {e})"

    def check_tesseract(self) -> tuple[bool, str]:
        """Check Tesseract OCR installation."""
        # Check common installation paths
        if sys.platform == "win32":
            tesseract_paths = [
                "C:\\Program Files\\Tesseract-OCR\\tesseract.exe",
                "C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe",
            ]
        else:
            tesseract_paths = [
                "/usr/bin/tesseract",
                "/usr/local/bin/tesseract",
                "/opt/homebrew/bin/tesseract",
            ]

        for path in tesseract_paths:
            if Path(path).exists():
                try:
                    result = subprocess.run(
                        [path, "--version"], capture_output=True, text=True, timeout=5
                    )
                    version = (
                        result.stdout.split("\n")[0]
                        if result.stdout
                        else "Unknown version"
                    )
                    return True, f"Tesseract OCR: {version} (at {path})"
                except:
                    return True, f"Tesseract OCR: Available (at {path})"

        # Check PATH
        return self.check_command("tesseract", "Tesseract OCR")

    def check_ghostscript(self) -> tuple[bool, str]:
        """Check Ghostscript installation."""
        if sys.platform == "win32":
            # Check common Windows installation paths
            gs_base_paths = [
                "C:\\Program Files\\gs",
                "C:\\Program Files (x86)\\gs",
            ]

            for base_path in gs_base_paths:
                if Path(base_path).exists():
                    version_dirs = list(Path(base_path).glob("gs*"))
                    if version_dirs:
                        latest_dir = max(version_dirs, key=lambda x: x.name)
                        gs_exe = latest_dir / "bin" / "gswin64c.exe"
                        if gs_exe.exists():
                            try:
                                result = subprocess.run(
                                    [str(gs_exe), "--version"],
                                    capture_output=True,
                                    text=True,
                                    timeout=5,
                                )
                                version = (
                                    result.stdout.split("\n")[0]
                                    if result.stdout
                                    else "Unknown version"
                                )
                                return True, f"Ghostscript: {version} (at {gs_exe})"
                            except:
                                return True, f"Ghostscript: Available (at {gs_exe})"

            # Check PATH for Windows
            return self.check_command("gswin64c", "Ghostscript")
        else:
            # Unix-like systems
            gs_paths = ["/usr/bin/gs", "/usr/local/bin/gs", "/opt/homebrew/bin/gs"]

            for path in gs_paths:
                if Path(path).exists():
                    try:
                        result = subprocess.run(
                            [path, "--version"],
                            capture_output=True,
                            text=True,
                            timeout=5,
                        )
                        version = (
                            result.stdout.split("\n")[0]
                            if result.stdout
                            else "Unknown version"
                        )
                        return True, f"Ghostscript: {version} (at {path})"
                    except:
                        return True, f"Ghostscript: Available (at {path})"

            return self.check_command("gs", "Ghostscript")

    def check_libreoffice(self) -> tuple[bool, str]:
        """Check LibreOffice installation."""
        if sys.platform == "win32":
            lo_paths = [
                "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
                "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
            ]
        elif sys.platform == "darwin":
            lo_paths = ["/Applications/LibreOffice.app/Contents/MacOS/soffice"]
        else:
            lo_paths = ["/usr/bin/libreoffice", "/usr/local/bin/libreoffice"]

        for path in lo_paths:
            if Path(path).exists():
                try:
                    result = subprocess.run(
                        [path, "--version"], capture_output=True, text=True, timeout=5
                    )
                    version = (
                        result.stdout.split("\n")[0]
                        if result.stdout
                        else "Unknown version"
                    )
                    return True, f"LibreOffice: {version} (at {path})"
                except:
                    return True, f"LibreOffice: Available (at {path})"

        # Check PATH
        return self.check_command("soffice", "LibreOffice")

    def check_python_package(
        self, package_name: str, import_name: str = None
    ) -> tuple[bool, str]:
        """Check if a Python package is installed.

        Args:
            package_name: Package name for display
            import_name: Import name (defaults to package_name)

        Returns:
            Tuple of (is_available, status_message)
        """
        if import_name is None:
            import_name = package_name

        try:
            __import__(import_name)
            return True, f"{package_name}: Available"
        except ImportError:
            return False, f"{package_name}: Not installed"

    def check_converter_dependencies(
        self, converter_type: str
    ) -> dict[str, tuple[bool, str]]:
        """Check dependencies for a specific converter type.

        Args:
            converter_type: Type of converter (e.g., 'pdf2md', 'xlsx2pdf')

        Returns:
            Dictionary of dependency checks
        """
        results = {}

        # Common dependencies
        if "ocr" in converter_type or "image" in converter_type:
            results["tesseract"] = self.check_tesseract()

        if "pdf" in converter_type and any(
            op in converter_type for op in ["split", "compress", "encrypt", "watermark"]
        ):
            results["ghostscript"] = self.check_ghostscript()

        # Converter-specific dependencies
        if converter_type.startswith("xlsx") or converter_type.startswith("csv"):
            results["openpyxl"] = self.check_python_package("openpyxl")
            results["pandas"] = self.check_python_package("pandas")

        if converter_type.startswith("pptx"):
            results["python-pptx"] = self.check_python_package("python-pptx", "pptx")

        if converter_type.startswith("epub"):
            results["ebooklib"] = self.check_python_package("ebooklib")
            results["beautifulsoup4"] = self.check_python_package(
                "beautifulsoup4", "bs4"
            )

        if converter_type.startswith("image"):
            results["Pillow"] = self.check_python_package("Pillow", "PIL")
            results["opencv-python"] = self.check_python_package("opencv-python", "cv2")

        if "pdf" in converter_type:
            results["PyPDF2"] = self.check_python_package("PyPDF2")
            results["PyMuPDF"] = self.check_python_package("PyMuPDF", "fitz")

        if converter_type.startswith("pdf") and any(
            op in converter_type for op in ["split", "compress", "encrypt"]
        ):
            results["pikepdf"] = self.check_python_package("pikepdf")

        return results

    def validate_converter(self, converter_type: str) -> bool:
        """Validate that all required dependencies are available for a converter.

        Args:
            converter_type: Type of converter to validate

        Returns:
            True if all required dependencies are available
        """
        dependencies = self.check_converter_dependencies(converter_type)

        missing_required = []
        missing_optional = []

        for dep_name, (is_available, message) in dependencies.items():
            if not is_available:
                # Determine if dependency is required or optional
                if dep_name in ["tesseract", "ghostscript"]:
                    missing_required.append(f"{dep_name}: {message}")
                else:
                    missing_optional.append(f"{dep_name}: {message}")

        if missing_required:
            self.logger.error(
                f"Converter {converter_type} missing required dependencies: {missing_required}"
            )
            return False

        if missing_optional:
            self.logger.warning(
                f"Converter {converter_type} missing optional dependencies: {missing_optional}"
            )

        return True

    def get_dependency_status(self) -> dict[str, dict[str, tuple[bool, str]]]:
        """Get status of all external dependencies.

        Returns:
            Dictionary of dependency categories and their status
        """
        return {
            "system_tools": {
                "tesseract": self.check_tesseract(),
                "ghostscript": self.check_ghostscript(),
                "libreoffice": self.check_libreoffice(),
                "pandoc": self.check_command("pandoc", "Pandoc"),
                "latex": self.check_command("pdflatex", "LaTeX"),
            },
            "python_packages": {
                "openpyxl": self.check_python_package("openpyxl"),
                "pandas": self.check_python_package("pandas"),
                "tabula-py": self.check_python_package("tabula-py", "tabula"),
                "python-pptx": self.check_python_package("python-pptx", "pptx"),
                "ebooklib": self.check_python_package("ebooklib"),
                "beautifulsoup4": self.check_python_package("beautifulsoup4", "bs4"),
                "docutils": self.check_python_package("docutils"),
                "pygments": self.check_python_package("pygments"),
                "pikepdf": self.check_python_package("pikepdf"),
                "pdf2image": self.check_python_package("pdf2image"),
                "Pillow": self.check_python_package("Pillow", "PIL"),
                "pytesseract": self.check_python_package("pytesseract"),
                "reportlab": self.check_python_package("reportlab"),
                "PyPDF2": self.check_python_package("PyPDF2"),
                "PyMuPDF": self.check_python_package("PyMuPDF", "fitz"),
                "opencv-python": self.check_python_package("opencv-python", "cv2"),
                "numpy": self.check_python_package("numpy"),
                "cryptography": self.check_python_package("cryptography"),
            },
        }


# Global instance
_dependency_checker = None


def get_dependency_checker() -> DependencyChecker:
    """Get the global dependency checker instance."""
    global _dependency_checker
    if _dependency_checker is None:
        _dependency_checker = DependencyChecker()
    return _dependency_checker
