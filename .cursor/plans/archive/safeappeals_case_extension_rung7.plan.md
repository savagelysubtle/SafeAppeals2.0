---
name: safeappeals-case extension (Rung 7)
overview:
  "[SUPERSEDED Aug 2, 2026 — Steve: drop case.json + case-info; onboarding
  owns profile; users author AGENTS.md. Live plan:
  safeappeals_timeline_rung7_5ce1bf30.plan.md.] Historical: case info as
  AGENTS.md + .safeAppeals/case.json twin; timeline was slice 2."
todos:
  - id: slice1-scaffold
    content: "Slice 1: extension scaffold + case init/edit commands
      (AGENTS.md managed block + .safeAppeals/case.json + folder scaffold with
      nested per-folder AGENTS.md + global profile rule in
      ~/.copilot/instructions)"
    status: completed
  - id: slice1-onboarding
    content: "Slice 1b: 'Who You Are' step in first-startup onboarding modal
      (welcomeOnboarding core contrib) writing settings + global rule; +
      case-setup agent skill via contributes.chatSkills"
    status: completed
  - id: slice1-verify
    content: "Slice 1 verify: onboarding M1 (T4/T10/T12) shipped Jul 30 — profile
      rule / walkthrough ownership moved there; case commands + AGENTS.md /
      case.json path remains as built in 567beff7. Slice 1b supersession
      complete; no further verify work on this plan's slice 1."
    status: completed
  - id: slice2-timeline
    content: "MOVED to safeappeals_timeline_rung7_5ce1bf30.plan.md (no longer
      reads case.json)."
    status: cancelled
  - id: slice3-skills
    content: "Optional/later — tracked on new timeline plan if still wanted."
    status: cancelled
isProject: false
---

# safeappeals-case extension (Rung 7, extension-first)

## SUPERSEDED (Aug 2, 2026)

Archived. Do not implement from this file. Replacement:
[`safeappeals_timeline_rung7_5ce1bf30.plan.md`](../safeappeals_timeline_rung7_5ce1bf30.plan.md).

Steve decision: onboarding owns global profile; drop `case.json` and case-info
commands/managed AGENTS blocks; case brief = user-written `AGENTS.md`.

## Status (historical) — Slice 1 DONE; Slice 2 was next

Slices 1 + 1b committed (`567beff7`). Slice 1 verify closed after onboarding
M1 (Jul 30) took over T4/T10/T12 — profile/walkthrough/sample-case ownership
lives there; case commands + AGENTS.md + `.safeAppeals/case.json` stand.

**Slice 1b superseded (closed).** Do not extend it here.

**Slice 2 (timeline) is unblocked** (onboarding M1 shipped) but **not started**.
Source material is inventoried:
`void-reference/browser/timeline/jurisdictionConfig.ts` (312 lines,
`DEFAULT_JURISDICTIONS` with real `statuteOfLimitationsDays` +
`deadlineRules[]`), `common/timeline/timelineTypes.ts` (462),
`browser/timeline/timelineService.ts` (1018 — `calculateStatuteDeadline`,
`generateDeadlinesFromDecision`, `getUpcomingDeadlines`, `syncFromCaseConfig`),
`electron-main/timelineExportChannel.ts` (401, PDF export), plus ~4,900 lines
of React under `browser/react/src/timeline-tsx/`. **Porting snag to resolve
first:** old jurisdiction IDs are slugs (`bc-wcb`, `ontario-wsib`) while this
extension's `src/types.ts` `JURISDICTIONS` uses display names (`BC WCB`,
`Ontario WSIB`). Old timeline also persisted `.timeline.json` at workspace
root; the new home is `.safeAppeals/`.

### Defects found by audit (Jul 29), not yet fixed

1. **Profile rule silently not written for fresh users (HIGH).**
   `_writeProfileRule()` in `onboardingVariationA.ts` writes
   `~/.copilot/instructions/safeappeals-profile.instructions.md` without
   creating the parent directory, and swallows the failure. The extension's
   `src/profile.ts` writer does create it. So the one durable output of slice
   1b never lands for a user who has not previously run the extension command.
   Owner: onboarding plan T4.
2. **The two profile-rule writers disagree.** Same frontmatter and headings,
   but the provenance line differs ("onboarding" vs "walkthrough"), so running
   `setupProfile` after the wizard overwrites the wizard's file. The onboarding
   plan §6 asked for byte-compatibility; it does not hold today. Owner: T10.
3. Settings registration moved core-side (uncommitted): the
   `safeappeals.profile.*` block was deleted from this extension's
   `package.json` and re-registered in `welcomeOnboarding.contribution.ts` at
   `APPLICATION` scope. This is the correct fix — the wizard wrote those keys
   before the extension host had registered them — and this plan should no
   longer describe the extension as owning them.

## Design decisions (user, Jul 21)

- **AGENTS.md at case root** — user picked root over `.safeAppeals/` for
  visibility, the emerging standard, and easy user docs later. Uses stock
  VS Code/copilot plumbing; no custom instruction loaders.
- **Global profile in the FIRST-STARTUP onboarding modal** (user
  correction Jul 21: "walkthrough" meant the very-first-startup welcome
  flow, i.e. `src/vs/workbench/contrib/welcomeOnboarding`, not an
  extension walkthrough). New "Who You Are" step added to
  `OnboardingVariationA` between Sign In and Personalize: name,
  firm/organization, role, area of law, jurisdiction — all optional.
  Saves to `safeappeals.profile.*` (user settings) + writes the global
  rule file on step-leave and on dismiss-from-step. The extension's
  welcome-page walkthrough + "Set Up Profile" command remain as the
  re-run path (same rule file, same settings).
- **`case-setup` agent skill ships with the extension**
  (`contributes.chatSkills`, `skills/case-setup/SKILL.md`): the agent
  interviews the user (client, opposing, others on the case, what
  happened, where, dates, claim numbers), asks if it's their first time
  with AGENTS.md and explains folder-level AGENTS.md if so, then writes
  the same managed-block AGENTS.md + `.safeAppeals/case.json` the
  commands produce, and offers the standard folder scaffold.
- **Rules plumbing audit (Jul 21)** — how 1.129 injects instructions
  (`computeAutomaticInstructions.ts` + `promptFileLocations.ts` + `config.ts`
  under `contrib/chat/common/promptSyntax/`), and what we use:
  - `~/.copilot/instructions/*.instructions.md` is a DEFAULT user-level
    instructions location (`DEFAULT_INSTRUCTIONS_SOURCE_FOLDERS`); a file
    there with `applyTo: '**'` frontmatter is attached to every chat request
    in every workspace. → profile setup writes
    `~/.copilot/instructions/safeappeals-profile.instructions.md`.
  - `chat.useAgentsMdFile` (default TRUE): AGENTS.md at workspace root is
    always attached. → case brief needs zero config.
  - `chat.useNestedAgentsMdFiles` (default FALSE): nested AGENTS.md files
    are listed for on-demand loading via the read tool. → initCase writes a
    small AGENTS.md into each standard folder (tosort/, Medical_Reports/,
    …) describing its purpose/handling rules, and flips this setting ON
    (workspace target) for the case folder.
  - Skills load from `.agents/skills`/`.github/skills`/`.claude/skills`
    (workspace) and `~/.agents|.copilot|.claude/skills` (user) — slice 3.
- **Per-case**: `.safeAppeals/case.json` (structured twin) + managed block
  in AGENTS.md between `<!-- safeappeals-case:begin/end -->` markers so
  user prose outside the block is never touched.
- Replaces from old fork: case-info React pane, `caseProfileService`,
  `.caseinfo`, `.fileorg.json` case fields, `.voidrules` categories.

## Slice 1 surface

Commands (category "Safe Appeals Case"):
- `safeappeals-case.setupProfile` — quick-input flow, writes global settings
- `safeappeals-case.initCase` — case fields quick-input flow (defaults from
  profile), writes AGENTS.md + `.safeAppeals/case.json`, optional standard
  folder scaffold (Medical_Reports, Correspondence, Decisions_and_Orders,
  Evidence, Personal_Notes, tosort)
- `safeappeals-case.editCaseInfo` — re-runs flow prefilled from case.json,
  rewrites managed block + case.json

Walkthrough "Set Up Safe Appeals": step 1 profile, step 2 init case.

## case.json schema (v1)

caseName, claimNumber, caseType, jurisdiction, injuryDate (YYYY-MM-DD),
status, client {name, contact}, opposing {party, representative},
createdAt/updatedAt. Consumers: timeline (slice 2: jurisdiction + injury
date → statute deadlines), organizer (rung 8: party names/keywords for
classification), email (case linking display names).
