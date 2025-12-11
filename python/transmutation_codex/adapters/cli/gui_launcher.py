"""GUI launcher for the Electron application."""

import subprocess
import sys
from pathlib import Path

from transmutation_codex.core import get_log_manager


def launch_gui() -> None:
    """Launch the Electron GUI application."""
    logger = get_log_manager().get_converter_logger("gui_launcher")

    # Find the project root
    project_root = Path(__file__).parent.parent.parent.parent.parent
    gui_dir = project_root / "gui"

    if not gui_dir.exists():
        logger.error(f"GUI directory not found: {gui_dir}")
        print(f"❌ GUI directory not found: {gui_dir}")
        sys.exit(1)

    # Check if package.json exists
    package_json = gui_dir / "package.json"
    if not package_json.exists():
        logger.error(f"package.json not found in GUI directory: {guii_dir}")
        print(f"❌ package.json not found in GUI directory: {gui_dir}")
        sys.exit(1)

    try:
        logger.info(f"Launching GUI from: {gui_dir}")
        print(f"🚀 Launching GUI from: {gui_dir}")

        # Change to GUI directory and run npm start
        subprocess.run(["npm", "run", "electron:dev"], cwd=gui_dir, check=True)

    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to launch GUI: {e}")
        print(f"❌ Failed to launch GUI: {e}")
        print("\n💡 Try running these commands manually:")
        print(f"   cd {gui_dir}")
        print("   npm install")
        print("   npm run electron:dev")
        sys.exit(1)
    except FileNotFoundError:
        logger.error("npm not found in PATH")
        print("❌ npm not found in PATH")
        print("Please install Node.js and npm first.")
        sys.exit(1)
