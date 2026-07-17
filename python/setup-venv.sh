#!/bin/bash
# SafeAppeals Python Environment Setup Script (macOS/Linux)
# This script creates a virtual environment and installs dependencies

set -e

echo "=== SafeAppeals Python Environment Setup ==="
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check for Python
echo "Checking for Python..."
PYTHON_CMD=""

# Try python3 first
if command -v python3 &> /dev/null; then
    VERSION=$(python3 --version 2>&1)
    PYTHON_CMD="python3"
    echo "  Found: $VERSION (using 'python3')"
elif command -v python &> /dev/null; then
    VERSION=$(python --version 2>&1)
    PYTHON_CMD="python"
    echo "  Found: $VERSION (using 'python')"
else
    echo "ERROR: Python not found!"
    echo "Please install Python 3.10+ using your package manager:"
    echo "  macOS: brew install python"
    echo "  Ubuntu: sudo apt install python3 python3-venv"
    exit 1
fi

# Create virtual environment
VENV_PATH="$SCRIPT_DIR/.venv"
if [ -d "$VENV_PATH" ]; then
    echo ""
    echo "Virtual environment already exists at: $VENV_PATH"
    read -p "Do you want to recreate it? (y/N) " response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo "Removing existing venv..."
        rm -rf "$VENV_PATH"
    else
        echo "Keeping existing venv. Running pip install to update dependencies..."
    fi
fi

if [ ! -d "$VENV_PATH" ]; then
    echo ""
    echo "Creating virtual environment..."
    $PYTHON_CMD -m venv .venv
    echo "  Created: $VENV_PATH"
fi

# Activate venv and install dependencies
echo ""
echo "Installing dependencies..."

PIP_PATH="$VENV_PATH/bin/pip"
PYTHON_PATH="$VENV_PATH/bin/python"

# Upgrade pip first
echo "  Upgrading pip..."
"$PYTHON_PATH" -m pip install --upgrade pip --quiet

# Install the package with dependencies
echo "  Installing transmutation-codex and dependencies..."
"$PIP_PATH" install -e . --quiet

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Python venv created at: $VENV_PATH"
echo "Python executable: $PYTHON_PATH"
echo ""
echo "The file converter will automatically use this bundled Python."
echo ""

# Show installed packages
echo "Installed packages:"
"$PIP_PATH" list

