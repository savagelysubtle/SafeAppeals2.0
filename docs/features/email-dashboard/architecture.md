# Email Dashboard Architecture

> **Historical Void-era architecture.** Shipping email lives in
> `extensions/safeappeals-email` (Service Connections, LM tools, dashboard Attach+Send;
> no agent send). See [README shipping note](./README.md) and
> [Agent LM Tools Pattern](../../agent-tools-pattern.md).

This document describes the technical architecture of the Email Dashboard feature.

## Table of Contents

- [Overview](#overview)
- [Process Model](#process-model)
- [Service Architecture](#service-architecture)
- [Database Design](#database-design)
- [IPC Communication](#ipc-communication)
- [UI Components](#ui-components)
- [File Structure](#file-structure)

---

## Overview

The Email Dashboard follows VSCode's split-process architecture, with React-based UI in the browser process and SQLite database operations in the Electron main process.

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Workspace-scoped database | Data isolation between projects |
| FTS5 for search | Fast full-text search without external dependencies |
| IPC channel pattern | Secure communication matching RAG service |
| shadcn-style React | Visual consistency with Timeline Dashboard |
| Webview for email viewing | Safe HTML rendering with sandboxing |

---

## Process Model

```
┌─────────────────────────────────────────────────────────────────┐
│                      BROWSER PROCESS                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  EmailService   │  │  EmailDraft     │  │  EmailViewer    │  │
│  │  (IPC Client)   │  │  Service        │  │  Editor         │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │            │
│  ┌────────┴────────────────────┴────────────────────┴─────────┐ │
│  │                    React Components                         │ │
│  │  EmailDashboard → EmailToolbar → EmailCard → EmailFilters   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└───────────────────────────────┬─────────────────────────────────┘
                                │ IPC Channel
                                │ (void-channel-email)
┌───────────────────────────────┴─────────────────────────────────┐
│                       MAIN PROCESS                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  EmailMain      │  │  EmailIndex     │  │  EmailMain      │  │
│  │  Channel        │  │  Service        │  │  Service        │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │            │
│           │                    ▼                    ▼            │
│           │           ┌─────────────┐      ┌─────────────┐      │
│           │           │   SQLite    │      │  mailparser │      │
│           │           │   + FTS5    │      │  pdfjs-dist │      │
│           │           └─────────────┘      └─────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Service Architecture

### Browser Process Services

#### IEmailService (common/emailService.ts)

Interface defining email operations available throughout the application.

```typescript
interface IEmailService {
  parseEmail(filePath: URI): Promise<Email>;
  getEmails(caseFolderPath?: URI): Promise<Email[]>;
  getEmailById(id: string): Promise<Email | null>;
  searchEmails(query: string, caseFolderPath?: URI): Promise<Email[]>;
  deleteEmail(emailId: string): Promise<void>;
  getStats(): Promise<EmailStats>;
  getWorkspaceId(): string;
  createReplyDocument(emailId: string, draftContent: string): Promise<URI>;
}
```

#### EmailService (browser/emailService.ts)

Browser-side implementation that acts as an IPC client.

**Responsibilities:**
- Compute stable workspace ID from folder path
- Serialize/deserialize IPC messages
- Convert date strings to Date objects
- Infer case folder path from file paths

**Workspace ID Computation:**
```typescript
private computeWorkspaceId(): string {
  const folderPath = folders[0].uri.fsPath;
  let hash = 0;
  for (let i = 0; i < folderPath.length; i++) {
    const char = folderPath.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0').substring(0, 16);
}
```

#### IEmailDraftService (browser/emailDraftService.ts)

Service for AI-assisted email draft generation.

**Responsibilities:**
- Query RAG service for relevant case documents
- Build LLM prompts with email context
- Generate draft content templates
- Create DOCX reply documents

### Main Process Services

#### EmailMainService (electron-main/email/emailMainService.ts)

Core email processing service running in Electron main process.

**Responsibilities:**
- Parse EML files using `mailparser`
- Extract text from PDF emails using `pdfjs-dist`
- Manage workspace-specific EmailIndexService instances
- Create DOCX draft replies using `docx` library

#### EmailIndexService (electron-main/email/emailIndexService.ts)

SQLite database manager for email storage and search.

**Responsibilities:**
- Initialize workspace-scoped database
- Create tables and FTS5 indexes
- CRUD operations for emails
- Full-text search execution

#### EmailMainChannel (electron-main/emailMainChannel.ts)

IPC channel implementation for browser-main communication.

**Supported Commands:**
| Command | Description |
|---------|-------------|
| `parseEmailFile` | Parse and store an email file |
| `getEmails` | Retrieve all emails (optionally filtered) |
| `getEmailById` | Get single email by ID |
| `searchEmails` | Full-text search |
| `deleteEmail` | Remove email from database |
| `getStats` | Get email statistics |
| `createReplyDocument` | Generate DOCX reply |

---

## Database Design

### Schema

```sql
CREATE TABLE emails (
  id TEXT PRIMARY KEY,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  cc TEXT,
  bcc TEXT,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT,
  date TEXT NOT NULL,
  case_folder_path TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK(file_type IN ('eml', 'pdf')),
  attachments_json TEXT,
  is_draft INTEGER NOT NULL DEFAULT 0,
  reply_to_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (reply_to_id) REFERENCES emails (id) ON DELETE SET NULL
);
```

### Indexes

```sql
CREATE INDEX idx_emails_case_folder ON emails(case_folder_path);
CREATE INDEX idx_emails_date ON emails(date);
CREATE INDEX idx_emails_from ON emails(from_email);
CREATE INDEX idx_emails_is_draft ON emails(is_draft);
CREATE INDEX idx_emails_reply_to ON emails(reply_to_id);
```

### FTS5 Virtual Table

```sql
CREATE VIRTUAL TABLE emails_fts USING fts5(
  id UNINDEXED,
  subject,
  body_text,
  from_email,
  content='emails',
  content_rowid='rowid'
);
```

### Auto-sync Triggers

```sql
-- Insert trigger
CREATE TRIGGER emails_ai AFTER INSERT ON emails BEGIN
  INSERT INTO emails_fts(rowid, id, subject, body_text, from_email)
  VALUES (new.rowid, new.id, new.subject, new.body_text, new.from_email);
END;

-- Delete trigger
CREATE TRIGGER emails_ad AFTER DELETE ON emails BEGIN
  DELETE FROM emails_fts WHERE rowid = old.rowid;
END;

-- Update trigger
CREATE TRIGGER emails_au AFTER UPDATE ON emails BEGIN
  UPDATE emails_fts SET subject = new.subject, body_text = new.body_text,
    from_email = new.from_email WHERE rowid = old.rowid;
END;
```

### Database Location

```
~/.safe-appeals-navigator/databases/workspaces/{workspaceId}/emails.db
```

Path is determined by `RAGPathService.getEmailSqlitePath(workspaceId)`.

---

## IPC Communication

### Channel Registration

In `app.ts` (Electron main entry):

```typescript
const emailMainService = new EmailMainService(logService, ragPathService);
const emailMainChannel = new EmailMainChannel(emailMainService);
mainProcessElectronServer.registerChannel('void-channel-email', emailMainChannel);
```

### Message Flow

```
Browser                          IPC                          Main
   │                              │                             │
   │  parseEmail(URI)             │                             │
   ├─────────────────────────────>│  {filePath, workspaceId}    │
   │                              ├────────────────────────────>│
   │                              │                             │
   │                              │     Parse EML/PDF           │
   │                              │     Store in SQLite         │
   │                              │                             │
   │                              │<────────────────────────────┤
   │<─────────────────────────────┤  Email (serialized)         │
   │                              │                             │
   │  Convert date string → Date  │                             │
   │                              │                             │
```

---

## UI Components

### Component Hierarchy

```
EmailDashboardPane (VSCode ViewPane)
└── EmailDashboard (React)
    ├── EmailToolbar
    │   ├── Search Input
    │   ├── Sort Dropdown
    │   ├── View Mode Toggle (List/Compact)
    │   └── Filter Toggle
    ├── EmailStats
    │   └── Count widgets (emails, drafts, cases, needs reply)
    ├── EmailFilters (collapsible)
    │   └── Case Folder Dropdown
    └── Email List
        └── EmailCard (per email)
            ├── Star Button
            ├── Reminder Button → ReminderPicker
            ├── Avatar (color-coded initials)
            ├── Content (from, subject, preview)
            ├── Category/Priority Badges
            ├── Draft Status Indicator
            ├── Actions (Draft, AI Reply, Open, Timeline, Delete)
            └── DraftEditor (expandable inline editor)
                ├── Toolbar (formatting buttons)
                ├── DraftStatusBadge (clickable status workflow)
                ├── Content Area (contenteditable div)
                └── DraftVersionHistory (slide-out panel)
                    ├── Version List
                    ├── Preview Pane
                    └── Restore Dialog
```

### Inline Editing Architecture

The inline editing system uses a contenteditable-based approach due to CSP restrictions:

```
┌─────────────────────────────────────────────────────────────────┐
│                    EmailCard Component                           │
├─────────────────────────────────────────────────────────────────┤
│  State: showDraftEditor, draftContent, draftStatus              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  DraftEditor (when expanded)                                 ││
│  │  ┌─────────────────────────────────────────────────────────┐││
│  │  │  Header: Status Badge + Save Indicator + History Btn    │││
│  │  ├─────────────────────────────────────────────────────────┤││
│  │  │  Toolbar: H1 H2 H3 | B I U | Lists                      │││
│  │  ├─────────────────────────────────────────────────────────┤││
│  │  │  Content: <div contenteditable>                         │││
│  │  │           Auto-saves on 2-second debounce               │││
│  │  └─────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  DraftVersionHistory (slide-out panel)                      ││
│  │  [Version List]  |  [Preview + Restore]                     ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Why Contenteditable Instead of Tiptap

The sidebar context runs with Trusted Types enabled, which blocks:
- `DOMParser.parseFromString()` 
- Dynamic HTML injection

Tiptap relies heavily on these APIs. The DOCX viewer can use Tiptap because it runs in a webview with relaxed CSP rules.

**Solution**: Use native `contenteditable` with `document.execCommand()` for formatting.

### Styling Constants

```typescript
// SafeAppeals brand colors (matching TimelineDashboard)
const BRAND_GREEN = '#22c55e';

// Background colors
const BG_PRIMARY = '#0a0a0a';
const BG_SECONDARY = '#111111';
const BG_TERTIARY = '#1a1a1a';

// Border colors
const BORDER_DEFAULT = '#27272a';
const BORDER_HOVER = BRAND_GREEN;

// Text colors
const TEXT_PRIMARY = '#fafafa';
const TEXT_SECONDARY = '#a1a1aa';
const TEXT_MUTED = '#71717a';
```

### View Registration

Registered in `emailDashboard.contribution.ts`:

```typescript
// Activity Bar container
viewContainerRegistry.registerViewContainer({
  id: EMAIL_DASHBOARD_VIEW_CONTAINER_ID,
  title: 'Email Dashboard',
  icon: Codicon.mail,
  order: 7
}, ViewContainerLocation.Sidebar);

// View pane
viewsRegistry.registerViews([{
  id: EMAIL_DASHBOARD_VIEW_ID,
  ctorDescriptor: new SyncDescriptor(EmailDashboardPane),
  canToggleVisibility: true,
  canMoveView: true
}], container);
```

---

## File Structure

```
src/vs/workbench/contrib/void/
├── common/
│   └── emailService.ts              # Email interface, types, DraftStatus
│
├── browser/
│   ├── emailService.ts              # Browser IPC client (emails)
│   ├── emailDraftService.ts         # Browser IPC client (drafts)
│   ├── emailThreadService.ts        # Thread grouping service
│   ├── emailClassifier.ts           # AI-powered email classification
│   │
│   ├── emailDashboard/
│   │   ├── emailDashboard.contribution.ts  # View registration
│   │   └── emailDashboardPane.ts           # ViewPane host
│   │
│   ├── emailViewers/
│   │   ├── emailViewer.contribution.ts     # Editor registration
│   │   ├── emailViewerEditor.ts            # EditorPane
│   │   ├── emailViewerInput.ts             # EditorInput
│   │   └── emailViewerInputSerializer.ts   # Serializer
│   │
│   └── react/src/email-dashboard-tsx/
│       ├── index.tsx                # React mount function
│       ├── EmailDashboard.tsx       # Main container component
│       ├── EmailCard.tsx            # Email card with inline editor
│       ├── EmailToolbar.tsx         # Search/sort/filter toolbar
│       ├── EmailFilters.tsx         # Collapsible filter panel
│       ├── EmailStats.tsx           # Statistics widget
│       ├── EmailThread.tsx          # Thread view component
│       │
│       ├── DraftEditor.tsx          # Inline rich text editor
│       ├── DraftEditor.css          # Editor styles
│       ├── DraftStatusBadge.tsx     # Status workflow badge
│       ├── DraftVersionHistory.tsx  # Version history panel
│       └── ReminderPicker.tsx       # Reminder date picker
│
└── electron-main/
    ├── emailMainChannel.ts          # IPC channel
    └── email/
        ├── emailMainService.ts      # Main email service
        └── emailIndexService.ts     # SQLite + FTS5 operations
```

---

## Next Steps

- [API Reference](./api-reference.md) — Detailed service methods
- [Developer Guide](./developer-guide.md) — Extending the system

