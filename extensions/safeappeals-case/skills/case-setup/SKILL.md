---
name: case-setup
description: Interview the user about a legal case and build its AGENTS.md case brief. Use when the user wants to set up a new case, create or update a case brief, says things like "new case", "set up this case", "who is this case about", or when a case folder has no AGENTS.md yet and the user asks for help organizing it.
---

# Case Setup — Build the Case Brief Interactively

You are helping the user set up a case workspace for Safe Appeals. The goal
is a complete `AGENTS.md` case brief at the workspace root so every future
conversation automatically knows the case.

## Step 0 — Check what already exists

- If `AGENTS.md` exists at the root with a `<!-- safeappeals-case:begin` block,
  this case is already set up. Offer to update it instead (ask only about the
  fields that are empty or that the user wants to change).
- If `.safeAppeals/case.json` exists, read it first and confirm rather than
  re-asking.

## Step 1 — First time with AGENTS.md?

Ask the user if they have used case briefs (AGENTS.md files) before. If it is
their first time, briefly explain before continuing:

- `AGENTS.md` at the case root is read automatically at the start of every
  conversation — it is how the assistant "remembers" the case.
- They can also put a small `AGENTS.md` inside any folder (like `tosort/` or
  `Medical_Reports/`) to describe what belongs in that folder and how files
  there should be treated. The assistant consults these when working in that
  folder.
- Everything is plain Markdown they can edit by hand at any time.

## Step 2 — Interview

Ask conversationally, a few questions at a time — not a wall of questions.
Collect:

1. **Case name** — a short label (suggest the folder name).
2. **Client** — who is this case for? Name and, if offered, contact info.
3. **Opposing side** — employer, board/WCB, insurer? Who represents them?
4. **Anyone else on the case** — co-counsel, doctors, case managers,
   witnesses worth noting.
5. **What happened** — a 2–4 sentence plain-language summary of the injury
   or dispute, in the user's own words.
6. **Where** — jurisdiction (e.g. BC WCB, Ontario WSIB, California DWC).
   If the user's profile has a default jurisdiction, propose it.
7. **Key dates** — injury/incident date, any decision dates, known deadlines.
8. **Claim / file numbers** and current status (active, appeal filed,
   awaiting decision).

Accept "skip" or "I don't know" for anything — never block on a field.

## Step 3 — Write the files

Write **both** files so the Safe Appeals UI stays in sync:

### `AGENTS.md` (workspace root)

Use exactly this managed-block structure (the "Edit Case Info" command
updates content between the markers, so keep them intact):

```markdown
# {Case name} — Case Brief

This folder is a Safe Appeals case workspace. The block below is maintained
by the "Safe Appeals Case: Edit Case Info" command; edit it there so the
structured copy stays in sync.

<!-- safeappeals-case:begin — managed by Safe Appeals; edit via the "Safe Appeals Case: Edit Case Info" command -->
## Case information

- **Case name:** …
- **Claim number:** …
- **Case type / area of law:** …
- **Jurisdiction:** …
- **Injury / incident date:** …
- **Status:** …

## Client (our side)

- **Name:** …
- **Contact:** …

## Opposing side

- **Party:** …
- **Representative:** …

Structured copy of this data lives in `.safeAppeals/case.json`.
<!-- safeappeals-case:end -->

## Case notes for the agent

{The "what happened" summary, other people on the case, and anything else
the user told you that doesn't fit the fields above. This section belongs to
the user — preserve existing content when updating.}
```

### `.safeAppeals/case.json`

```json
{
	"version": 1,
	"caseName": "",
	"claimNumber": "",
	"caseType": "",
	"jurisdiction": "",
	"injuryDate": "",
	"status": "active",
	"client": { "name": "", "contact": "" },
	"opposing": { "party": "", "representative": "" },
	"createdAt": "<ISO timestamp>",
	"updatedAt": "<ISO timestamp>"
}
```

`injuryDate` is `YYYY-MM-DD` or empty. Preserve `createdAt` when updating.

## Step 4 — Offer folder structure

If the standard case folders don't exist yet, offer to create them, each
with a one-paragraph `AGENTS.md` describing its purpose:

- `Medical_Reports/` — medical evidence; originals are read-only
- `Correspondence/` — letters/emails; drafts go elsewhere
- `Decisions_and_Orders/` — official decisions; check deadlines when new ones arrive
- `Evidence/` — non-medical supporting evidence
- `Personal_Notes/` — the user's drafts and working documents (agent output goes here)
- `tosort/` — unsorted intake, to be classified into the folders above

If the user declined the first-time explanation earlier, still mention in one
sentence that these folder briefs are how the assistant knows what each
folder is for.

## Step 5 — Wrap up

Tell the user the case brief is live from the next message onward, and that
they can update it by editing `AGENTS.md` directly, rerunning this skill, or
using the "Safe Appeals Case: Edit Case Info" command.
