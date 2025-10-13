## SafeAppeals2.0 development guide (.vscode)

This document summarizes how to build and launch the app from VS Code using the tasks and launch configurations in this workspace, and how the helper scripts under `scripts/` fit in.

### Prerequisites

- Node 20 (see `.nvmrc`)
- First run the prelaunch step to fetch Electron and built-in bits when needed

You can trigger Prelaunch via the Task: “Ensure Prelaunch Dependencies”.

### Typical workflows

1) Build and run the desktop app (recommended)
   - Run the default build task: “VS Code - Build” (Ctrl/Cmd+Shift+B)
   - Launch the debugger: “Launch VS Code Internal”

2) Quick start from a terminal
   - Windows: `scripts\code.bat`
   - macOS/Linux: `./scripts/code.sh`

3) Run the web (server) variant
   - Task: “Run code server” (starts on port 8080)
   - Debug: “VS Code Server (Web, Chrome)” or “… (Edge)”

4) Run the web (static) variant
   - Task: “Run code web” (starts on port 8080)
   - Debug: “VS Code Web (Chrome)” or “… (Edge)”

Note: When running the desktop app via “Launch VS Code Internal” or `scripts/code.bat`, the environment sets `VSCODE_DEV=1`, which enables CSS import support used by the workbench. If you see CSS MIME errors, ensure you are launching this way.

---

### Tasks (from .vscode/tasks.json)

- VS Code - Build
  - Default aggregate build. Depends on:
    - Core - Build → `npm run watch-clientd` (TypeScript core, watch)
    - React - Build → `npm run watchreactd` (React pieces in `contrib/void`, watch)
    - Ext - Build → `npm run watch-extensionsd` (built-in extensions, watch)

- Web Ext - Build → `npm run watch-webd` (web extensions, watch)

- Ensure Prelaunch Dependencies → `node build/lib/preLaunch.js`
  - Fetches Electron and other required prebuilts as needed.

- Run Dev
  - Windows: runs `.\\scripts\\code.bat`
  - macOS/Linux: runs `./scripts/code.sh`

- Run code server
  - Windows: `.\\scripts\\code-server.bat --no-launch --connection-token dev-token --port 8080`
  - macOS/Linux: `./scripts/code-server.sh --no-launch --connection-token dev-token --port 8080`

- Run code web
  - Windows: `.\\scripts\\code-web.bat --port 8080 --browser none`
  - macOS/Linux: `./scripts/code-web.sh --port 8080 --browser none`

- Run tests
  - Windows: `.\\scripts\\test.bat`
  - macOS/Linux: `./scripts/test.sh`

- Download electron → `npm run electron`

- npm: tsec-compile-check
  - `node_modules/tsec/bin/tsec -p src/tsconfig.json --noEmit`

- Launch Http Server
  - `node_modules/.bin/ts-node -T ./scripts/playground-server` (for Monaco playground; depends on Core - Build)

- Kill/Restart helpers
  - Kill Core - Build, Kill Ext - Build
  - Kill VS Code - Build (aggregates the above kill tasks)
  - Restart VS Code - Build (Kill + Build in sequence)

Tips:

- All “watch” tasks are long-lived. Use the provided Kill tasks to stop them.
- The default build is backgrounded; use Problems panel to view TypeScript errors.

---

### Launch configurations (from .vscode/launch.json)

- Launch VS Code Internal (Chrome)
  - Uses `scripts/code.bat` (Windows) or `scripts/code.sh` to start the desktop app under Chrome debugging
  - Sets `VSCODE_DEV=1` and other dev flags so CSS imports and dev tooling work
  - Opens Chrome DevTools for the renderer; main process debug listens on port 5875

- Main/Shared/Extension/CLI/Pty Host attach targets
  - Attach to the specific Node/Electron processes on the listed ports (e.g., Main Process: 5875)

- Compounds (e.g., “VS Code”)
  - Start “Launch VS Code Internal” and attach the important processes automatically

- VS Code Server (Web)
  - Launch the server via task “Run code server”, then use the Chrome/Edge launchers to open `http://localhost:8080`

- VS Code Web (static)
  - Launch via “Run code web”, then use the Chrome/Edge launchers to open `http://localhost:8080`

Note: Many launchers reference output in `out/**/*.js` for source maps. Ensure background builds are running (“VS Code - Build”).

---

### Scripts (from /scripts)

- code.bat / code.sh
  - Starts the desktop app from local sources using the downloaded Electron
  - Sets dev env: `NODE_ENV=development`, `VSCODE_DEV=1`, `VSCODE_CLI=1`, etc.
  - Passes through arguments; disables a test extension by default unless running tests

- code-server.*
  - Starts the web server flavor of the app (used by the “VS Code Server (Web, …)” launchers)

- code-web.*
  - Starts the static web flavor (used by the “VS Code Web (… )” launchers)

- test.*
  - Runs the project’s test suites

Other helpers include CLI variants and playground tooling; see each script’s header for details.

---

### Troubleshooting (quick)

- CSS MIME errors in dev: ensure you start via “Launch VS Code Internal” or `scripts/code.bat` so `VSCODE_DEV=1` is set.
- “Failed to fetch dynamically imported module”: ensure imports end with `.js` in compiled output.
- Missing styles right after startup: give watchers a moment to emit, then reload the window (Ctrl/Cmd+R).
