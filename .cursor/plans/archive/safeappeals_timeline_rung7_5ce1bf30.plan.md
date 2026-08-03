---
name: safeappeals-timeline (Rung 7)
overview:
  "Aug 2, 2026 rewrite of Rung 7. Rename extensions/safeappeals-case →
  safeappeals-timeline (timeline tools + store/UI — not a case extension).
  No case-info UI / case.json. Onboarding owns profile; role-pill project-setup
  skill (plain AGENTS.md + folders) ships in this extension. Six void timeline
  agent tools + .safeAppeals/timeline.json. Supersedes
  archive/safeappeals_case_extension_rung7.plan.md."
todos:
  - id: r7-rename-extension
    content:
      "Rename extensions/safeappeals-case → extensions/safeappeals-timeline:
      package name, command prefix safeappeals-timeline.*, gulp/dirs,
      product.json trustedExtensionAuthAccess, watermark/onboarding/tour
      command ids, nls, tests, docs/plan pointers. Display name Safe Appeals
      Timeline."
    status: completed
  - id: r7-retire-caseinfo
    content:
      "Retire case-info UI/twin only: delete case.json writers/readers, managed
      AGENTS markers, initCase/editCaseInfo/openCaseBrief; scrub
      walkthrough/nls/sampleCase; retarget watermark + onboarding startOwnCase
      to Chat. Do NOT leave the product without a project-setup skill — see
      r7-project-setup-skill."
    status: completed
  - id: r7-project-setup-skill
    content:
      "Agent skill (contributes.chatSkills) in safeappeals-timeline: role-based
      project/folder setup keyed off safeappeals.profile.role pills. Interview +
      plain AGENTS.md + optional folder scaffold — NO case.json / managed
      markers / case-info commands. Replace retired case-setup skill."
    status: completed
  - id: r7-master-pointers
    content:
      "Update master plan: r7-timeline → this plan; done-rung7-slice1 note
      case-info retired; r8 drop case.json dep; inventory table + D1
      supersession note; rename safeappeals-case → safeappeals-timeline in
      inventory."
    status: completed
  - id: r7-jurisdiction-ids
    content:
      "Canonical jurisdiction IDs = void-reference slugs (bc-wcb) + display
      labels for UI/profile; migrate types.ts JURISDICTIONS + onboarding
      PROFILE_JURISDICTIONS; alias map for existing display-name profile
      values; keep jurisdictionsDrift.test green."
    status: completed
  - id: r7-timeline-store
    content:
      "Define .safeAppeals/timeline.json schema (jurisdictionId, injuryDate,
      events[] with deadline flags) + load/save helpers; plaintext workspace
      file by design (same carve-out as old case.json)."
    status: completed
  - id: r7-timeline-engine
    content:
      "Port statute/deadline calc from void-reference jurisdictionConfig +
      timelineService (calculateStatuteDeadline, generateDeadlinesFromDecision,
      getUpcomingDeadlines); drop syncFromCaseConfig; persist under
      .safeAppeals/ not root .timeline.json."
    status: completed
  - id: r7-timeline-ui
    content:
      "Production timeline + deadlines UI in safeappeals-timeline (port void
      timeline-tsx into extension webview — not a stub list). Jurisdiction/dates
      collected in-UI; deadline notifications; ICS export; soft calendar
      getEvents pull (Q5 write-back still open on master). PDF export optional
      follow-on if electron channel is heavy."
    status: completed
  - id: r7-timeline-tools
    content:
      "Remake void-reference timeline agent tools on vscode.lm in
      safeappeals-timeline (same pattern as documents/email agentTools.ts):
      timeline_add_event, timeline_update_event, timeline_delete_event,
      timeline_get_events, timeline_link_document, timeline_get_deadlines —
      wire to store/engine; allowlist; tests. Source: void-reference prompts.ts
      + toolsService.ts + toolsServiceTypes.ts."
    status: completed
  - id: r7-timeline-verify
    content:
      "Manual Electron + web: Open Case Timeline; create/edit events; agent
      tools round-trip; AGENTS.md untouched. Unit gates already green (compile
      + 7 mocha incl. agentTools); reviewer APPROVE + should-fixes landed."
    status: pending
isProject: false
---

# safeappeals-timeline (Rung 7 rewrite)

## Status (Aug 2, 2026) — rename/retire/skill + timeline store/engine/tools/UI shipped; verify pending

**Supersedes:**
[`archive/safeappeals_case_extension_rung7.plan.md`](archive/safeappeals_case_extension_rung7.plan.md)
(slices 1–1b historical; slice 2 cancelled there and rebuilt here without
`case.json`).

| Was (old plan) | Now |
| --- | --- |
| Extension `safeappeals-case` | **Rename → `safeappeals-timeline`** |
| Global profile via walkthrough + extension | **Onboarding** owns profile (done); `setupProfile` re-run may stay under new id |
| Managed `AGENTS.md` + `case.json` twin | **Drop twin.** User/agent write `AGENTS.md` |
| Case-info commands / UI | **Retire** |
| Old `case-setup` skill (wrote twin) | **Replace** with role-based **project-setup** skill |
| Timeline | Store + UI + **six agent tools** in this extension |

Parallel work: email / OAuth piggyback is Rung 6.5 — no dependency either way.

## Decisions (Steve, Aug 2)

1. **Rename the extension to timeline.** Folder `extensions/safeappeals-timeline`,
   npm/`package.json` name `safeappeals-timeline`, commands
   `safeappeals-timeline.*`, publisher id `safeappeals.safeappeals-timeline`.
   Display name: **Safe Appeals Timeline**. This is a timeline-tools extension,
   not a “case” product surface.
2. **Onboarding is enough for “who you are.”** Do not rebuild case-info as
   the durable profile path. `setupProfile` re-run may remain under the new
   command prefix.
3. **No `case.json` / no case-info UI.** Machine-readable deadline facts live
   only in the timeline store.
4. **`AGENTS.md` is optional prose** (stock `chat.useAgentsMdFile`). No managed
   markers / forced schema.
5. **Keep an agent skill for project setup** in this extension — keyed off
   onboarding role pill. Not a case dashboard.
6. **D1 supersession.** No case-info dashboard/commands/`case.json`. Surface =
   onboarding profile + role skill + optional AGENTS.md + timeline UI/tools.
7. **Do not merge with `safeappeals-calendar` (Aug 2).** Calendar stays the
   OAuth/sync/`getEvents` provider layer. Timeline **calls** calendar commands
   for soft pull in the UI; Q5 write-back (if built) lands as new calendar
   commands, not inside timeline. Same split as email vs its consumers.

### Recommendations (defaults unless Steve overrides)

| Topic | Recommendation |
| --- | --- |
| Rename timing | **`r7-rename-extension` first** (or with retire) so new code never lands under `safeappeals-case` |
| Timeline store | `.safeAppeals/timeline.json` — `jurisdictionId`, injuryDate, `events[]` |
| Jurisdiction IDs | **Slugs canonical** (`bc-wcb`) + display labels; alias map for old `"BC WCB"` profile values |
| Retire vs timeline order | Rename + twin delete + **project-setup skill**, then store/engine → tools + UI |
| Project-setup skill | Ships in `safeappeals-timeline`; branch by persona group from `PROFILE_ROLES` |
| Watermark / `startOwnCase` | Open Chat; agent can invoke project-setup skill |
| Export | **ICS** with the UI; PDF via export channel when electron path is ready |
| Agent tools | Remake all six void timeline tools in this extension |
| Rung 8 organizer | No `case.json`; folder heuristics / `AGENTS.md` / optional timeline fields |
| Case-type skills (old slice 3) | Defer |

### Rename checklist (code)

| Touch | Action |
| --- | --- |
| `extensions/safeappeals-case/` | `git mv` → `extensions/safeappeals-timeline/` |
| `package.json` `name`, scripts, command ids | `safeappeals-timeline` |
| `package.nls.json` | Display/description = Timeline; scrub “case” product copy |
| `build/npm/dirs.ts`, `build/gulpfile.extensions.ts` | Path + `compile-extension:safeappeals-timeline` |
| `product.json` `trustedExtensionAuthAccess` | `safeappeals.safeappeals-timeline` |
| Watermark, onboarding, sampleCaseTour | New command ids |
| Drift tests / path strings | New folder path |
| `.vscode-test.js` / integration scripts | If listed |

### Role pills the skill must honor

From `welcomeOnboarding/common/profileRuleTemplate.ts` `PROFILE_ROLES`:
Lawyer, Paralegal, Advocate, Appeals Representative, Union Representative,
Injured Worker, Representing Myself, Student, Teacher, Researcher,
Office Worker, Software Developer — mapped to persona groups
`legal` | `self` | `education` | `research` | `office` | `developer`.

Skill behavior (sketch): read profile role → interview for project facts
appropriate to that group → write/update root `AGENTS.md` (plain) → optional
standard folders for that persona (legal: Medical_Reports/…; research:
sources/notes/…; etc.) → never write `case.json` or managed markers.

## What to delete vs keep

### Delete / stop shipping

| Path / surface | Why |
| --- | --- |
| Name `safeappeals-case` / command prefix | Renamed to timeline |
| `src/caseFiles.ts` (if still present) | `case.json` + managed AGENTS + init/edit/open |
| Commands `initCase`, `editCaseInfo`, `openCaseBrief` | Case-info UX |
| Old `skills/case-setup/` twin-writing content | Replaced by project-setup skill |
| Walkthrough “create case” / `case.json` media | Stale product story |
| Sample writing `case.json` / managed blocks | AGENTS.md-only |
| Core callers of `safeappeals-case.initCase` | Retarget to Chat under new ids |

### Keep / add (under new folder name)

| Path / surface | Why |
| --- | --- |
| Extension shell after rename | Timeline home |
| `setupProfile`, profile helpers, drift tests | Re-run path (ids become `safeappeals-timeline.*`) |
| Sample + tour + scrubbed walkthrough | Post-welcome outcomes |
| `types.ts` `JURISDICTIONS` | Timeline + onboarding shared list |
| `scaffold.ts` / persona folders | Skill + sample |
| **`contributes.chatSkills` → project-setup** | Role-based setup |
| Timeline store / engine / UI / agent tools | Core of this extension |

No other extension currently reads `.safeAppeals/case.json` (explorer, Aug 2).

## Timeline data model (sketch)

Path: **`.safeAppeals/timeline.json`** (not workspace-root `.timeline.json`).
Plaintext by design. Shape adapted from void `CaseTimeline` / `TimelineEvent`
(minus `syncFromCaseConfig`):

```json
{
  "version": 1,
  "jurisdictionId": "bc-wcb",
  "injuryDate": "2024-03-01",
  "events": [
    {
      "id": "evt_…",
      "date": "2024-03-01",
      "title": "Date of injury",
      "category": "injury",
      "isDeadline": false,
      "linkedDocuments": []
    },
    {
      "id": "dl_…",
      "date": "2024-05-30",
      "title": "Statute of limitations",
      "category": "deadline",
      "isDeadline": true,
      "isComplete": false,
      "source": "statute"
    }
  ],
  "notificationsEnabled": true
}
```

- UI/tools collect jurisdiction + dates; **do not** parse `AGENTS.md`.
- Timeline writes never touch `AGENTS.md`.
- Port **after** `r7-jurisdiction-ids` (slugs vs today's display names).

| Source | Role |
| --- | --- |
| `void-reference/browser/timeline/jurisdictionConfig.ts` | statute days, `deadlineRules[]` |
| `void-reference/common/timeline/timelineTypes.ts` | event/timeline types |
| `void-reference/browser/timeline/timelineService.ts` | calc + upcoming; drop case-config sync |
| `void-reference/electron-main/timelineExportChannel.ts` | PDF (defer) |
| `void-reference/browser/react/src/timeline-tsx/` | ~4.9k UI reference — port selectively |

## Agent tools to remake (from void-reference)

Six BuiltinTool tools in the old fork — remake as `vscode.lm.registerTool` in
`extensions/safeappeals-timeline` (mirror `safeappeals-documents` /
`safeappeals-email` `agentTools.ts`), call into the new timeline store/engine,
and allowlist for the Cloud agent like other SafeAppeals tools.

| Tool | Mutating? | Params (snake_case in void) | Calls |
| --- | --- | --- | --- |
| `timeline_add_event` | yes | `date`, `title`, `description?`, `category`, `is_deadline?`, `linked_documents?` | `timelineService.addEvent` |
| `timeline_update_event` | yes | `event_id`, optional `date`/`title`/`description`/`category`/`is_deadline`/`is_complete` | `updateEvent` |
| `timeline_delete_event` | yes | `event_id` | `deleteEvent` |
| `timeline_get_events` | no | `category?`, `start_date?`, `end_date?`, `is_deadline?`, `limit?` (default 50) | `getEventsSorted` + filters |
| `timeline_link_document` | yes | `event_id`, `document_uri` | `linkDocument` |
| `timeline_get_deadlines` | no | `days_ahead?` (default 30) | `getUpcomingDeadlines` + `getOverdueDeadlines` |

**Categories:** `injury` \| `medical` \| `hearing` \| `decision` \| `deadline` \|
`filing` \| `correspondence` \| `custom`.

**Primary sources:**
- Schemas / descriptions:
  [`void-reference/common/prompt/prompts.ts`](void-reference/common/prompt/prompts.ts)
  (~624–741)
- Param/result types:
  [`void-reference/common/tools/toolsServiceTypes.ts`](void-reference/common/tools/toolsServiceTypes.ts)
  (~82–87, 135–140)
- Validate + invoke + format:
  [`void-reference/browser/tools/toolsService.ts`](void-reference/browser/tools/toolsService.ts)
  (~618–665, 1130–1191, 1374–1414)
- Product docs mirror:
  [`docs/system-prompts/tool-definitions.md`](docs/system-prompts/tool-definitions.md),
  [`docs/features/timeline/api-reference.md`](docs/features/timeline/api-reference.md)

**Not separate tools in void** (engine/UI only — expose later if useful):
statute calc / `generateDeadlinesFromDecision` / sync-from-case. Agent can
add deadline events via `timeline_add_event` once the UI/engine generates them.

**Implementation notes:**
- Prefer void tool names for prompt familiarity unless allowlist/prefix
  conventions require `safeappeals_timeline_*`.
- **Approval (change from Void):** Void ran all six with **no** approval gate
  (`approvalTypeOfBuiltinToolName` omitted them; system prompt was tool-first).
  For SafeAppeals, treat mutating tools
  (`add` / `update` / `delete` / `link_document`) like other workspace writes —
  require confirmation or autoApprove policy; reads stay silent. Decide at
  implement time; default recommend confirm-on-delete at minimum.
- Persist via **`.safeAppeals/timeline.json`** (Void used workspace-root
  `.timeline.json`).
- Tools depend on **`r7-timeline-store` + `r7-timeline-engine`**; can ship
  before or with UI (`r7-timeline-ui`).
- Trust `prompts.ts` / `toolsService.ts` schemas over
  `docs/features/timeline/api-reference.md` (param drift: `endDate`,
  `reminderDays`, `tags`, `id` vs `event_id`).
- Update `docs/tools/` + allowlist when remade; scrub stale historical Void
  wording that says timeline tools need no approval.

## Sequencing

1. **`r7-rename-extension`** — `safeappeals-case` → `safeappeals-timeline`.
2. **`r7-retire-caseinfo`** — finish twin/command delete + Chat retarget
   (partial progress may already exist — finish cleanly).
3. **`r7-project-setup-skill`** — role-based skill (with or right after 2).
4. **`r7-master-pointers`** — largely done; refresh any leftover `safeappeals-case` strings.
5. **`r7-jurisdiction-ids`** → **`r7-timeline-store`** → **`r7-timeline-engine`**.
6. **`r7-timeline-tools`** + **`r7-timeline-ui`** (parallel once engine exists).
7. **`r7-timeline-verify`**.

## Master plan updates

Frontmatter / inventory / D1 / r8 pointers **done** at plan creation
(`r7-master-pointers` completed). Residual scrub if still stale:
`docs/ADDED_FEATURES_TRACKER.md` rows linking the archived case-extension plan
or treating `case.json` as the live surface.

## Risks

| Risk | Mitigation |
| --- | --- |
| Broken watermark / Credits “start own case” | Retarget in same PR as command removal |
| Orphan `case.json` / managed AGENTS blocks | Ignore on read; no migration |
| Profile display-name vs slug ids | Alias map + normalize on read; drift test |
| Full React timeline (~4.9k) port cost | Port void `timeline-tsx` into extension webview as the product UI; phase internal PRs if needed, but ship a complete chronology/deadline surface — not a stub list |
| Tools before store | Block tools on store/engine |

## Out of scope here

- Email XOAUTH2 / provider-token providers (Rung 6.5 / email piggyback).
- Calendar OAuth / Q5 write-back (default pull-only until decided).
- Case-type skills under `.safeAppeals/skills/` (old slice 3).
- Moving profile settings registration out of core (already correct).
