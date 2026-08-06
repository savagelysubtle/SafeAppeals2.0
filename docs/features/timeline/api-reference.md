# Timeline API Reference

Technical reference for the Timeline service interface, types, and agent tools.

## Table of Contents

1. [ITimelineService Interface](#itimelineservice-interface)
2. [Types & Interfaces](#types--interfaces)
3. [Helper Functions](#helper-functions)
4. [Agent Tools](#agent-tools)
5. [IPC Channels](#ipc-channels)

---

## ITimelineService Interface

The main service for timeline operations. Inject via dependency injection:

```typescript
import { ITimelineService } from '../common/timeline/timelineTypes.js';

constructor(
  @ITimelineService private readonly timelineService: ITimelineService
) {}
```

### Lifecycle Methods

#### `loadTimeline(): Promise<CaseTimeline | null>`
Load timeline from workspace storage (`.safeAppeals/timeline.json`).

```typescript
const timeline = await timelineService.loadTimeline();
if (timeline) {
  console.log(`Loaded ${timeline.events.length} events`);
}
```

#### `saveTimeline(timeline: CaseTimeline): Promise<void>`
Save timeline to workspace storage.

```typescript
await timelineService.saveTimeline(timeline);
```

#### `getTimeline(): CaseTimeline | null`
Get the cached timeline (synchronous).

```typescript
const timeline = timelineService.getTimeline();
```

### Event CRUD

#### `addEvent(event: Omit<TimelineEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<TimelineEvent>`
Add a new event. Returns the created event with generated ID.

```typescript
const event = await timelineService.addEvent({
  date: '2024-06-15',
  title: 'Initial Injury',
  category: 'injury',
  description: 'Workplace accident',
  linkedDocuments: [],
  isDeadline: false
});
console.log(`Created event: ${event.id}`);
```

#### `updateEvent(id: string, updates: Partial<TimelineEvent>): Promise<void>`
Update an existing event.

```typescript
await timelineService.updateEvent('evt_123', {
  title: 'Updated Title',
  isComplete: true
});
```

#### `deleteEvent(id: string): Promise<void>`
Delete an event.

```typescript
await timelineService.deleteEvent('evt_123');
```

#### `getEventsSorted(ascending?: boolean): TimelineEvent[]`
Get all events sorted by date.

```typescript
const events = timelineService.getEventsSorted(true); // oldest first
const recentFirst = timelineService.getEventsSorted(false); // newest first
```

#### `getEventsByCategory(category: EventCategory): TimelineEvent[]`
Filter events by category.

```typescript
const medicalEvents = timelineService.getEventsByCategory('medical');
```

### Deadline & Statute Methods

#### `calculateStatuteDeadline(injuryDate: Date, jurisdictionId: string): Date`
Calculate statute of limitations deadline.

```typescript
const deadline = timelineService.calculateStatuteDeadline(
  new Date('2024-06-15'),
  'bc-wcb'
);
// Returns: 2024-09-13 (90 days later)
```

#### `getUpcomingDeadlines(daysAhead: number): TimelineEvent[]`
Get deadlines within specified days.

```typescript
const upcoming = timelineService.getUpcomingDeadlines(7);
```

#### `getOverdueDeadlines(): TimelineEvent[]`
Get past-due deadlines.

```typescript
const overdue = timelineService.getOverdueDeadlines();
```

#### `generateDeadlinesFromDecision(decisionEvent: TimelineEvent): TimelineEvent[]`
Auto-generate deadline events based on jurisdiction rules.

```typescript
const deadlines = timelineService.generateDeadlinesFromDecision(decisionEvent);
```

### Document Linking

#### `linkDocument(eventId: string, documentUri: URI): Promise<void>`
Link a document to an event.

```typescript
await timelineService.linkDocument('evt_123', URI.file('/path/to/doc.pdf'));
```

#### `unlinkDocument(eventId: string, documentUri: URI): Promise<void>`
Remove document link from an event.

```typescript
await timelineService.unlinkDocument('evt_123', URI.file('/path/to/doc.pdf'));
```

### Notifications

#### `generateNotifications(): TimelineNotification[]`
Generate notifications based on current timeline state.

#### `getNotifications(): TimelineNotification[]`
Get all notifications (unread first).

#### `getUnreadCount(): number`
Get count of unread notifications.

#### `markAsRead(notificationId: string): Promise<void>`
Mark a notification as read.

#### `markAllAsRead(): Promise<void>`
Mark all notifications as read.

#### `dismissNotification(notificationId: string): Promise<void>`
Dismiss a notification.

#### `snoozeNotification(notificationId: string, days: number): Promise<void>`
Snooze a notification for X days.

#### `updateNotificationPreferences(prefs: Partial<NotificationPreferences>): Promise<void>`
Update notification settings.

#### `getNotificationPreferences(): NotificationPreferences`
Get current notification settings.

### Export

#### `exportToPDF(): Promise<string>`
Export timeline to PDF. Returns base64-encoded PDF data.

```typescript
const pdfBase64 = await timelineService.exportToPDF();
const pdfBytes = Buffer.from(pdfBase64, 'base64');
```

### Jurisdictions

#### `getJurisdictions(): JurisdictionConfig[]`
Get all available jurisdictions.

#### `getJurisdiction(id: string): JurisdictionConfig | undefined`
Get jurisdiction by ID.

#### `setJurisdiction(jurisdictionId: string): Promise<void>`
Set jurisdiction for current timeline.

### Case Config Integration

#### `syncFromCaseConfig(): Promise<boolean>`
Sync timeline with `.caseinfo` data. Returns true if updates were made.

#### `createInjuryEventFromCaseConfig(): Promise<TimelineEvent | null>`
Create injury event from case config injury date.

#### `createTimelineWithCaseConfig(): Promise<CaseTimeline>`
Create new timeline pre-populated with case config data.

### Events (Observables)

#### `onDidChangeTimeline: Event<CaseTimeline | null>`
Fired when timeline changes.

```typescript
timelineService.onDidChangeTimeline(timeline => {
  console.log('Timeline updated:', timeline?.events.length);
});
```

#### `onDidChangeNotifications: Event<TimelineNotification[]>`
Fired when notifications change.

---

## Types & Interfaces

### EventCategory

```typescript
type EventCategory =
  | 'injury'
  | 'medical'
  | 'hearing'
  | 'decision'
  | 'deadline'
  | 'filing'
  | 'correspondence'
  | 'custom';
```

### TimelineEvent

```typescript
interface TimelineEvent {
  id: string;
  date: string;                    // ISO 8601 format
  endDate?: string;                // For date ranges
  title: string;
  description?: string;
  category: EventCategory;
  linkedDocuments: string[];       // URI strings
  isDeadline: boolean;
  reminderDays?: number[];         // e.g., [7, 3, 1]
  isComplete?: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}
```

### CaseTimeline

```typescript
interface CaseTimeline {
  version: '1.0';
  caseId: string;
  caseName?: string;
  jurisdiction: string;            // JurisdictionConfig.id
  injuryDate?: string;             // ISO 8601
  events: TimelineEvent[];
  customStatuteDays?: number;
  notificationsEnabled: boolean;
  notificationPreferences?: NotificationPreferences;
  notifications?: TimelineNotification[];
  createdAt: string;
  updatedAt: string;
}
```

### JurisdictionConfig

```typescript
interface JurisdictionConfig {
  id: string;                      // e.g., 'bc-wcb'
  name: string;                    // e.g., 'British Columbia WCB'
  region: string;                  // e.g., 'CA-BC'
  statuteOfLimitationsDays: number;
  deadlineRules: DeadlineRule[];
}
```

### DeadlineRule

```typescript
interface DeadlineRule {
  id: string;
  name: string;                    // e.g., 'Review Division Appeal'
  daysFromTrigger: number;
  triggerEvent: EventCategory;
  description: string;
}
```

### TimelineNotification

```typescript
interface TimelineNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  eventId?: string;
  severity: 'info' | 'warning' | 'error';
  isRead: boolean;
  isDismissed: boolean;
  snoozedUntil?: string;
  createdAt: string;
}
```

### NotificationType

```typescript
type NotificationType =
  | 'deadline_upcoming'
  | 'deadline_overdue'
  | 'document_expiring'
  | 'document_missing'
  | 'follow_up'
  | 'statute_warning';
```

### NotificationPreferences

```typescript
interface NotificationPreferences {
  enabled: boolean;
  deadlineAlerts: boolean;
  deadlineReminderDays: number[];
  documentExpirationMonths: number;
  documentMissingAlerts: boolean;
  followUpReminders: boolean;
  statuteWarningDays: number;
}
```

---

## Helper Functions

Located in `common/timeline/timelineTypes.ts`:

### `generateEventId(): string`
Generate unique event ID.

```typescript
const id = generateEventId(); // "evt_1703505600000_abc1234"
```

### `parseTimelineDate(dateStr: string): Date | null`
Safely parse date string.

```typescript
const date = parseTimelineDate('2024-06-15');
```

### `formatTimelineDate(date: Date | string): string`
Format date for display.

```typescript
formatTimelineDate('2024-06-15'); // "Jun 15, 2024"
```

### `daysBetween(date1: Date, date2: Date): number`
Calculate days between dates.

```typescript
daysBetween(new Date('2024-06-01'), new Date('2024-06-15')); // 14
```

### `isDeadlineUpcoming(event: TimelineEvent, daysAhead: number): boolean`
Check if deadline is upcoming.

### `isDeadlineOverdue(event: TimelineEvent): boolean`
Check if deadline is past due.

---

## Agent Tools

Available tools for AI agent integration:

### timeline_add_event

Create a new timeline event.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| date | string | ✅ | ISO 8601 date |
| title | string | ✅ | Event title |
| category | EventCategory | ✅ | Event category |
| description | string | ❌ | Event notes |
| endDate | string | ❌ | End date for ranges |
| isDeadline | boolean | ❌ | Mark as deadline |
| reminderDays | number[] | ❌ | Reminder schedule |
| linkedDocuments | string[] | ❌ | Document URIs |
| tags | string[] | ❌ | Custom tags |

### timeline_update_event

Update an existing event.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | ✅ | Event ID |
| updates | object | ✅ | Fields to update |

### timeline_delete_event

Delete an event.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | ✅ | Event ID |

### timeline_get_events

Query events with filters.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| category | EventCategory | ❌ | Filter by category |
| start_date | string | ❌ | Filter from date |
| end_date | string | ❌ | Filter to date |
| is_deadline | boolean | ❌ | Deadlines only |
| limit | number | ❌ | Max results |

### timeline_link_document

Attach document to event.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| event_id | string | ✅ | Event ID |
| document_path | string | ✅ | File path |

### timeline_get_deadlines

Get upcoming and overdue deadlines.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| days_ahead | number | ❌ | Look-ahead days (default: 30) |
| include_overdue | boolean | ❌ | Include past due (default: true) |

---

## IPC Channels

### Timeline Export Channel

Channel ID: `void-channel-timeline-export`

Used for PDF generation in the main process.

**Request:**
```typescript
interface TimelineExportData {
  timeline: CaseTimeline;
  jurisdiction: JurisdictionConfig | undefined;
}
```

**Response:**
- Base64-encoded PDF string

---

## Constants

### Category Labels

```typescript
const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  injury: 'Injury',
  medical: 'Medical',
  hearing: 'Hearing',
  decision: 'Decision',
  deadline: 'Deadline',
  filing: 'Filing',
  correspondence: 'Correspondence',
  custom: 'Custom'
};
```

### Category Colors

```typescript
const EVENT_CATEGORY_COLORS: Record<EventCategory, string> = {
  injury: '#ef4444',      // red
  medical: '#3b82f6',     // blue
  hearing: '#8b5cf6',     // purple
  decision: '#f59e0b',    // amber
  deadline: '#dc2626',    // dark red
  filing: '#10b981',      // emerald
  correspondence: '#6b7280', // gray
  custom: '#64748b'       // slate
};
```

### Default Notification Preferences

```typescript
const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  deadlineAlerts: true,
  deadlineReminderDays: [7, 3, 1],
  documentExpirationMonths: 6,
  documentMissingAlerts: true,
  followUpReminders: true,
  statuteWarningDays: 30
};
```

---

**See Also:**
- [Architecture](architecture.md) - Implementation details
- [Configuration Guide](configuration-guide.md) - Jurisdictions and settings

