@echo off
REM Start Docling Serve for SafeAppeals Navigator
REM This script starts the Docling API server on localhost:5001

echo Starting Docling Serve...
echo.

REM Activate virtual environment
call .venv\Scripts\activate.bat

REM Check if docling-serve is installed
python -c "import docling_serve" 2>nul
if errorlevel 1 (
    echo [ERROR] docling-serve not found!
    echo Please install it: uv pip install docling-serve
    pause
    exit /b 1
)

REM Start docling-serve with 'run' command
echo Docling Serve starting on http://localhost:5001
echo Press Ctrl+C to stop
echo.
python -m docling_serve run

