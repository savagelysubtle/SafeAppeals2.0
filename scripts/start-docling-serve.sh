#!/bin/bash
# Start Docling Serve for SafeAppeals Navigator
# This script starts the Docling API server on localhost:5001

echo "Starting Docling Serve..."
echo ""

# Activate virtual environment
source .venv/bin/activate

# Check if docling-serve is installed
python -c "import docling_serve" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "[ERROR] docling-serve not found!"
    echo "Please install it: uv pip install docling-serve"
    exit 1
fi

# Start docling-serve with 'run' command
echo "Docling Serve starting on http://localhost:5001"
echo "Press Ctrl+C to stop"
echo ""
python -m docling_serve run

