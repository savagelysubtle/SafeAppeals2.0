---
name: Add Template Layouts to File Organizer
overview: Add three folder template layouts (Legal/Appeals, Research/Academic, Business/Project) to the File Organizer's destination panel, allowing users to switch between different organizational structures.
todos:
  - id: define-templates
    content: Define the three template folder structures as constants in FilingCabinet.tsx
    status: completed
  - id: add-state
    content: Add useState for selectedTemplate with default 'legal'
    status: completed
  - id: add-buttons
    content: Add template toggle buttons in the FilingCabinet header using VSCode button styling
    status: completed
  - id: dynamic-tree
    content: Make treeData dynamic based on selectedTemplate state
    status: completed
  - id: service-method
    content: Add initializeFoldersFromTemplate() method to fileOrganizerService.ts
    status: completed
  - id: core-ref-type
    content: Add isCoreReference and coreReferenceReason fields to AIClassificationResult interface
    status: completed
  - id: core-ref-prompt
    content: Update buildContextAwarePrompt to include Core_References detection criteria
    status: completed
  - id: core-ref-parse
    content: Update parseContextAwareResponse to extract isCoreReference from AI response
    status: completed
isProject: false
---

# Add Template Layouts to File Organizer

## Current State

The FilingCabinet component ([FilingCabinet.tsx](src/vs/workbench/contrib/void/browser/react/src/file-organizer-tsx/FilingCabinet.tsx)) currently has a hardcoded Legal/Appeals folder structure:

```typescript
const treeData = [
	{ name: "Medical", icon: "🏥", children: ["Reports", "Imaging", "Bills"] },
	{
		name: "Legal",
		icon: "⚖️",
		children: ["Correspondence", "Court Filings", "Decisions"],
	},
	{ name: "Evidence", icon: "📎", children: [] },
	{ name: "Your Side", icon: "👤", children: [] },
	{ name: "Their Side", icon: "🏢", children: [] },
];
```

## Changes Required

### 1. Define Template Data Structures

Add template definitions at the top of `FilingCabinet.tsx`:

- **Legal/Appeals Template**: Current structure (Your Side, Their Side, Medical, Legal, Evidence, etc.)
- **Research/Academic Template**: Literature, Data, Drafts, Final, Notes, Core_References
- **Business/Project Template**: Admin, Planning, Working, Deliverables, Communications, Archive

### 2. Update FilingCabinet Component

**File**: [FilingCabinet.tsx](src/vs/workbench/contrib/void/browser/react/src/file-organizer-tsx/FilingCabinet.tsx)

- Add `useState` for selected template (default: 'legal')
- Add template selection buttons in header section (below "DESTINATION" title)
- Make `treeData` dynamic based on selected template
- Use existing button styling patterns from DocketInspector:
  - Primary: `var(--vscode-button-background)`
  - Secondary: `var(--vscode-button-secondaryBackground)`

**Button Layout (in header)**:

```
DESTINATION
[Legal] [Research] [Business]  <- small toggle buttons
```

### 3. Update FileOrganizerService

**File**: [fileOrganizerService.ts](src/vs/workbench/contrib/void/browser/fileOrganizer/fileOrganizerService.ts)

Add method to create folders for a specific template:

- `initializeFoldersFromTemplate(template: 'legal' | 'research' | 'business')`
- Reuse existing folder creation logic from `initializeCaseFolders()`

### 4. Wire Up Template Initialization (Optional)

If the user wants folders created automatically when switching templates:

- Pass `fileOrganizerService` to FilingCabinet via props or useAccessor
- Call folder creation when template changes

## Template Folder Structures

**Legal/Appeals** (from systemPrompt.ts lines 999-1024):

- 01_Your_Side/ (Medical_Treating, Legal_Representation, Personal_Statements)
- 02_Their_Side/ (IME_Reports, Employer_Defense, WCB_Decisions)
- 03_Correspondence/ (Incoming, Outgoing)
- 04_Timeline_Evidence/
- 05_Appeals/
- 06_Reference/ (Templates)
- Core_References/

**Research/Academic** (lines 1030-1048):

- 01_Literature/ (Primary_Sources, Secondary_Sources, References)
- 02_Data/ (Raw, Processed, Analysis)
- 03_Drafts/
- 04_Final/
- 05_Notes/
- Core_References/

**Business/Project** (lines 1053-1073):

- 01_Admin/ (Contracts, Invoices, Licenses)
- 02_Planning/ (Requirements, Proposals)
- 03_Working/
- 04_Deliverables/
- 05_Communications/ (Internal, External)
- Archive/
- Core_References/

## UI Mockup

```
┌─────────────────────────────────┐
│ 📁 DESTINATION                  │
├─────────────────────────────────┤
│ [Legal] [Research] [Business]   │  <- template buttons
├─────────────────────────────────┤
│ Filing to: Medical/Reports      │
├─────────────────────────────────┤
│ 📂 01_Your_Side                 │
│   📄 Medical_Treating           │
│   📄 Legal_Representation       │
│ 📂 02_Their_Side                │
│   📄 IME_Reports                │
│   ...                           │
└─────────────────────────────────┘
```

---

## 5. Core_References AI Detection

**File**: [aiClassifier.ts](src/vs/workbench/contrib/void/browser/fileOrganizer/aiClassifier.ts)

### Problem

The AI classifier needs to recognize when a document is a foundational/authoritative reference that belongs in Core_References, rather than a normal case document.

### Solution

Update the classification prompt (`buildContextAwarePrompt`) to:

1. **Add explicit Core_References criteria** - Define what qualifies:

- Official policy manuals (WCB policies, company HR policies)
- Government regulations and statutes
- Seminal research papers/studies cited repeatedly
- Medical/legal reference guides
- Industry standards documents

1. **Add `isCoreReference` field** to the JSON response:

```json
 {
   "side": "Neutral",
   "category": "Medical",
   "isCoreReference": true,
   "coreReferenceReason": "Official WCB policy manual - foundational document",
   "suggestedFolder": "Core_References",
   ...
 }
```

1. **Add explicit guidance** that Core_References is NOT for:

- Regular case documents
- Individual medical reports
- Correspondence
- Evidence specific to one case

### Prompt Addition (to buildContextAwarePrompt)

```
## CORE_REFERENCES DETECTION
Identify if this file is a FOUNDATIONAL REFERENCE document. Core_References are:
- Official policy manuals (WCB, employer policies, insurance guidelines)
- Government regulations, statutes, or legal codes
- Seminal peer-reviewed research papers that establish key principles
- Medical textbook excerpts or authoritative clinical guidelines
- Industry standards (e.g., AMA Guides, DSM criteria)

IMPORTANT: Core_References are RARE. Most case files do NOT belong here.
Do NOT classify as Core_Reference:
- Individual patient medical reports
- Case-specific correspondence
- Personal evidence or statements
- Regular legal filings

Only suggest Core_References if the document is authoritative and would be
referenced across MULTIPLE cases, not just this one.
```

### Type Update

**File**: [aiClassifier.ts](src/vs/workbench/contrib/void/browser/fileOrganizer/aiClassifier.ts) - `AIClassificationResult` interface:

```typescript
export interface AIClassificationResult {
	// ... existing fields ...
	isCoreReference?: boolean;
	coreReferenceReason?: string;
}
```
