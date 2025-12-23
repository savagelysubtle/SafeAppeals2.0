# Timeline & Event Tracker Feature Plan

**Jira Epic**: KAN-51 (Timeline & Case Management)
**Jira Feature**: KAN-57 (Timeline & Event Tracker)
**Branch**: `feature/kan-57-timeline-event-tracker`
**Priority**: High
**Status**: ✅ Phase 1 & 2 Complete

---

## Overview

A visual timeline of case events for tracking injury progression, medical visits, hearings, and decisions. Part of the SafeAppeals workers' compensation case management system.

## Design Decisions

| Decision           | Choice                             | Rationale                                                       |
| ------------------ | ---------------------------------- | --------------------------------------------------------------- |
| **Storage**        | `.timeline.json` in workspace      | Portable, version-controllable, syncs across machines           |
| **Timeline UI**    | Custom React (Tailwind)            | Full control, VSCode integration, avoid external library issues |
| **PDF Export**     | Electron HTML-to-PDF               | Clean output, full styling control (Phase 2)                    |
| **Notifications**  | Scheduled on app startup           | Simple, reliable, no background service needed                  |
| **Statute Limits** | Configurable per jurisdiction/case | Flexible for BC WCB, WSIB, CA DWC, etc.                         |

---

## Architecture

### Module Structure

```
src/vs/workbench/contrib/void/
├── browser/
│   └── timeline/                          # MODULAR FEATURE
│       ├── timeline.contribution.ts       # Registers actions, panes, services
│       ├── timelineService.ts             # Core CRUD, notifications, calculations
│       ├── timelinePane.ts                # Sidebar panel registration
│       └── jurisdictionConfig.ts          # Default jurisdiction rules (12 configs)
│
├── common/
│   └── timeline/
│       └── timelineTypes.ts               # Types shared between browser/electron-main
│
├── electron-main/
│   └── timelineExportChannel.ts           # PDF export via IPC (Phase 2)
│
└── browser/react/src/
    └── timeline-tsx/                      # React components
        ├── index.tsx                      # Mount function export
        ├── TimelineDashboard.tsx          # Main timeline container
        ├── TimelineEventCard.tsx          # Individual event cards
        ├── TimelineToolbar.tsx            # Add, export, filter controls
        ├── EventEditor.tsx                # Create/edit event modal
        └── DeadlineWarnings.tsx           # Upcoming/overdue deadline alerts
```

---

## Data Model

### TimelineEvent

```typescript
interface TimelineEvent {
	id: string;
	date: string; // ISO 8601
	endDate?: string; // For date ranges
	title: string;
	description?: string;
	category: EventCategory; // injury | medical | hearing | decision | deadline | filing | correspondence | custom
	linkedDocuments: string[]; // URI strings
	isDeadline: boolean;
	reminderDays?: number[]; // e.g., [7, 3, 1]
	isComplete?: boolean;
	tags?: string[];
	createdAt: string;
	updatedAt: string;
}
```

### CaseTimeline (`.timeline.json`)

```typescript
interface CaseTimeline {
	version: "1.0";
	caseId: string;
	caseName?: string;
	jurisdiction: string; // e.g., 'bc-wcb', 'ontario-wsib'
	injuryDate?: string;
	events: TimelineEvent[];
	customStatuteDays?: number; // Override jurisdiction default
	notificationsEnabled: boolean;
	createdAt: string;
	updatedAt: string;
}
```

---

## Jurisdictions Supported

### Canada

- **BC WCB** - 90 days (Review Division: 90d, WCAT: 30d)
- **Ontario WSIB** - 30 days (ARO: 30d, WSIAT: 30d)
- **Alberta WCB** - 60 days (DRDRB: 60d, Appeals Commission: 30d)
- **Quebec CNESST** - 30 days (Admin Review: 30d, TAT: 45d)
- **Manitoba WCB** - 30 days
- **Saskatchewan WCB** - 60 days
- **Nova Scotia WCB** - 30 days

### United States

- **California DWC** - 365 days (Petition: 20d, Appeal: 45d)
- **Texas DWC** - 365 days (Contested: 20d, Panel: 15d)
- **New York WCB** - 730 days (Review: 30d, Appeal: 30d)
- **Florida DWC** - 730 days (Petition: 30d)
- **Washington L&I** - 60 days (Protest: 60d, BIIA: 60d)

### Custom

- User-configurable statute days and deadline rules

---

## Phase 1 (Complete) ✅

### Implemented Features

1. **Event CRUD**

   - ✅ Add events with date, title, description, category
   - ✅ Edit existing events
   - ✅ Delete events with confirmation
   - ✅ 8 event categories with color coding

2. **Timeline Visualization**

   - ✅ Chronological event display
   - ✅ Visual timeline with colored dots
   - ✅ Category badges and labels
   - ✅ Deadline status indicators (overdue/upcoming)

3. **Filtering**

   - ✅ Filter by category
   - ✅ Show deadlines only toggle
   - ✅ Event count display

4. **Deadline Management**

   - ✅ Mark events as deadlines
   - ✅ Reminder days configuration
   - ✅ Mark complete functionality
   - ✅ Overdue/upcoming warnings banner

5. **Notifications**

   - ✅ Deadline notifications on startup
   - ✅ 7, 3, 1 day warning levels
   - ✅ Overdue deadline alerts

6. **Jurisdiction Support**

   - ✅ 12 pre-configured jurisdictions
   - ✅ Statute of limitations calculation
   - ✅ Auto-generate deadlines from decisions
   - ✅ Custom jurisdiction override per case

7. **Service Infrastructure**

   - ✅ ITimelineService interface
   - ✅ File-based storage (.timeline.json)
   - ✅ Event-driven updates
   - ✅ Registered in React accessor

8. **Commands & Actions**
   - ✅ `Ctrl+Shift+T` - Open Timeline
   - ✅ Command Palette: "Open Case Timeline"
   - ✅ Command Palette: "Add Timeline Event"
   - ✅ Explorer context menu: "Link to Timeline Event..."

---

## Phase 2 (Complete) ✅

### Document Linking UI ✅

```
- [x] Document picker modal (DocumentPicker.tsx)
- [x] Link/unlink from event editor
- [x] Show linked documents on event cards (clickable to open)
- [x] File type icons (PDF, DOC, TXT, images)
```

### PDF Export ✅

```
- [x] Create electron-main/timelineExportChannel.ts
- [x] HTML template for timeline export (print-friendly CSS)
- [x] Export PDF button in toolbar
- [x] Include case info header, jurisdiction, event count
- [x] Native printToPDF via Electron IPC (registered in app.ts)
```

### Jurisdiction Selector ✅

```
- [x] Dropdown button in toolbar
- [x] Modal with grouped jurisdictions (Canada/US)
- [x] Show statute of limitations days
- [x] Persist jurisdiction to timeline file
```

### UI Polish ✅

```
- [x] Green/black SafeAppeals theming
- [x] Shadcn-inspired card design
- [x] Customizable first event (no hardcoded default)
- [x] Immutable state updates for React re-renders
```

---

## Phase 3 (Next) 📋

### Enhanced Timeline

```
- [ ] Drag-and-drop event reordering
- [ ] Zoom controls (year/month/week view)
- [ ] Scroll to today marker
- [ ] Right-click "Link to Timeline Event" with event picker
```

### Case Config Integration ✅

```
- [x] Auto-import injuryDate from .fileorg.json
- [x] Sync case name from caseInfo (claimantName or caseNumber)
- [x] Auto-create injury event when creating timeline
- [x] "Sync Case" button in toolbar for manual refresh
- [ ] Import parties for event descriptions (Phase 4)
```

### Calendar View

```
- [ ] Month grid view toggle
- [ ] Week view for detailed planning
- [ ] Today indicator
```

---

## Phase 4 (Future) 🔮

### Advanced Features

```
- [ ] Recurring events
- [ ] Event templates (e.g., "Medical Appointment", "Appeal Deadline")
- [ ] Multi-case timeline search
- [ ] Timeline comparison between cases
```

### External Integrations

```
- [ ] Google Calendar sync
- [ ] Outlook calendar sync
- [ ] iCal export (.ics)
- [ ] Mobile push notifications
- [ ] Email reminders via SafeAppeals Cloud
```

---

## Testing Checklist

### Build & Launch

```bash
# 1. Build React components
bun run buildreact

# 2. Build TypeScript
bun run compile

# 3. Launch app
.\scripts\code.bat

# 4. Open timeline
Ctrl+Shift+T (or Command Palette → "Open Case Timeline")
```

### Functional Tests

- [ ] Create new timeline (click "Create Timeline" on empty state)
- [ ] Add event with all fields
- [ ] Edit existing event
- [ ] Delete event (double-click to confirm)
- [ ] Filter by category
- [ ] Toggle "Deadlines only"
- [ ] Mark deadline as complete
- [ ] Verify `.timeline.json` created in workspace
- [ ] Verify deadline notifications on reload

---

## Files Created/Modified

### New Files (Phase 1 & 2)

| File                                              | Lines | Purpose                        |
| ------------------------------------------------- | ----- | ------------------------------ |
| `common/timeline/timelineTypes.ts`                | ~300  | Core types and helpers         |
| `browser/timeline/jurisdictionConfig.ts`          | ~250  | 12 jurisdiction configs        |
| `browser/timeline/timelineService.ts`             | ~450  | CRUD, deadlines, notifications |
| `browser/timeline/timelinePane.ts`                | ~70   | Sidebar panel                  |
| `browser/timeline/timeline.contribution.ts`       | ~150  | Commands, registration         |
| `electron-main/timelineExportChannel.ts`          | ~250  | PDF export via IPC             |
| `react/src/timeline-tsx/index.tsx`                | ~10   | Mount export                   |
| `react/src/timeline-tsx/TimelineDashboard.tsx`    | ~300  | Main container                 |
| `react/src/timeline-tsx/TimelineEventCard.tsx`    | ~280  | Event cards with doc links     |
| `react/src/timeline-tsx/TimelineToolbar.tsx`      | ~180  | Toolbar with export/filter     |
| `react/src/timeline-tsx/EventEditor.tsx`          | ~400  | Event editor with doc linking  |
| `react/src/timeline-tsx/DeadlineWarnings.tsx`     | ~150  | Warning banners                |
| `react/src/timeline-tsx/DocumentPicker.tsx`       | ~280  | Document linking modal         |
| `react/src/timeline-tsx/JurisdictionSelector.tsx` | ~160  | Jurisdiction selection modal   |

### Modified Files

| File                          | Change                                    |
| ----------------------------- | ----------------------------------------- |
| `void.contribution.ts`        | Import timeline contribution              |
| `react/src/util/services.tsx` | Add ITimelineService, IEditorService, URI |
| `react/tsup.config.js`        | Add timeline-tsx entry                    |
| `code/electron-main/app.ts`   | Register TimelineExportChannel for PDF    |

---

## Acceptance Criteria (from Jira)

- [x] User can add events with date, title, description, and category
- [x] Events display on visual timeline with scroll
- [x] Documents can be linked to events
- [x] Timeline can be exported as PDF
- [x] Deadline notifications appear 7, 3, and 1 days before
- [x] Statute of limitations automatically calculated based on injury date

---

**Created**: December 23, 2025
**Author**: Claude (Cursor AI Assistant)
**Last Updated**: December 23, 2025 - Phase 2 Complete
