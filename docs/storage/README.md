# Storage & Database Locations

## Overview

SafeAppeals Navigator uses a **per-workspace micro database architecture**. Each workspace/project gets its own isolated set of SQLite databases. This ensures complete data isolation between cases/projects - critical for legal compliance.

> **No Global Storage**: All custom data is stored per-workspace. There is NO global fallback.

---

## ⚠️ CRITICAL: Development vs Production Paths

SafeAppeals uses **DIFFERENT paths** depending on how you run the app:

| Environment | How to Run | Our Databases Location |
|-------------|------------|------------------------|
| **Development** | `.\scripts\code.bat` | `%APPDATA%\code-oss-dev\User\.safe-appeals-navigator\` |
| **Production** | Installed app | `%APPDATA%\Void\User\.safe-appeals-navigator\` |

---

## Development Environment Paths (When Running `.\scripts\code.bat`)

### 🗂️ Two Separate Directories!

Development has **TWO** important directories that serve different purposes:

#### 1. VSCode Config Directory (Extensions, Settings)
```
C:\Users\[USER]\.vscode-oss-dev\
└── extensions\              ← Installed extensions only
```

#### 2. App Data Directory (OUR DATABASES, Electron Data)
```
C:\Users\[USER]\AppData\Roaming\code-oss-dev\
├── Cache\                   ← Electron cache
├── Code Cache\              ← V8 compiled JS cache
├── GPUCache\                ← GPU rendering cache
├── logs\                    ← Application logs
└── User\
    ├── globalStorage\       ← VSCode's global storage (state.vscdb)
    ├── workspaceStorage\    ← VSCode's per-workspace storage
    └── .safe-appeals-navigator\    ← ⭐ OUR CUSTOM DATABASES
        └── databases\
            └── workspaces\
                └── [workspaceHash]\
                    ├── workspace.db    ← RAG document metadata
                    ├── threads.db      ← Chat threads
                    ├── emails.db       ← Email data
                    └── chroma\
                        └── embeddings.db   ← Vector embeddings
```

### 📍 Full Path Example (Dev)

For workspace `d:\Steve\Documents\HumanRights` (hash: `2fb73011`):

```
C:\Users\Steve\AppData\Roaming\code-oss-dev\User\.safe-appeals-navigator\databases\workspaces\2fb73011\
├── workspace.db     (RAG metadata)
├── threads.db       (Chat threads)
├── emails.db        (Email data)
└── chroma\
    └── embeddings.db (Vector embeddings)
```

---

## Production Environment Paths (Installed App)

When running the installed SafeAppealsNavigator (or Void) application:

```
C:\Users\[USER]\AppData\Roaming\Void\
├── Cache\                   ← Electron cache
├── Code Cache\              ← V8 compiled JS cache
├── logs\                    ← Application logs
└── User\
    ├── globalStorage\       ← VSCode's global storage
    ├── workspaceStorage\    ← VSCode's per-workspace storage
    └── .safe-appeals-navigator\    ← ⭐ OUR CUSTOM DATABASES
        └── databases\
            └── workspaces\
                └── [workspaceHash]\
                    ├── workspace.db
                    ├── threads.db
                    ├── emails.db
                    └── chroma\
                        └── embeddings.db
```

### 📍 Full Path Example (Production)

For workspace `d:\Steve\Documents\HumanRights` (hash: `2fb73011`):

```
C:\Users\Steve\AppData\Roaming\Void\User\.safe-appeals-navigator\databases\workspaces\2fb73011\
├── workspace.db
├── threads.db
├── emails.db
└── chroma\
    └── embeddings.db
```

---

## Quick Comparison Table

| What | Development Path | Production Path |
|------|------------------|-----------------|
| **Extensions** | `%USERPROFILE%\.vscode-oss-dev\extensions\` | (integrated in app) |
| **App Data Root** | `%APPDATA%\code-oss-dev\` | `%APPDATA%\Void\` |
| **VSCode Global Storage** | `%APPDATA%\code-oss-dev\User\globalStorage\` | `%APPDATA%\Void\User\globalStorage\` |
| **Our Base Dir** | `%APPDATA%\code-oss-dev\User\.safe-appeals-navigator\` | `%APPDATA%\Void\User\.safe-appeals-navigator\` |
| **Workspace DBs** | `...\databases\workspaces\[hash]\` | `...\databases\workspaces\[hash]\` |

---

## Database Files Explained

Each workspace has these SQLite database files:

| File | Purpose | Service |
|------|---------|---------|
| `workspace.db` | RAG document metadata, chunks, document registry | `RAGService` |
| `threads.db` | Chat conversation threads, messages, history | `ChatThreadStorageService` |
| `emails.db` | Email data, attachments, metadata | `EmailService` |
| `chroma/embeddings.db` | Vector embeddings for semantic search | `ChromaDB` (via RAG) |

---

## Workspace Hash Computation

The `[workspaceHash]` is a stable identifier computed from the workspace folder path:

```typescript
// Algorithm (same in RAGService and ChatThreadService)
function computeWorkspaceId(folderPath: string): string {
    let hash = 0
    for (let i = 0; i < folderPath.length; i++) {
        hash = ((hash << 5) - hash) + folderPath.charCodeAt(i)
        hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0').substring(0, 16)
}
```

### Example Workspace Hashes

| Workspace Folder | Hash |
|------------------|------|
| `d:\Steve\Documents\HumanRights` | `2fb73011` |
| `D:\Coding\SafeAppeals2.0` | (different hash) |

---

## PowerShell Debug Commands

### Check Development Databases

```powershell
# List all workspace databases (Dev)
dir "$env:APPDATA\code-oss-dev\User\.safe-appeals-navigator\databases\workspaces\"

# List all .db files (Dev)
Get-ChildItem "$env:APPDATA\code-oss-dev\User\.safe-appeals-navigator" -Recurse -Filter "*.db"

# Check specific workspace (Dev) - replace hash with your workspace hash
dir "$env:APPDATA\code-oss-dev\User\.safe-appeals-navigator\databases\workspaces\2fb73011\"

# Query threads.db (Dev)
cd D:\Coding\SafeAppeals2.0
node -e "const Database = require('@vscode/sqlite3').Database; const db = new Database('C:/Users/Steve/AppData/Roaming/code-oss-dev/User/.safe-appeals-navigator/databases/workspaces/2fb73011/threads.db', (err) => { if(err) console.log('Error:', err); else { db.all('SELECT id, last_modified FROM threads', (err, rows) => { console.log('Threads:', rows); db.close(); }); } });"
```

### Check Production Databases

```powershell
# List all workspace databases (Production)
dir "$env:APPDATA\Void\User\.safe-appeals-navigator\databases\workspaces\"

# List all .db files (Production)
Get-ChildItem "$env:APPDATA\Void\User\.safe-appeals-navigator" -Recurse -Filter "*.db"
```

### Clean Development Databases (Fresh Start)

```powershell
# ⚠️ DANGER: Deletes ALL development databases!
Remove-Item "$env:APPDATA\code-oss-dev\User\.safe-appeals-navigator" -Recurse -Force
```

---

## How Paths Are Determined (Code)

The base path comes from `IEnvironmentService.userRoamingDataHome`:

```typescript
// In RAGPathService (src/vs/workbench/contrib/void/common/rag/ragPathService.ts)
export class RAGPathService implements IRAGPathService {
    private getBaseDir(): string {
        // userRoamingDataHome resolves to:
        // - Dev:  C:\Users\[USER]\AppData\Roaming\code-oss-dev\User
        // - Prod: C:\Users\[USER]\AppData\Roaming\Void\User
        const baseDir = join(this.environmentService.userRoamingDataHome.fsPath, '.safe-appeals-navigator')
        return baseDir
    }

    getChatThreadsSqlitePath(workspaceId: string): string {
        return join(this.getBaseDir(), 'databases', 'workspaces', workspaceId, 'threads.db')
    }

    getWorkspaceSqlitePath(workspaceId: string): string {
        return join(this.getBaseDir(), 'databases', 'workspaces', workspaceId, 'workspace.db')
    }

    getChromaPath(workspaceId: string): string {
        return join(this.getBaseDir(), 'databases', 'workspaces', workspaceId, 'chroma')
    }
}
```

---

## Related Documentation

- [Chat Thread Storage](../chat/per-workspace-storage.md) - Chat-specific storage details
- [RAG System](../ragSystem/README.md) - RAG database details
- [Email Dashboard](../email-dashboard/README.md) - Email database details

## Related Code Files

| File | Purpose |
|------|---------|
| `src/vs/workbench/contrib/void/common/rag/ragPathService.ts` | Path computation for all databases |
| `src/vs/workbench/contrib/void/electron-main/chat/chatThreadStorageService.ts` | Thread SQLite operations |
| `src/vs/workbench/contrib/void/browser/chat/chatThreadStorageService.ts` | Browser-side IPC proxy |
| `src/vs/workbench/contrib/void/electron-main/chat/chatThreadStorageChannel.ts` | IPC channel handler |

---

## Important Notes

1. **Development uses TWO directories** - Don't confuse `.vscode-oss-dev` (extensions) with `AppData\code-oss-dev` (databases)
2. **No global storage** - All data is per-workspace only
3. **Workspace hash is stable** - Same folder always produces same hash
4. **URI revival required** - Thread data contains URI objects that need special JSON parsing
5. **IPC required** - Browser process communicates with main process for SQLite access
