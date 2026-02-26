# System Prompts Documentation

## Overview

SafeAppealNavigator uses a modular, research-backed system prompt architecture to guide its AI assistant. The prompts are organized into two primary source files and follow a section-based assembly pattern that allows context-aware customization per chat mode.

**Based on:** Anthropic Best Practices 2025, NLT Framework, Multi-Agent Systems Research

---

## Prompt System Architecture

```
common/prompt/
├── systemPrompt.ts     # Main case-management system prompt (~2,300 lines)
│                       # Function: getSystemPrompt(options) → string
│
└── prompts.ts          # Feature-specific prompts & tool definitions (~1,600 lines)
                        # Exports: chat_systemMessage, rewriteCode_systemMessage,
                        #          ctrlKStream_systemMessage, gitCommitMessage_systemMessage,
                        #          caseOrganizerInit_systemMessage, builtinTools, ...
```

Additional inline prompts exist in:
- `browser/react/src/email-dashboard-tsx/EmailDashboard.tsx` — Email drafting
- `browser/fileOrganizer/aiClassifier.ts` — File classification
- `browser/documentViewers/docxViewer/docxViewerEditor.ts` — Document editing

---

## Chat Mode → Prompt Mapping

The main system prompt is **mode-aware**. Three chat modes produce different behaviors:

| Mode | Identity Focus | Tool Strategy | Key Workflow |
|---|---|---|---|
| `case_manager` | Full agentic case management | Parallel reads, sequential writes | Policy verification → Document creation → Timeline |
| `research` | Deep policy & evidence research | Aggressive parallel (3-5 simultaneous searches) | RAG search → Cross-reference → Synthesize |
| `drafting` | Legal correspondence creation | Parallel research, sequential document creation | Research → Draft → Verify |

---

## How the System Prompt Is Assembled

`getSystemPrompt(options)` builds the final string by joining these sections:

```
Section 1:   Identity & Purpose          (WHO + WHY — agent role, capabilities, core expertise)
Section 1.5: Response Style              (Action-first, direct execution, conciseness)
Section 1.6: Professional Objectivity    (Accuracy over agreement, evidence-based)
Section 1.7: Planning Guidelines         (No time estimates, actionable steps, deadline handling)
Section 2:   Mode-Specific Workflow      (case_manager | research | drafting behavior)
Section 3:   Tool Calling Format         (ANTML XML format, parallel execution, Windows paths)
Section 4:   Parallel Tool Strategy      (Generic example + mode-specific parallel guidance)
Section 5:   Policy Verification         (Mandatory 5-step WC guidance process)
Section 5.5: Medical Evidence Analysis   (Structured IME/QME extraction framework)
Section 6:   Context Window Management   (Token budget, progressive loading, compression)
Section 7:   System Environment          (OS, workspace folders, open documents, date)
Section 8:   Timeline Management         (Timeline tools reference, bulk editing, schemas)
Section 9:   Case Configuration Usage    (Party identification, .fileorg.json behavior)
Section 10:  Workspace Configuration     (Creating .fileorg.json — interview process)
Section 11:  Document Handling           (Creation, editing, verification lifecycle)
Section 12:  Communication Standards     (Tone by mode, audience calibration)
Section 13:  Citation Format             (Mandatory verbatim citation template)
Section 14:  Error Handling              (Recovery procedures, user communication)
Section 15:  File Operations Safety      (Safety protocols, undo plans, dry-runs)
Section 16:  File Organization           (Folder structures, naming conventions)
```

---

## Documentation Files

| File | Description |
|---|---|
| [main-system-prompt.md](./main-system-prompt.md) | All sections of `systemPrompt.ts` documented in detail |
| [feature-prompts.md](./feature-prompts.md) | Feature-specific prompts (apply, ctrl+k, git, case organizer, etc.) |
| [tool-definitions.md](./tool-definitions.md) | All built-in tool definitions and their parameters |

---

## Key Design Principles

### 1. Explicit Over Terse
Claude 4.x requires detailed, explicit instructions. Prompts favor long, specific guidance over short commands. Research finding: explicit instructions reduce hallucination and improve tool-calling accuracy.

### 2. Action-First / Tool-First
The assistant is instructed to **output tool calls immediately** when a task is clear, rather than asking for clarification. The identity section reinforces: "CRITICAL MINDSET: When a user asks you to DO something, OUTPUT TOOL CALLS."

### 3. Mode-Specific Parallelism
Each mode has a tailored parallel tool execution strategy:
- **Research**: Aggressive parallel (3-5 RAG searches simultaneously)
- **Case Manager**: Parallel reads, strictly sequential writes
- **Drafting**: Parallel research phase, sequential document creation

### 4. Context Window Budgeting
Every system prompt includes a live token budget calculation:
```
Available for conversation = totalContext - systemPromptTokens - toolDefinitions - outputReserve
```
The AI is instructed to use progressive loading and save summaries to files when approaching the limit.

### 5. Grounded Responses
All workers' compensation guidance must follow a **5-step policy verification workflow** with mandatory verbatim citations in the format:
```
"According to [Manual Name], Section [X], page [Y]: '[Verbatim Quote]'"
```
