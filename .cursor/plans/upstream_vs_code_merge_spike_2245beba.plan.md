---
name: Upstream VS Code Merge Spike
overview:
  'Optional disposable spike. Feature research (Jul 2026) says full VS Code
  rebase is Worth it later — most 1.95→1.129 value is Copilot/Agents noise;
  Electron 34 EOL is the real urgency. Spike only if you want a hard effort
  number; otherwise prioritize cleanup + Electron security separately.'
todos:
  - id: add-vscode-remote
    content: Add microsoft/vscode remote; pick target tag for the spike
    status: pending
  - id: overlay-void-tree
    content:
      Branch from VS Code tag; overlay contrib/void, product.json, SafeAppeals
      themes
    status: pending
  - id: port-void-markers
    content: Re-apply ~25 Void-marked core files outside contrib/void
    status: pending
  - id: port-app-ts
    content:
      Manually port app.ts IPC channels + browser-session security exemptions
    status: pending
  - id: catalog-compile-errors
    content: Attempt compile; catalog API/Electron/build errors by category
    status: pending
  - id: write-feasibility-report
    content:
      Write docs/UPSTREAM_VSCODE_MERGE_FEASIBILITY.md with effort estimate and
      go/no-go
    status: pending
isProject: false
---

# Upstream VS Code Merge Spike

## Pre-research verdict (Jul 2026) — before running the spike

Latest stable: **VS Code 1.129** (Jul 15, 2026). Gap from **1.95.0** ≈ 34
releases / ~20 months. Electron jump is larger than earlier assumed: SafeAppeals
is on **34.3.2** (EOL since Jun 2025); latest Stable is on Electron **~42** /
Chromium **148**, not 39.

**Worth it later** for a full rebase: release notes since 1.95 are dominated by
Copilot/Agents, which SafeAppeals already replaced and disables. Genuine wins
(custom-editor diffs API, integrated browser polish, multi-window, extension
trust) are incremental vs overlay + ~117k LOC API churn cost.

**Electron security is worth it sooner** if separable from a full VS Code
rebase. Prefer cleanup plan first; treat this spike as optional confirmation of
effort, not a prerequisite to decide "features aren't the reason."

Sources: [VS Code updates](https://code.visualstudio.com/updates),
[v1_129](https://code.visualstudio.com/updates/v1_129),
[Electron EOL schedule](https://releases.electronjs.org/schedule).

## Goal

Investigation only: put a hard cost number on overlaying onto current Stable
(or an intermediate tag). Deliverable is a feasibility report — not a shippable
merged tree. Skip this spike if the pre-research verdict is enough to deprioritize.

## Day-1 decision gate

Stop after overlay + Void markers + `app.ts` port + **one compile pass**.
Classify errors (API drift / Electron / build). Write a one-page estimate. Only
continue deeper if numbers look better than expected.

## Ground rules

- Branch: `spike/upstream-vscode-merge` — disposable, **never merges** to `main`
  or `dev`.
- `main` stays untouched.
- Optional: docs-only PR of the feasibility report onto `dev`.
- Independent of Cleanup & Rust Consolidation; lower priority than that plan.

## Why overlay, not `git merge`

This repo is a **snapshot import** (213 SafeAppeals-only commits, no Microsoft
history). There is no meaningful merge-base with `microsoft/vscode`. Follow
Void's playbook: copy a fresh VS Code tree, then re-apply Void/SafeAppeals
patches (search case-sensitive `"Void"` markers).

## Prerequisites

- Add remote: `vscode` → `https://github.com/microsoft/vscode.git` (read-only
  fetch)
- Optionally add `void` → `voideditor/void` for reference only (Void is
  deprecated)
- Choose a target tag: latest `1.129.x` for max signal, or intermediate
  `1.110` / Electron-39-era if a smaller first jump is preferred

## Spike steps

1. **Create branch** from the chosen VS Code tag (fresh tree), not by merging
   into current `main`.
2. **Overlay** from current SafeAppeals `main`:
   - `src/vs/workbench/contrib/void/`
   - `product.json` (SafeAppeals branding)
   - SafeAppeals theme extensions under `extensions/theme-safeappeals*`
3. **Re-apply ~25 Void-marked core files** outside `contrib/void` (inventory
   from prior research), including:
   - [workbench.common.main.ts](src/vs/workbench/workbench.common.main.ts) —
     void contribution import
   - Layout / aux-bar / watermark / chat-disable / theme defaults / telemetry /
     keybinding priority
4. **Manually port** [app.ts](src/vs/code/electron-main/app.ts) — deepest pain
   point:
   - ~31 imports from `contrib/void`
   - ~22 `void-channel-*` IPC registrations
   - `persist:void-browser-v2` session exemptions for the embedded browser
5. **Attempt compile** (`bun install` / npm as needed against new Electron/Node
   pins, then compile). Catalog and categorize errors:
   - API drift inside `contrib/void`
   - Electron 34 → ~42 session/CSP/navigation breaks
   - Build system / native modules (sqlite, whisper, WASM, sharp)
   - CI (`build-release.yml`) vs upstream expectations
6. **Write feasibility report** to `docs/` (e.g.
   `docs/UPSTREAM_VSCODE_MERGE_FEASIBILITY.md`) covering:
   - Target tag and Electron/Node delta
   - Files ported vs still broken
   - Error categories with counts
   - Estimated effort (days/weeks) to a working build
   - Go / no-go / Electron-only path / wait recommendation

## Known difficulty (from prior assessment)

| Area                                       | Difficulty |
| ------------------------------------------ | ---------- |
| Branding, chat disable, menu hooks         | Low        |
| `workbench.common.main.ts`, layout, themes | Moderate   |
| `app.ts` IPC + browser security            | High       |
| Electron 34→~42 + build/native/CI          | High       |
| `contrib/void` API churn (~117k LOC)       | High       |

## Out of scope

- Merging the spike tree into `dev` or `main`
- Fixing every compile error to production quality (stop once the report is
  credible)
- Syncing Void upstream (project is deprecated; use only as patch reference)
