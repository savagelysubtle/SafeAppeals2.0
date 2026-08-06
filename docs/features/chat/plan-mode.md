# Plan Mode and CreatePlan Persistence

SafeAppeals Plan mode researches and writes a durable plan file before implementation. Plans are Cursor-shaped `*.plan.md` files under the **workspace** at `.safeAppeals/plans/`, not chat-only drafts.

**Extension:** `extensions/safeappeals-authentication`  
**Primary tools:** `safeappeals_createPlan` (`toolReferenceName`: `createPlan`), `safeappeals_switchMode` (`toolReferenceName`: `switchMode`), plus host `reviewPlan` / `askQuestions`

## Modes

| Mode | Role |
|------|------|
| **Plan** | Custom agent (`PlanAgentProvider`). Discovery, alignment, write/update plan, review — no general file edits. |
| **Agent** | Implements changes. `createPlan` is **not** force-ensured here. |

Switch with LM tool `safeappeals_switchMode` (`mode`: `"Plan"` \| `"Agent"`), or the chat UI mode control. Setting `safeappeals.chat.switchMode.enabled` (default `true`) gates the tool at invoke time.

## Plan agent workflow

The Plan custom agent prompt walks an iterative cycle (not strictly linear):

1. **Discovery** — concrete read/search tools (`textSearch`, `fileSearch`, `codebase`, `symbols`, `listDirectory`, `readFile`; optional web/fetch for external docs; terminal/test evidence when relevant). No memory tools or subagents.
2. **Alignment** — `#tool:vscode/askQuestions` for material decisions before writing a plan.
3. **CreatePlan** — `#tool:createPlan` / `safeappeals_createPlan` writes under `.safeAppeals/plans/`.
4. **reviewPlan** — after CreatePlan returns a file URI, call `#tool:reviewPlan` with separate fields:
   - `content` — markdown plan body (or summary)
   - `plan` — file URI from CreatePlan
   - plus required host fields (`actions`, `canProvideFeedback`)
5. **Wait / Start Implementation** — on approval, point the user to **Start Implementation** (handoff to Agent). Do not implement in Plan mode. Revisions loop CreatePlan → reviewPlan again.

Handoffs on the Plan agent config include **Start Implementation** and **Open in Editor** (open an existing `.safeAppeals/plans/*.plan.md`, not an untitled buffer).

Plan mode does **not** ship a full Cursor Plan Mermaid zoom editor. Plans are markdown files; Mermaid may appear in the body when useful.

## Plan files on disk

| Item | Value |
|------|--------|
| Directory | `{workspace}/.safeAppeals/plans/` |
| Filename | `{slug}_{8hex}.plan.md` (slug from plan name; hash is 8 hex chars) |
| Permissions | Directory created `0700`; writes use atomic tmp + rename with `0600` files (POSIX) |
| Requirement | An open workspace folder is required |

Writes refuse paths outside `.safeAppeals/plans/`. Updates via `planPath` must resolve to a `.plan.md` under that directory.

### Example frontmatter + body

```markdown
---
name: Index Core References
overview: "Wire folder watchers and index pipeline for core_references."
todos:
  - id: scaffold
    content: Add watcher registration
    status: pending
  - id: tests
    content: Cover index path
    status: pending
isProject: false
---

## Plan: Index Core References

TL;DR — one concrete approach…

**Steps**
1. …

**Relevant files**
- `extensions/safeappeals-rag/src/…` — …

**Verification**
1. …
```

Frontmatter fields (YAML between `---`):

| Field | Type | Notes |
|-------|------|--------|
| `name` | string | Required |
| `overview` | string | Required |
| `todos` | array of `{ id, content, status }` | `status`: `pending` \| `completed` \| `in_progress` \| `cancelled` (default `pending` on create) |
| `isProject` | boolean | Default `false` on create |

Serialization/parsing: `planMd.ts` (hand-rolled YAML, no external YAML dependency).

## Tool: `safeappeals_createPlan`

Registered via `contributes.languageModelTools` and `vscode.lm.registerTool` (`createPlanTool.ts`).

### Create

Required: `name`, `overview`, `plan` (markdown body).  
Optional: `todos`, `isProject`.

Creates a new file and remembers its URI for the chat session (sticky). Success text tells the model to call `reviewPlan` with that URI.

### Update

Target resolution order:

1. Explicit `planPath` (workspace-relative path, absolute path, or `file:` URI under `.safeAppeals/plans/`), or
2. Sticky URI from the last create/update in the **same** chat session (`chatSessionResource`).

Then either:

- Full body: `plan` (optional overrides for `name` / `overview` / `todos` / `isProject`), or
- Exact single-occurrence replace: both `oldStr` and `newStr` (not combined with a full `plan` body).

If a sticky URI exists, calling CreatePlan again with `name` + `overview` + `plan` **updates that same file** (does not orphan a second file). A new session without sticky/planPath creates a new file.

### Plan-only availability

`safeappeals_createPlan` is intentionally **absent** from `ENSURED_AGENT_TOOL_NAMES`. It is a Plan-mode surface (listed on the Plan agent tool allowlist as `createPlan`), not force-injected into Agent.

## Defense in depth (Plan + agent loop)

When `selectAgentTools` runs with `modeName` Plan, it strips `PLAN_MODE_EDIT_DENYLIST` after selection:

- `safeappeals_editFile`, `safeappeals_createFile`, `safeappeals_createDirectory`
- `safeappeals_replaceString`, `safeappeals_multiReplaceString`, `safeappeals_applyPatch`
- `vscode_editFile_internal`, `vscode_editFile`

The Plan agent prompt also forbids general edits; CreatePlan is the sole write path (plan files only).

## Workspace hygiene

Plan files can contain case strategy and client-adjacent detail. For legal/case workspaces, **recommend** adding to the workspace `.gitignore`:

```gitignore
.safeAppeals/plans/
```

SafeAppeals does **not** auto-gitignore this directory.

## Cached Plan agent markdown

`PlanAgentProvider` writes `Plan.agent.md` under the extension `globalStorageUri` (`plan-agent/` cache). After Plan-agent prompt or tool-list changes, a **Reload Window** may be needed if the host is still serving a stale cached agent definition.

## Source anchors

| Concern | Path |
|---------|------|
| Create/update tool | `extensions/safeappeals-authentication/src/chat/createPlanTool.ts` |
| Frontmatter serialize/parse | `extensions/safeappeals-authentication/src/chat/planMd.ts` |
| Paths / filenames | `extensions/safeappeals-authentication/src/chat/planPaths.ts` |
| Plan custom agent | `extensions/safeappeals-authentication/src/chat/planAgentProvider.ts` |
| Allowlist, ensure list, Plan denylist, `selectAgentTools` | `extensions/safeappeals-authentication/src/chat/toolAllowlist.ts` |
| Mode switch tool | `extensions/safeappeals-authentication/src/chat/switchModeTool.ts` |
| Registration | `extensions/safeappeals-authentication/src/chat/tools.ts`, `package.json` (`languageModelTools`) |

## Related docs

- [Chat Modes](./chat-modes.md) — historical Void-era mode matrix; see Plan/Agent note at top
- [Chat README](./README.md) — chat docs index
- [RAG tool contracts](../../rag/tool-contracts.md) — Private Search LM tools used from Agent (and searchable from Plan via read/search toolsets)
