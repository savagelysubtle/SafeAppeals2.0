# Email Dashboard Developer Guide

This guide covers how to extend, customize, and contribute to the Email Dashboard feature.

## Table of Contents

- [Development Setup](#development-setup)
- [Building the React Components](#building-the-react-components)
- [Inline Draft Editing System](#inline-draft-editing-system)
- [Draft Service Architecture](#draft-service-architecture)
- [Adding New Features](#adding-new-features)
- [Extending the Email Parser](#extending-the-email-parser)
- [Customizing the UI](#customizing-the-ui)
- [Testing](#testing)
- [Common Patterns](#common-patterns)

---

## Development Setup

### Prerequisites

- Node.js 18+
- Bun package manager
- SQLite3 development headers

### Initial Setup

```bash
# Install dependencies
bun install

# Fetch Electron prebuilts
node build/lib/preLaunch.js

# Build React components
bun run buildreact
```

### Development Workflow

```bash
# Terminal 1: Watch TypeScript
bun run watch-clientd

# Terminal 2: Watch React components
bun run watchreact

# Terminal 3: Launch application
./scripts/code.bat  # Windows
./scripts/code.sh   # macOS/Linux
```

### After Making Changes

1. **TypeScript changes:** Automatically rebuilt by watch
2. **React changes:** Automatically rebuilt by watchreact
3. **Reload window:** `Ctrl+Shift+P` → "Developer: Reload Window"

---

## Building the React Components

### Entry Point

React components are bundled using `tsup` from:

```
src/vs/workbench/contrib/void/browser/react/src/email-dashboard-tsx/index.tsx
```

### Build Configuration

Located in `src/vs/workbench/contrib/void/browser/react/tsup.config.js`:

```javascript
export default defineConfig({
  entry: [
    // ... other entries
    './src/email-dashboard-tsx/index.tsx',
  ],
  // ...
})
```

### Mount Function

The entry point exports a mount function for VSCode integration:

```typescript
// index.tsx
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation';
import { EmailDashboard } from './EmailDashboard';

export function mountEmailDashboard(
  container: HTMLElement,
  accessor: ServicesAccessor
): { dispose: () => void } {
  const root = createRoot(container);
  root.render(
    <AccessorProvider value={accessor}>
      <EmailDashboard />
    </AccessorProvider>
  );
  return { dispose: () => root.unmount() };
}
```

---

## Inline Draft Editing System

The inline draft editing feature allows users to compose and edit email reply drafts directly within the email card UI.

### Component Architecture

```
EmailCard.tsx
├── DraftEditor.tsx          # Main inline editor component
│   ├── DraftStatusBadge.tsx # Status workflow badge
│   └── DraftVersionHistory.tsx # Version history panel
└── (integration via showDraftEditor state)
```

### DraftEditor Component

The `DraftEditor` component (`DraftEditor.tsx`) provides a rich text editing experience using a `contenteditable` div.

**Why not Tiptap?** The sidebar context has Trusted Types enabled which blocks Tiptap's `DOMParser.parseFromString` calls. The DOCX viewer uses Tiptap because it runs in a webview with different CSP rules.

#### Props Interface

```typescript
interface DraftEditorProps {
  emailId: string;         // Parent email ID
  initialContent?: string; // HTML content to load
  onSave?: (content: string) => void;  // Save callback
  onClose?: () => void;    // Close callback
}
```

#### Key Features

| Feature | Implementation |
|---------|----------------|
| Auto-save | 2-second debounce on content changes |
| Formatting | `document.execCommand()` for bold, italic, lists, etc. |
| Version history | Integration with `IEmailDraftService.getDraftVersions()` |
| Status workflow | Status badge with dropdown for Draft → Reviewed → Ready |

#### Toolbar Implementation

Formatting uses `document.execCommand()` which works with contenteditable:

```typescript
const toggleBold = () => {
  editorContainerRef.current?.focus();
  document.execCommand('bold');
};

const setHeading = (level: 1 | 2 | 3 | 4) => {
  editorContainerRef.current?.focus();
  document.execCommand('formatBlock', false, `h${level}`);
};
```

#### Content Serialization

Content is converted between HTML (storage) and plain text (display) due to CSP restrictions:

```typescript
// HTML to plain text for display
const htmlToText = (html: string): string => {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
};

// Plain text to HTML for storage
const content = rawContent
  .split('\n\n')
  .filter(p => p.trim())
  .map(p => `<p>${p.trim()}</p>`)
  .join('\n');
```

### DraftStatusBadge Component

The `DraftStatusBadge` component provides a visual indicator and dropdown for managing draft workflow status.

#### Status Configuration

```typescript
const STATUS_CONFIGS: Record<DraftStatus, StatusConfig> = {
  'draft': {
    icon: '✏️',
    label: 'Draft',
    bgColor: 'var(--vscode-button-secondaryBackground)',
    textColor: 'var(--vscode-descriptionForeground)',
    borderColor: 'var(--vscode-panel-border)',
  },
  'reviewed': {
    icon: '👀',
    label: 'Reviewed',
    bgColor: 'var(--vscode-inputValidation-infoBackground)',
    textColor: 'var(--vscode-charts-blue)',
    borderColor: 'var(--vscode-inputValidation-infoBorder)',
  },
  'ready': {
    icon: '✅',
    label: 'Ready to Send',
    bgColor: 'var(--vscode-testing-iconPassed)',
    textColor: 'var(--vscode-charts-green)',
    borderColor: 'var(--vscode-charts-green)',
  },
  'sent': {
    icon: '📤',
    label: 'Sent',
    // ... (disabled in UI - future feature)
  },
};
```

### DraftVersionHistory Component

The version history panel displays all saved versions with preview and restore functionality.

#### Features

- **Split panel UI**: Version list on left, preview on right
- **Timestamp formatting**: Relative times (e.g., "5 minutes ago", "Yesterday 2:45 PM")
- **Restore confirmation**: Modal dialog before restoring
- **Current version indicator**: Badge for the latest version

#### Restore Flow

```typescript
const handleRestoreVersion = useCallback((content: string) => {
  // Set content as plain text in the editor
  if (editorContainerRef.current) {
    editorContainerRef.current.innerText = htmlToText(content);
  }
  
  // Mark as unsaved and trigger auto-save
  setHasUnsavedChanges(true);
  handleContentChange();
  
  // Close history panel
  setShowVersionHistory(false);
}, [handleContentChange]);
```

---

## Draft Service Architecture

### IEmailDraftService Interface

```typescript
// common/emailService.ts
export interface IEmailDraftService {
  readonly _serviceBrand: undefined;
  
  saveDraft(emailId: string, content: string): Promise<EmailDraft>;
  getDraft(emailId: string): Promise<EmailDraft | null>;
  getDraftVersions(emailId: string): Promise<EmailDraft[]>;
  updateDraftStatus(draftId: string, status: DraftStatus): Promise<void>;
}

export type DraftStatus = 'draft' | 'reviewed' | 'ready' | 'sent';

export interface EmailDraft {
  id: string;
  emailId: string;
  content: string;
  version: number;
  status: DraftStatus;
  createdAt: Date;
  updatedAt: Date;
}
```

### Browser Service (emailDraftService.ts)

The browser-side service acts as an IPC client:

```typescript
export class EmailDraftService implements IEmailDraftService {
  private readonly channel: IChannel;
  private readonly workspaceId: string;

  constructor(
    @IMainProcessService mainProcessService: IMainProcessService,
    @IWorkspaceContextService workspaceContextService: IWorkspaceContextService
  ) {
    this.channel = mainProcessService.getChannel('void-channel-email');
    this.workspaceId = this.computeWorkspaceId();
  }

  async saveDraft(emailId: string, content: string): Promise<EmailDraft> {
    const result = await this.channel.call<EmailDraftWithStringDates>('saveDraft', {
      workspaceId: this.workspaceId,
      emailId,
      content
    });
    return convertDraftDates(result);
  }
  
  // ... other methods
}
```

### Database Schema (Drafts Table)

```sql
CREATE TABLE email_drafts (
  id TEXT PRIMARY KEY,
  email_id TEXT NOT NULL,
  content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' 
    CHECK(status IN ('draft', 'reviewed', 'ready', 'sent')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (email_id) REFERENCES emails (id) ON DELETE CASCADE
);

CREATE INDEX idx_drafts_email_id ON email_drafts(email_id);
CREATE INDEX idx_drafts_version ON email_drafts(email_id, version DESC);
```

### Version Management

Each save creates a new version:

```typescript
async saveDraft(emailId: string, content: string): Promise<EmailDraft> {
  // Get current max version
  const maxVersion = await this.db.get(
    'SELECT MAX(version) as max_ver FROM email_drafts WHERE email_id = ?',
    [emailId]
  );
  
  const newVersion = (maxVersion?.max_ver || 0) + 1;
  
  const draft: EmailDraft = {
    id: generateId(),
    emailId,
    content,
    version: newVersion,
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  await this.db.run(
    `INSERT INTO email_drafts (id, email_id, content, version, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [draft.id, draft.emailId, draft.content, draft.version, draft.status,
     draft.createdAt.toISOString(), draft.updatedAt.toISOString()]
  );
  
  return draft;
}
```

---

## Adding New Features

### Adding a New Service Method

#### 1. Define in Interface (common/emailService.ts)

```typescript
export interface IEmailService {
  // ... existing methods

  /**
   * Mark an email as important
   */
  markAsImportant(emailId: string, important: boolean): Promise<void>;
}
```

#### 2. Implement in Main Service (electron-main/email/emailMainService.ts)

```typescript
async markAsImportant(emailId: string, important: boolean): Promise<void> {
  const indexService = await this.workspaceManager.getOrCreateWorkspace(workspaceId);
  await indexService.updateImportantFlag(emailId, important);
}
```

#### 3. Add Database Column (electron-main/email/emailIndexService.ts)

```sql
ALTER TABLE emails ADD COLUMN is_important INTEGER NOT NULL DEFAULT 0;
```

#### 4. Add IPC Command (electron-main/emailMainChannel.ts)

```typescript
case 'markAsImportant': {
  const { emailId, important, workspaceId } = args;
  return this.service.markAsImportant(emailId, important, workspaceId);
}
```

#### 5. Implement Browser Client (browser/emailService.ts)

```typescript
async markAsImportant(emailId: string, important: boolean): Promise<void> {
  await this.channel.call('markAsImportant', {
    workspaceId: this.workspaceId,
    emailId,
    important
  });
}
```

### Adding a New React Component

#### 1. Create Component File

```typescript
// src/email-dashboard-tsx/EmailImportantBadge.tsx
import React from 'react';

const BRAND_GREEN = '#22c55e';

interface Props {
  isImportant: boolean;
  onToggle: () => void;
}

export const EmailImportantBadge: React.FC<Props> = ({ isImportant, onToggle }) => {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      style={{
        color: isImportant ? '#f59e0b' : '#71717a'
      }}
    >
      <i className={`codicon codicon-${isImportant ? 'star-full' : 'star-empty'}`} />
    </button>
  );
};
```

#### 2. Import in Parent Component

```typescript
// EmailCard.tsx
import { EmailImportantBadge } from './EmailImportantBadge';

// In render:
<EmailImportantBadge
  isImportant={email.isImportant}
  onToggle={() => handleToggleImportant(email.id)}
/>
```

---

## Extending the Email Parser

### Adding a New File Type

To add support for a new email format (e.g., `.msg` Outlook files):

#### 1. Install Parser Library

```bash
bun add @pnp/graph  # or appropriate library
```

#### 2. Add Parser Method

```typescript
// electron-main/email/emailMainService.ts

async parseMsgFile(filePath: string, caseFolderPath: string, workspaceId: string): Promise<Email> {
  this.logService.info(`Email: Parsing MSG file: ${filePath}`);

  // Parse MSG file
  const msgParser = require('msg-parser');
  const parsed = await msgParser.parse(filePath);

  const indexService = await this.workspaceManager.getOrCreateWorkspace(workspaceId);
  const emailId = indexService.generateEmailId(filePath);

  const email: Email = {
    id: emailId,
    from: parsed.senderEmail,
    to: parsed.recipients.join(', '),
    subject: parsed.subject,
    bodyText: parsed.body,
    date: parsed.sentDate,
    caseFolderPath,
    filePath,
    fileType: 'msg' as any,  // Add to type
    attachments: parsed.attachments.map(a => ({
      filename: a.name,
      contentType: a.mimeType,
      size: a.size
    }))
  };

  await indexService.storeEmail(email);
  return email;
}
```

#### 3. Update File Type Check

```typescript
async parseEmailFile(filePath: URI, caseFolderPath: string, workspaceId: string): Promise<Email> {
  const ext = path.extname(filePath.fsPath).toLowerCase();

  switch (ext) {
    case '.eml':
      return this.parseEmlFile(filePath.fsPath, caseFolderPath, workspaceId);
    case '.pdf':
      return this.parsePdfEmail(filePath.fsPath, caseFolderPath, workspaceId);
    case '.msg':
      return this.parseMsgFile(filePath.fsPath, caseFolderPath, workspaceId);
    default:
      throw new Error(`Unsupported email file type: ${ext}`);
  }
}
```

#### 4. Update File Dialog Filter

```typescript
// EmailDashboard.tsx
const result = await fileDialogService.showOpenDialog({
  filters: [
    { name: 'Email Files', extensions: ['eml', 'pdf', 'msg'] },
    // ...
  ]
});
```

---

## Customizing the UI

### Color Theme

All components use these brand constants:

```typescript
// SafeAppeals brand colors
const BRAND_GREEN = '#22c55e';

// Background hierarchy
const BG_PRIMARY = '#0a0a0a';    // Main background
const BG_SECONDARY = '#111111';  // Cards, panels
const BG_TERTIARY = '#1a1a1a';   // Hover states

// Borders
const BORDER_DEFAULT = '#27272a';
const BORDER_HOVER = BRAND_GREEN;

// Text
const TEXT_PRIMARY = '#fafafa';
const TEXT_SECONDARY = '#a1a1aa';
const TEXT_MUTED = '#71717a';
```

### Adding Custom CSS

Tailwind classes are available. Use inline styles for dynamic values:

```tsx
<div
  className="rounded-xl p-4 transition-all"
  style={{
    backgroundColor: isHovered ? BG_TERTIARY : BG_SECONDARY,
    border: `1px solid ${isHovered ? BRAND_GREEN : BORDER_DEFAULT}`
  }}
>
```

### Component Patterns

Follow the existing shadcn-style patterns:

```tsx
// Button pattern
<button
  className="px-4 py-2 rounded-lg font-semibold transition-all duration-200"
  style={{
    backgroundColor: variant === 'primary' ? BRAND_GREEN : BG_TERTIARY,
    color: variant === 'primary' ? BG_PRIMARY : TEXT_SECONDARY,
    border: `1px solid ${variant === 'primary' ? BRAND_GREEN : BORDER_DEFAULT}`
  }}
>
  {children}
</button>

// Card pattern
<div
  className="rounded-xl transition-all duration-200 cursor-pointer group"
  style={{
    backgroundColor: BG_SECONDARY,
    border: `1px solid ${isHovered ? BRAND_GREEN : BORDER_DEFAULT}`,
    boxShadow: isHovered ? `0 4px 12px ${BRAND_GREEN}10` : 'none'
  }}
>
```

---

## Testing

### Manual Testing

1. **Import emails:** Test with various `.eml` and `.pdf` files
2. **Search:** Verify FTS5 search works correctly
3. **Filtering:** Test case folder filtering
4. **Delete:** Verify two-click confirmation
5. **Viewer:** Open emails in the custom editor

### Adding Unit Tests

Create test files in the same directory:

```typescript
// emailService.test.ts
import { EmailService } from './emailService';

describe('EmailService', () => {
  it('computes workspace ID consistently', () => {
    // Test implementation
  });

  it('infers case folder path correctly', () => {
    // Test path inference logic
  });
});
```

### Running Tests

```bash
bun run test-node
```

---

## Common Patterns

### Service Injection

```typescript
// In VSCode service
constructor(
  @IEmailService private readonly emailService: IEmailService,
  @ILogService private readonly logService: ILogService
) {}
```

### React Service Access

```typescript
// In React component
const accessor = useAccessor();

useEffect(() => {
  const loadData = async () => {
    const emailService = accessor.get('IEmailService');
    const emails = await emailService.getEmails();
  };
  loadData();
}, []);  // Empty deps - accessor is stable
```

### IPC Call Pattern

```typescript
// Browser → Main
const result = await this.channel.call<ReturnType>('commandName', {
  workspaceId: this.workspaceId,
  // ... other params
});

// Main handler
case 'commandName': {
  const { workspaceId, ...params } = args;
  return this.service.methodName(workspaceId, params);
}
```

### Date Serialization

Dates are serialized as ISO strings over IPC:

```typescript
// Send
{ date: email.date.toISOString() }

// Receive
{ ...result, date: new Date(result.date) }
```

### Error Handling

```typescript
try {
  const email = await emailService.parseEmail(uri);
} catch (error) {
  this.logService.error('[EmailDashboard]', error);
  // Show user-friendly message
}
```

---

## File Reference

### Core Services

| File | Purpose |
|------|---------|
| `common/emailService.ts` | Interface definitions, types, DraftStatus enum |
| `browser/emailService.ts` | Browser IPC client for email operations |
| `browser/emailDraftService.ts` | Browser IPC client for draft CRUD & versioning |
| `electron-main/email/emailMainService.ts` | Main process email parsing & storage |
| `electron-main/email/emailIndexService.ts` | SQLite database operations |
| `electron-main/emailMainChannel.ts` | IPC channel handler |

### View Registration

| File | Purpose |
|------|---------|
| `browser/emailDashboard/emailDashboard.contribution.ts` | View container & command registration |
| `browser/emailDashboard/emailDashboardPane.ts` | ViewPane that hosts React component |
| `browser/emailViewers/emailViewer.contribution.ts` | Email viewer editor registration |
| `browser/emailViewers/emailViewerEditor.ts` | Full email viewer EditorPane |

### React Components

| File | Purpose |
|------|---------|
| `react/src/email-dashboard-tsx/index.tsx` | Mount function & entry point |
| `react/src/email-dashboard-tsx/EmailDashboard.tsx` | Main dashboard container |
| `react/src/email-dashboard-tsx/EmailCard.tsx` | Email card with inline editor integration |
| `react/src/email-dashboard-tsx/EmailToolbar.tsx` | Search, sort, filter toolbar |
| `react/src/email-dashboard-tsx/EmailFilters.tsx` | Collapsible filter panel |
| `react/src/email-dashboard-tsx/EmailStats.tsx` | Statistics widget |
| `react/src/email-dashboard-tsx/EmailThread.tsx` | Thread grouping view |

### Inline Editing Components

| File | Purpose |
|------|---------|
| `react/src/email-dashboard-tsx/DraftEditor.tsx` | Contenteditable rich text editor |
| `react/src/email-dashboard-tsx/DraftEditor.css` | Editor styling |
| `react/src/email-dashboard-tsx/DraftStatusBadge.tsx` | Status workflow dropdown badge |
| `react/src/email-dashboard-tsx/DraftVersionHistory.tsx` | Version history panel with restore |
| `react/src/email-dashboard-tsx/ReminderPicker.tsx` | Email reminder date picker |

---

## Contributing

1. Create a feature branch
2. Make changes following existing patterns
3. Test manually
4. Update documentation if needed
5. Submit pull request

### Code Style

- Use existing naming conventions (`bOfA` for mappings)
- Don't cast to `any` — find the correct type
- Keep changes minimal and focused
- Follow semicolon convention of each file

