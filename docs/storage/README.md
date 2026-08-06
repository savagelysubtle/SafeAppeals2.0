# Storage & Database Locations

## Overview

SafeAppeals Navigator keeps matter data isolated per workspace/profile. Electron
**user-data** paths differ for development vs an installed build.

> Prefer extension `globalStorageUri` / `storageUri` for new stores. Case-local
> product config lives under **`.safeAppeals/`** in the workspace (settings,
> skills, agents, plans, timeline) — not `.vscode/` for new SafeAppeals case
> config.

---

## CRITICAL: Development vs Production User-Data Paths

| Environment | How to run | Electron user-data product folder |
|-------------|------------|-----------------------------------|
| **Development** | `VSCODE_DEV` set (e.g. `./scripts/code.sh`) | `safe-appeals-dev` |
| **Production** | Installed Safe Appeals | `product.nameShort` → **Safe Appeals** (`applicationName` / `dataFolderName`: `safe-appeals-navigator` / `.safe-appeals-navigator`) |

Dev override is hard-coded in `src/vs/platform/environment/node/userDataPath.ts`
when `VSCODE_DEV` is set (`productName = 'safe-appeals-dev'`). It is **not**
`code-oss-dev` / `.vscode-oss-dev`, and production is **not** `%APPDATA%\Void\`.

### Platform examples (development)

| Platform | User-data root |
|----------|----------------|
| Linux | `~/.config/safe-appeals-dev` |
| Windows | `%APPDATA%\safe-appeals-dev` |
| macOS | `~/Library/Application Support/safe-appeals-dev` |

Inside that tree, VS Code / Electron layout is the usual `User/`,
`User/globalStorage/`, `User/workspaceStorage/`, logs, caches, etc.

### Platform examples (production)

| Platform | User-data root (from `product.nameShort`) |
|----------|-------------------------------------------|
| Linux | `~/.config/Safe Appeals` (or equivalent under `XDG_CONFIG_HOME`) |
| Windows | `%APPDATA%\Safe Appeals` |
| macOS | `~/Library/Application Support/Safe Appeals` |

Product identity (`product.json`): `applicationName` =
`safe-appeals-navigator`, `dataFolderName` = `.safe-appeals-navigator`.

---

## Private Search (current RAG)

Private Search (`extensions/safeappeals-rag`) stores indexes under the
extension's `globalStorageUri`:

```
<extension-globalStorage>/rag/<workspaceId>/
```

(see `RagCoreHost.storageRoot` in `extensions/safeappeals-rag/src/ragCoreHost.ts`).
Sealed markdown caches use `…/rag/<workspaceId>/sealed_md/`.

Left status bar label: `$(search) Private Search`. Shared workspace folder for
references: `core_references/`.

---

## Case workspace paths (on disk in the matter folder)

| Path | Purpose |
|------|---------|
| `.safeAppeals/settings.json` | Case / folder Chat settings (not `.vscode/` for new SafeAppeals case config) |
| `.safeAppeals/skills/` | Case-local agent skills |
| `.safeAppeals/agents/` | Case-local custom agents |
| `.safeAppeals/plans/` | Product CreatePlan files |
| `.safeAppeals/timeline.json` | Case timeline store |
| `core_references/` | Shared statutes / policy excerpts for Private Search |
| `medical_reports/`, `correspondence/`, `decisions_and_orders/`, `evidence/`, `personal_notes/`, `to_sort/` | Standard case folders (snake_case) |

---

## Historical Void-era layout (do not treat as current)

Older Void contrib docs described per-workspace SQLite trees such as
`User/.safe-appeals-navigator/databases/workspaces/[hash]/{workspace,threads,emails}.db`
and `chroma/embeddings.db` under **`code-oss-dev`** / **`Void`**. That stack is
retired for Private Search. Chat / email extensions may still use their own
encrypted or SQLite stores under extension global/workspace storage — inspect the
owning extension rather than assuming the Void `RAGPathService` paths.

---

## Related Documentation

- [Private Search tool contracts](../rag/tool-contracts.md)
- [Timeline configuration](../features/timeline/configuration-guide.md)
- [Chat per-workspace storage notes](../features/chat/per-workspace-storage.md) (may still mention legacy path names)

## Related Code Files

| File | Purpose |
|------|---------|
| `src/vs/platform/environment/node/userDataPath.ts` | `VSCODE_DEV` → `safe-appeals-dev` |
| `src/main.ts` | Passes `product.nameShort` into `getUserDataPath` |
| `product.json` | `applicationName`, `dataFolderName`, `nameShort` |
| `extensions/safeappeals-rag/src/ragCoreHost.ts` | Private Search storage root |
| `extensions/safeappeals-timeline/src/timelineStore.ts` | `.safeAppeals/timeline.json` |
| `extensions/safeappeals-authentication/src/chat/planPaths.ts` | `.safeAppeals/plans/` |

---

## Important Notes

1. **Dev product folder is `safe-appeals-dev`** — not `code-oss-dev` / `.vscode-oss-dev`
2. **Production is Safe Appeals / `safe-appeals-navigator`** — not Void
3. **Case config brand path is `.safeAppeals/`** in the workspace
4. Prefer managed extension storage URIs for new encrypted stores
