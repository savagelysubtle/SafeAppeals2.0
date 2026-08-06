# Feature-Specific Prompts (`prompts.ts`)

> **Historical Void dump (superseded).** Current organize flow is the
> `organize-files` skill (`extensions/safeappeals-timeline/skills/organize-files`):
> source `./to_sort`, snake_case folders at workspace root, logs under
> `.safeAppeals/`. Do not treat `Case_Files/` / PascalCase / `.fileorg.json` as
> the shipping contract.

**Location**: `src/vs/workbench/contrib/void/common/prompt/prompts.ts`  
**Approximate size**: ~1,600 lines

This file contains prompts and user-message builders for all IDE features outside the main chat — Apply (slow and fast), Ctrl+K quick edit, Git commit messages, and the Case Organizer agent.

## Table of Contents

1. [Shared Constants](#shared-constants)
2. [Chat System Message](#chat-system-message)
3. [Chat User Message](#chat-user-message)
4. [Apply — Slow Rewrite](#apply--slow-rewrite)
5. [Apply — Fast Search/Replace](#apply--fast-searchreplace)
6. [Ctrl+K Quick Edit (FIM)](#ctrlk-quick-edit-fim)
7. [Git Commit Message](#git-commit-message)
8. [Case Organizer Agent](#case-organizer-agent)
9. [User Message Utilities](#user-message-utilities)
10. [Inline Prompts (Other Files)](#inline-prompts-other-files)

---

## Shared Constants

```typescript
// Triple backtick wrapper for code blocks
export const tripleTick = ['```', '```']

// Search/Replace block delimiters (used in Apply system)
export const ORIGINAL = `<<<<<<< ORIGINAL`
export const DIVIDER  = `=======`
export const FINAL    = `>>>>>>> UPDATED`

// Context limits
export const MAX_DIRSTR_CHARS_TOTAL_BEGINNING = 20_000
export const MAX_DIRSTR_CHARS_TOTAL_TOOL      = 20_000
export const MAX_FILE_CHARS_PAGE              = 500_000
export const MAX_CHILDREN_URIs_PAGE           = 500
export const MAX_TERMINAL_CHARS               = 100_000
export const MAX_TERMINAL_INACTIVE_TIME       = 8    // seconds
export const MAX_TERMINAL_BG_COMMAND_TIME     = 5    // seconds
export const MAX_PREFIX_SUFFIX_CHARS          = 20_000

// DOCX/XLSX editing operation description
export const EDIT_DOCUMENT_DESCRIPTION = `Edit DOCX/XLSX files using JSON operations array...`
// (See tool-definitions.md for full specification)
```

---

## Chat System Message

**Export**: `chat_systemMessage()` (function call, not a constant)

The chat system message is built by calling `getSystemPrompt(options)` from `systemPrompt.ts`. `prompts.ts` acts as the integration layer that gathers the runtime context (workspace folders, open URIs, active URI, terminal IDs, etc.) and passes it to the system prompt builder.

**How it's used** (from `convertToLLMMessageService.ts` or similar):
```typescript
const systemPrompt = getSystemPrompt({
    mode,
    workspaceFolders,
    openedURIs,
    activeURI,
    persistentTerminalIDs,
    directoryStr,
    os,
    contextWindowSize: model.contextWindow
})
```

The return value is used as the `system` field in the LLM API call.

---

## Chat User Message

**Export**: `chat_userMessageContent(instructions, currSelns, opts)`

Builds the user-turn text content for chat messages, including any attached files, code selections, folders, or images.

### Signature

```typescript
export const chat_userMessageContent = async (
    instructions: string,
    currSelns: StagingSelectionItem[] | null,
    opts: {
        directoryStrService: IDirectoryStrService,
        fileService: IFileService,
    },
): Promise<string>
```

### Selection Handling

Attached items are rendered differently based on type:

| Selection Type | Rendered As |
|---|---|
| `CodeSelection` | Fenced code block with language tag + line range |
| `File` (text) | Fenced code block with language tag |
| `File` (PDF with RAG context) | Plain text (full document content with "DO NOT USE read_file" warning) |
| `File` (PDF without RAG context) | Warning message telling agent to use `read_file` |
| `File` (binary: docx, xlsx) | Warning message to use `read_file` |
| `File` (image) | Placeholder text — image is sent separately via multi-modal |
| `Folder` | Directory tree + all file contents |
| `Image` | `[Image attached: filename]` placeholder |

### Attachment Header Logic

When selections are present, a header is prepended with explicit instructions to not re-read already-provided files:

**PDF with RAG context** (full text already extracted):
```
📄 ATTACHED DOCUMENTS (FULL CONTENT INCLUDED BELOW)
The following documents have been FULLY EXTRACTED and their COMPLETE TEXT is included below.
🚫 DO NOT use read_file on these documents - you already have the full content.
✅ Simply read and analyze the text below.
```

**Other files/selections**:
```
📎 ATTACHED FILES & SELECTIONS (FULL CONTENT BELOW)
The user has attached [N file(s), M code selection(s), ...]. Their COMPLETE CONTENTS are included below.
🚫 DO NOT use read_file on these files - you already have the full content.
```

---

## Apply — Slow Rewrite

**Exports**: `rewriteCode_systemMessage`, `rewriteCode_userMessage()`

Used when the "Apply" feature rewrites an entire file (Slow Apply mode).

### System Message

```
You are a coding assistant that re-writes an entire file to make a change.
You are given the original file ORIGINAL_FILE and a change CHANGE.

Directions:
1. Rewrite the original file ORIGINAL_FILE, making the change CHANGE.
   You must completely re-write the whole file.
2. Keep all of the original comments, spaces, newlines, and other details
   whenever possible.
3. ONLY output the full new file. Do not add any other explanations or text.
```

### User Message Template

```typescript
rewriteCode_userMessage({ originalCode, applyStr, language })
```

Produces:
```
ORIGINAL_FILE
```[language]
[original code]
```

CHANGE
```
[change description / diff]
```

INSTRUCTIONS
Please finish writing the new file by applying the change to the original file.
Return ONLY the completion of the file, without any explanation.
```

---

## Apply — Fast Search/Replace

**Exports**: `searchReplaceGivenDescription_systemMessage`, `searchReplaceGivenDescription_userMessage()`

Used when the "Apply" feature uses search/replace blocks (Fast Apply mode). Much more token-efficient than full file rewrite.

### Search/Replace Block Format

```
<<<<<<< ORIGINAL
// ... original code goes here
=======
// ... final code goes here
>>>>>>> UPDATED
```

Multiple blocks can be chained back-to-back.

### System Message

```
You are a coding assistant that takes in a diff, and outputs SEARCH/REPLACE code blocks
to implement the change(s) in the diff.

Format your SEARCH/REPLACE blocks as follows:
[block format shown above]

Rules:
1. Your blocks must implement the diff EXACTLY. Do NOT leave anything out.
2. You are allowed to output multiple SEARCH/REPLACE blocks.
3. Assume any comments in the diff are PART OF THE CHANGE.
4. Your output should consist ONLY of SEARCH/REPLACE blocks. No text before or after.
5. ORIGINAL code must EXACTLY match lines in the original file (whitespace included).
6. ORIGINAL text must be large enough to uniquely identify the change.
7. Each ORIGINAL text must be DISJOINT from all others.
```

### User Message Template

```typescript
searchReplaceGivenDescription_userMessage({ originalCode, applyStr })
```

Produces:
```
DIFF
[applyStr — the change description or partial code]

ORIGINAL_FILE
```
[originalCode]
```
```

### Context Window Helper

**Export**: `voidPrefixAndSuffix({ fullFileStr, startLine, endLine })`

Extracts up to `MAX_PREFIX_SUFFIX_CHARS` (20,000 chars) of context before and after the selected region, used to give the model surrounding context for Ctrl+K operations.

---

## Ctrl+K Quick Edit (FIM)

**Exports**: `ctrlKStream_systemMessage()`, `ctrlKStream_userMessage()`, `defaultQuickEditFimTags`

Ctrl+K uses FIM (Fill-In-The-Middle) prompting. The model receives the selection marked with tags and surrounding context, and is asked to rewrite just the selection.

### FIM Tags

```typescript
export const defaultQuickEditFimTags: QuickEditFimTagsType = {
    preTag: 'ABOVE',      // Tag wrapping prefix context
    sufTag: 'BELOW',      // Tag wrapping suffix context
    midTag: 'SELECTION',  // Tag wrapping the code to be replaced
}
```

### System Message

```typescript
ctrlKStream_systemMessage({ quickEditFIMTags: { preTag, midTag, sufTag } })
```

Produces:
```
You are a smart editing assistant using FIM (Fill-In-The-Middle).
Your goal is to update the SELECTION marked by <SELECTION> tags based on the user's INSTRUCTIONS.

Context:
- <ABOVE>: Preceding context
- <BELOW>: Following context
- ORIGINAL SELECTION: Content to be replaced

Instructions:
1. Transform: Apply the user's instructions to the original selection.
2. Output: Return strictly the new content within <SELECTION> tags.
3. Integrity: Ensure the result flows seamlessly with the surrounding text or code.
   - Maintain correct indentation and formatting.
   - For text: Ensure grammatical continuity.
   - For code: Ensure syntax validity.
```

### User Message Template

```typescript
ctrlKStream_userMessage({ selection, prefix, suffix, instructions, fimTags, language })
```

Produces:
```
CURRENT SELECTION
```[language]
<SELECTION>[original selection]</SELECTION>
```

INSTRUCTIONS
[user instructions]

<ABOVE>[prefix — up to 20,000 chars before selection]</ABOVE>
<BELOW>[suffix — up to 20,000 chars after selection]</BELOW>
```

The model then returns only the replacement content wrapped in `<SELECTION>...</SELECTION>` tags.

---

## Git Commit Message

**Exports**: `gitCommitMessage_systemMessage`, `gitCommitMessage_userMessage()`

Used by the Source Control Manager (SCM) integration to auto-generate commit messages.

### System Message

```
You are an intelligent version control assistant responsible for writing clear and
concise Git commit messages that summarize the purpose and intent of the change.

Guidelines:
1. Concise: Aim for a single sentence. Two only if necessary.
2. Intent-Focused: Explain WHY the change was made, not just WHAT changed.
3. Format:
   <output>Correct formatting in appeal letter template</output>
   <reasoning>This commit fixes indentation issues in the appeal letter
   to ensure professional presentation.</reasoning>

Output Requirement:
Provide ONLY the <output> and <reasoning> tags. No other text.
```

### User Message Template

```typescript
gitCommitMessage_userMessage(stat, sampledDiffs, branch, log)
```

**Parameters**:
| Parameter | Description |
|---|---|
| `stat` | Output of `git diff --stat` (summary of changed files) |
| `sampledDiffs` | Diffs of the top changed files |
| `branch` | Current git branch name |
| `log` | Last 5 commits (excluding merges), formatted as `hash\|message\|date` |

**Output format** (parsed by the SCM service):
```xml
<output>The commit message goes here</output>
<reasoning>Explanation of why this message was chosen</reasoning>
```

---

## Case Organizer Agent

**Exports**: `caseOrganizerInit_systemMessage`, `caseOrganizerInit_defaultPrompt`

A specialized agent system message for organizing workers' compensation case files into a structured folder hierarchy.

### System Message Overview

The Case Organizer agent is instructed to:
1. Operate in one of three modes chosen by the user
2. Follow strict safety guardrails
3. Generate dry-run previews before any execution
4. Create backups and undo plans

### Modes

| Mode | Description |
|---|---|
| `full_auto` | Analyze, plan, backup, organize automatically |
| `interactive` | Confirm categories for low-confidence files; always dry-run first |
| `manual` | Scaffold folders only; do not move any files |

### Safety Guardrails (critical)

- ALWAYS run a dry_run plan first (JSON preview before executing)
- In full_auto: ALWAYS create backups in `to_sort/_originals/` before any moves
- On filename conflicts: auto-rename with numeric suffix (`_01`, `_02`, etc.)
- Log ALL operations to `.safeAppeals/organization_log.json`
- Produce `.safeAppeals/undo_plan.json` with reverse operations
- NEVER delete original files unless explicitly requested

### Standard Workflow (5 Steps)

**Step 1: Mode Selection** — Ask user to choose a mode

**Step 2: Analysis** (for full_auto and interactive)
1. Check if `./to_sort` exists (create if missing)
2. Read directory tree with `get_dir_tree`
3. Categorize files by filename patterns
4. Sample 1KB of uncertain files (text only)
5. Build categorization plan

**Step 3: Dry-Run Plan** — Display JSON plan and request approval:
```json
{
  "mode": "full_auto",
  "operations": [{
    "source": "./to_sort/2024-01-15_medical_exam.pdf",
    "destination": "./medical_reports/2024-01-15_medical_exam.pdf",
    "category": "medical_reports",
    "confidence": "high",
    "reason": "Filename contains 'medical' and 'exam'"
  }],
  "stats": {
    "total_files": 25,
    "high_confidence": 20,
    "medium_confidence": 3,
    "low_confidence": 2,
    "conflicts_detected": 1
  }
}
```

**Step 4: Execution** (if approved)
- Create all destination folders
- In full_auto: copy all files to `_originals/` first
- Move files one by one, logging success/failure
- Write `.safeAppeals/organization_log.json` and `.safeAppeals/undo_plan.json`

**Step 5: Summary Report**
```json
{
  "summary": {
    "mode": "full_auto",
    "files_moved": 23,
    "files_skipped": 2,
    "conflicts_resolved": 1,
    "backups_created": 25,
    "errors": []
  },
  "logs": ".safeAppeals/organization_log.json",
  "undo_plan": ".safeAppeals/undo_plan.json"
}
```

### Target Folder Structure

```
medical_reports/
correspondence/
decisions_and_orders/
evidence/
personal_notes/
to_sort/
core_references/
```

### Categorization Heuristics (filename pattern matching)

| Category | Filename Keywords |
|---|---|
| medical_reports | medical, doctor, physician, exam, assessment, treatment, diagnosis, mri, xray, report |
| correspondence | letter, email, correspondence, notice, communication |
| decisions_and_orders | decision, order, ruling, judgment, determination, award |
| evidence | evidence, witness, statement, photo, image, document |
| personal_notes | note, journal, diary, personal, draft |
| (leave in `to_sort`) | anything that doesn't fit above — do not invent `Uncategorized` |

### OS-Specific Commands (PowerShell)

The prompt includes Windows PowerShell commands for all operations:

```powershell
# Create directory
New-Item -ItemType Directory -Path "<path>" -Force

# Copy for backup
Copy-Item -Path "<src>" -Destination "<dst>" -Force

# Move file
Move-Item -Path "<src>" -Destination "<dst>" -Force

# List directory
Get-ChildItem -Path "<path>" | Format-Table Name, Length
```

### Default User Prompt

**Export**: `caseOrganizerInit_defaultPrompt`

The default first message sent automatically when the Case Organizer is initialized:
```
Let's organize my case files. First, tell me what files you found in ./to_sort
and then ask me which mode I'd like to use.
```

---

## User Message Utilities

### `messageOfSelection(s, opts)`

Renders a single `StagingSelectionItem` to a string for inclusion in the user message.

### `voidPrefixAndSuffix({ fullFileStr, startLine, endLine })`

Extracts surrounding context for Ctrl+K operations:
- Walks backward from `startLine` accumulating `prefix` until `MAX_PREFIX_SUFFIX_CHARS` is reached
- Walks forward from `endLine` accumulating `suffix` until the same limit
- Returns `{ prefix, suffix }` — both are used in `ctrlKStream_userMessage`

### `toolCallDefinitionsXMLString(tools, toolChoice)`

Formats an array of `InternalToolInfo` objects into the XML tool definitions block expected by the LLM API.

### `systemToolsXMLPrompt(tools, toolChoice)`

Higher-level wrapper that calls `toolCallDefinitionsXMLString` and prepends/appends the appropriate XML framing.

---

## Inline Prompts (Other Files)

Beyond the two main prompt files, several features contain inline system prompts.

### Email Drafting (`EmailDashboard.tsx`)

A brief system prompt for email reply drafting:
```
You are a professional legal assistant helping draft email replies for workers' compensation cases.
Maintain professional tone, cite relevant facts from the provided context, and keep responses concise.
```

### File Classification (`aiClassifier.ts`)

Context-aware system messages for document classification:
- **Legal template**: Focuses on medical records, legal documents, correspondence categories
- **Research template**: Focuses on literature, data, methodology categories
- **Business template**: Focuses on contracts, invoices, project documents

Functions: `buildClassificationPrompt()`, `buildContextAwarePrompt()`

### Document Editing (`docxViewerEditor.ts`)

An inline system prompt for the AI-powered document editor:
```
You are an expert document editor. You will be given a DOCX document's current content
and instructions for editing it. Return a JSON operations array to implement the requested changes.
```
