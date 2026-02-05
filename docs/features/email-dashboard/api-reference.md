# Email Dashboard API Reference

Complete API documentation for the Email Dashboard services.

## Table of Contents

- [IEmailService](#iemailservice)
- [IEmailDraftService](#iemaildraftservice)
- [Email Interface](#email-interface)
- [EmailAttachment Interface](#emailattachment-interface)
- [IPC Commands](#ipc-commands)
- [React Hooks](#react-hooks)

---

## IEmailService

The primary service for email operations. Available in both browser and main process contexts.

### Service Decorator

```typescript
import { IEmailService } from '../common/emailService';

// In a service constructor
constructor(@IEmailService private readonly emailService: IEmailService) {}

// In React components
const emailService = accessor.get('IEmailService');
```

### Methods

#### parseEmail

Parse and store an email file in the workspace database.

```typescript
parseEmail(filePath: URI): Promise<Email>
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `filePath` | `URI` | Path to the `.eml` or `.pdf` file |

**Returns:** `Promise<Email>` — The parsed and stored email object

**Example:**
```typescript
const email = await emailService.parseEmail(URI.file('/path/to/email.eml'));
console.log(email.subject); // "Re: Workers' Comp Claim"
```

---

#### getEmails

Retrieve all emails, optionally filtered by case folder.

```typescript
getEmails(caseFolderPath?: URI): Promise<Email[]>
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `caseFolderPath` | `URI` (optional) | Filter to specific case folder |

**Returns:** `Promise<Email[]>` — Array of emails sorted by date (newest first)

**Example:**
```typescript
// All emails
const allEmails = await emailService.getEmails();

// Emails for specific case
const caseEmails = await emailService.getEmails(
  URI.file('/workspace/cases/smith-v-employer')
);
```

---

#### getEmailById

Retrieve a specific email by its unique ID.

```typescript
getEmailById(id: string): Promise<Email | null>
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `id` | `string` | SHA-256 hash of the file path (first 16 chars) |

**Returns:** `Promise<Email | null>` — The email or null if not found

**Example:**
```typescript
const email = await emailService.getEmailById('a1b2c3d4e5f67890');
if (email) {
  console.log(`From: ${email.from}`);
}
```

---

#### searchEmails

Full-text search across emails using FTS5.

```typescript
searchEmails(query: string, caseFolderPath?: URI): Promise<Email[]>
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `query` | `string` | Search query (subject, body, from) |
| `caseFolderPath` | `URI` (optional) | Limit search to case folder |

**Returns:** `Promise<Email[]>` — Matching emails (max 50 results)

**Example:**
```typescript
// Search all emails
const results = await emailService.searchEmails('denial claim');

// Search within case
const caseResults = await emailService.searchEmails(
  'settlement',
  URI.file('/workspace/cases/smith-v-employer')
);
```

---

#### deleteEmail

Remove an email from the database.

```typescript
deleteEmail(emailId: string): Promise<void>
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `emailId` | `string` | Email ID to delete |

**Note:** This only removes the database record. The original file is not deleted.

**Example:**
```typescript
await emailService.deleteEmail('a1b2c3d4e5f67890');
```

---

#### getStats

Get email statistics for the current workspace.

```typescript
getStats(): Promise<{
  totalEmails: number;
  draftCount: number;
  caseFolders: string[];
}>
```

**Returns:**
| Field | Type | Description |
|-------|------|-------------|
| `totalEmails` | `number` | Total emails in workspace |
| `draftCount` | `number` | Number of draft replies |
| `caseFolders` | `string[]` | Unique case folder paths |

**Example:**
```typescript
const stats = await emailService.getStats();
console.log(`Total: ${stats.totalEmails}, Drafts: ${stats.draftCount}`);
console.log(`Cases: ${stats.caseFolders.join(', ')}`);
```

---

#### getWorkspaceId

Get the computed workspace identifier.

```typescript
getWorkspaceId(): string
```

**Returns:** `string` — 16-character hex string derived from workspace path

**Example:**
```typescript
const wsId = emailService.getWorkspaceId();
// e.g., "a1b2c3d4e5f67890"
```

---

#### createReplyDocument

Generate a DOCX draft reply for an email.

```typescript
createReplyDocument(emailId: string, draftContent: string): Promise<URI>
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `emailId` | `string` | Original email ID |
| `draftContent` | `string` | Reply body text |

**Returns:** `Promise<URI>` — Path to created DOCX file

**Generated File Location:**
```
{caseFolderPath}/replies/Reply_to_{subject}_{timestamp}.docx
```

**Example:**
```typescript
const replyUri = await emailService.createReplyDocument(
  'a1b2c3d4e5f67890',
  'Thank you for your correspondence...'
);
```

---

## IEmailDraftService

Service for AI-assisted email draft generation.

### Service Decorator

```typescript
import { IEmailDraftService } from '../browser/emailDraftService';

constructor(@IEmailDraftService private readonly draftService: IEmailDraftService) {}
```

### Events

#### onDraftProgress

Fired during draft generation with progress updates.

```typescript
readonly onDraftProgress: Event<{
  emailId: string;
  progress: number;  // 0-100
  status: string;    // Human-readable status
}>
```

**Example:**
```typescript
draftService.onDraftProgress(e => {
  console.log(`[${e.emailId}] ${e.progress}%: ${e.status}`);
});
```

### Methods

#### generateDraftReply

Generate an AI-assisted draft reply.

```typescript
generateDraftReply(emailId: string, customPrompt?: string): Promise<DraftResult>
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `emailId` | `string` | Email to reply to |
| `customPrompt` | `string` (optional) | Additional instructions |

**Returns:**
```typescript
interface DraftResult {
  content: string;   // Draft reply text
  sources: string[]; // Referenced document filenames
}
```

**Progress Events:**
| Progress | Status |
|----------|--------|
| 10% | Retrieving email context... |
| 40% | Building draft context... |
| 60% | Generating draft... |
| 100% | Draft complete |

---

#### getRelevantContext

Retrieve RAG context for an email.

```typescript
getRelevantContext(email: Email): Promise<Array<{
  text: string;
  source: string;
  score: number;
}>>
```

**Returns:** Array of relevant document chunks with similarity scores.

---

#### saveDraftAsDocx

Save draft content as a DOCX file.

```typescript
saveDraftAsDocx(emailId: string, draftContent: string): Promise<URI>
```

Delegates to `IEmailService.createReplyDocument()`.

---

## Email Interface

```typescript
interface Email {
  id: string;                    // Unique identifier (SHA-256 hash)
  from: string;                  // Sender email/name
  to: string;                    // Recipient(s)
  cc?: string;                   // Carbon copy recipients
  bcc?: string;                  // Blind carbon copy recipients
  subject: string;               // Email subject
  bodyText: string;              // Plain text body
  bodyHtml?: string;             // HTML body (if available)
  date: Date;                    // Send/receive date
  caseFolderPath: string;        // Associated case folder
  filePath: string;              // Original file path
  fileType: 'eml' | 'pdf';       // Source file type
  attachments: EmailAttachment[]; // Attachment metadata
  isDraft?: boolean;             // Is this a draft reply?
  replyToId?: string;            // Original email ID (for replies)
}
```

---

## EmailAttachment Interface

```typescript
interface EmailAttachment {
  filename: string;       // Attachment filename
  contentType: string;    // MIME type
  content?: Uint8Array;   // Binary content (optional)
  size?: number;          // File size in bytes
}
```

---

## IPC Commands

Commands available on the `void-channel-email` IPC channel.

### parseEmailFile

```typescript
channel.call('parseEmailFile', {
  filePath: URI,          // JSON-serialized URI
  caseFolderPath: string, // Case folder path
  workspaceId: string     // Workspace identifier
}): Promise<Email>
```

### getEmails

```typescript
channel.call('getEmails', {
  workspaceId: string,
  caseFolderPath?: string
}): Promise<Email[]>
```

### getEmailById

```typescript
channel.call('getEmailById', {
  workspaceId: string,
  emailId: string
}): Promise<Email | null>
```

### searchEmails

```typescript
channel.call('searchEmails', {
  workspaceId: string,
  query: string,
  caseFolderPath?: string
}): Promise<Email[]>
```

### deleteEmail

```typescript
channel.call('deleteEmail', {
  workspaceId: string,
  emailId: string
}): Promise<void>
```

### getStats

```typescript
channel.call('getStats', {
  workspaceId: string
}): Promise<{ totalEmails: number; draftCount: number; caseFolders: string[] }>
```

### createReplyDocument

```typescript
channel.call('createReplyDocument', {
  workspaceId: string,
  emailId: string,
  draftContent: string,
  replyFolderPath: string
}): Promise<string>  // File path
```

---

## React Hooks

### Accessing Services

```typescript
import { useAccessor } from '../util/services';

function MyComponent() {
  const accessor = useAccessor();

  const loadEmails = async () => {
    const emailService = accessor.get('IEmailService');
    const emails = await emailService.getEmails();
    // ...
  };
}
```

### Available Services via Accessor

| Key | Service |
|-----|---------|
| `'IEmailService'` | Email operations |
| `'IFileDialogService'` | File open dialogs |
| `'IEditorService'` | Open files in editor |
| `'URI'` | URI construction utilities |

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Email not found: {id}` | Invalid email ID | Verify ID exists |
| `Database not initialized` | Service not ready | Await initialization |
| `Unsupported email file type` | Not .eml or .pdf | Use supported format |

### Error Handling Pattern

```typescript
try {
  const email = await emailService.parseEmail(fileUri);
} catch (error) {
  if (error.message.includes('not found')) {
    // File doesn't exist
  } else if (error.message.includes('Unsupported')) {
    // Wrong file type
  } else {
    // Unknown error
    console.error('[Email]', error);
  }
}
```

---

## Next Steps

- [Developer Guide](./developer-guide.md) — Extending the system
- [Architecture](./architecture.md) — Technical design

