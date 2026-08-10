<!-- Copyright (c) Safe Appeals. All rights reserved. -->

# Agent LM Tools Pattern

How SafeAppeals satellite extensions expose language-model tools to the Agent chat loop. Grounded in shipped code under `extensions/safeappeals-*`, `extensions/time-tracker`, and allowlisting in `extensions/safeappeals-authentication`.

## Overview

1. The owning extension **contributes** tool metadata in `package.json` under `contributes.languageModelTools` (name, `modelDescription`, `inputSchema`, display fields). Each contribution implies an `onLanguageModelTool:<name>` activation event.
2. On activate, the extension **registers** an implementation with `vscode.lm.registerTool(name, impl)` (usually from `src/agentTools.ts` via `registerAgentTools(...)`).
3. The SafeAppeals agent loop in `safeappeals-authentication` **allowlists** tool names before they reach the model. Any name starting with `safeappeals_` is allowed. Host/core tools (terminal, browser, timeline, etc.) use an explicit CORE list.

Satellite tools are **not** force-ensured into every turn. Ensured tools live in `ENSURED_AGENT_TOOL_NAMES` (workspace file ops, web search, RAG, switch mode, …). Satellite tools appear when the extension is active and the tool is selected/available in the pool.

## Checklist for a new satellite tool

1. Pick a stable id: `safeappeals_<domain>_<verb>` (camelCase after the prefix), e.g. `safeappeals_email_listThreads`, `safeappeals_timer_start`.
2. Add a `languageModelTools` entry in the extension `package.json` (and matching `activationEvents` `onLanguageModelTool:…` if you list them explicitly).
3. Implement `vscode.LanguageModelTool<T>` in `agentTools.ts` — `invoke`, and `prepareInvocation` when the user should confirm (writes, drafts, start/stop timer).
4. Call `vscode.lm.registerTool` from `registerAgentTools` and invoke that from `activate`.
5. Confirm `isAgentToolAllowed` accepts the name (`safeappeals_*` prefix). Do **not** add satellite tools to `ENSURED_AGENT_TOOL_NAMES` or `CORE_AGENT_TOOL_NAMES` unless they are host/core exceptions (timeline uses void-compatible `timeline_*` names on CORE).
6. Prefer wrapping existing extension services/commands; keep side effects local and fail closed on missing auth/index/workspace.

## Allowlist layers (`toolAllowlist.ts`)

| Layer | Role |
| ----- | ---- |
| `safeappeals_*` prefix | Cloud/satellite tools — allowed when present; not ENSURED |
| `ENSURED_AGENT_TOOL_NAMES` | Force-added unless the picker disabled them (workspace, web, RAG, `safeappeals_switchMode`, …) |
| `CORE_AGENT_TOOL_NAMES` | Host tools by exact name (edit/fetch internals, terminal, todo, browser suite + `browser_cdp`, **`timeline_*`**) |
| `PLAN_MODE_EDIT_DENYLIST` | Edit/write tools stripped in Plan mode |
| `PLAN_MODE_BROWSER_DENYLIST` | All integrated-browser CORE tools stripped in Plan mode (including `browser_cdp`) |

`copilot_*` names are never allowed; substitutions map picker aliases to SafeAppeals ids.

## Shipped satellites (reference)

### Documents — `extensions/safeappeals-documents`

| Tool | Purpose |
| ---- | ------- |
| `safeappeals_docx_read` / `_create` / `_edit` | Word read / create / edit |
| `safeappeals_xlsx_read` / `_create` / `_edit` | Spreadsheet read / create / edit |
| `safeappeals_openDocument` | Open a document in the viewer/editor |

Registration: `registerAgentTools` in `src/agentTools.ts`.

### Email — `extensions/safeappeals-email`

Fourteen tools; **no send** tool. Drafts are local (and optional remote draft folder sync); the user sends from the dashboard.

**Read**

| Tool | Purpose |
| ---- | ------- |
| `safeappeals_email_search` | Search indexed mail |
| `safeappeals_email_listThreads` | List threads (folder, tag, case, sort filters) |
| `safeappeals_email_getMessage` | Fetch one message (body truncated for the model) |
| `safeappeals_email_listAccounts` | Configured accounts |
| `safeappeals_email_listFolders` | Folders for an account |

**Organize**

| Tool | Purpose |
| ---- | ------- |
| `safeappeals_email_listTags` | List tags |
| `safeappeals_email_tagThread` / `_untagThread` | Tag / untag a thread |
| `safeappeals_email_deleteTag` | Delete a tag |
| `safeappeals_email_hideThread` / `_unhideThread` | Hide / unhide |
| `safeappeals_email_linkThreadToCase` / `_unlinkThreadFromCase` | Case folder link |

**Draft**

| Tool | Purpose |
| ---- | ------- |
| `safeappeals_email_createDraft` | Save a draft (`to`, `subject`, `content` required). Does **not** send. |

`createDraft` optional inputs include `accountId`, `cc`, `bcc`, `emailId`, `draftId`, `openInCompose` (default opens compose), and `attachments: [{ path }]` with workspace-bounded paths.

**Draft attachments**

- Bytes are sealed under `context.globalStorageUri/draft-attachments/<draftId>/<attachmentId>` (`DraftAttachmentStore`; fail-safe in-memory if encryption is unavailable — never plaintext on disk).
- Limits: **20 MiB** per file, **20 MiB** aggregate per draft, **10** files per draft.
- Dashboard Attach button and Send use `draftId` + store-loaded bytes (inbound attachment payloads ignored when `draftId` is set).
- After save, UI hooks refresh the dashboard/sidebar and can open compose (`loadDraft` / refresh path).

### Timer — `extensions/time-tracker`

| Tool | Purpose |
| ---- | ------- |
| `safeappeals_timer_getState` | Running flag, elapsed, matter/rate/description/billable |
| `safeappeals_timer_start` | Start (optional description, matterId, rateId, isBillable); confirms with user |
| `safeappeals_timer_stop` | Stop and save a time entry; confirms with user |

`updateEntry` / `listMatters` LM tools are **not** required for the shipped surface.

### Timeline — `extensions/safeappeals-timeline` (CORE, not `safeappeals_*`)

Six tools on the CORE allowlist with void-compatible names: `timeline_add_event`, `timeline_update_event`, `timeline_delete_event`, `timeline_get_events`, `timeline_link_document`, `timeline_get_deadlines`. See [features/timeline](./features/timeline/README.md).

### Auth / workspace / web — `extensions/safeappeals-authentication`

Workspace file tools, Brave web search / multi-search / fetch, plan/mode tools, and RAG tool ids are contributed or ensured from auth (and RAG from `safeappeals-rag`). Those are ENSURED or Plan-gated surfaces, not satellite-only.

### Integrated browser (CORE) — `src/vs/workbench/contrib/browserView`

Registered by `BrowserChatAgentToolsContribution` when sharing is available (`chat` + Agent enabled + `workbench.browser.enableChatTools`, default on). Tools are **CORE, not ENSURED** (picker can disable). Prefer snapshot/click/type; use escape hatches only when needed.

| Tool id | Role |
| ------- | ---- |
| `open_browser_page` | Open / share a tab |
| `read_page` | Accessibility snapshot (primary “see the page”) |
| `screenshot_page` | Visual capture |
| `navigate_page` / `click_element` / `type_in_page` / `hover_element` / `drag_element` / `handle_dialog` | Drive the shared page |
| `run_playwright_code` | Playwright API escape hatch (confirm) |
| `browser_cdp` | Page-scoped CDP method escape hatch (confirm; deny-list blocks Input.*/cookies/storage/permissions/downloads/target-escape) |

**Failure mode when sharing unavailable:** only non-agentic `open_browser_page` is registered — pages may open, but contents are not shared and the interactive suite (including `browser_cdp`) is unreachable.

**Plan mode:** all browser CORE ids above are stripped via `PLAN_MODE_BROWSER_DENYLIST`.

**Not an Agent tool:** workbench/renderer Electron CDP (`--remote-debugging-port` / launch-skill attach) is **developer automation only**. Do not allowlist it into Agent chat.

**Windows QA (remaining manual):** on a Windows Electron build, smoke open→share→`read_page`→click/type, `browser_cdp` `Runtime.evaluate`, deny-list errors, and chat-session dispose. Automated unit tests cover deny-list, Plan strip, tool contract, and CDP session-store dispose.

## Related docs

- [Chat feature index](./features/chat/README.md) — Plan/Agent modes and CreatePlan
- [Plan mode](./features/chat/plan-mode.md) — `safeappeals_createPlan`
- [Time Tracker](./features/timeTracker/README.md) — timer UX + LM tools
- [Feature tracker](./ADDED_FEATURES_TRACKER.md) — ship status index
- Allowlist source: `extensions/safeappeals-authentication/src/chat/toolAllowlist.ts`
