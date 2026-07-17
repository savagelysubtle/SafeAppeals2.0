---
name: Upstream VS Code Merge — Bolt-On Migration
overview:
  'Migration to upstream VS Code 1.129 on branch update-vscode (import commit
  65015a05, byte-identical to tag). Strategy: adopt upstream agent
  infrastructure (chat, chat editing, inline chat, inline completions, tools,
  MCP, browserView) and register SafeAppeals providers into it; port only the
  legal-domain product into contrib/void; keep themes and utility extensions
  as extensions; extension-ize document viewers post-migration. This file is
  the full disposition inventory: every fork asset classified as
  replace / bolt-on / port / extension / retire / defer.'
todos:
  - id: import-upstream
    content: Import 1.129.0 tree on update-vscode (65015a05, diff vs tag = 0)
    status: completed
  - id: survey-upstream-agents
    content: Survey 1.129 agent stack vs Void systems; write decision matrix
    status: completed
  - id: phase0-prep
    content: 'Phase 0: wipe residual contrib/void on disk; confirm overlay sources'
    status: pending
  - id: phase1-branding-build
    content:
      'Phase 1: product.json branding + Copilot strip; themes + utility
      extensions; buildreact wiring into gulpfile.mjs build'
    status: pending
  - id: phase2-ai-boltons
    content:
      'Phase 2: contrib/void/browser/integration — LM provider, default chat
      agent (panel + EditorInline), InlineCompletionsProvider, LM tools'
    status: pending
  - id: phase3-domain-port
    content: 'Phase 3: overlay domain features into contrib/void; fix API drift'
    status: pending
  - id: phase4-appts-channels
    content: 'Phase 4: port reduced app.ts channel set (~15 of 20)'
    status: pending
  - id: phase5-compile-native
    content:
      'Phase 5: bun install vs new Electron/Node pins; native module rebuilds;
      full compile + smoke test'
    status: pending
  - id: phase6-data-migrations
    content:
      'Phase 6: chat-thread → ChatSessionStore import; MCP config → .mcp.json;
      settings key carry-over'
    status: pending
  - id: phase7-extensionize-viewers
    content:
      'Phase 7 (post-migration): convert PDF → DOCX → XLSX viewers to built-in
      custom-editor extensions'
    status: pending
isProject: false
---

# Upstream VS Code Merge — Bolt-On Migration (full disposition plan)

## Status (Jul 17, 2026)

- Branch `update-vscode`: fork `main` tip (`741fd1ab`) + import commit
  `65015a05` == tag `1.129.0` exactly (`git diff --stat` = 0).
- Overlay sources: `git show main:<path>` for everything below;
  `feat-blog-writer-extension` only for Growth Writer (deferred).
- Residual untracked files on disk (`contrib/void` leftovers, `python/`,
  `void-cloud/`, `resources/ffmpeg|models`, `.env`, workspace file) — wipe
  `contrib/void` residue before overlay; the rest are non-build assets.

## Strategy

1.95-era Void built parallel AI stacks because core had none. 1.129 core ships
chat + agent mode + chat editing + inline chat + inline completions + tool
calling + MCP + integrated browser, all usable without Copilot. Therefore:
**adopt upstream infra via registration APIs; port only the legal product;
keep upstream files untouched except a tiny marked hookpoint set.**

Architecture rules (settled):

- All fork code stays under `src/vs/workbench/contrib/void/` (rename to
  `safeappeals` optional/cosmetic later; storage & settings keys must not
  change). No new logic in upstream files.
- New thin `contrib/void/browser/integration/` layer is the ONLY place
  coupled to upstream chat APIs (provider, agent, completions, tools).
- Rule of thumb: renders a document → extension candidate; orchestrates
  workbench/agent state → contrib.
- Do not convert viewers to extensions during the migration (two variables at
  once); that is Phase 7.

---

## A. Upstream 1.129 capabilities we adopt (hook points)

| Capability | Hook |
| --- | --- |
| LLM providers | `ILanguageModelsService.registerLanguageModelProvider('safeappeals', provider)` — in-process, no extension (`contrib/chat/common/languageModels.ts`) |
| Chat agent (panel + inline) | `IChatAgentService.registerDynamicAgent`, `isDefault: true`, locations `[Panel, EditorInline]` — EditorInline default agent un-gates inline chat (`InlineChatEnabler`) |
| Agentic edits / diff review | `IChatEditingSession` (agent emits `textEditGroup` progress; accept/reject per hunk) — replaces DiffZones |
| Autocomplete + NES | `ILanguageFeaturesService.inlineCompletionsProvider.register('*', p)`; `isInlineEdit: true` |
| Tool calling | `ILanguageModelToolsService.registerTool` (+ confirmation service) |
| MCP | `contrib/mcp` full client (stdio+HTTP/SSE, OAuth, trust, `.mcp.json`/Claude discovery); servers run in extension host |
| Integrated browser | `contrib/browserView` (`WebContentsView`, `persist:vscode-browser`, Playwright/CDP agent tools) |
| Chat persistence | `ChatSessionStore` (workspace/global) |
| Copilot residue | `product.json` `defaultChatAgent` blanked; `IChatEntitlementService` chrome hidden via product config; skip Copilot MCP setup commands |

---

## B. Disposition: REPLACE with upstream (delete from port set)

| Void system | Replaced by | Data/UX migration |
| --- | --- | --- |
| React chat sidebar (`sidebarPane`, `sidebarActions`, `react/sidebar-tsx`) | native `ChatViewPane` | UX change: native widget, not Tailwind |
| `chatThreadService` + `void-channel-chat-threads` storage | `ChatSessionStore` | Phase 6 thread import shim |
| `editCodeService` (+ types, `react/diff`, `void-editor-widgets-tsx`) | `IChatEditingSession` | none |
| `cloudLLMRouterService` | model picker + `isDefaultForLocation` (see C.1) | routing becomes explicit model choice |
| `quickEditActions` (Cmd+K) + `react/quick-edit-tsx` | `contrib/inlineChat` (Cmd+I) | optional keybinding remap Cmd+K→`inlineChat.start` |
| `autocompleteService` | inlineCompletions provider (Phase 2 registers ours) | none |
| `browser/tools` + `electron-main/tools` + `common/tools` | `ILanguageModelToolsService` (re-register in Phase 2) | tool confirmations now upstream UI |
| `common/mcpService` + `mcpChannel` + `void-channel-mcp` | `contrib/mcp` | Phase 6 config migration; servers move electron-main → ext host |
| `browserPanel` + `browserPanelChannel` + `void-channel-browser-panel` | `contrib/browserView` | drop `persist:void-browser-v2` app.ts exemptions; cookies/sessions reset |
| `webSearchActions` | chat tool entry | Brave backend kept (see C) |
| `voidCommandBarService`, `voidSelectionHelperWidget`, `tooltipService`, `react/void-tooltip` | retired Void-chat UX glue | delete |
| `voidOnboardingService` + `react/void-onboarding` | upstream `welcomeOnboarding` / `welcomeAgentSessions` | re-add SafeAppeals onboarding content later if needed |
| `contextGatheringService` (as standalone) | folded into agent impl + upstream `IPromptsService` instructions | — |

## C. Disposition: BOLT-ON layer (new code, small; wraps kept pipeline)

### C.1 Provider decision (settled Jul 17): two vendors, one pipeline, no router

How upstream works (1.129): vendor descriptor via
`deltaLanguageModelChatProviderDescriptors` THEN
`registerLanguageModelProvider(vendor, provider)` (order mandatory).
Provider = 3 methods: `provideLanguageModelChatInfo` (model list + metadata),
`sendChatRequest` (AsyncIterable of `text`/`tool_use`/`thinking`/`data`
parts), `provideTokenCount`. Picker groups by vendor; default via
`isDefaultForLocation` / `chat.defaultModel`. BYOK config: vendor
`configuration` schema → groups in `chatLanguageModels.json`, secrets in
`ISecretStorageService` (`chat.lm.secret.*`), injected back into
`provideLanguageModelChatInfo({ group, configuration })`. Auth/quota are NOT
coupled (Copilot chrome is separate); providers get `metadata.auth`,
`statusIcon`, `warningText`, pricing display fields only.

Decision:

- **Vendor `safeappeals-cloud`** ("SafeAppeals Cloud"): managed models,
  credits. Model list fetched from cloud API (new `/models` endpoint — makes
  server the single source of truth; deletes the 3-way drift between
  `defaults.ts`, `cloudModelMapping`, `litellm/config.yaml`). Metadata:
  pricing multiplier display, `statusIcon`+`warningText` on low credits,
  `metadata.auth` → existing `safeappeals-cloud` IAuthenticationService
  provider (ports as-is), `isDefaultForLocation` set when signed in.
- **Vendor `safeappeals-byok`** ("Your API Keys"): wraps the 17 provider SDK
  impls in `electron-main/llmMessage`. Local providers (ollama/vLLM/
  lmStudio) keep auto-detect listing.
- **`cloudLLMRouterService` is DELETED** — the model picker IS the router.
  Cloud-vs-BYOK becomes an explicit, visible model choice; no hidden
  fallback. (Old "smart fallback" ≈ cloud models default when signed in.)
- **Cloud becomes the 18th impl in `sendLLMMessage.impl.ts`** (electron-main)
  instead of a browser fetch: inherits streaming, abort, rate limiter; kills
  CORS problem (and the blog-branch `cloud-proxy` channel becomes moot).
- **Adapter**: one shared class maps IPC stream events
  (`onText`/`onFinalMessage`/`toolCall`) → upstream response parts, incl.
  native `tool_use` (no more ANTML-XML-in-text parsing for cloud).

**Server prerequisite (void-cloud API, before Phase 2 completes):**
`/llm/chat` upgraded to SSE streaming + native OpenAI `tool_calls`
passthrough (LiteLLM supports both already; the XML hack existed only for
Void's old XML agent loop), plus new `/models` endpoint (id, display name,
context window, credit multiplier). Non-streaming fallback kept for old
clients during transition.

Key-storage: Phase 2 reads keys from ported `voidSettingsService`
(encrypted, keys unchanged); Phase 6 migrates to upstream secret storage +
Manage Models UI and deletes most of the settings React UI.

### C.2 Tool-calling decision (settled Jul 17): native-only, core infra, loop stays ours

How upstream works (1.129): **core does NOT run the agentic loop.** Core
provides the tool registry (`IToolData`/`IToolImpl`,
`ILanguageModelToolsService.registerTool`/`invokeTool`), the entire
confirmation/approval system (per-tool/workspace/profile allowlists,
`chat.tools.global.autoApprove`, `chat.tools.edits.autoApprove`, request
`permissionLevel`), MCP tools auto-registered into the same registry, the
tool picker (→ `IChatAgentRequest.userSelectedTools`), and built-in tools
(`vscode_editFile_internal` → chat editing session, todos, fetch, subagent,
askQuestions, full terminal suite in `terminalContrib/chatAgentTools`). The
`IChatAgentImplementation.invoke` must: pass enabled tools to
`sendChatRequest`, react to `tool_use` parts by calling `invokeTool`, append
`tool_result` messages, repeat until done.

Void today (from `main`): 34 builtin tools; loop in
`chatThreadService._runChatAgent` (while-loop, 4 approval categories,
interrupt/re-entry on approval); HYBRID tool-call transport — native
adapters (anthropic/openai) for capable providers, ANTML-XML-in-prompt +
streaming XML parser (`extractGrammar` 460 + `xmlParserService` 558 +
`toolRouter` 95 + `parallelToolOptimizer` 425 LOC) for the rest.

Decisions:

1. **Drop the XML tool path entirely.** Native tool calling only. Providers
   whose models can't do native tools get `capabilities.toolCalling: false`
   (no agent mode for them) instead of an XML fallback. Deletes ~1,950 LOC
   of parser/router/optimizer plumbing.
2. **The native adapters survive but move**: their SDK-response → tool-call
   translation becomes part of each provider impl feeding `tool_use` parts
   (they are the provider's job now, not a router's).
3. **Generic tools are deleted, not ported**: read_file/ls_dir/dir_tree/
   search×3/lint, rewrite/edit/create/delete file, run_command + persistent
   terminal ×3 → upstream built-ins + terminal agent tools cover all of it.
4. **SafeAppeals-specific tools re-register as `IToolData`/`IToolImpl`**
   (~1,500 LOC of impls kept): RAG ×5, timeline ×6, `edit_document`
   (docx/xlsx structured ops), `web_search`/`multi_link_search` (Brave via
   channel).
5. **Approval system replaced**: 4 Void categories → upstream confirmation
   service + auto-approve settings; `edit_document` + terminal set
   `confirmationMessages` in `prepareToolInvocation`.
6. **Mode-based tool filtering** (research vs case_manager) → custom chat
   modes + tool picker `userSelectedTools`, not hardcoded lists.
7. **The agent loop is rewritten small** inside `safeappealsChatAgent.ts`:
   with parsing/approval/schema-injection gone it shrinks from ~1,000 LOC to
   a few hundred (send with tools → invokeTool on `tool_use` → append →
   repeat; emit `textEditGroup` progress for edits so chat editing renders).

Net payoff: ~5,500–6,500 LOC of custom tool plumbing deleted; kept surface =
domain tool impls + a small loop.

### C.3 Integration layer files

New `contrib/void/browser/integration/`:

| New file (indicative) | Registers | Backed by (kept, ported as-is) |
| --- | --- | --- |
| `safeappealsLMProviders.ts` | vendors `safeappeals-cloud` + `safeappeals-byok` (C.1) | `sendLLMMessageService` + `llmMessage/` channel + 17 SDK impls + new cloud impl; `modelCapabilities`, `refreshModelService`, `convertToLLMMessageService` |
| `safeappealsChatAgent.ts` | default dynamic agent, Panel + EditorInline; OWNS the agentic loop (C.2 #7) | `common/prompt` system prompts (minus XML tool sections); context assembly (ex-`contextGatheringService`) |
| `safeappealsCompletions.ts` | `InlineCompletionsProvider` (ghost text; NES later) | same LM pipeline (FIM prompts from old `autocompleteService`) |
| `safeappealsTools.ts` | LM tools: RAG search, case-profile lookup, doc extract, Brave web search, email query, timeline query | RAG/email/etc. services in contrib; `braveSearchChannel` |
| `safeappealsChatModes.ts` (optional) | custom chat modes (legal research / drafting) | `IChatModeService` |

Gotchas from the 1.129 contract: provider owns `identifier` strings
(`vendor:modelId`); fire `onDidChange` after model refresh; set
`capabilities.toolCalling: true` for agent mode; register vendor descriptor
before provider or registration throws.

`voidSCMService` (commit messages): keep service; re-point its action at
upstream git contrib UI; low priority.

## D. Disposition: PORT AS-IS into contrib/void (the product)

Browser/common/electron-main triads, with their channels (see G):

- Document pipeline: `documentViewers/`, `documentCreatorService`,
  `documentFileCreation.contribution`, `common/documentViewerService`,
  extractor/creator channels (pdf/docx/xlsx), `documentExportChannel`,
  `webpack.docx.config.cjs` (build input for DOCX viewer worker)
- RAG: `browser/rag`, `common/rag`, `electron-main/rag`, `RAGPathService`,
  `RAGMainService` (native deps: sqlite/embeddings — Phase 5 risk)
- Email: `emailDashboard/`, `emailViewers/`, `emailService/Thread/Draft`,
  `emailClassifier`, `electron-main/email` + `emailMainChannel`
- Case: `caseInfo/`, `common/caseProfileService`, `timeline/` (browser +
  common) + `timelineExportChannel` — name-collision note: upstream
  `contrib/timeline` = file history; keep Void IDs distinct
- Calendar: `calendar/` + calendar channel (Google sync)
- DocuSign: `docuSign/`, `common/docuSign`, `docuSignChannel`,
  `docusign-esign.d.ts`, `devAuthServer`
- Files: `fileOrganizer/` + `fileOrgContextService`, `fileConverter/` +
  `fileConverterChannel`, `browser/fileService`
- Audio: `audioRecorder/` (browser/common/electron-main) — evaluate vs
  upstream `speech`/`agentsVoice` AFTER migration; port first
- Cloud: `voidCloudService/AuthProvider/UrlHandler/Actions`,
  `common/voidCloudTypes`, `rateLimiter`, metrics
  (`metricsService/PollService/MainService`), update
  (`voidUpdateService/MainService`, `voidUpdateActions`)
- Settings: `voidSettingsService` + `voidSettingsPane` + `react/void-settings-tsx`
  — SLIM: keep provider API keys + cloud account; model-picker duties move to
  upstream `languageModelsConfiguration`
- Support plumbing: `voidModelService`, `directoryStrService`,
  `helperServices/`, `helpers/`, `storageKeys`, `actionIDs`,
  `extensionTransferService/Types`, `convertToLLMMessageWorkbenchContrib`,
  `miscWokrbenchContrib`, `_markerCheckService` (audit), `voidExtensionApi`
  (audit — external API surface)

React entries kept (rebuild via tsup, unchanged pipeline):
`file-organizer-tsx`, `case-info-dashboard-tsx`, `file-converter-tsx`,
`timeline-tsx`, `email-dashboard-tsx`, `audio-recorder-tsx`, viewers' UIs,
`void-settings-tsx` (slimmed). Deleted entries: `sidebar-tsx`, `diff`,
`quick-edit-tsx`, `void-tooltip`, `void-onboarding`, `void-editor-widgets-tsx`.

## E. Disposition: EXTENSIONS (copy into extensions/, already extension-shaped)

- ~50 `theme-safeappeals*` theme extensions + `theme-scripts` +
  `color-themes-product-json-entries.txt` (merge entries into new
  product.json)
- `time-tracker`
- `open-remote-ssh`, `open-remote-wsl` (verify against upstream 1.129 remote
  changes — may be obsolete or need updates)
- Extension build glue on main: `extensions/bun.lock`,
  `esbuild-webview-common.js`, `mangle-loader.js`,
  `shared.webpack.config.js` — reconcile with 1.129's extension build (do
  NOT blind-copy; upstream build moved on)

## F. Root-level / non-src assets

| Asset (main) | Disposition |
| --- | --- |
| `void-cloud/` (Next.js dashboard) | untouched separate app; keep out of vscode build; stays untracked or its own repo eventually |
| `python/`, `pyproject.toml`, `uv.lock` | RAG/audio backend tooling — port with RAG (verify usage first) |
| `resources/ffmpeg`, `resources/models` (whisper) | ship-with assets for audio — port with audioRecorder; wire into build packaging |
| `void_icons/`, icon CSS swaps | rebrand assets — Phase 1 (re-do the 6 CSS `// Void` icon edits) |
| `docs/`, `*.md` guides (VOID_CLOUD_*, PROJECT_MODIFICATIONS, etc.) | copy docs/ wholesale; root md files prune to relevant |
| `gulpfile.js` (main) vs `gulpfile.mjs` (1.129) | build system moved to ESM — REDO buildreact + packaging integration in new build files, don't copy old |
| `bun.lock`, package.json scripts | re-add `buildreact`/`watchreact` + fork deps to 1.129 package.json; regenerate lock |
| `.voidrules`, `.cursor/`, `.claude/`, `CLAUDE.md`, `tasks.md` | dev-tooling; copy as needed, untracked ok |
| `build/win32/tools/`, `.configurations`, `convert-key.cjs`, `test-sharp-electron.js` | audit individually during Phase 5 (packaging/native-module helpers) |

## G. app.ts channels — reduced set (was 20)

KEEP (~15): `llmMessage`, `rag`, `pdf-extractor`, `docx-extractor`,
`xlsx-extractor`, `docx-creator`, `file-converter`, `brave-search`,
`timeline-export`, `calendar`, `docusign`, `document-export`, `email`,
`audio-recorder`, `metrics`, `update`, `scm` (audit: metrics/update/scm may
slim later).

DROP: `mcp` (upstream), `browser-panel` (upstream), `chat-threads` (upstream
persistence; keep read-only access for Phase 6 import).

DEFER: `cloud-proxy`, `growth-writer` (exist only on
`feat-blog-writer-extension`; decide after that branch lands).

## H. Core-file edits outside contrib (old ~25 marked files — new verdicts)

RE-APPLY (still wanted):
- `workbench.common.main.ts` — the one import line
- `app.ts` — reduced channel block (G)
- `keybindingsRegistry.ts` — `VoidExtension = 605` weight
- `telemetryService.ts` — telemetry removal
- `encryptionMainService.ts` — Linux default provider
- `workbenchThemeService.ts` — default theme = SafeAppeals theme
- `auxiliaryBarPart.ts` + `layout.ts` — aux bar min width / default size
  (verify still sensible with native chat in panel)
- CSS icon swaps (6 files) + `product.ts` `release` field
- `editorGroupWatermark.ts` — watermark actions (update action IDs)
- `fileActions.contribution.ts` — settings entry hook (or retire if native
  settings suffice)
- `explorerViewer.ts` — file-organizer tree hook (verify against 1.129
  explorer changes)

OBSOLETE (do NOT re-apply):
- All chat-disable patches (`chatActions.ts`, `chatParticipant.contribution.ts`
  comment-outs, `workbench.common.main.ts` chat region edits) — we now USE
  upstream chat; suppression happens via product.json `defaultChatAgent`
- `smartSelect.ts`, `lineSelection.ts`, `editorOptions.ts` keybinding/setting
  tweaks — re-evaluate individually; default: drop, reintroduce on demand
- `workbench.contribution.ts` "Void Side Bar" localization strings — native
  chat lives in standard panels now

## I. Data / config migrations (Phase 6)

| Data | From | To |
| --- | --- | --- |
| Chat threads | `void-channel-chat-threads` store | `ChatSessionStore` import shim (one-time) |
| MCP servers | voidSettings JSON | `.mcp.json` (workspace) / user MCP config |
| Provider API keys | `voidSettingsService` encrypted blob | `ISecretStorageService` (`chat.lm.secret.*`) + `chatLanguageModels.json` groups via one-time importer; then delete key mgmt from settings React UI |
| Cloud model list | `defaults.ts` + `cloudModelMapping` (hardcoded) | cloud API `/models` endpoint (server = source of truth) |
| Cloud session/auth | `void.cloud.session` in IStorageService | unchanged (auth provider ports as-is); consider moving token to secret storage while at it |
| Browser sessions | `persist:void-browser-v2` | `persist:vscode-browser` (accept cookie loss) |
| Keybindings | Cmd+K quick edit | map to `inlineChat.start` in defaults |

## J. Phase order & gates

- **Phase 0** prep: wipe residual `contrib/void` from disk; commit checkpoint.
- **Phase 1** branding/build: product.json (branding + blank
  `defaultChatAgent` + theme entries), icons, themes/utility extensions,
  `buildreact` into ESM build, package.json deps. GATE: upstream-clean build
  still compiles + runs branded.
- **Phase 2** AI bolt-on: integration layer (C) + `llmMessage` channel only.
  Includes cloud-as-18th-impl + the void-cloud server upgrade (SSE streaming,
  native tool_calls, `/models`) — server work can start in parallel with
  Phase 1 since it's a separate deployable. GATE: native chat panel answers
  via BOTH vendors (cloud streaming + BYOK); inline chat works; ghost text
  appears; agent mode executes a native tool call end-to-end.
- **Phase 3** domain overlay (D): sub-feature at a time, compile-fix loop.
  GATE: each feature's views/editors open.
- **Phase 4** remaining channels (G) + H re-applies.
- **Phase 5** native/Electron: rebuild sqlite/whisper/sharp/WASM against new
  ABI; packaging; CI (`build-release.yml` vs upstream expectations). GATE:
  packaged build runs on Windows.
- **Phase 6** data migrations (I).
- **Phase 7** extension-ize viewers: PDF first (most standalone), then DOCX,
  XLSX; move extraction to ext host + `lm.registerTool` OR keep channels and
  bridge via commands (decide with PDF pilot).

## K. Risks

| Risk | Mitigation |
| --- | --- |
| Electron 34→~42 native ABI (sqlite, whisper, sharp, WASM loaders) | Phase 5 isolated; known-highest risk; budget accordingly |
| Upstream chat API churn (not yet `vscode.d.ts`-stable in-process) | all coupling confined to `integration/`; small surface |
| ESM build (`gulpfile.mjs`) vs old gulpfile.js glue | rewrite glue, don't port |
| Thread/MCP/config migration bugs | one-time importers with dry-run logging; keep old stores read-only |
| `open-remote-*` vs 1.129 remote stack | verify early in Phase 1; drop if upstream superseded |
| Cloud server upgrade (SSE + native tool_calls) breaks old 1.95 clients | keep non-streaming XML endpoint alive during transition; version via `X-Client-Version` |
| No upstream quota UI for credits | pricing display fields + `statusIcon`/`warningText` low-credit signal + dashboard for purchase; custom credit UI in contrib only if needed later |
| Dropping XML tool fallback removes agent mode for non-native-tool models (fork marked ollama/vLLM/lmStudio/deepseek/xAI as XML-only) | acceptable: chat still works (`toolCalling: false`); re-audit capability flags first — deepseek/xAI/ollama gained native tools since 1.95-era code was written |
| UX regressions (native chat vs Tailwind sidebar; Cmd+I vs Cmd+K) | accept + keybinding remap; revisit theming via chat CSS vars |
