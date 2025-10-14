# Case Organizer Feature

## Overview

The Case Organizer is a specialized agent workflow for organizing workers compensation case documents using SafeAppeals2.0's terminal tools with maximum safety guardrails.

## Quick Start

### Launch the Organizer

1. **Command Palette**: Press `F1` and type "Void: Initialize Case Organizer"
2. **Or** use the command: `void.organizer.init`

This will:
- Open the Void sidebar
- Create a new chat thread in Agent mode
- Pre-fill a prompt with Case Organizer instructions

### Organization Modes

**1. Full Auto** ⚡
- Analyzes files automatically
- Creates backups in `tosort/_originals/`
- Shows dry-run plan for approval
- Executes moves with conflict resolution
- Generates logs and undo plans

**2. Interactive** 🤝
- Same as Full Auto but asks for confirmation on uncertain files
- You review and adjust categories before execution
- Perfect for first-time organization

**3. Manual** 📁
- Only creates the folder scaffold
- You manually move files
- No automated file operations

## Folder Structure Created

```
Case_Files/
├── Medical_Reports/        # Medical exams, doctor reports, diagnoses
├── Correspondence/         # Letters, emails, notices
├── Decisions_and_Orders/   # Legal decisions, rulings, awards
├── Evidence/               # Photos, witness statements, documents
├── Personal_Notes/         # Journal entries, drafts, notes
└── Uncategorized/          # Files that don't fit above categories
```

## Safety Features

### 🔒 Built-in Guardrails

1. **Dry-Run First**: Always shows a JSON preview before any file operations
2. **Automatic Backups**: Full Auto mode copies all files to `tosort/_originals/`
3. **Conflict Resolution**: Auto-renames duplicates with `_01`, `_02` suffixes
4. **Operation Logs**: Creates `organization_log.json` with all operations
5. **Undo Plans**: Generates `undo_plan.json` with reverse operations
6. **No Deletions**: Never deletes originals unless explicitly requested

### 📋 Dry-Run Plan Format

```json
{
  "mode": "full_auto",
  "operations": [
    {
      "source": "./tosort/2024-01-15_medical_exam.pdf",
      "destination": "./Case_Files/Medical_Reports/2024-01-15_Medical_Exam.pdf",
      "category": "Medical_Reports",
      "confidence": "high",
      "reason": "Filename contains 'medical' and 'exam'"
    }
  ],
  "stats": {
    "total_files": 25,
    "high_confidence": 20,
    "medium_confidence": 3,
    "low_confidence": 2,
    "conflicts_detected": 1
  }
}
```

## Categorization Heuristics

The agent uses filename pattern matching:

| Category | Keywords |
|----------|----------|
| **Medical_Reports** | medical, doctor, physician, exam, assessment, treatment, diagnosis, mri, xray, report |
| **Correspondence** | letter, email, correspondence, notice, communication |
| **Decisions_and_Orders** | decision, order, ruling, judgment, determination, award |
| **Evidence** | evidence, witness, statement, photo, image, document |
| **Personal_Notes** | note, journal, diary, personal, draft |

## OS-Specific Commands

### Windows (PowerShell)
```powershell
# Create directory
New-Item -ItemType Directory -Path ".\Case_Files\Medical_Reports" -Force

# Copy for backup
Copy-Item -Path ".\tosort\file.pdf" -Destination ".\tosort\_originals\file.pdf" -Force

# Move file
Move-Item -Path ".\tosort\file.pdf" -Destination ".\Case_Files\Medical_Reports\file.pdf" -Force
```

### macOS/Linux (bash)
```bash
# Create directory
mkdir -p ./Case_Files/Medical_Reports

# Copy for backup
cp ./tosort/file.pdf ./tosort/_originals/file.pdf

# Move file
mv ./tosort/file.pdf ./Case_Files/Medical_Reports/file.pdf
```

## Workflow Example

### Step 1: Initialize
```
User: Runs "Void: Initialize Case Organizer"
Agent: "I'll help organize your workers compensation case files. 
        Which mode would you like?
        1. Full Auto - I'll handle everything with backups
        2. Interactive - You'll confirm uncertain categorizations  
        3. Manual - Just create the folder structure
        
        Type 1, 2, or 3 to choose."
```

### Step 2: Analysis
```
Agent: "Analyzing files in ./tosort...
        Found 25 files:
        - 20 high-confidence categorizations
        - 3 medium-confidence
        - 2 low-confidence"
```

### Step 3: Dry-Run Preview
```
Agent: "Here's the organization plan:
        [Shows JSON plan]
        
        Review the plan above. Type 'proceed' to continue, 
        'edit' to modify, or 'cancel' to stop."
```

### Step 4: Execution
```
User: "proceed"
Agent: "Creating backups in ./tosort/_originals/...
        ✓ Backed up 25 files
        Creating folder structure...
        ✓ Created all directories
        Moving files...
        ✓ Moved 23 files
        ⚠ Skipped 2 files (errors logged)
        
        Summary: 23 moved, 2 skipped, 1 conflict resolved
        Logs: organization_log.json, undo_plan.json"
```

## Generated Files

### `organization_log.json`
Complete record of all operations performed:
```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "mode": "full_auto",
  "operations": [
    {
      "type": "move",
      "source": "./tosort/medical_report.pdf",
      "destination": "./Case_Files/Medical_Reports/medical_report.pdf",
      "status": "success",
      "timestamp": "2025-01-15T10:30:05Z"
    }
  ],
  "summary": {
    "total": 25,
    "success": 23,
    "failed": 2,
    "skipped": 0
  },
  "errors": [
    {
      "file": "corrupted.pdf",
      "error": "File not found",
      "timestamp": "2025-01-15T10:30:15Z"
    }
  ]
}
```

### `undo_plan.json`
Reverse operations to restore original state:
```json
{
  "operations": [
    {
      "type": "move",
      "source": "./Case_Files/Medical_Reports/medical_report.pdf",
      "destination": "./tosort/medical_report.pdf"
    }
  ]
}
```

## Advanced Usage

### Custom Source Folder
If your files aren't in `tosort/`:
```
User: "My files are in D:\Documents\WC_Docs\"
Agent: "I'll analyze D:\Documents\WC_Docs\ instead..."
```

### Add Custom Categories
Create a `.voidrules` file:
```
When organizing case files:
- Add a "Legal_Correspondence" category for lawyer communications
- Add a "Financial" category for bills and receipts
- Use pattern matching for these new categories
```

### Batch Multiple Folders
```
User: "I have 3 case folders to organize: case_2023, case_2024, case_2025"
Agent: "I'll process each folder separately with the same structure..."
```

## Troubleshooting

### "tosort folder not found"
- Create the folder manually: `mkdir tosort`
- Or specify a different folder when prompted

### "Permission denied"
- Run VSCode as administrator (Windows)
- Check folder permissions (macOS/Linux)

### "Files not moving"
- Check the `organization_log.json` for specific errors
- Ensure destination folders were created
- Verify files aren't locked/in use

### "Want to undo organization"
- Check `undo_plan.json` for reverse operations
- Or restore from `tosort/_originals/` (Full Auto mode)

## Implementation Details

### Files Modified
- `src/vs/workbench/contrib/void/common/prompt/prompts.ts` - System prompt and default prompt
- `src/vs/workbench/contrib/void/browser/sidebarActions.ts` - Command registration
- Terminal tools enabled in `toolsService.ts`, `toolsServiceTypes.ts`

### Tools Used
- `run_command` - Execute PowerShell/bash commands
- `get_dir_tree` - Analyze folder structure
- `read_file` - Sample file content for uncertain categorizations
- `ls_dir` - List directory contents

### Command ID
`void.organizer.init`

## Future Enhancements

Potential additions:
- MCP server for richer file operations
- Template-based categorization rules
- Bulk rename operations
- OCR for scanned documents
- Date-based organization
- Auto-tagging with metadata

## Support

For issues or questions:
- GitHub: https://github.com/savagelysubtle/SafeAppeals2.0
- Documentation: See VOID_CODEBASE_GUIDE.md

