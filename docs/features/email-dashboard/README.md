# Email Dashboard

> **Shipping extension (Aug 2026):** Live product email is
> [`extensions/safeappeals-email`](../../../extensions/safeappeals-email/) —
> IMAP/SMTP (Google XOAUTH2 + app-password), Service Connections for mail accounts,
> sidebar + dashboard, tags/case links, local drafts. Agent LM tools (14×
> `safeappeals_email_*`, including `createDraft` with workspace-bounded attachments)
> — **no agent send**; user sends from the dashboard (Attach + Send uses sealed
> draft-attachment store). Catalog: [Agent LM Tools Pattern](../../agent-tools-pattern.md).
>
> **This folder** documents the older Void-era import/FTS dashboard (`.eml`/PDF
> import, `void-channel-email`). Treat diagrams and paths below as historical
> reference unless confirmed against `safeappeals-email`.

A workspace-scoped email management system for SafeAppeals Navigator that enables users to import, view, search, and manage case-related correspondence with AI-assisted draft replies.

## Features

- **📥 Email Import** — Import `.eml` and `.pdf` email files from case directories
- **🔍 Full-Text Search** — FTS5-powered search across email subjects, bodies, and sender addresses
- **📁 Case Organization** — Emails automatically organized by case folder paths
- **🎨 Modern UI** — shadcn-style React interface with dark mode optimization
- **📝 Inline Draft Editing** — Compose and edit reply drafts directly within email cards
- **✏️ Rich Text Editor** — Format text with headings, bold, italic, and lists
- **📊 Draft Status Workflow** — Track drafts from creation to review to send-ready
- **🔄 Version History** — View and restore previous draft versions with one click
- **🤖 AI-Assisted Replies** — Generate contextual draft replies using RAG
- **💾 Workspace Isolation** — Each workspace maintains its own email database
- **📧 Custom Viewer** — Dedicated email viewer editor for `.eml` files
- **⭐ Email Organization** — Star emails, set reminders, add to timeline

## Quick Start

### Opening the Email Dashboard

**Keyboard Shortcut:** `Ctrl+Shift+E` (Cmd+Shift+E on macOS)

**Command Palette:** `SafeAppeals: Open Email Dashboard`

**Activity Bar:** Click the mail icon in the sidebar

### Importing Emails

1. Open the Email Dashboard
2. Click **Import Emails** button
3. Select `.eml` or `.pdf` files
4. Emails are automatically parsed, indexed, and organized

## Documentation

### For Developers

- [User Guide](./user-guide.md) — Detailed feature documentation
- [Architecture](./architecture.md) — Technical design and patterns
- [API Reference](./api-reference.md) — Service interfaces and methods
- [Developer Guide](./developer-guide.md) — Extending and customizing

### For End Users

- [Email Dashboard (User Docs)](../../dashboard/docs/email-dashboard.md) — Simplified user-friendly guide

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + Tailwind CSS (shadcn styling) |
| State | React hooks with service accessor pattern |
| Database | SQLite with FTS5 for full-text search |
| IPC | VSCode channel-based communication |
| Parsing | mailparser (EML), pdfjs-dist (PDF) |
| DOCX | docx library for draft replies |

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                        Browser Process                              │
├────────────────────────────────────────────────────────────────────┤
│  EmailDashboard (React)                                            │
│  ├── EmailToolbar (search, sort, filters)                          │
│  ├── EmailCard                                                      │
│  │   ├── DraftEditor (inline rich text editor)                     │
│  │   ├── DraftStatusBadge (workflow status)                        │
│  │   └── DraftVersionHistory (restore panel)                       │
│  └── EmailFilters                                                   │
├────────────────────────────────────────────────────────────────────┤
│  EmailService (IPC)  │  EmailDraftService (IPC)  │  EmailViewer    │
├────────────────────────────────────────────────────────────────────┤
│                    IPC (void-channel-email)                         │
├────────────────────────────────────────────────────────────────────┤
│                    Main Process (Electron)                          │
├────────────────────────────────────────────────────────────────────┤
│  EmailMainService  →  EmailIndexService  →  SQLite Database        │
│        ↓                     ↓                    ↓                 │
│  mailparser (EML)     FTS5 Search         email_drafts table       │
│  pdfjs-dist (PDF)     emails table        (versioned content)      │
└────────────────────────────────────────────────────────────────────┘
```

## Database Location

Emails are stored in a workspace-specific SQLite database:

```
~/.safe-appeals-navigator/databases/workspaces/{workspaceId}/emails.db
```

The `workspaceId` is a hash of the workspace folder path, ensuring complete data isolation between projects.

## Related Features

- **[Timeline Dashboard](../timeline-dashboard/)** — Visualize case events chronologically
- **[RAG Service](../rag/)** — AI-powered document retrieval for draft context
- **[Case Organizer](../case-organizer/)** — Case file management and organization

## License

Copyright 2025 Glass Devtools, Inc. Licensed under Apache 2.0.

