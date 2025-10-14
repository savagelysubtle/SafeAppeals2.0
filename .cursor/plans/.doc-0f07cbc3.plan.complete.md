<!-- 0f07cbc3-3000-424e-b505-696313d94e03 1f2057be-1f0b-4586-a8c8-02ea7dbcf802 -->
# Doc-Focused Editor: Keep Markdown/Plaintext/YAML/JSON/XML + SCM/Git, remove IDE features

## Scope

- Keep: Markdown, Plaintext, YAML, JSON, XML, Git/SCM
- Remove: Terminal and all other built-in language services/extensions (TypeScript/JS, Python, Go, PHP, HTML/CSS, Debug, etc.)
- UI: Activity Bar shows Explorer, Search, SCM; no Extensions view; no Terminal
- Physically delete non-document extension folders under `extensions/`, except `git`, `git-base`, and allowed languages
- Block all extension installations (gallery, VSIX)

## 1) Prune built-in extensions (build-time)

- Edit `build/gulpfile.extensions.js`: restrict `compilations` to an allowlist.
  - Keep only:
    - `extensions/markdown-language-features/tsconfig.json`
    - `extensions/markdown-language-features/preview-src/tsconfig.json`
    - `extensions/markdown-math/tsconfig.json`
    - `extensions/json-language-features/client/tsconfig.json`
    - `extensions/json-language-features/server/tsconfig.json`
    - `extensions/json/tsconfig.json` (if present)
    - `extensions/yaml/tsconfig.json` (if present)
    - `extensions/xml/tsconfig.json` (if present)
    - `extensions/git/tsconfig.json`
    - `extensions/git-base/tsconfig.json`
  - Remove (or comment out) all others like `typescript-language-features`, `php-language-features`, `css-language-features`, `html-language-features`, `ipynb`, etc.
- Constrain packaging:
  - In `build/gulpfile.extensions.js` tasks that call `ext.packageAllLocalExtensionsStream(...)`, filter to only the above folders so only they land in `.build/extensions`.

## 2) Remove Extensions view and block installs

- Remove Extensions viewlet registration in `src/vs/workbench/contrib/extensions/browser/extensions.contribution.ts` by guarding the registration with a product flag.
- Hard-block installs in `src/vs/platform/extensionManagement/common/extensionManagementIpc.ts` (install/VSIX/gallery commands) when flag is set.
- Also block client-side install commands in `extensions.contribution.ts` when flag is set.

## 3) Activity Bar: Explorer, Search, SCM only

- In `src/vs/workbench/browser/parts/activitybar/activitybarPart.ts`, filter view containers to an allowlist:
```ts
const allowed = new Set([
  'workbench.view.explorer',
  'workbench.view.search',
  'workbench.view.scm',
]);
containers = containers.filter(c => allowed.has(c.id));
```


## 4) Remove Terminal UI and commands (Workbench + Void)

- Workbench Terminal (global): gate terminal contributions off with a product flag and/or hard filter registrations under `src/vs/workbench/contrib/terminal/**` (browser and common):
  - Prevent registering terminal views, actions, quick picks, menus.
  - Remove/guard "Toggle Integrated Terminal" and related command registrations.
- Panel handling (optional hardening): keep panel hidden by default so no terminal can show even if code slips through.
- Void module: disable/remove terminal tool integration so nothing in Void calls the terminal:
  - Remove the import in `src/vs/workbench/contrib/void/browser/void.contribution.ts`: `import './terminalToolService.js'`.
  - Remove/guard the service in `src/vs/workbench/contrib/void/browser/terminalToolService.ts` (prefer gating via product flag like `disableTerminal`).
  - In `src/vs/workbench/contrib/void/browser/toolsService.ts`, remove handlers for `run_command`, `run_persistent_command`, `open_persistent_terminal`, `kill_persistent_terminal` and any dependency on `ITerminalToolService`.
  - In `src/vs/workbench/contrib/void/common/toolsServiceTypes.ts`, delete the `'terminal'` entries from `approvalTypeOfBuiltinToolName` and related param typings.
  - In `src/vs/workbench/contrib/void/common/prompt/prompts.ts`, remove terminal tool descriptions and instructions.

## 5) Default settings and product flags

- Update `product.json` with defaults and control flags:
```json
{
  "disableExtensionInstalls": true,
  "settings.experimentalDefaults": {
    "files.associations": {
      "*.md": "markdown",
      "*.markdown": "markdown",
      "*.txt": "plaintext",
      "*.yaml": "yaml",
      "*.yml": "yaml",
      "*.json": "json",
      "*.xml": "xml"
    },
    "workbench.startupEditor": "newUntitledFile",
    "editor.formatOnSave": false,
    "editor.bracketPairColorization.enabled": false,
    "editor.matchBrackets": "never",
    "editor.codeActionsOnSave": {},
    "editor.folding": false,
    "editor.semanticHighlighting.enabled": false,
    "terminal.integrated.enable": false
  }
}
```

- Do NOT disable SCM; ensure it is visible by default.

## 6) Remove non-document extensions from the repo (MANDATORY)

- Allowlist to keep under `extensions/`:
  - `markdown-language-features/`
  - `markdown-math/`
  - `markdown-basics/`
  - `json/`
  - `json-language-features/`
  - `yaml/`
  - `xml/`
  - `git/`
  - `git-base/`
- Delete everything else under `extensions/`.
- Suggested PowerShell (from repo root) to delete all non-allowlisted folders safely via git:
```powershell
$root = Resolve-Path .
$extPath = Join-Path $root 'extensions'
$keep = @(
  'markdown-language-features','markdown-math','markdown-basics',
  'json','json-language-features','yaml','xml',
  'git','git-base'
)
Get-ChildItem -LiteralPath $extPath -Directory | Where-Object { $keep -notcontains $_.Name } |
  ForEach-Object {
    git rm -r --cached --force -- $_.FullName 2>$null | Out-Null
    Remove-Item -LiteralPath $_.FullName -Recurse -Force
  }
```

- Commit the deletions separately to keep the diff clear.

## 7) Build and verify

- Dev: `npm ci`, then `npm run watch`.
- Package (Windows x64):
  - `npm run compile-build`
  - `node ./node_modules/gulp/bin/gulp.js vscode-win32-x64-min`
- Verify at runtime:
  - Explorer, Search, SCM in Activity Bar; no Extensions view
  - No Terminal UI or commands (Command Palette)
  - MD/Plain/YAML/JSON/XML language modes work; no other IntelliSense
  - Git SCM works locally (init, stage, commit, history)

## Notes

- Keeping `extensions/git` and `extensions/git-base` is sufficient for local Git; `extensions/github` and `extensions/github-authentication` are not required for local-only workflows and can be removed.
- XML may be grammar-only; if no tsconfig, ensure it is included by the packaging allowlist step.
- The product flag `disableExtensionInstalls` gates all install paths.

### To-dos

- [ ] Allowlist MD/JSON/YAML/XML/Git in build/gulpfile.extensions.js compilations
- [ ] Filter packaging to MD/JSON/YAML/XML/Git only in build/lib/extensions.ts
- [ ] Guard/remove Extensions view registration in extensions.contribution.ts
- [ ] Block install commands in extensionManagementIpc.ts when product flag set
- [ ] Allowlist Explorer/Search/SCM in activitybarPart.ts
- [ ] Disable Terminal contributions and commands; hide panel by default
- [ ] Add default settings (incl. *.xml) and disableExtensionInstalls flag
- [ ] Delete all non-doc extension folders except git/git-base/yaml/xml
- [ ] Build desktop app and verify UI + Git/SCM; no Terminal