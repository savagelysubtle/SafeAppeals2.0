---
name: organize-files
description: Organize case documents from to_sort (or a user-chosen folder) into the standard Safe Appeals legal folders with a dry-run plan and confirmation. Use when the user asks to organize files, sort the docket, file documents into medical_reports/correspondence/etc., or clean up unsorted intake.
---

# Safe Appeals file organizer

Classify and move case documents from unsorted intake into the standard Safe
Appeals legal folder layout. This skill is **file organization only** — it does
not interview the user for project facts, write root `AGENTS.md`, or scaffold a
full project brief (use the **project-setup** skill for that).

Do **not** create `.safeAppeals/case.json`, `.fileorg.json`, or call retired
commands (`safeappeals-case.initCase`, `safeappeals-case.editCaseInfo`,
`safeappeals-timeline.initCase`, or any `*editCaseInfo` / `*openCaseBrief`).

## 1. Standard folder layout

Folders live **flat at the workspace root** (same as `scaffold.ts`
`STANDARD_FOLDERS` and the **project-setup** skill). There is **no**
`Case_Files/` wrapper and **no** `Uncategorized` folder.

| Folder | Purpose |
| ------ | ------- |
| `medical_reports` | Doctor reports, exams, assessments, imaging, treatment records |
| `correspondence` | Letters, emails, notices, board/employer communication |
| `decisions_and_orders` | Official decisions, orders, rulings, awards |
| `evidence` | Witness statements, photos, pay records, non-medical supporting docs |
| `personal_notes` | User notes, drafts, agent summaries (not originals) |
| `to_sort` | Unsorted intake — source folder for organization |

If standard folders are missing, offer to run the **project-setup** skill
first (scaffold-only) or create only the missing folders after asking. Do not
invent a `Case_Files/` hierarchy.

## 2. Choose a mode

Ask once unless the user already specified a mode.

| Mode | Behavior |
| ---- | -------- |
| **interactive** (default) | Analyze files, show dry-run JSON plan, confirm low-confidence placements with the user, then execute approved moves |
| **full_auto** | Analyze, dry-run preview, create backups, execute all high/medium-confidence moves without per-file prompts |
| **scaffold-only** | Ensure standard folders exist (and optional nested folder briefs if **project-setup** left them out); **do not move any files**. Point the user at **project-setup** if they need a project brief |

## 3. Source folder

1. Default source: `./to_sort` at workspace root.
2. If `./to_sort` is missing, ask whether to create it or use a different folder.
3. If the user names another folder, use that path instead.
4. Recurse only within the chosen source tree; do not move files already sitting in destination folders unless the user asks to re-sort them.

## 4. Analyze and categorize

For each file in the source tree:

1. **Filename heuristics** (case-insensitive substring match):

   - **medical_reports:** medical, doctor, physician, exam, assessment,
     treatment, diagnosis, mri, xray, report (when clearly medical context)
   - **correspondence:** letter, email, correspondence, notice, communication
   - **decisions_and_orders:** decision, order, ruling, judgment, determination,
     award
   - **evidence:** evidence, witness, statement, photo, image, document (when
     not better fit elsewhere)
   - **personal_notes:** note, journal, diary, personal, draft

2. **Content sample:** for text-like files with ambiguous filenames, read roughly
   the first 1 KB and use content to refine category.

3. **Confidence:**

   - **high** — clear filename or content match
   - **medium** — plausible match, minor ambiguity
   - **low** — unclear; in **interactive** mode ask the user; in **full_auto**
     leave in `to_sort` (do not invent extra folders)

4. **Never delete originals.** Moves only. On destination filename conflict,
   auto-rename with numeric suffix (`_01`, `_02`, …).

5. Prefer workspace / agent file tools (read, list, copy, move) over shell
   commands. If shell is unavoidable, show each command before running.

## 5. Dry-run plan (required before any move)

**Always** build and show a JSON preview. Wait for `proceed`, `edit`, or
`cancel`. Do not execute until the user approves (except **scaffold-only**,
which creates folders only).

```json
{
  "mode": "interactive",
  "source": "./to_sort",
  "operations": [
    {
      "source": "./to_sort/2024-01-15_medical_exam.pdf",
      "destination": "./medical_reports/2024-01-15_medical_exam.pdf",
      "category": "medical_reports",
      "confidence": "high",
      "reason": "Filename contains 'medical' and 'exam'"
    }
  ],
  "skipped": [
    {
      "source": "./to_sort/scan001.pdf",
      "reason": "low confidence — left in to_sort pending user input"
    }
  ],
  "stats": {
    "total_files": 25,
    "high_confidence": 20,
    "medium_confidence": 3,
    "low_confidence": 2,
    "conflicts_detected": 1
  },
  "conflicts": [
    {
      "file": "report.pdf",
      "issue": "Already exists in destination",
      "resolution": "Will rename to report_01.pdf"
    }
  ]
}
```

After `edit`, revise the plan and show an updated dry-run. On `cancel`, stop
without moving files.

## 6. Execute (interactive or full_auto, after approval)

1. Create any missing destination folders (flat at workspace root).
2. **full_auto only:** create `./to_sort/_originals/` and copy every file
   slated to move into `_originals/` **before** moving (preserve relative paths
   or basenames as needed for restore).
3. For each approved operation:
   - Ensure destination parent exists
   - Resolve conflicts with `_01`, `_02`, … suffixes
   - Move the file (never delete the source without an explicit user request
     to discard — default is move)
   - Record success or failure
4. Write logs under `.safeAppeals/` (create the directory if needed):
   - `.safeAppeals/organization_log.json` — move metadata only (paths,
     categories, timestamps, outcomes); **never** file contents
   - `.safeAppeals/undo_plan.json` — reverse operations for manual undo
5. If a log file already exists, ask before overwriting or append a new run
   entry — do not silently discard history.

## 7. Summary

Report a short summary: files moved, skipped (still in `to_sort`), conflicts
resolved, backup count (**full_auto**), errors, and paths to the log files.

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

## 8. Interactive mode specifics

- For **low** confidence (and optionally **medium** when the user wants
  control), ask: "Where should I place '<filename>'? Suggested: `<category>`"
- Allow a custom destination under one of the standard folders
- Re-show the dry-run after user input before executing

## 9. Scaffold-only mode

- Create missing standard folders at workspace root (same list as §1)
- Optionally mention nested folder briefs — if missing, suggest **project-setup**
- Print that folder structure is ready and files can be moved manually or by
  re-running this skill in **interactive** / **full_auto**
- **Do not** move files or write organization logs

## 10. Error handling

- Record failures per operation; continue with the rest
- Never abort the entire batch because of a single failure unless the user
  asks to stop
- Include all errors in the final summary

## 11. Finish

1. Summarize what moved and what remains in `to_sort`.
2. Remind the user that `.safeAppeals/undo_plan.json` describes reverse moves
   if they need to undo.
3. For project facts or root `AGENTS.md`, point them to **project-setup** —
   not this skill.
