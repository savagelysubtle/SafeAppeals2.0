# Email Dashboard User Guide

This guide covers how to use the Email Dashboard to manage case correspondence in SafeAppeals Navigator.

## Table of Contents

- [Opening the Dashboard](#opening-the-dashboard)
- [Importing Emails](#importing-emails)
- [Viewing Emails](#viewing-emails)
- [Searching Emails](#searching-emails)
- [Filtering by Case](#filtering-by-case)
- [Sorting Emails](#sorting-emails)
- [Deleting Emails](#deleting-emails)
- [Creating Draft Replies](#creating-draft-replies)

---

## Opening the Dashboard

### Method 1: Keyboard Shortcut

Press `Ctrl+Shift+E` (or `Cmd+Shift+E` on macOS) to instantly open the Email Dashboard.

### Method 2: Command Palette

1. Press `Ctrl+Shift+P` to open the Command Palette
2. Type "Email Dashboard"
3. Select **SafeAppeals: Open Email Dashboard**

### Method 3: Activity Bar

Click the **mail icon** (📧) in the Activity Bar on the left side of the window.

---

## Importing Emails

The Email Dashboard supports two email file formats:

| Format | Extension | Description |
|--------|-----------|-------------|
| EML | `.eml` | Standard email message format |
| PDF | `.pdf` | Printed/exported email documents |

### Import Steps

1. Open the Email Dashboard
2. Click the **Import Emails** button (or the + icon in the toolbar)
3. In the file dialog, navigate to your email files
4. Select one or multiple files
5. Click **Open**

The system will:
- Parse the email content (headers, body, attachments)
- Extract metadata (from, to, date, subject)
- Store the email in the workspace database
- Automatically detect the case folder

### Supported Email Fields

| Field | Description |
|-------|-------------|
| From | Sender email address |
| To | Recipient email address(es) |
| CC | Carbon copy recipients |
| BCC | Blind carbon copy recipients |
| Subject | Email subject line |
| Date | Send/receive date |
| Body | Plain text and HTML content |
| Attachments | File names and types |

---

## Viewing Emails

### Quick View

Click any email card in the dashboard to open it in the **Email Viewer Editor**.

### Email Card Information

Each email card displays:

- **Avatar** — Color-coded initials based on sender
- **Sender Name** — Extracted from the From field
- **Subject** — Email subject line
- **Preview** — First 150 characters of body text
- **Date** — Relative date (Today shows time, otherwise date)
- **File Type Badge** — EML (blue) or PDF (red)
- **Case Folder** — Source folder name
- **Draft Badge** — Orange badge if it's a draft reply
- **Attachment Icon** — Shows if email has attachments

### Email Viewer Features

The full email viewer includes:

- Complete email headers (From, To, CC, Date)
- Full email body (HTML rendered if available)
- Attachment list with file types
- **Draft Reply** button for AI-assisted responses

---

## Searching Emails

The search feature uses SQLite FTS5 for fast full-text search.

### Search Fields

Searches across:
- Subject
- Body text
- Sender email address

### Search Tips

| Query | Description |
|-------|-------------|
| `claim` | Find emails containing "claim" |
| `john smith` | Find emails mentioning John Smith |
| `WCAB` | Find emails about Workers' Comp Appeals Board |
| `denial` | Find denial-related correspondence |

### How to Search

1. Click the **search icon** in the toolbar
2. Type your search query
3. Press **Enter** or wait for automatic search
4. Results update in real-time

To clear the search, delete the query text or click the **X** button.

---

## Filtering by Case

### Show Filters Panel

1. Click the **filter icon** in the toolbar
2. The filters panel expands below the toolbar

### Filter by Case Folder

1. In the filters panel, find **Case Folder**
2. Select a specific case folder from the dropdown
3. Or select **All Cases** to show everything

The filter works alongside search — you can search within a specific case.

---

## Sorting Emails

### Sort Options

| Field | Description |
|-------|-------------|
| Date | Sort by email date (newest/oldest first) |
| From | Sort alphabetically by sender |
| Subject | Sort alphabetically by subject |

### Change Sort Order

1. Click the **sort icon** in the toolbar
2. Select the sort field
3. Click again to toggle ascending/descending

### Default Sort

Emails are sorted by **Date (newest first)** by default.

---

## Deleting Emails

### Delete Single Email

1. Hover over an email card
2. Click the **trash icon** that appears
3. Click again to **confirm deletion**

> **Note:** Deletion removes the email from the database. The original `.eml` or `.pdf` file is NOT deleted from disk.

### Confirmation

The delete button requires a **two-click confirmation**:
1. First click: Button turns red
2. Second click (within 3 seconds): Deletes the email
3. If you wait too long, the confirmation resets

---

## Creating Draft Replies

### AI-Assisted Drafting

The Email Dashboard integrates with the RAG (Retrieval Augmented Generation) service to create contextual draft replies.

### How It Works

1. Open an email in the Email Viewer
2. Click the **Draft Reply** button
3. The system:
   - Searches your case documents for relevant context
   - Builds a prompt with email history and document excerpts
   - Generates a professional reply template
4. A new DOCX file is created in `{case-folder}/replies/`

### Draft Location

Draft replies are saved as:
```
{case-folder}/replies/Reply_to_{subject}_{timestamp}.docx
```

### Tone Options

| Tone | Description |
|------|-------------|
| Professional | Business-appropriate, courteous |
| Friendly | Warm and approachable |
| Formal | Official, legal-appropriate |

> **Note:** Tone configuration will be available in future settings updates.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+E` | Open Email Dashboard |
| `Enter` | Execute search |
| `Escape` | Clear search |

---

## Troubleshooting

### Emails Not Importing

1. Ensure the file is a valid `.eml` or `.pdf`
2. Check the file is not corrupted
3. For PDFs, ensure they contain readable text (not scanned images)

### Search Not Finding Results

1. Try simpler, single-word queries
2. Check for typos
3. Ensure the email was successfully imported

### Missing Email Content

For PDF emails, content extraction depends on:
- Text being embedded (not scanned images)
- Standard email header format in the document

If extraction fails, the filename is used as the subject.

---

## Next Steps

- [Architecture](./architecture.md) — Technical details
- [API Reference](./api-reference.md) — Programmatic access
- [Developer Guide](./developer-guide.md) — Customization

