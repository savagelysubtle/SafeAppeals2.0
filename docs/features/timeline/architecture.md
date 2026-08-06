# Timeline Architecture

Technical implementation details for the Case Timeline feature.

## Table of Contents

1. [System Overview](#system-overview)
2. [Service Architecture](#service-architecture)
3. [Data Flow](#data-flow)
4. [File Structure](#file-structure)
5. [React Components](#react-components)
6. [PDF Export System](#pdf-export-system)
7. [IPC Communication](#ipc-communication)

---

## System Overview

The Timeline feature spans three layers of the VSCode architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    React UI (timeline-tsx/)                  │
│  TimelineDashboard ← EventEditor ← TimelineEventCard        │
└─────────────────────────────────────────────────────────────┘
                              ↕ Props/Callbacks
┌─────────────────────────────────────────────────────────────┐
│                Browser Process (browser/timeline/)           │
│  TimelineService ← TimelinePane ← timeline.contribution     │
└─────────────────────────────────────────────────────────────┘
                              ↕ IPC Channel
┌─────────────────────────────────────────────────────────────┐
│            Electron Main Process (electron-main/)            │
│                   TimelineExportChannel                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Service Architecture

### TimelineService (Browser)

**Location:** `browser/timeline/timelineService.ts`

The core service handles:

- Timeline CRUD operations
- Event management
- Deadline calculations
- Notification generation
- Jurisdiction configuration
- Case config integration

**Registration:**

```typescript
registerSingleton(ITimelineService, TimelineService, InstantiationType.Delayed);
```

**Dependencies:**

```typescript
constructor(
  @IFileService private readonly fileService: IFileService,
  @IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
  @INotificationService private readonly notificationService: INotificationService,
  @IMainProcessService mainProcessService: IMainProcessService,
  @IFileOrganizerService private readonly fileOrganizerService: IFileOrganizerService
) {}
```

### TimelineExportChannel (Main)

**Location:** `electron-main/timelineExportChannel.ts`

Handles PDF generation using Electron's `BrowserWindow.printToPDF()`:

- Creates hidden browser window
- Loads HTML template
- Generates PDF
- Returns base64-encoded data via IPC

---

## Data Flow

### Timeline Loading

```
1. Workspace Opens
   ↓
2. TimelineService.initializeTimeline()
   ↓
3. Load .safeAppeals/timeline.json from workspace
   ↓
4. Parse JSON → CaseTimeline object
   ↓
5. Fire onDidChangeTimeline event
   ↓
6. React component receives updated state
```

### Event Creation

```
1. User clicks "Add Event"
   ↓
2. EventEditor modal opens
   ↓
3. User fills form, clicks Save
   ↓
4. TimelineService.addEvent(eventData)
   ↓
5. Generate unique ID
   ↓
6. Add to events array
   ↓
7. Save to .safeAppeals/timeline.json
   ↓
8. Fire onDidChangeTimeline event
   ↓
9. UI updates with new event
```

### PDF Export

```
1. User clicks "Export PDF"
   ↓
2. TimelineDashboard.handleExport()
   ↓
3. TimelineService.exportToPDF()
   ↓
4. IPC call to main process
   ↓
5. TimelineExportChannel.exportToPDF()
   ↓
6. Create hidden BrowserWindow
   ↓
7. Generate HTML template
   ↓
8. Load HTML via data URI
   ↓
9. Wait for content to render (500ms)
   ↓
10. BrowserWindow.webContents.printToPDF()
   ↓
11. Encode PDF as base64 string
   ↓
12. Return via IPC
   ↓
13. Decode base64 → Uint8Array
   ↓
14. Create Blob and download
```

---

## File Structure

```
src/vs/workbench/contrib/void/
├── browser/
│   └── timeline/
│       ├── timeline.contribution.ts   # View registration, commands, actions
│       ├── timelineService.ts         # Core service (CRUD, deadlines, notifications)
│       ├── timelinePane.ts            # ViewPane with React mount
│       └── jurisdictionConfig.ts      # 12 jurisdiction configurations
│
├── common/
│   └── timeline/
│       └── timelineTypes.ts           # Interfaces, types, helpers
│
├── electron-main/
│   └── timelineExportChannel.ts       # PDF generation (main process)
│
└── browser/react/src/
    └── timeline-tsx/
        ├── index.tsx                  # Entry point, mountTimeline()
        ├── TimelineDashboard.tsx      # Main container (two-panel layout)
        ├── TimelineEventCard.tsx      # Individual event cards
        ├── TimelineToolbar.tsx        # Filters, add button, jurisdiction
        ├── EventEditor.tsx            # Create/edit modal
        ├── DeadlineWarnings.tsx       # Overdue/upcoming banners
        ├── CaseSummary.tsx            # Left panel KPI cards
        ├── CalendarView.tsx           # Calendar visualization
        ├── DocumentPicker.tsx         # Document selection modal
        ├── JurisdictionSelector.tsx   # Jurisdiction dropdown
        ├── NotificationCenter.tsx     # Notification panel
        ├── NotificationPreferences.tsx # Settings form
        └── TodayMarker.tsx            # Today indicator
```

---

## React Components

### Component Hierarchy

```
TimelineDashboard
├── [Left Panel]
│   ├── CaseSummary
│   │   └── KPI Cards (Events, Deadlines, Docs, Duration)
│   └── DeadlineWarnings
│       └── Warning Banners
│
├── [Right Panel]
│   ├── TimelineToolbar
│   │   ├── Add Event Button
│   │   ├── Category Filter
│   │   ├── View Toggle (Timeline/Calendar)
│   │   ├── JurisdictionSelector
│   │   └── Export Button
│   │
│   └── [Content Area]
│       ├── Timeline View
│       │   ├── TodayMarker
│       │   └── TimelineEventCard[] (chronological)
│       │       ├── Category Badge
│       │       ├── Title & Date
│       │       ├── Description
│       │       ├── Linked Docs
│       │       ├── Tags
│       │       └── Action Buttons
│       │
│       └── CalendarView (alternate)
│
├── EventEditor (modal)
│   └── Form fields
│
├── DocumentPicker (modal)
│   └── File browser
│
└── NotificationCenter (dropdown)
    └── NotificationPreferences
```

### State Management

React components receive state from the TimelineService via props passed through the ViewPane:

```typescript
// timelinePane.ts
const accessor = {
	timelineService: this.timelineService,
	notificationService: this.notificationService,
	// ...
};

mountTimeline(this.container, accessor);
```

Components subscribe to service events:

```typescript
useEffect(() => {
	const disposable = timelineService.onDidChangeTimeline((timeline) => {
		setTimeline(timeline);
	});
	return () => disposable.dispose();
}, [timelineService]);
```

---

## PDF Export System

### HTML Template Generation

The `generateTimelineHTML()` function creates a styled HTML document:

```typescript
function generateTimelineHTML(data: TimelineExportData): string {
	const { timeline, jurisdiction } = data;

	// Sort events chronologically
	const sortedEvents = [...timeline.events].sort(
		(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
	);

	// Generate event cards HTML
	const eventsHTML = sortedEvents
		.map(
			(event) => `
    <div class="event ${event.isDeadline ? "deadline" : ""}">
      <div class="event-dot" style="background-color: ${getCategoryColor(
				event.category
			)};"></div>
      <div class="event-content">
        <h3>${escapeHtml(event.title)}</h3>
        <p class="event-date">${formatTimelineDate(event.date)}</p>
        ${event.description ? `<p>${escapeHtml(event.description)}</p>` : ""}
      </div>
    </div>
  `
		)
		.join("");

	return `<!DOCTYPE html>
    <html>
    <head>
      <style>/* CSS styles */</style>
    </head>
    <body>
      <div class="header">
        <h1>Case Timeline - ${escapeHtml(
					timeline.caseName || timeline.caseId
				)}</h1>
      </div>
      <div class="timeline">${eventsHTML}</div>
    </body>
    </html>`;
}
```

### PDF Generation Process

```typescript
private async exportToPDF(data: TimelineExportData): Promise<string> {
  // Create hidden browser window
  const win = new BrowserWindow({
    show: false,
    width: 800,
    height: 600,
    webPreferences: { offscreen: true }
  });

  // Load HTML content
  const html = generateTimelineHTML(data);
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  // Wait for CSS/fonts to apply
  await new Promise(resolve => setTimeout(resolve, 500));

  // Generate PDF
  const pdfBuffer = await win.webContents.printToPDF({
    printBackground: true,
    landscape: false,
    pageSize: 'Letter',
    margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 }
  });

  win.close();

  // Return base64 for IPC transfer
  return Buffer.from(pdfBuffer).toString('base64');
}
```

### Filename Generation

Smart filename extraction from case data:

```typescript
const rawId = timeline?.caseName || timeline?.caseId || "";

// Extract last path segment if caseId is a path
const segments = rawId.split(/[/\\]+/).filter((s) => s && s.length > 1);
const baseName = segments.length > 0 ? segments[segments.length - 1] : "";

// Sanitize for filename safety
const sanitizedName =
	baseName
		.replace(/[\\/:*?"<>|]/g, "_")
		.replace(/\s+/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_|_$/g, "")
		.substring(0, 50) || "export";

const filename = `Timeline_${sanitizedName}_${dateStamp}.pdf`;
```

---

## IPC Communication

### Channel Registration

**Main Process (electron-main/timelineExportChannel.ts):**

```typescript
export const TIMELINE_EXPORT_CHANNEL_ID = "void:timelineExport";

export class TimelineExportChannel implements IServerChannel {
	call(ctx: unknown, command: string, args?: any): Promise<any> {
		switch (command) {
			case "exportToPDF":
				return this.exportToPDF(args);
			default:
				throw new Error(`Unknown command: ${command}`);
		}
	}
}
```

**Browser Process (timelineService.ts):**

```typescript
constructor(
  @IMainProcessService mainProcessService: IMainProcessService
) {
  this.timelineExportChannel = mainProcessService.getChannel('void-channel-timeline-export');
}

async exportToPDF(): Promise<string> {
  const pdfBase64 = await this.timelineExportChannel.call<string>('exportToPDF', {
    timeline: this._timeline,
    jurisdiction: this.getJurisdiction(this._timeline.jurisdiction)
  });
  return pdfBase64;
}
```

### Binary Data Transfer Pattern

**Why Base64?**

VSCode's IPC serialization can corrupt binary data when transferred as raw `Uint8Array` or even `VSBuffer`. The reliable pattern is:

1. **Main process**: Encode as base64 string
2. **Transfer**: String survives IPC serialization
3. **Browser process**: Decode to `Uint8Array`

```typescript
// Main process
return Buffer.from(pdfBuffer).toString("base64");

// Browser process
const pdfBytes = Buffer.from(pdfBase64, "base64");
const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
```

---

## View Registration

### Container Registration

```typescript
const container = viewContainerRegistry.registerViewContainer(
	{
		id: "workbench.view.caseTimeline",
		title: nls.localize2("caseTimelineContainer", "Case Timeline"),
		ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [
			"workbench.view.caseTimeline",
			{
				mergeViewWithContainerWhenSingleView: true,
				orientation: Orientation.HORIZONTAL,
			},
		]),
		hideIfEmpty: false,
		order: 6,
		icon: Codicon.calendar,
	},
	ViewContainerLocation.Sidebar
);
```

### View Registration

```typescript
viewsRegistry.registerViews(
	[
		{
			id: "workbench.view.caseTimeline",
			name: nls.localize2("caseTimeline", "Case Timeline"),
			ctorDescriptor: new SyncDescriptor(TimelinePane),
			canToggleVisibility: true,
			canMoveView: true,
			weight: 100,
		},
	],
	container
);
```

### Commands

```typescript
class OpenTimelineAction extends Action2 {
	static readonly ID = "void.openCaseTimeline";

	constructor() {
		super({
			id: OpenTimelineAction.ID,
			title: "Open Case Timeline",
			icon: Codicon.calendar,
			f1: true,
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyT,
				weight: KeybindingWeight.WorkbenchContrib,
			},
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const viewsService = accessor.get(IViewsService);
		await viewsService.openView("workbench.view.caseTimeline", true);
	}
}
```

---

## Testing & Development

### Build Commands

```bash
# Build React components
bun run buildreact

# Watch React components
bun run watchreact

# Build TypeScript
bun run compile

# Watch TypeScript
bun run watch-clientd
```

### Debug Logging

The service includes console logging:

```typescript
console.log("[TimelineService] Timeline loaded from:", timelineUri.toString());
console.log("[TimelineService] Event added:", event.id);
console.error("[TimelineService] Failed to save:", error);
```

Check DevTools console (`Help` → `Toggle Developer Tools`) for logs.

---

**See Also:**

- [API Reference](api-reference.md) - Service interface
- [User Guide](user-guide.md) - Usage instructions
