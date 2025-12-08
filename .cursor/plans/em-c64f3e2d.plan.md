---
name: Email Dashboard with RAG-Powered Drafting & Editor Integration
overview: ""
todos:
  - id: a4f721dd-78d3-44db-ac1c-c73171286c65
    content: Test with sample .eml files, verify parsing, inbox display, and RAG-powered drafting
    status: pending
---

# Email Dashboard with RAG-Powered Drafting & Editor Integration

## Architecture Overview

Three-part system following existing Void patterns:

1. **Sidebar Panel** (like File Organizer) - Email inbox list and management
2. **Custom Editor** (like DOCX/PDF Viewer) - View emails and draft responses
3. **RAG Integration** - Draft emails using case folder knowledge base

Key workflow:

- Sidebar lists emails parsed from .eml/.pdf files
- Click email → Opens in custom EmailEditor (EditorPane)
- PDF emails open in existing PDF viewer (read-only)
- "Draft Reply" button → Creates DOCX document for editable draft
- RAG queries case folder documents for relevant context
- LLM generates draft in DOCX using document editor operations

## Implementation Tasks

### 1. Email Service Layer

**electron-main/** - Email parsing and storage

Create `emailService.ts`:

- Parse .eml files using `mailparser` library (extracts from, to, subject, body, date, attachments)
- Parse .pdf emails using existing `pdfExtractorChannel.ts`
- SQLite storage: `emails.db` with schema:
  - `id`, `from_email`, `to_email`, `subject`, `body_text`, `body_html`, `date`, `case_folder_path`, `file_path`, `file_type` (.eml|.pdf), `attachments_json`

Create `emailMainChannel.ts` (IPC):

- `parseEmailFile({ filePath, caseFolderPath })`
- `getEmails({ caseFolderPath? })`
- `getEmailById({ emailId })`
- `createReplyDocument({ emailId, draftContent })`

**common/emailService.ts** - Types

```typescript
interface Email {
  id: string;
  from: string;
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  date: Date;
  caseFolderPath: string;
  filePath: string;
  fileType: 'eml' | 'pdf';
  attachments: Array<{ filename: string; contentType: string }>;
}

interface IEmailService {
  parseEmail(filePath: URI): Promise<Email>;
  getEmails(caseFolderPath?: URI): Promise<Email[]>;
  getEmailById(id: string): Promise<Email | null>;
  createReplyDocument(emailId: string, draftContent: string): Promise<URI>;
}
```

**browser/emailService.ts** - IPC client, register singleton

### 2. Email Custom Editor

**browser/emailViewers/emailViewerInput.ts**

Create custom EditorInput (like `docxViewerInput.ts`):

- `EmailViewerInput` extends `EditorInput`
- Holds email ID and resource URI
- Serializer for persistence

**browser/emailViewers/emailViewerEditor.ts**

Create custom EditorPane (like `docxViewerEditor.ts:27`):

- `EmailViewerEditor` extends `EditorPane`
- Webview-based UI with email display + drafting panel
- Buttons: "Draft Reply", "Open Original", "View Case Files"
- "Draft Reply" workflow:

  1. Query RAG for case folder context
  2. Build prompt with email + RAG chunks
  3. Stream LLM response
  4. Create DOCX file: `replies/Re-{subject}-{timestamp}.docx`
  5. Open DOCX in existing `DOCXViewerEditor`

**browser/emailViewers/media/emailViewer.html/js/css**

Webview implementation:

- Display email metadata (from, to, subject, date)
- Render body (plain text or HTML)
- Attachments list
- Draft panel with:
  - Instructions input
  - "Generate Draft" button
  - RAG context preview (which docs used)
  - Status indicator (generating, ready)

### 3. Email Dashboard Sidebar

**browser/emailDashboard/emailDashboardPane.ts**

Like `fileOrganizerDashboardPane.ts:20`:

- Extends `ViewPane`
- Mounts React via `instantiationService.invokeFunction()`

**browser/react/src/email-dashboard-tsx/**

`EmailDashboard.tsx`:

- Email list with columns: From, Subject, Date, Case Folder
- Filter/search controls
- Click email → Call `editorService.openEditor(new EmailViewerInput(email))`
- "Import Emails" button → File picker for .eml/.pdf

`EmailList.tsx`:

- Virtual scrolling for large lists
- Sorting by date/sender/case
- Status badges (new, replied, draft created)

`EmailFilters.tsx`:

- Case folder dropdown
- Date range picker
- Search input

`index.tsx` - Mount function

**browser/emailDashboard/emailDashboardContribution.ts**

Register:

- View container: `Codicon.mail`, order 6
- View: `EmailDashboard`
- Command: `void.openEmailDashboard` (Ctrl+Shift+M)
- Context menu: Explorer right-click on .eml/.pdf → "Import Email"

### 4. RAG-Powered Drafting

**browser/emailDraftService.ts**

Core drafting logic:

```typescript
async draftReply(emailId: string, userInstructions?: string): Promise<URI> {
  // 1. Get email
  const email = await emailService.getEmailById(emailId);
  
  // 2. Query RAG with case folder scope
  const ragQuery = `Email from ${email.from} about: ${email.subject}`;
  const ragResults = await ragService.search({
    query: ragQuery,
    scope: email.caseFolderPath,
    limit: 5
  });
  
  // 3. Build LLM prompt
  const prompt = buildDraftPrompt(email, ragResults, userInstructions);
  
  // 4. Stream LLM response
  let draftText = '';
  await llmMessageService.sendLLMMessage({
    messages: [{ role: 'user', content: prompt }],
    onText: ({ fullText }) => { draftText = fullText; },
    // ... model selection, etc
  });
  
  // 5. Create DOCX file
  const replyUri = await documentCreatorService.createDOCX({
    path: `${email.caseFolderPath}/replies/Re-${sanitize(email.subject)}.docx`,
    content: formatEmailDraft(email, draftText)
  });
  
  // 6. Open in DOCX editor
  await editorService.openEditor(new DOCXViewerInput(replyUri));
  
  return replyUri;
}
```

**Extend RAG for folder scope**

Update `ragMainService.ts`:

- Add `caseFolderPath` to ChromaDB metadata
- Filter search by `where: { caseFolderPath: { $eq: targetPath } }`
- Existing documents indexed via RAG auto-indexing already have paths

**Email draft template**

```
To: {original.from}
From: {user.email}
Re: {original.subject}
Date: {timestamp}

---

{llm_generated_content}

---
Original Email:
From: {original.from}
Date: {original.date}
Subject: {original.subject}

{original.body}
```

### 5. Workspace Integration

**browser/emailWorkspaceService.ts**

File system watcher (like `ragWorkspaceService.ts`):

- Watch for `*.eml`, `*.pdf` in workspace
- On file created/changed:
  - Parse email
  - Extract case folder from path
  - Store in emails.db
  - Notify EmailDashboard to refresh

**Auto-parse workflow:**

1. User drops .eml file in `cases/john-doe/correspondence/`
2. Watcher detects file
3. Parse email → Store with `caseFolderPath = cases/john-doe`
4. EmailDashboard auto-refreshes
5. Email appears in list

### 6. Editor Registration

**browser/emailViewers/emailViewer.contribution.ts**

```typescript
// Register custom editor
const editorRegistry = Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane);
editorRegistry.registerEditorPane(
  EditorPaneDescriptor.create(
    EmailViewerEditor,
    EmailViewerEditor.ID,
    'Email Viewer'
  ),
  [new SyncDescriptor(EmailViewerInput)]
);

// Register input serializer for persistence
const inputRegistry = Registry.as<IEditorInputFactoryRegistry>(EditorInputExtensions.EditorInputFactories);
inputRegistry.registerEditorInputSerializer(
  EmailViewerInput.ID,
  EmailViewerInputSerializer
);
```

### 7. Settings

Add to `voidSettingsTypes.ts`:

```typescript
emailDashboardEnabled: boolean; // default: true
emailAutoParseEnabled: boolean; // default: true
emailWatchFolders: string[]; // default: []
emailDefaultDraftTone: 'professional' | 'friendly' | 'formal'; // default: 'professional'
emailReplyFolder: string; // default: 'replies'
emailUserName: string; // default: ''
emailUserEmail: string; // default: ''
```

### 8. Dependencies

Add to `package.json`:

```json
"mailparser": "^3.6.5"
```

## File Structure

```
src/vs/workbench/contrib/void/
├── browser/
│   ├── emailDashboard/
│   │   ├── emailDashboardPane.ts
│   │   ├── emailDashboardContribution.ts
│   ├── emailViewers/
│   │   ├── emailViewerEditor.ts
│   │   ├── emailViewerInput.ts
│   │   ├── emailViewerInputSerializer.ts
│   │   ├── emailViewer.contribution.ts
│   │   └── media/
│   │       ├── emailViewer.html
│   │       ├── emailViewer.js
│   │       └── emailViewer.css
│   ├── emailDraftService.ts
│   ├── emailWorkspaceService.ts
│   ├── emailService.ts (IPC client)
│   └── react/src/email-dashboard-tsx/
│       ├── index.tsx
│       ├── EmailDashboard.tsx
│       ├── EmailList.tsx
│       └── EmailFilters.tsx
├── electron-main/
│   ├── emailService.ts
│   └── emailMainChannel.ts
└── common/
    └── emailService.ts (types)
```

## Registration in void.contribution.ts

```typescript
// Email Dashboard & Editor
import './emailDashboard/emailDashboardContribution.js';
import './emailViewers/emailViewer.contribution.js';
import '../common/emailService.js';
import './emailDraftService.ts';
import './emailWorkspaceService.js';
```

## Key Implementation Notes

- **PDF emails**: Open in existing read-only PDF viewer, draft replies create new DOCX
- **EML emails**: Custom webview renderer, same draft workflow
- **Reply documents**: Created in `{caseFolderPath}/replies/` as editable DOCX
- **RAG scope**: Filter by case folder path in ChromaDB metadata
- **Editor reuse**: Leverage `DOCXViewerEditor` for draft editing, `PDFViewerEditor` for PDF emails
- **Document operations**: Use existing `documentEditorService.editDOCX()` for LLM edits
- **Webview pattern**: Follow `docxViewer.js` for email viewer webview
- **IPC pattern**: Like `docxCreatorChannel.ts` for email parsing

## Testing Workflow

1. Drop `test-email.eml` in `workspace/cases/case-001/correspondence/`
2. Open Email Dashboard sidebar (Ctrl+Shift+M)
3. Verify email appears in list with case folder "case-001"
4. Click email → Opens EmailViewerEditor
5. Click "Draft Reply" → Queries RAG for case-001 docs
6. Verify RAG context displayed (which PDFs/docs used)
7. LLM generates draft → Creates `replies/Re-{subject}.docx`
8. DOCX editor opens with editable draft
9. User edits draft, saves DOCX
10. Export/copy final email text