# File Organization & Case Configuration

## Current product behavior (shipping)

SafeAppeals case workspaces use **plain markdown briefs and `.safeAppeals/` config**, not a twin `case.json` / Void `.voidrules` pipeline.

| Concern | Current location |
|---------|------------------|
| Case / folder Chat settings | `.safeAppeals/settings.json` (not `.vscode/` for new SafeAppeals case config) |
| Case-local skills | `.safeAppeals/skills/<name>/SKILL.md` |
| Case-local agents | `.safeAppeals/agents/*.agent.md` (global starters under `~/.safeAppeals/agents/`) |
| Product plans | `.safeAppeals/plans/` |
| Timeline | `.safeAppeals/timeline.json` |
| Workspace / nested agent rules | Root `AGENTS.md` and per-folder `AGENTS.md` (via `chat.useNestedAgentsMdFiles`) |
| Shared references for Private Search | `core_references/` |
| Standard document folders | snake_case: `medical_reports`, `correspondence`, `decisions_and_orders`, `evidence`, `personal_notes`, `to_sort` |

**Organize flow:** chat skill `extensions/safeappeals-timeline/skills/organize-files` (source default `./to_sort`). Logs under `.safeAppeals/organization_log.json` and `.safeAppeals/undo_plan.json`. Do **not** create `.safeAppeals/case.json` or `.fileorg.json` as part of project-setup.

**AI context analogue to Void `.voidrules`:** use workspace / nested **`AGENTS.md`** (and case skills/agents under `.safeAppeals/`), not `.voidrules`.

**Local Git:** optional local backup only. Safe Appeals does not auto-run `git init`. Agents are instructed never to push legal/client matter workspaces without explicit confirmation (`gitPrivacyRules.ts`).

**Tutorials:** `safeappeals-timeline.openTutorials` (Help → Tutorials) materializes the sample case as a real `file://` workspace and opens walkthroughs.

---

## Historical: `.fileorg.json` case config (Void-era)

> The sections below describe the retired Void file-organizer dashboard and
> `.fileorg.json` onboarding. They are kept for archaeology. Do not treat
> `.fileorg.json` / `.voidrules` / PascalCase folders as the current product
> contract.

### Overview (historical)

This system allowed users to set up case-specific information that:
1. **Helped organize files** - Provided keywords and party names for smart classification
2. **Auto-loaded into AI context** - Like `.voidrules`, the `.fileorg.json` file was read into AI system prompts

### Case Configuration File (`.fileorg.json`) — historical

Created in the workspace root, this file stored:

```json
{
  "version": "1.0",
  "caseInfo": {
    "caseNumber": "39573881",
    "claimantName": "Steven Oatman",
    "injuryDate": "2024-06-14",
    "caseType": "Workers Compensation",
    "description": "Brief case description...",
    "parties": {
      "claimant": {
        "name": "Steven Oatman",
        "lawyers": ["John Smith"],
        "doctors": ["Dr. Treating"]
      },
      "employer": {
        "name": "ABC Corporation",
        "lawyers": ["Kotze"],
        "doctors": ["Dr. IME"]
      },
      "wcb": {
        "adjudicators": ["Heather"],
        "references": ["R0331814"]
      }
    },
    "keywords": {
      "yourSide": ["claimant", "treating", "personal", "oatman"],
      "theirSide": ["employer", "wcb", "ime", "defense", "kotze"],
      "medical": ["medical", "doctor", "physician", "diagnosis"],
      "legal": ["legal", "court", "decision", "appeal"],
      "evidence": ["evidence", "study", "research", "expert"]
    }
  },
  "organizationSettings": {
    "selectedTemplate": "workers-comp-full",
    "preserveOriginalNames": true,
    "createBackup": true,
    "targetFolder": "./organized"
  }
}
```

### Historical components

- Case Onboarding wizard (`CaseOnboarding.tsx`) under Void contrib
- `fileOrganizerService.ts` / `fileOrgContextService.ts` under
  `src/vs/workbench/contrib/void/…` (not the shipping skill path)

### Migration guidance

| Old | Prefer now |
|-----|------------|
| `.voidrules` | `AGENTS.md` (+ nested folder `AGENTS.md`) |
| `.fileorg.json` / `.safeAppeals/case.json` | Case facts in `AGENTS.md` / notes; no twin JSON from project-setup |
| `Medical_Reports/`, `tosort/`, `policy-manuals/` | `medical_reports/`, `to_sort/`, `core_references/` |
| `.vscode/settings.json` for case Chat pins | `.safeAppeals/settings.json` |

See also: `extensions/safeappeals-timeline/skills/project-setup/SKILL.md` and
`organize-files/SKILL.md`.
