---
name: Per-Workspace Calendar Sync
overview: Implement calendar export and sync with complete workspace isolation. Phase 1 (ICS export) complete. Timeline storage path is `.safeAppeals/timeline.json` (not root `.timeline.json`).
todos:
  - id: cal-1.1
    content: Add syncToCalendar field to TimelineEvent type
    status: completed
  - id: cal-1.2
    content: Add per-event calendar toggle UI in TimelineEventCard
    status: completed
  - id: cal-1.3
    content: Create icsGenerator.ts for RFC 5545 .ics generation
    status: completed
  - id: cal-1.4
    content: Add export methods to timelineService.ts
    status: completed
  - id: cal-1.5
    content: Add Export .ics button to TimelineToolbar
    status: completed
  - id: cal-1.6
    content: Wire up handlers in TimelineDashboard
    status: completed
  - id: cal-1.7
    content: Test .ics export and import to Google Calendar
    status: pending
  - id: cal-2.1
    content: Create calendarSyncStateService.ts for sync state tracking
    status: pending
  - id: cal-2.2
    content: Add hash generation for event change detection
    status: pending
  - id: cal-2.3
    content: Implement .calendar-sync.json persistence per workspace
    status: pending
  - id: cal-3.1
    content: Set up Google Cloud OAuth credentials
    status: pending
  - id: cal-3.2
    content: Create googleCalendarService.ts in electron-main
    status: pending
  - id: cal-3.3
    content: Create calendarMainChannel.ts for IPC
    status: pending
  - id: cal-3.4
    content: Add Google Calendar connect UI in Timeline Dashboard
    status: pending
  - id: cal-3.5
    content: Implement two-way sync with conflict resolution
    status: pending
  - id: cal-4.1
    content: Set up Azure AD app registration for Outlook
    status: pending
  - id: cal-4.2
    content: Create outlookCalendarService.ts
    status: pending
  - id: cal-4.3
    content: Add Outlook connect option to UI
    status: pending
isProject: true
---

# Plan: Per-Workspace Calendar Sync

## Overview

Implement calendar export and sync that maintains complete workspace isolation. Each workspace syncs independently using its workspace ID as the unique sync identifier.

**Key Principle**: The workspace ID becomes the "sync namespace" - events from Case A can never be confused with Case B because they have different workspace IDs embedded in the sync.

---

## Architecture

### Event Types: Chronology vs Calendar

The timeline contains TWO types of events:


| Type                  | Purpose                                        | Sync to Calendar |
| --------------------- | ---------------------------------------------- | ---------------- |
| **Chronology Events** | Document what happened (past/historical)       | ❌ Never          |
| **Calendar Events**   | Deadlines and appointments (future/actionable) | ✅ User choice    |


**Examples**:

- ❌ "Date of Injury: 2025-03-15" → Chronology only
- ❌ "Dr. Smith visit - discussed symptoms" → Chronology only
- ❌ "Received denial letter" → Chronology only
- ✅ "Filing deadline: 2026-02-28" → Calendar sync
- ✅ "Deposition scheduled: 2026-02-15 9am" → Calendar sync
- ✅ "Hearing date: 2026-03-10" → Calendar sync

### Per-Event Calendar Toggle

Each event in `.safeAppeals/timeline.json` gets a `syncToCalendar` flag:

```json
{
	"events": [
		{
			"id": "evt_001",
			"title": "Date of Injury",
			"date": "2025-03-15",
			"type": "milestone",
			"syncToCalendar": false, // ← Never sync historical events
			"description": "Fell at warehouse loading dock"
		},
		{
			"id": "evt_002",
			"title": "Filing Deadline - DWC-1",
			"date": "2026-02-28",
			"type": "deadline",
			"syncToCalendar": true, // ← User enabled sync
			"reminderDays": 7,
			"description": "Must file within 1 year of injury"
		},
		{
			"id": "evt_003",
			"title": "Deposition - Dr. Johnson",
			"date": "2026-02-15T09:00:00",
			"type": "appointment",
			"syncToCalendar": true, // ← User enabled sync
			"location": "Law offices of Smith & Associates",
			"description": "Treating physician deposition"
		}
	]
}
```

### UI: Per-Event Sync Button

The TimelineEventCard gets a calendar toggle button:

```
┌─────────────────────────────────────────────────────────┐
│  📅 Feb 28, 2026                              [deadline]│
│  ─────────────────────────────────────────────────────  │
│  Filing Deadline - DWC-1                                │
│  Must file within 1 year of injury                      │
│                                                         │
│  [Edit] [Delete] [📆 Synced ✓]  ← Toggle per event     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  📅 Mar 15, 2025                            [milestone] │
│  ─────────────────────────────────────────────────────  │
│  Date of Injury                                         │
│  Fell at warehouse loading dock                         │
│                                                         │
│  [Edit] [Delete] [📆 Add to Cal]  ← Not synced         │
└─────────────────────────────────────────────────────────┘
```

### Smart Defaults by Event Type


| Event Type     | Default `syncToCalendar` | Rationale                          |
| -------------- | ------------------------ | ---------------------------------- |
| `deadline`     | `true`                   | Deadlines should be on calendar    |
| `hearing`      | `true`                   | Court dates are critical           |
| `appointment`  | `true`                   | Scheduled meetings need reminders  |
| `deposition`   | `true`                   | Depositions are appointments       |
| `milestone`    | `false`                  | Historical markers                 |
| `conversation` | `false`                  | Past communications                |
| `medical`      | `false`                  | Usually documenting past treatment |
| `incident`     | `false`                  | Date of injury, accidents          |


User can always override the default.

---

### Deep Dive: Existing Timeline Implementation

**IMPORTANT**: Based on codebase analysis, here's what ALREADY exists that we must integrate with:

#### Existing TimelineEvent Interface (from `timelineTypes.ts`)

```typescript
interface TimelineEvent {
	id: string;
	date: string; // ISO 8601
	endDate?: string;
	title: string;
	description?: string;
	category: EventCategory; // 8 categories (NOT "type")
	linkedDocuments: string[];
	isDeadline: boolean; // ← KEY: Already distinguishes actionable events!
	reminderDays?: number[]; // ← Already has reminders!
	isComplete?: boolean;
	tags?: string[];
	createdAt: string;
	updatedAt: string;
}
```

#### Existing EventCategory Enum (NOT the types we listed above!)

```typescript
type EventCategory =
	| "injury" // Historical - don't sync by default
	| "medical" // Could be either
	| "hearing" // Future - sync by default
	| "decision" // Historical - don't sync
	| "deadline" // Future - sync by default
	| "filing" // Could be either
	| "correspondence" // Historical - don't sync
	| "custom"; // User decides
```

#### Existing Service Methods We Can Leverage

- `getUpcomingDeadlines(daysAhead)` - Already filters future deadlines
- `getOverdueDeadlines()` - Already tracks overdue items
- `exportToPDF()` - Already in TimelineToolbar
- `updateEvent(id, updates)` - Can add syncToCalendar field

### Integration Strategy: Extend, Don't Duplicate

**The `isDeadline: boolean` field already distinguishes actionable vs historical!**


| Correction    | Wrong Assumption             | Actual Implementation                                                        |
| ------------- | ---------------------------- | ---------------------------------------------------------------------------- |
| Field name    | `type`                       | `category` (EventCategory enum)                                              |
| Categories    | milestone, appointment, etc. | injury, medical, hearing, decision, deadline, filing, correspondence, custom |
| Deadline flag | New concept                  | `isDeadline: boolean` already exists!                                        |
| Reminders     | New field needed             | `reminderDays: number[]` already exists!                                     |


### Minimal Schema Extension

Add ONE new optional field to existing `TimelineEvent`:

```typescript
interface TimelineEvent {
	// ... all existing fields unchanged ...

	// NEW: Calendar sync toggle (defaults based on isDeadline)
	syncToCalendar?: boolean; // undefined = use isDeadline as default
}
```

**Why optional?** Existing `.safeAppeals/timeline.json` files continue to work unchanged.

### Sync Logic (Backward Compatible)

```typescript
function shouldSyncToCalendar(event: TimelineEvent): boolean {
	// If explicitly set, use that value
	if (event.syncToCalendar !== undefined) {
		return event.syncToCalendar;
	}
	// Otherwise, default based on isDeadline
	return event.isDeadline;
}
```

### Updated Smart Defaults (Using Actual Categories)


| Category         | isDeadline | Default Sync        | Reasoning            |
| ---------------- | ---------- | ------------------- | -------------------- |
| `deadline`       | true       | ✅ Sync              | Critical dates       |
| `hearing`        | true       | ✅ Sync              | Court appearances    |
| `filing`         | true       | ✅ Sync              | Filing deadlines     |
| `medical`        | true       | ✅ Sync              | Future appointment   |
| `medical`        | false      | ❌ No sync           | Historical treatment |
| `injury`         | false      | ❌ No sync           | Date of injury       |
| `decision`       | false      | ❌ No sync           | Past decisions       |
| `correspondence` | false      | ❌ No sync           | Past communications  |
| `custom`         | (either)   | Based on isDeadline | User decides         |


### Reuse Existing Patterns


| Feature          | Existing Pattern                   | Calendar Integration           |
| ---------------- | ---------------------------------- | ------------------------------ |
| Export button    | `exportToPDF()` in TimelineToolbar | Add `exportToIcs()` next to it |
| Event update     | `updateEvent(id, updates)`         | Add `toggleSyncToCalendar(id)` |
| Filter deadlines | `getUpcomingDeadlines()`           | Add `getEventsForCalendar()`   |
| Reminders        | `reminderDays: number[]`           | Reuse for VALARM in .ics       |


---

### Workspace ID as Sync Anchor

```
Workspace: D:\Cases\SmithVsAcme\
├── .vscode/
│   └── workspace.json  ← Contains workspace ID (UUID)
├── .safeAppeals/timeline.json  ← Events to sync
├── .caseinfo.json      ← Case name for event tagging
└── .calendar-sync.json ← Sync state (NEW)
```

**Sync ID Format**: `safeappeals-{workspaceId}-{eventId}`

Example:

- Workspace ID: `a1b2c3d4-5678-90ab-cdef-1234567890ab`
- Event ID: `evt_001`
- Calendar Event ID: `safeappeals-a1b2c3d4-5678-90ab-cdef-1234567890ab-evt_001`

This ensures:

- Events from different workspaces NEVER collide
- Sync can update/delete events by matching this ID
- Two-way sync knows which workspace owns which event

---

## Phase 1: .ics Export (Immediate)

### Goal

Add "Export to .ics" button in Timeline Dashboard. User can import to any calendar.

### Files to Modify


| File                                                                               | Change                     |
| ---------------------------------------------------------------------------------- | -------------------------- |
| `src/vs/workbench/contrib/void/browser/timeline/timelineService.ts`                | Add `exportToIcs()` method |
| `src/vs/workbench/contrib/void/browser/react/src/timeline-tsx/TimelineToolbar.tsx` | Add export button          |
| `src/vs/workbench/contrib/void/common/timeline/icsGenerator.ts`                    | NEW: .ics file generation  |


### .ics Format

```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//SafeAppeals//Timeline Export//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Smith vs Acme Corp - Deadlines

BEGIN:VEVENT
UID:safeappeals-a1b2c3d4-5678-90ab-cdef-1234567890ab-evt_001
DTSTAMP:20260130T120000Z
DTSTART:20260215T090000Z
DTEND:20260215T100000Z
SUMMARY:[Smith vs Acme] Deposition - Dr. Johnson
DESCRIPTION:Medical deposition for treating physician\nLinked docs: medical_records.pdf
CATEGORIES:DEADLINE,DEPOSITION
STATUS:CONFIRMED
END:VEVENT

END:VCALENDAR
```

### Implementation Steps

- **Step 1.1**: Update timeline event types (MINIMAL CHANGE)
  - File: `src/vs/workbench/contrib/void/common/timeline/timelineTypes.ts`
  - Add ONE field to existing `TimelineEvent` interface:
    ```typescript
    syncToCalendar?: boolean;  // Optional, defaults to isDeadline value
    ```
  - `reminderDays` already exists as `number[]` - no change needed!
- **Step 1.2**: Add per-event calendar toggle UI
  - File: `src/vs/workbench/contrib/void/browser/react/src/timeline-tsx/TimelineEventCard.tsx`
  - Add calendar toggle button to existing action buttons (Edit/Delete)
  - Button states based on: `event.syncToCalendar ?? event.isDeadline`
  - On click: call `timelineService.updateEvent(id, { syncToCalendar: !current })`
  - Style: Use existing button patterns from the card
- **Step 1.3**: Create `icsGenerator.ts`
  - File: `src/vs/workbench/contrib/void/common/timeline/icsGenerator.ts` (NEW)
  - Function signature:
    ```typescript
    export function generateIcsContent(
        events: TimelineEvent[],
        caseTimeline: CaseTimeline,
        workspaceId: string,
    ): string;
    ```
  - Filter logic: `events.filter(e => e.syncToCalendar ?? e.isDeadline)`
  - Date formatting per RFC 5545 (YYYYMMDDTHHMMSSZ)
  - Escape special chars: `;`, `,`, `\n` → `\;`, `\,`, `\\n`
  - Include VALARM for each reminderDay: `-P${days}D`
  - UID format: `safeappeals-${workspaceId}-${event.id}`
- **Step 1.4**: Add export methods to `timelineService.ts`
  - File: `src/vs/workbench/contrib/void/browser/timeline/timelineService.ts`
  - Add methods following existing patterns:
    ```typescript
    getEventsForCalendar(): TimelineEvent[] {
      return this.getEventsSorted().filter(e => e.syncToCalendar ?? e.isDeadline);
    }

    async exportToIcs(): Promise<void> {
      const events = this.getEventsForCalendar();
      const workspaceId = this.workspaceContextService.getWorkspace().id;
      const icsContent = generateIcsContent(events, this.timeline!, workspaceId);
      // Use existing file dialog pattern from exportToPDF
      await this.fileDialogService.showSaveDialog({ ... });
    }

    async toggleSyncToCalendar(eventId: string): Promise<void> {
      const event = this.timeline?.events.find(e => e.id === eventId);
      if (event) {
        const current = event.syncToCalendar ?? event.isDeadline;
        await this.updateEvent(eventId, { syncToCalendar: !current });
      }
    }
    ```
- **Step 1.5**: Add toolbar button in `TimelineToolbar.tsx`
  - File: `src/vs/workbench/contrib/void/browser/react/src/timeline-tsx/TimelineToolbar.tsx`
  - Add next to existing "Export PDF" button
  - Show event count: `Export ${calendarEvents.length} to .ics`
  - Disable if `calendarEvents.length === 0`
  - Use same button styling as PDF export
- **Step 1.6**: Add toggle to EventEditor modal (optional)
  - File: `src/vs/workbench/contrib/void/browser/react/src/timeline-tsx/EventEditor.tsx`
  - Add checkbox: "Sync to Calendar"
  - Default checked if `isDeadline` is checked
  - Place near the "Is Deadline" toggle
- **Step 1.7**: Test with real calendar import
  - Create events with mix of categories and isDeadline values
  - Toggle syncToCalendar on specific events
  - Export .ics file
  - Import to Google Calendar - verify only synced events appear
  - Import to Outlook - verify same behavior
  - Check that reminderDays appear as calendar reminders

### Exit Criteria

- `syncToCalendar` optional field added to TimelineEvent type
- TimelineEventCard shows calendar toggle button per event
- Button uses `event.syncToCalendar ?? event.isDeadline` for state
- Clicking toggle updates event and persists to `.safeAppeals/timeline.json`
- TimelineToolbar has "Export to .ics" button with event count
- Export filters to only calendar-enabled events
- .ics file includes VALARM for each reminderDay
- .ics imports correctly to Google Calendar
- .ics imports correctly to Microsoft Outlook
- Events tagged with case name from CaseTimeline
- Workspace ID embedded in event UIDs

---

## Phase 2: Sync State Tracking

### Goal

Track what's been synced so we can update/delete events later.

### New File: `.calendar-sync.json`

```json
{
	"workspaceId": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
	"lastSync": "2026-01-30T15:30:00Z",
	"provider": "google", // or "outlook" or "ics-export"
	"syncedEvents": {
		"evt_001": {
			"calendarEventId": "safeappeals-a1b2c3d4-...-evt_001",
			"lastSyncedAt": "2026-01-30T15:30:00Z",
			"lastSyncedHash": "abc123..." // Hash of event data
		},
		"evt_002": {
			"calendarEventId": "safeappeals-a1b2c3d4-...-evt_002",
			"lastSyncedAt": "2026-01-30T15:30:00Z",
			"lastSyncedHash": "def456..."
		}
	}
}
```

### Implementation Steps

- **Step 2.1**: Create `calendarSyncStateService.ts`
  - Load/save `.calendar-sync.json` per workspace
  - Track synced events with hashes
  - Detect changed/new/deleted events
- **Step 2.2**: Add hash generation for events
  - Hash event data (title, date, description, linked docs)
  - Compare hashes to detect changes
- **Step 2.3**: Implement change detection
  - `getEventsToCreate()`: New events not in sync state
  - `getEventsToUpdate()`: Events with changed hash
  - `getEventsToDelete()`: Events in sync state but not in timeline

### Exit Criteria

- Sync state persisted per workspace
- Can detect new/changed/deleted events
- Workspace ID embedded in all sync operations

---

## Phase 3: Google Calendar Sync

### Goal

Two-way sync with Google Calendar, per-workspace.

### OAuth Flow (Per-Workspace)

```
User clicks "Connect Google Calendar" in Timeline Dashboard
         │
         ▼
┌─────────────────────────────────────┐
│  OAuth popup opens                  │
│  User grants calendar access        │
│  Tokens stored in .calendar-sync.json│
│  (per-workspace, not global)        │
└─────────────────────────────────────┘
```

### Files to Create


| File                                              | Purpose                         |
| ------------------------------------------------- | ------------------------------- |
| `electron-main/calendar/googleCalendarService.ts` | Google Calendar API calls       |
| `electron-main/calendar/calendarMainChannel.ts`   | IPC channel for calendar ops    |
| `browser/calendar/calendarSyncService.ts`         | Browser-side sync orchestration |


### Sync Algorithm

```typescript
async function syncToGoogle(workspaceId: string) {
  const state = await loadSyncState(workspaceId);
  const timeline = await loadTimeline();

  const toCreate = getEventsToCreate(timeline, state);
  const toUpdate = getEventsToUpdate(timeline, state);
  const toDelete = getEventsToDelete(timeline, state);

  for (const event of toCreate) {
    const calEventId = `safeappeals-${workspaceId}-${event.id}`;
    await googleApi.createEvent({
      id: calEventId,  // Use our ID so we can find it later
      summary: `[${caseInfo.caseName}] ${event.title}`,
      start: event.date,
      description: event.description
    });
    state.syncedEvents[event.id] = {
      calendarEventId: calEventId,
      lastSyncedAt: new Date().toISOString(),
      lastSyncedHash: hashEvent(event)
    };
  }

  for (const event of toUpdate) {
    const calEventId = state.syncedEvents[event.id].calendarEventId;
    await googleApi.updateEvent(calEventId, {...});
    state.syncedEvents[event.id].lastSyncedHash = hashEvent(event);
  }

  for (const eventId of toDelete) {
    const calEventId = state.syncedEvents[eventId].calendarEventId;
    await googleApi.deleteEvent(calEventId);
    delete state.syncedEvents[eventId];
  }

  await saveSyncState(state);
}
```

### Implementation Steps

- **Step 3.1**: Set up Google Cloud project
  - Create OAuth credentials
  - Configure redirect URI
  - Store client ID/secret securely
- **Step 3.2**: Create `googleCalendarService.ts`
  - OAuth flow (per-workspace tokens)
  - Create/update/delete event methods
  - Token refresh handling
- **Step 3.3**: Create IPC channel
  - `calendarMainChannel.ts` for main process
  - Browser service calls main process for API calls
- **Step 3.4**: Add UI in Timeline Dashboard
  - "Connect Google Calendar" button
  - "Sync Now" button
  - Sync status indicator
  - "Disconnect" option
- **Step 3.5**: Implement two-way sync (optional)
  - Detect events modified in Google Calendar
  - Update local `.safeAppeals/timeline.json`
  - Handle conflicts (local wins? remote wins? prompt?)

### Exit Criteria

- User can connect Google Calendar per workspace
- Events sync with workspace ID prefix
- Changes in timeline push to calendar
- Tokens stored per-workspace (not global)

---

## Phase 4: Outlook Calendar Sync

### Goal

Same as Phase 3 but for Microsoft Outlook/365.

### Implementation Steps

- **Step 4.1**: Set up Azure AD app registration
- **Step 4.2**: Create `outlookCalendarService.ts`
- **Step 4.3**: Add UI toggle for Google vs Outlook
- **Step 4.4**: Handle Microsoft Graph API calls

### Exit Criteria

- User can connect Outlook per workspace
- Same isolation guarantees as Google sync

---

## Sync ID Design (Critical for Isolation)

### Event ID Structure

```
safeappeals-{workspaceId}-{eventId}
     │           │           │
     │           │           └── From `.safeAppeals/timeline.json` (evt_001, evt_002, etc.)
     │           │
     │           └── UUID of workspace (from VS Code workspace state)
     │
     └── Prefix to identify our events
```

### Why This Works

1. **No Collisions**: Two workspaces can both have `evt_001` but calendar IDs differ
2. **Easy Lookup**: Filter calendar by `safeappeals-{workspaceId}-*` to find all events for a case
3. **Clean Delete**: When user disconnects, delete all `safeappeals-{workspaceId}-*` events
4. **Audit Trail**: Calendar event ID tells you exactly which workspace it came from

### Example


| Workspace     | Event ID | Calendar Event ID              |
| ------------- | -------- | ------------------------------ |
| Smith vs Acme | evt_001  | `safeappeals-a1b2c3d4-evt_001` |
| Smith vs Acme | evt_002  | `safeappeals-a1b2c3d4-evt_002` |
| Jones vs Corp | evt_001  | `safeappeals-f9e8d7c6-evt_001` |
| Jones vs Corp | evt_002  | `safeappeals-f9e8d7c6-evt_002` |


Even though both have `evt_001`, they're completely separate in the calendar.

---

## Settings (Per-Workspace)

Store in `.calendar-sync.json`:

```json
{
  "workspaceId": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
  "provider": "google",
  "connected": true,
  "tokens": {
    "accessToken": "...",
    "refreshToken": "...",
    "expiresAt": "2026-01-30T16:00:00Z"
  },
  "settings": {
    "autoSync": true,
    "syncOnTimelineChange": true,
    "calendarId": "primary",  // Which calendar to sync to
    "eventPrefix": "[Smith vs Acme]",  // From .caseinfo.json
    "includeLinkedDocs": true,  // Add doc names to description
    "reminderMinutes": 60  // Add reminder to events
  },
  "syncedEvents": { ... }
}
```

---

## UI Mockup

### Timeline Toolbar (Updated)

```
┌─────────────────────────────────────────────────────────────────┐
│  📅 Timeline Dashboard                                    ⚙️   │
├─────────────────────────────────────────────────────────────────┤
│  [+ Add Event]  [📥 Export .ics]  [🔗 Connect Calendar ▼]      │
│                                    ├─ Google Calendar           │
│                                    ├─ Outlook Calendar          │
│                                    └─ Disconnect                │
├─────────────────────────────────────────────────────────────────┤
│  Connected to: Google Calendar ✅  Last sync: 2 min ago [Sync] │
├─────────────────────────────────────────────────────────────────┤
│  ... timeline events ...                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Timeline


| Phase       | Effort    | Deliverable                                |
| ----------- | --------- | ------------------------------------------ |
| **Phase 1** | 3-4 hours | Per-event toggle + .ics export working     |
| **Phase 2** | 1-2 hours | Sync state tracking                        |
| **Phase 3** | 1-2 days  | Google Calendar sync (per-workspace OAuth) |
| **Phase 4** | 1 day     | Outlook Calendar sync                      |


---

## Files Changed Summary

### Phase 1 (New Files)

- `src/vs/workbench/contrib/void/common/timeline/icsGenerator.ts` - .ics file generation (RFC 5545)

### Phase 1 (Modified)

- `src/vs/workbench/contrib/void/common/timeline/timelineTypes.ts` - Add `syncToCalendar?: boolean` to TimelineEvent
- `src/vs/workbench/contrib/void/browser/timeline/timelineService.ts` - Add `exportToIcs()`, `getEventsForCalendar()`, `toggleSyncToCalendar()`
- `src/vs/workbench/contrib/void/browser/react/src/timeline-tsx/TimelineToolbar.tsx` - Add .ics export button next to PDF export
- `src/vs/workbench/contrib/void/browser/react/src/timeline-tsx/TimelineEventCard.tsx` - Add calendar toggle button
- `src/vs/workbench/contrib/void/browser/react/src/timeline-tsx/EventEditor.tsx` - Add "Sync to Calendar" checkbox

### Phase 2 (New Files)

- `src/vs/workbench/contrib/void/browser/calendar/calendarSyncStateService.ts`

### Phase 3 (New Files)

- `src/vs/workbench/contrib/void/electron-main/calendar/googleCalendarService.ts`
- `src/vs/workbench/contrib/void/electron-main/calendar/calendarMainChannel.ts`
- `src/vs/workbench/contrib/void/browser/calendar/calendarSyncService.ts`

### Phase 4 (New Files)

- `src/vs/workbench/contrib/void/electron-main/calendar/outlookCalendarService.ts`

---

## Risk Mitigation


| Risk                 | Mitigation                                                  |
| -------------------- | ----------------------------------------------------------- |
| OAuth token expiry   | Implement refresh token flow, prompt re-auth if needed      |
| API rate limits      | Batch sync operations, add backoff                          |
| Conflicting edits    | Default to local-wins, add UI for conflict resolution later |
| Workspace ID changes | ID is stable UUID, but handle migration if needed           |
| User revokes access  | Handle 401s gracefully, prompt to reconnect                 |


---

## Success Criteria

1. ✅ Export .ics works for any workspace
2. ✅ .ics files import correctly to Google/Outlook
3. ✅ Events tagged with case name
4. ✅ Workspace ID embedded in all event IDs
5. ✅ No cross-workspace data leakage
6. ✅ Sync state persisted per-workspace
7. ✅ Two-way sync detects changes
8. ✅ UI shows sync status per-workspace

---

*Plan created: January 30, 2026*
*Status: Phase 3 COMPLETE - Google Calendar OAuth integration implemented*

## Implementation Summary

### Phase 1 - .ics Export (COMPLETE)

**Files Created:**

- `src/vs/workbench/contrib/void/common/timeline/icsGenerator.ts` - RFC 5545 compliant .ics generator

**Files Modified:**

- `timelineTypes.ts` - Added `syncToCalendar?: boolean` to TimelineEvent interface
- `timelineService.ts` - Added `exportToIcs()`, `getEventsForCalendar()`, `toggleSyncToCalendar()`, `getCalendarEventCount()`
- `TimelineToolbar.tsx` - Added "Export .ics" button with event count
- `TimelineEventCard.tsx` - Added calendar sync toggle button per event
- `TimelineDashboard.tsx` - Wired up handlers for new functionality

### Phase 2 - Sync State Tracking (COMPLETE)

**Files Created:**

- `src/vs/workbench/contrib/void/common/timeline/calendarSyncTypes.ts` - Types for sync state and service interface
- `src/vs/workbench/contrib/void/browser/calendar/calendarSyncStateService.ts` - Service with hash-based change detection

**Files Modified:**

- `void.contribution.ts` - Registered calendarSyncStateService

**Key Features:**

- Per-workspace `.calendar-sync.json` persistence
- djb2 hash algorithm for event change detection
- Sync diff calculation (create/update/delete/unchanged)
- Provider and OAuth token management ready for Phase 3

### Phase 3 - Google Calendar OAuth Integration (COMPLETE)

**Files Created:**

- `src/vs/workbench/contrib/void/electron-main/calendar/googleCalendarService.ts` - Google Calendar API service with OAuth
- `src/vs/workbench/contrib/void/electron-main/calendar/calendarChannel.ts` - IPC channel for browser ↔ main communication
- `src/vs/workbench/contrib/void/browser/calendar/googleCalendarClientService.ts` - Browser-side client for calendar operations

**Files Modified:**

- `app.ts` - Registered CalendarChannel and imported DevAuthServerService
- `void.contribution.ts` - Registered googleCalendarClientService
- `TimelineToolbar.tsx` - Added "Connect Google" and "Sync" buttons with status indicators
- `TimelineDashboard.tsx` - Added Google Calendar connection state and sync handlers
- `services.tsx` - Added ICalendarSyncStateService and IGoogleCalendarClientService to accessor

**Key Features:**

- OAuth 2.0 flow using DevAuthServerService for callback handling
- One-way sync: local → Google Calendar (create/update/delete)
- Workspace ID embedded in event UIDs for isolation
- Token persistence in `.calendar-sync.json`
- Batch sync with progress indicator
- Environment variable configuration (GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET)

**Required Dependency:**

```bash
bun add googleapis google-auth-library
```

**To Test (Standalone Mode):**

1. Set environment variables:
  - `GOOGLE_CALENDAR_CLIENT_ID`
  - `GOOGLE_CALENDAR_CLIENT_SECRET`
2. Run `bun run buildreact`
3. Reload the app
4. Open Timeline Dashboard
5. Click "Connect Google" to start OAuth flow
6. Authorize the app in the browser
7. Click "Sync" to push events to Google Calendar

### Void Cloud Integration (COMPLETE)

**Purpose:** Auto-connect Google Calendar when user signs into Void Cloud

**Server-side changes needed (Void Cloud API):**

1. In Supabase Dashboard → Authentication → Providers → Google:
  - Add scopes: `https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly`
2. Update `/auth/callback` endpoint response to include:

```json
{
  "googleProviderToken": "google_oauth_access_token",
  "googleProviderRefreshToken": "google_oauth_refresh_token"
}
```

**Client-side changes (COMPLETE):**

- `voidCloudTypes.ts` - Added `googleProviderToken` and `googleProviderRefreshToken` to CloudSession
- `voidCloudService.ts` - Added `onGoogleCalendarTokensAvailable` event
- `voidCloudUrlHandler.ts` - Parses `provider_token` from implicit flow callback
- `TimelineDashboard.tsx` - Listens for event and auto-connects Calendar

**User Flow with Void Cloud:**

1. User clicks "Sign in with Google" in Settings
2. Authenticates with Google (with Calendar scopes)
3. Void Cloud returns session + Google provider tokens
4. Timeline Dashboard automatically connects Calendar
5. User can sync events without separate OAuth

