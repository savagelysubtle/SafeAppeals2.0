@echo off
setlocal EnableDelayedExpansion

title VSCode Dev

pushd %~dp0\..

:: Get electron, compile, built-in extensions
if "%VSCODE_SKIP_PRELAUNCH%"=="" node build/lib/preLaunch.js

set CODE=".build\electron\Safe Appeals Navigator.exe"

:: Manage built-in extensions
if "%~1"=="--builtin" goto builtin

:: Configuration
set NODE_ENV=development
set VSCODE_DEV=1
set VSCODE_CLI=1
set ELECTRON_ENABLE_LOGGING=1
set ELECTRON_ENABLE_STACK_DUMPING=1

:: Enable garbage collection for better memory management with large PDFs
set ELECTRON_RUN_AS_NODE=
set NODE_OPTIONS=--expose-gc --max-old-space-size=4096

:: Load environment variables from .env file if it exists
if exist ".env" (
    echo Loading environment from .env file...
    for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do (
        if not "%%a"=="" (
            set "%%a=%%b"
            echo   Loaded: %%a
        )
    )
    echo.
    echo DocuSign env vars:
    echo   DOCUSIGN_INTEGRATION_KEY=!DOCUSIGN_INTEGRATION_KEY!
    echo   DOCUSIGN_ENVIRONMENT=!DOCUSIGN_ENVIRONMENT!
    echo.
)

set DISABLE_TEST_EXTENSION="--disable-extension=vscode.vscode-api-tests"
for %%A in (%*) do (
	if "%%~A"=="--extensionTestsPath" (
		set DISABLE_TEST_EXTENSION=""
	)
)

:: Launch Code

%CODE% . %DISABLE_TEST_EXTENSION% %*
goto end

:builtin
%CODE% build/builtin

:end

popd

endlocal
