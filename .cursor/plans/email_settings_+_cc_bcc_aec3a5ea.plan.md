---
name: Email settings + CC/BCC
overview: Add CC/BCC fields to compose, plus a settings button in the email sidebar that opens a new dashboard Settings pane for compose defaults (header/signature, auto-CC/BCC) and surfaced sync settings.
todos:
  - id: rename-core
    content: "Rename workspace config folder: FOLDER_CONFIG_FOLDER_NAME + ~13 core literals + 8 test files"
    status: completed
  - id: rename-copilot
    content: "Copilot + configuration-editing: protected-files glob, launch.json path, JSON schema associations for .safeAppeals"
    status: completed
  - id: ccbcc-ui
    content: Compose CC/BCC fields (toggle links, send/draft round-trip, reply prefill)
    status: completed
  - id: settings-config
    content: New safeappealsEmail.compose.* config keys + config.ts helpers
    status: completed
  - id: settings-pane
    content: Dashboard Settings pane (Compose + Sync sections) + updateSettings host handler
    status: completed
  - id: sidebar-gear
    content: Sidebar gear button → openSettings → dashboard settings pane
    status: completed
  - id: verify
    content: Type-check, rebuild bundles, live-verify in web build
    status: completed
isProject: false
---

# Email Settings Panel + CC/BCC + `.safeAppeals` Folder Rename (rung 6.8)

Two work streams: (A) the product-wide rename of the workspace config folder
`.vscode` → `.safeAppeals` (core + copilot), and (B) the email settings pane +
CC/BCC (all in `extensions/safeappeals-email`). Settings stored as VS Code
configuration (`safeappealsEmail.*`) so they sync with profiles, appear in
native Settings UI, and are readable by the future agent tools.

## 0. Workspace config folder rename: `.vscode` → `.safeAppeals`

Case folders belong to legal users, not developers — they should see a
`.safeAppeals` folder, and per-case email settings land there too.

- **Single source of truth**: change `FOLDER_CONFIG_FOLDER_NAME = '.vscode'` →
  `'.safeAppeals'` in
  [src/vs/workbench/services/configuration/common/configuration.ts](src/vs/workbench/services/configuration/common/configuration.ts).
  This automatically moves discovery of `settings.json`, `tasks.json`,
  `launch.json`, and `mcp.json` (so the Copilot MCP lookup — the
  "Failed to get installed servers from …/.vscode/mcp.json" console error —
  follows for free).
- **Hardcoded literals in core** (~13 non-test files found by grep; patch each
  to use the constant where importable, else the literal):
  `diagnosticsService.ts` (node — can't import workbench constant, use
  literal), `textFileService.ts` (UTF-8 encoding override for the config
  folder), `sessionsTasksService.ts`, `preferences.ts`,
  `debugConfigurationManager.ts`, `workspaceExtensionsConfig.ts`,
  `workspaceRecommendations.ts`, `extensionsActions.ts`,
  `taskConfiguration.ts`, `abstractTaskService.ts`, `snippetsService.ts`,
  `configureSnippets.ts`, `telemetry.contribution.ts`.
- **Copilot extension**: [extensions/copilot/src/extension/tools/node/editFileToolUtils.tsx](extensions/copilot/src/extension/tools/node/editFileToolUtils.tsx)
  protected-files glob `**/.vscode/*.json` → cover `**/.safeAppeals/*.json`;
  [extensions/copilot/src/extension/prompt/vscode-node/debugCommands.ts](extensions/copilot/src/extension/prompt/vscode-node/debugCommands.ts)
  creates `launch.json` under the config folder — update the joined path.
  (Other hits are comments/test fixtures; leave them.)
- **configuration-editing extension**:
  [extensions/configuration-editing/package.json](extensions/configuration-editing/package.json)
  JSON schema associations for `.vscode/*.json` → add `.safeAppeals/*.json`
  equivalents so settings/tasks/launch/mcp get IntelliSense in case folders.
- **Tests**: 8 files under `src/vs/**/test/**` hardcode `.vscode` paths;
  mechanical replace so suites keep passing. (Noted upstream-merge cost: this
  churn re-appears at every upstream merge; acceptable, it's grep-able.)
- **Not doing**: no dual-read fallback from `.vscode` (pre-release, case
  folders are new; a fallback doubles the config-watcher surface). Dev repos
  opened in Cursor/stock VS Code are unaffected — Cursor reads its own
  `.vscode`; only the built SafeAppeals product reads `.safeAppeals`.
- **Verify**: web build — open a case folder, change a workspace setting via
  the Settings UI, confirm it writes `.safeAppeals/settings.json` and reads
  back after reload; confirm the Copilot mcp.json console error now references
  `.safeAppeals` and tasks from `.safeAppeals/tasks.json` load.

## 1. CC/BCC in compose (backend already done)

The data model is already wired: `SendMailRequest.cc/bcc` → nodemailer in
[extensions/safeappeals-email/src/smtpClient.ts](extensions/safeappeals-email/src/smtpClient.ts),
and `EmailDraft.cc/bcc` exists in
[extensions/safeappeals-email/src/types.ts](extensions/safeappeals-email/src/types.ts).
Only the UI is missing:

- [extensions/safeappeals-email/webview-src/dashboard/App.tsx](extensions/safeappeals-email/webview-src/dashboard/App.tsx):
  extend `compose` state to `{ to, cc, bcc, subject, content }`.
  - Compact "CC / BCC" toggle links beside the To field (Gmail-style); clicking
    reveals the input rows so compose stays uncluttered. Auto-expand when a
    loaded draft or reply has values.
  - `onSend` includes `cc`/`bcc` in the request; `onSaveDraft` includes them in
    the draft; loading a draft restores them.
  - Reply prefills CC from the original message's `cc` (reply-all behavior stays
    manual — user can clear it).

## 2. Settings storage (new config keys)

In
[extensions/safeappeals-email/package.json](extensions/safeappeals-email/package.json)
`configuration.properties` + helpers in
[extensions/safeappeals-email/src/config.ts](extensions/safeappeals-email/src/config.ts):

- `safeappealsEmail.compose.header` — text block inserted at the top of new
  compositions (e.g. "PRIVILEGED AND CONFIDENTIAL"). Global (user identity).
- `safeappealsEmail.compose.signature` — text block appended
  (name/title/contact). Global (user identity).
- `safeappealsEmail.compose.autoCc` / `safeappealsEmail.compose.autoBcc` —
  addresses prefilled into every new composition. **Per-case
  (workspace-scoped)**: written via `ConfigurationTarget.Workspace` so each
  case folder carries its own values in its `.safeAppeals/settings.json`
  (after the stream-0 rename — the extension itself never hardcodes the
  folder; `ConfigurationTarget.Workspace` follows the core constant) — e.g.
  opposing counsel or a case-logging address differs per case. Reads need no
  special handling: VS Code config precedence returns the workspace value
  when a case is open. When no workspace is open, the settings pane disables
  these two fields with an "open a case to set per-case CC/BCC" note, and
  compose applies no auto-CC/BCC.
- Existing keys surfaced in the UI (no schema change): `syncIntervalMinutes`,
  `defaultFolder`, `maxMessagesPerSync` (global)

Compose behavior: opening compose (new/reply/forward) prefills `content` as
`header + "\n\n" + (body) + "\n\n" + signature` (skipping empty parts) and
CC/BCC from autoCc/autoBcc. Values arrive via the dashboard bootstrap payload so
the webview never reads config directly.

## 3. Settings UI

- Sidebar: gear `icon-btn` in the `toolbar-row` (the green-box area, next to
  Sync/Dashboard buttons) in
  [extensions/safeappeals-email/webview-src/sidebar/App.tsx](extensions/safeappeals-email/webview-src/sidebar/App.tsx)
  posting `openSettings`.
- Host: `EmailSidebarProvider` handles `openSettings` → opens the dashboard with
  a new pane (same pattern as `openDrafts`/`showCompose` in
  [extensions/safeappeals-email/src/dashboardPanel.ts](extensions/safeappeals-email/src/dashboardPanel.ts)).
- Dashboard: new `Pane = 'settings'` in the dashboard app with sections:
  - **Compose** — multiline textareas for header and signature (global);
    auto-CC / auto-BCC inputs labeled "This case", disabled with a hint when
    no case is open
  - **Sync** — number inputs for sync interval and max messages per sync, text
    input for default folder
  - Save button posts `updateSettings` → host validates and writes each key to
    its proper target: header/signature/sync via `ConfigurationTarget.Global`,
    autoCc/autoBcc via `ConfigurationTarget.Workspace` (skipped when no
    workspace is open), then re-bootstraps. A "restart sync timer" nudge
    happens automatically since the sync engine reads interval on schedule.
- New host↔webview messages: `openSettings` (sidebar→host), `settings` payload
  in dashboard bootstrap, `updateSettings` (dashboard→host).

## 4. Deferred (noted, not built now)

Auto-tag sent mail, default case-link on send, mark-as-read behavior, thread
density — candidates for a later pass once the settings pane exists as a home
for them. Per-account signatures also deferred (v1 is global).

## 5. Verify

- Type-check src (repo-root tsc), rebuild webviews (`node esbuild.mjs`), then
  live-check in the web build: gear opens Settings pane, saved header/signature
  appear in a new compose, CC/BCC round-trip through draft save → send.
- Update the agent tools plan note: `email_createDraft` already documents
  `cc?`/`bcc?`; add that compose defaults come from
  `safeappealsEmail.compose.*`.
