# Contributing to SafeAppeals2.0

### Welcome! 👋

This is the official guide on how to contribute to SafeAppeals2.0. We want to make it as easy as possible to contribute, so if you have any questions or comments, reach out via email or GitHub!

There are a few ways to contribute:

- 💫 Complete items on the project roadmap and issues.
- 💡 Make suggestions by opening GitHub issues.
- 🪴 Start new Issues - see [Issues](https://github.com/savagelysubtle/SafeAppeals2.0/issues).

### Codebase Guide

We [highly recommend reading this](https://github.com/savagelysubtle/SafeAppeals2.0/blob/main/VOID_CODEBASE_GUIDE.md) guide that we put together on SafeAppeals2.0's sourcecode if you'd like to add new features.

The repo is not as intimidating as it first seems if you read the guide!

Most of SafeAppeals2.0's code lives in the folder `src/vs/workbench/contrib/void/`.

## Editing SafeAppeals2.0's Code

If you're making changes to SafeAppeals2.0's code as a contributor, you'll want to run a local version of SafeAppeals2.0 to make sure your changes worked. Developer mode lets you do this. Here's how to use it.

### a. Mac - Prerequisites

If you're using a Mac, you need Python and XCode. You probably have these by default.

### b. Windows - Prerequisites

If you're using a Windows computer, first get [Visual Studio 2022](https://visualstudio.microsoft.com/thank-you-downloading-visual-studio/?sku=Community) (recommended) or [VS Build Tools](https://visualstudio.microsoft.com/thank-you-downloading-visual-studio/?sku=BuildTools) (not recommended). If you already have both, you might need to run the next few steps on both of them.

Go to the "Workloads" tab and select:

- `Desktop development with C++`
- `Node.js build tools`

Go to the "Individual Components" tab and select:

- `MSVC v143 - VS 2022 C++ x64/x86 Spectre-mitigated libs (Latest)`
- `C++ ATL for latest build tools with Spectre Mitigations`
- `C++ MFC for latest build tools with Spectre Mitigations`
- `Windows 10 SDK` (10.0.22621 or newer) and/or `Windows 11 SDK`

Finally, click Install.

### c. Linux - Prerequisites

First, run `npm install -g node-gyp`. Then:

- Debian (Ubuntu, etc): `sudo apt-get install build-essential g++ libx11-dev libxkbfile-dev libsecret-1-dev libkrb5-dev python-is-python3`.
- Red Hat (Fedora, etc): `sudo dnf install @development-tools gcc gcc-c++ make libsecret-devel krb5-devel libX11-devel libxkbfile-devel`.
- SUSE (openSUSE, etc): `sudo zypper install patterns-devel-C-C++-devel_C_C++  krb5-devel libsecret-devel libxkbfile-devel libX11-devel`.
- Others: see [How to Contribute](https://github.com/microsoft/vscode/wiki/How-to-Contribute).

### d. Windows - First-time Setup (Quick Start)

Run these in an elevated PowerShell in your repo root the first time you set up:

```powershell
# Node 20 (matches .nvmrc)
nvm install 20.18.2
nvm use 20.18.2

# Fix NVM_SYMLINK errors (if symlink target already exists as a real folder)
if ($env:NVM_SYMLINK -and (Test-Path $env:NVM_SYMLINK)) {
  Rename-Item -Path $env:NVM_SYMLINK -NewName (Split-Path $env:NVM_SYMLINK -Leaf)"_backup_$(Get-Date -Format yyyyMMddHHmmss)" -ErrorAction SilentlyContinue
}

# Tooling for node-gyp
$env:GYP_MSVS_VERSION = "2022"  # Use VS 2022 toolset (v143)
# Optional: pin Python 3.11/3.12 (recommended for node-gyp)
# npm config set python "C:\\Path\\to\\python311.exe"

# Clean any locks and caches (optional but helps with first-time setup)
Get-Process node,electron,gulp,msbuild -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\node-gyp\Cache" -ErrorAction SilentlyContinue

# Install dependencies
npm install

# If native modules fail, rebuild sequentially (avoid parallel builders)
# npm rebuild @vscode/sqlite3 @parcel/watcher @vscode/windows-process-tree @vscode/spdlog --verbose
```

### e. Local dev: `npm install` vs `npm ci`

- **Use `npm install`** for first-time local setup and day-to-day development. It allows small ad‑hoc fixes (e.g., `tar@6`, `node-addon-api`) that some native module builds expect on Windows.
- **Use `npm ci`** only in clean CI environments. It strictly uses `package-lock.json` and will remove ad‑hoc modules you may have added locally.

### Developer Mode Instructions

Here's how to start changing SafeAppeals2.0's code. These steps cover everything from cloning SafeAppeals2.0, to opening a Developer Mode window where you can play around with your updates.

1. `git clone https://github.com/savagelysubtle/SafeAppeals2.0` to clone the repo.
2. `npm install` to install all dependencies.
3. Open SafeAppeals2.0 or VSCode, and initialize Developer Mode (this can take ~5 min to finish, it's done when 2 of the 3 spinners turn to check marks):
   - Windows: Press <kbd>Ctrl+Shift+B</kbd>.
   - Mac: Press <kbd>Cmd+Shift+B</kbd>.
   - Linux: Press <kbd>Ctrl+Shift+B</kbd>.
4. Open the SafeAppeals2.0 Developer Mode window:
   - Windows: `./scripts/code.bat`.
   - Mac: `./scripts/code.sh`.
   - Linux: `./scripts/code.sh`.
5. You're good to start editing SafeAppeals2.0's code!
   - You won't see your changes unless you press <kbd>Ctrl+R</kbd> (<kbd>Cmd+R</kbd>) inside the new window to reload. Alternatively, press <kbd>Ctrl+Shift+P</kbd> and `Reload Window`.
   - You might want to add the flags `--user-data-dir ./.tmp/user-data --extensions-dir ./.tmp/extensions` to the command in step 4, which lets you reset any IDE changes you made by deleting the `.tmp` folder.

#### CSS in Development (Import Maps)

- In dev, `VSCODE_DEV=1` enables the CSS development service.
- CSS files imported via `import './file.css'` are mapped to small JS blobs that call `globalThis._VSCODE_CSS_LOAD(url)`, which injects the stylesheet.
- If you see "Failed to load module script ... MIME type 'text/css'": launch via `scripts/code.bat` or the "Launch VS Code Internal" configuration so `VSCODE_DEV=1` is set.

- You can kill any of the build scripts by pressing `Ctrl+D` in its terminal. If you press `Ctrl+C` the script will close but will keep running in the background.

If you get any errors, scroll down for common fixes.

#### Common Fixes

- Make sure you followed the prerequisite steps above.
- Make sure you have Node version `20.18.2` (the version in `.nvmrc`).
  - You can do this without changing your global Node version using [nvm](https://github.com/nvm-sh/nvm): run `nvm install`, followed by `nvm use` to install the version in `.nvmrc` locally.
- Make sure the path to your Void folder does not have any spaces in it.
- If you get `"TypeError: Failed to fetch dynamically imported module"`, make sure all imports end with `.js`.
- If you get an error with React, try running `NODE_OPTIONS="--max-old-space-size=8192" npm run buildreact`.
- If you see missing styles, wait a few seconds and then reload.
- If you get errors like `npm error libtool:   error: unrecognised option: '-static'`,  when running ./scripts/code.sh, make sure you have GNU libtool instead of BSD libtool (BSD is the default in macos)
- If you get errors like `The SUID sandbox helper binary was found, but is not configured correctly` when running ./scripts/code.sh, run
`sudo chown root:root .build/electron/chrome-sandbox && sudo chmod 4755 .build/electron/chrome-sandbox` and then run `./scripts/code.sh` again.
- If you have any other questions, feel free to [submit an issue](https://github.com/savagelysubtle/SafeAppeals2.0/issues/new). You can also refer to VSCode's complete [How to Contribute](https://github.com/microsoft/vscode/wiki/How-to-Contribute) page.

##### Windows native-build troubleshooting

- **MSB8040 (Spectre libs required)**: In Visual Studio Installer → Build Tools 2022 → Individual components, install:
  - `MSVC v143 – VS 2022 C++ x64/x86 Spectre-mitigated libs (Latest)`
  - `C++ ATL for latest build tools with Spectre Mitigations`
  - `C++ MFC for latest build tools with Spectre Mitigations`
  - `Windows 10 SDK` (10.0.22621+) and/or `Windows 11 SDK`
  - Then set:

    ```powershell
    $env:GYP_MSVS_VERSION = "2022"
    ```

- **Python for node-gyp**: Prefer Python 3.11 or 3.12 and point npm to it:

  ```powershell
  npm config set python "C:\\Path\\to\\python311.exe"
  ```

- **NVM_SYMLINK error** (target exists as a real folder): rename it, then `nvm use`:

  ```powershell
  $sym = $env:NVM_SYMLINK; if ($sym -and (Test-Path $sym)) { Rename-Item -Path $sym -NewName ((Split-Path $sym -Leaf)+"_backup_$(Get-Date -Format yyyyMMddHHmmss)") }
  nvm use 20.18.2
  ```

- **EPERM/EBUSY (locked files)**: stop locking processes, clear caches, rebuild sequentially:

  ```powershell
  Get-Process node,electron,gulp,msbuild -ErrorAction SilentlyContinue | Stop-Process -Force
  Remove-Item -Recurse -Force "$env:LOCALAPPDATA\node-gyp\Cache" -ErrorAction SilentlyContinue
  npm rebuild @vscode/sqlite3 @parcel/watcher @vscode/windows-process-tree @vscode/spdlog --verbose
  ```

  If it persists, add a Defender exclusion for the repo:

  ```powershell
  Add-MpPreference -ExclusionPath "D:\\Coding\\SafeAppeals2.0"
  ```

- **@vscode/sqlite3 "Cannot find module 'tar'"** during build: install tar v6 and rebuild:

  ```powershell
  npm i tar@6 --no-save
  npm rebuild @vscode/sqlite3 --verbose
  ```

- **@vscode/windows-process-tree "Cannot find module 'node-addon-api'"**: install headers and rebuild:

  ```powershell
  npm i node-addon-api@8 --no-save
  npm rebuild @vscode\windows-process-tree --verbose
  ```

#### Building SafeAppeals2.0 from Terminal

To build SafeAppeals2.0 from the terminal instead of from inside VSCode, follow the steps above, but instead of pressing <kbd>Cmd+Shift+B</kbd>, run `npm run watch`. The build is done when you see something like this:

```text
[watch-extensions] [00:37:39] Finished compilation extensions with 0 errors after 19303 ms
[watch-client    ] [00:38:06] Finished compilation with 0 errors after 46248 ms
[watch-client    ] [00:38:07] Starting compilation...
[watch-client    ] [00:38:07] Finished compilation with 0 errors after 5 ms
```

### Distributing

SafeAppeals2.0's maintainers distribute SafeAppeals2.0 on our website and in releases. Our build pipeline is a fork of VSCodium, and it works by running GitHub Actions which create the downloadables. The build repo with more instructions lives [here](https://github.com/savagelysubtle/SafeAppeals2.0).

If you want to completely control SafeAppeals2.0's build pipeline for your own internal usage, which comes with a lot of time cost (and is typically not recommended), see our build configuration in this repository.

#### Building a Local Executible

We don't usually recommend building a local executible of SafeAppeals2.0 - typically you should follow the steps above to distribute a complete executible with the advantages of VSCodium baked-in, or you should just use Developer Mode to run SafeAppeals2.0 locally which is much faster. If you're certain this is what you want, see details below.

<details>
 <summary> Building Locally (not recommended)</summary>
If you're certain you want to build a local executible of SafeAppeals2.0, follow these steps. It can take ~25 minutes.

Make sure you've already entered Developer Mode with SafeAppeals2.0 first, then run one of the following commands. This will create a folder named `VSCode-darwin-arm64` or similar outside of the SafeAppeals2.0/ repo (see below).

##### Mac

- `npm run gulp vscode-darwin-arm64` - most common (Apple Silicon)
- `npm run gulp vscode-darwin-x64` (Intel)

##### Windows

- `npm run gulp vscode-win32-x64` - most common
- `npm run gulp vscode-win32-arm64`

##### Linux

- `npm run gulp vscode-linux-x64` - most common
- `npm run gulp vscode-linux-arm64`

##### Local Executible Output

The local executible will be located in a folder outside of `SafeAppeals2.0/`:

```bash
workspace/
├── SafeAppeals2.0/   # Your SafeAppeals2.0 fork
└── VSCode-darwin-arm64/ # Generated output
```

</details>

## Pull Request Guidelines

- Please submit a pull request once you've made a change.
- No need to submit an Issue unless you're creating a new feature that might involve multiple PRs.
- Please don't use AI to write your PR 🙂
