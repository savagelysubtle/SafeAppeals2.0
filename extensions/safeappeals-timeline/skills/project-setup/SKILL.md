---
name: project-setup
description: Interview the user and set up a Safe Appeals project folder — plain root AGENTS.md and optional folders keyed off safeappeals.profile.role. Use when starting a new matter, workspace, or case brief, or when the user asks to initialize project structure.
---

# Safe Appeals project setup

Set up (or refresh) the **current workspace root** as a Safe Appeals project.
Write a plain root `AGENTS.md` the agent can use as the project brief. Optionally
scaffold folders. Do **not** create `.safeAppeals/case.json`, managed
`<!-- safeappeals-*:begin/end -->` markers, or call retired commands
(`safeappeals-case.initCase`, `safeappeals-case.editCaseInfo`,
`safeappeals-timeline.initCase`, or any `*editCaseInfo` / `*openCaseBrief`).

## 1. Read the user's role

1. Read the setting `safeappeals.profile.role` (and other `safeappeals.profile.*`
   values when useful for defaults).
2. Map the role to a persona group (same rules as
   `profileRuleTemplate` / `getPersonaGroup`):

| Role | Persona group |
| ---- | ------------- |
| Lawyer, Paralegal, Advocate, Appeals Representative, Union Representative | `legal` |
| Injured Worker, Representing Myself | `self` |
| Student, Teacher | `education` |
| Researcher | `research` |
| Office Worker | `office` |
| Software Developer | `developer` |
| Empty or unrecognized | treat as `legal` for interview questions (legacy default) |

Canonical role strings (exact match): Lawyer, Paralegal, Advocate, Appeals
Representative, Union Representative, Injured Worker, Representing Myself,
Student, Teacher, Researcher, Office Worker, Software Developer.

If the role is missing, ask once which role fits best, then continue. Do not
block setup if they prefer to skip — use the `legal` question set and note the
gap in `AGENTS.md`.

## 2. Interview for project facts (by group)

Ask only what that group needs. Prefer a short multi-turn interview over a
long form. Skip fields the user already answered in chat. Confirm before
writing files.

### `legal` / `self`

- Project / matter name
- Claim or file number (if any)
- Case type / area of law
- Jurisdiction / compensation board or tribunal
- Injury or incident date (if relevant)
- Status (active, closed, exploratory, …)
- Client or party on our side (name; contact only if they want it in the brief)
- Opposing party / representative (if known)
- Notes the agent should always keep in mind

For `self`, use plain language and avoid assuming they have counsel.

### `education`

- Course, class, or project title
- School / institution
- Field of study or subject / level
- Preferred citation style
- Assignment goals or deliverables
- Notes for how the agent should help (e.g. explain reasoning; do not submit
  assessed work for students)

### `research`

- Project or study title
- Institution / affiliation
- Research field
- Preferred citation style
- Research questions or scope
- Notes on sources the agent must prefer or avoid

### `office`

- Project or initiative name
- Company / organization
- What the work is about (`focusArea`)
- Stakeholders or internal docs to respect
- Notes on tone (concise, action-oriented)

### `developer`

- Project / repo name
- Company / team
- Languages / stack
- Build, test, and run commands if known
- Conventions or pitfalls the agent should know
- Notes on docs the agent should prefer

## 3. Write or update root `AGENTS.md`

- Path: workspace root `AGENTS.md` only (not nested copies unless scaffolding
  folders — see below).
- **Plain markdown.** No YAML frontmatter required. No managed begin/end HTML
  comments. No twin JSON under `.safeAppeals/`.
- If `AGENTS.md` already exists, **merge**: keep useful existing content, update
  stale project facts from the interview, do not wipe unrelated sections.
- Structure suggestion (adapt headings to the persona group):

  ```markdown
  # <Project title>

  ## Snapshot
  - **…:** …

  ## Parties / people (if relevant)
  …

  ## Notes for the agent
  …
  ```

- **Required in Notes for the agent** (adapt voice; do not omit for legal /
  self / education / research / office matters that may hold confidential
  documents): if this workspace is a legal matter, case folder, or contains
  legal/client documents — **never push** to GitHub or any git remote; only
  commit locally when the user wants history; if they ask to push, warn that
  confidential documents would leave this computer and proceed only after
  explicit confirmation. For a clearly coding/software project (not a client
  matter), confirm once when they ask to push, then you may push.

- Remind the user they own this file and can edit it freely.

## 4. Optional folder scaffold

Ask whether to create folders. Never delete existing files.

### `legal` / `self`

Offer folders similar to the extension's standard legal layout
(`scaffold.ts` `STANDARD_FOLDERS`):

- `medical_reports`
- `correspondence`
- `decisions_and_orders`
- `evidence`
- `personal_notes`
- `to_sort`

Optionally add a short nested `AGENTS.md` in each new folder describing its
purpose (preserve existing nested briefs).

Optionally also offer:

- A root `.gitignore` that skips OS/editor noise and Safe Appeals organizer
  churn (`.safeAppeals/organization_log.json`, `.safeAppeals/undo_plan.json`,
  `to_sort/_originals/`) while keeping case document folders and
  `.safeAppeals/skills/` tracked — for users who want local git backups of
  matter docs. Do not ignore all of `.safeAppeals/` (skills must stay
  trackable; timeline.json may be optionally ignored).
- A `<matter_name>.code-workspace` file (single folder, `path: "."`) with the
  same Chat settings as `.safeAppeals/settings.json` — at least
  `"chat.useNestedAgentsMdFiles": true` so nested folder briefs work when the
  workspace file is opened. Prefer `.safeAppeals/settings.json` over
  `.vscode/settings.json`. Do not auto-run `git init`.
- Optional case-local skills under `.safeAppeals/skills/<skill-name>/SKILL.md`
  for repeatable matter tasks. Safe Appeals discovers this root by default;
  if skills do not appear, ensure `chat.agentSkillsLocations` in
  `.safeAppeals/settings.json` includes `.safeAppeals/skills: true` (keep other
  default roots when overriding). Only create skills the user asks for.

### `education`

Lighter layout, for example: `Readings`, `Notes`, `Drafts`, `Handouts` (teachers)
or `Assignments`, `Notes`, `Sources` (students). Adjust to what they ask for.

### `research`

Lighter layout, for example: `Sources`, `Notes`, `Drafts`, `Data`.

### `office`

Lighter layout, for example: `Inbox`, `Drafts`, `Reference`, `Archive`.

### `developer`

Prefer the repo's existing layout. Only suggest minimal extras if the tree is
empty (e.g. `docs/`, `scripts/`) — do not invent a legal case tree.

## 5. Finish

1. Summarize what you wrote or created (paths only).
2. Point them to Chat for ongoing work; timeline/deadlines features may land
   separately — do not invent timeline store APIs.
3. Never instruct another agent or the user to run retired case-info commands.
