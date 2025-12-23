# Timeline & Event Tracker Feature Plan

**Jira Epic**: KAN-51 (Timeline & Case Management)
**Jira Feature**: KAN-57 (Timeline & Event Tracker)
**Branch**: `feature/kan-57-timeline-event-tracker`
**Priority**: High - Phase 1
**Status**: ✅ Phase 1 Complete

---

## Overview

A visual timeline of case events for tracking injury progression, medical visits, hearings, and decisions. Part of the SafeAppeals workers' compensation case management system.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Storage** | `.timeline.json` in workspace | Portable, version-controllable, syncs across machines |
| **Timeline UI** | Custom React (Tailwind) | Full control, VSCode integration, avoid external library issues |
| **PDF Export** | Electron HTML-to-PDF | Clean output, full styling control (Phase 2) |
| **Notifications** | Scheduled on app startup | Simple, reliable, no background service needed |
| **Statute Limits** | Configurable per jurisdiction/case | Flexible for BC WCB, WSIB, CA DWC, etc. |

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
  date: string;                    // ISO 8601
  endDate?: string;                // For date ranges
  title: string;
  description?: string;
  category: EventCategory;         // injury | medical | hearing | decision | deadline | filing | correspondence | custom
  linkedDocuments: string[];       // URI strings
  isDeadline: boolean;
  reminderDays?: number[];         // e.g., [7, 3, 1]
  isComplete?: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}
```

### CaseTimeline (`.timeline.json`)

```typescript
interface CaseTimeline {
  version: '1.0';
  caseId: string;
  caseName?: string;
  jurisdiction: string;            // e.g., 'bc-wcb', 'ontario-wsib'
  injuryDate?: string;
  events: TimelineEvent[];
  customStatuteDays?: number;      // Override jurisdiction default
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

## Phase 2 (Pending) 📋

### Document Linking UI

```
- [ ] Document picker modal
- [ ] Link/unlink from event editor
- [ ] Show linked documents on event cards (clickable)
- [ ] Right-click "Link to Timeline Event" with event picker
```

### PDF Export

```
- [ ] Create electron-main/timelineExportChannel.ts
- [ ] HTML template for timeline export
- [ ] Electron webContents.printToPDF()
- [ ] Export button in toolbar
- [ ] Include case info header
```

### Enhanced Timeline

```
- [ ] Drag-and-drop event reordering
- [ ] Zoom controls (year/month/week view)
- [ ] Scroll to today marker
- [ ] Print-friendly CSS
```

### Case Config Integration

```
- [ ] Auto-import injuryDate from .fileorg.json
- [ ] Sync case name from caseInfo
- [ ] Import parties for event descriptions
```

---

## Phase 3 (Future) 🔮

### Advanced Features

```
- [ ] Calendar view (month grid)
- [ ] Recurring events
- [ ] Event templates
- [ ] Multi-case search
- [ ] Timeline sharing/export
```

### Integrations

```
- [ ] Google Calendar sync
- [ ] Outlook calendar sync
- [ ] Mobile notifications
- [ ] Email reminders
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

### New Files (Phase 1)

| File | Lines | Purpose |
|------|-------|---------|
| `common/timeline/timelineTypes.ts` | ~300 | Core types and helpers |
| `browser/timeline/jurisdictionConfig.ts` | ~250 | 12 jurisdiction configs |
| `browser/timeline/timelineService.ts` | ~350 | CRUD, deadlines, notifications |
| `browser/timeline/timelinePane.ts` | ~70 | Sidebar panel |
| `browser/timeline/timeline.contribution.ts` | ~150 | Commands, registration |
| `react/src/timeline-tsx/index.tsx` | ~10 | Mount export |
| `react/src/timeline-tsx/TimelineDashboard.tsx` | ~200 | Main container |
| `react/src/timeline-tsx/TimelineEventCard.tsx` | ~200 | Event cards |
| `react/src/timeline-tsx/TimelineToolbar.tsx` | ~120 | Toolbar |
| `react/src/timeline-tsx/EventEditor.tsx` | ~300 | Event editor modal |
| `react/src/timeline-tsx/DeadlineWarnings.tsx` | ~150 | Warning banners |

### Modified Files

| File | Change |
|------|--------|
| `void.contribution.ts` | Import timeline contribution |
| `react/src/util/services.tsx` | Add ITimelineService to accessor |
| `react/tsup.config.js` | Add timeline-tsx entry, switch to src/ |
| `react/build.js` | Update styles path to src/ |

---

## Acceptance Criteria (from Jira)

- [x] User can add events with date, title, description, and category
- [x] Events display on visual timeline with scroll
- [ ] Documents can be linked to events *(service ready, UI pending)*
- [ ] Timeline can be exported as PDF *(Phase 2)*
- [x] Deadline notifications appear 7, 3, and 1 days before
- [x] Statute of limitations automatically calculated based on injury date

---

**Created**: December 23, 2025
**Author**: Claude (Cursor AI Assistant)
**Last Updated**: December 23, 2025

