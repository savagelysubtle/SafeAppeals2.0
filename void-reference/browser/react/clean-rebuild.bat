@echo off
echo Cleaning old build artifacts...

REM Remove src2 directory (old scoped source)
if exist src2 (
    echo Removing src2 directory...
    rmdir /s /q src2
)

REM Remove out directory (old build artifacts)
if exist out (
    echo Removing out directory...
    rmdir /s /q out
)

echo Clean complete!
echo.
echo Building from src...
node build.js

echo.
echo Build complete! Please reload VSCode window.
pause
