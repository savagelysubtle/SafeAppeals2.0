# Timeline User Guide

Complete instructions for using the Case Timeline & Event Tracker.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Managing Events](#managing-events)
3. [Working with Deadlines](#working-with-deadlines)
4. [Linking Documents](#linking-documents)
5. [Notifications](#notifications)
6. [Jurisdictions](#jurisdictions)
7. [Exporting](#exporting)
8. [Using AI Agent](#using-ai-agent)

---

## Getting Started

### Opening the Timeline

**Option 1: Keyboard Shortcut**
```
Ctrl+Shift+T (Windows/Linux)
Cmd+Shift+T (macOS)
```

**Option 2: Command Palette**
1. Press `F1` or `Ctrl+Shift+P`
2. Type "Open Case Timeline"
3. Press Enter

**Option 3: Activity Bar**
- Click the calendar icon in the left sidebar

### First-Time Setup

When you open a workspace for the first time, the timeline is empty. You can:

1. **Create manually** - Add events one by one
2. **Import from case config** - If you have a `.caseinfo` file, the timeline can sync injury date and case name
3. **Let the AI help** - Use the chat agent to extract dates from your documents

---

## Managing Events

### Adding an Event

1. Click **"+ Add Event"** in the toolbar
2. Fill in the event form:

| Field | Required | Description |
|-------|----------|-------------|
| Date | ✅ | Event date (YYYY-MM-DD) |
| End Date | ❌ | For date ranges (e.g., hospitalization) |
| Title | ✅ | Brief event name |
| Category | ✅ | Type of event (see categories below) |
| Description | ❌ | Detailed notes |
| Is Deadline | ❌ | Mark as a deadline for tracking |
| Reminder Days | ❌ | When to remind (e.g., 7, 3, 1 days before) |
| Tags | ❌ | Custom labels |

3. Click **Save**

### Editing an Event

1. Find the event in the timeline
2. Click the **edit** (pencil) icon on the event card
3. Modify fields as needed
4. Click **Save**

### Deleting an Event

1. Click the **delete** (trash) icon on the event card
2. Confirm deletion

### Event Categories

Choose the appropriate category for each event:

| Category | When to Use |
|----------|-------------|
| **Injury** | Initial workplace injury, accident reports |
| **Medical** | Doctor visits, treatments, IME, evaluations |
| **Hearing** | Oral hearings, mediation, conferences |
| **Decision** | Board decisions, rulings, orders |
| **Deadline** | Filing deadlines, response due dates |
| **Filing** | Claim submissions, appeal filings |
| **Correspondence** | Letters, emails, phone calls |
| **Custom** | Anything else |

---

## Working with Deadlines

### Marking an Event as a Deadline

1. When creating/editing an event, check **"Is Deadline"**
2. Optionally set **Reminder Days** (e.g., `7, 3, 1` for reminders at 7, 3, and 1 day before)

### Deadline Status Indicators

| Status | Appearance | Meaning |
|--------|------------|---------|
| Upcoming | Yellow warning | Due within 7 days |
| Overdue | Red warning | Past due date |
| Complete | Green checkmark | Marked as done |

### Completing a Deadline

1. Click the **checkmark** icon on the deadline event
2. The deadline is marked complete and no longer shows warnings

### Automatic Deadline Generation

When you add a **Decision** event, the system can automatically generate related deadlines based on your jurisdiction's rules. For example:

- BC WCB decision → Creates "Review Division Appeal" deadline (90 days)
- Ontario WSIB decision → Creates "ARO Review" deadline (30 days)

---

## Linking Documents

### From Explorer Context Menu

1. Right-click a file in the Explorer sidebar
2. Select **"Link to Timeline Event..."**
3. Choose the event to link

### From Event Editor

1. Edit an event
2. Use the document picker to add files
3. Save the event

### Viewing Linked Documents

- Linked documents appear as chips on event cards
- Click a document link to open it in the editor

---

## Notifications

### Notification Types

| Type | Trigger |
|------|---------|
| **Deadline Upcoming** | Deadline approaching (based on reminder days) |
| **Deadline Overdue** | Deadline passed without completion |
| **Document Expiring** | Medical report older than configured months |
| **Document Missing** | Event without linked documents |
| **Statute Warning** | Statute of limitations approaching |

### Managing Notifications

- **Mark as Read** - Click the notification
- **Dismiss** - Remove from list
- **Snooze** - Hide for X days

### Notification Preferences

Configure in the timeline settings:

| Setting | Default | Description |
|---------|---------|-------------|
| Enabled | ✅ | Master toggle |
| Deadline Alerts | ✅ | Alert on upcoming deadlines |
| Reminder Days | 7, 3, 1 | Days before to remind |
| Document Expiration | 6 months | Alert when docs are old |
| Missing Docs Alert | ✅ | Alert for unlinked events |
| Statute Warning | 30 days | Warn before statute expires |

---

## Jurisdictions

### Setting Your Jurisdiction

1. Open the timeline
2. Click the jurisdiction selector in the toolbar
3. Choose your region

### Jurisdiction-Specific Features

Each jurisdiction has:
- **Statute of Limitations** - Days to file initial claim
- **Deadline Rules** - Appeal periods after decisions

### Custom Statute Days

Override the default statute days per case:

1. Set `customStatuteDays` in your timeline
2. This overrides the jurisdiction default

### Available Jurisdictions

**Canada:**
- BC WorkSafeBC, Ontario WSIB, Alberta WCB
- Quebec CNESST, Manitoba WCB, Saskatchewan WCB, Nova Scotia WCB

**United States:**
- California DWC, Texas DWC, New York WCB
- Florida DWC, Washington L&I

---

## Exporting

### Export to PDF

1. Click **"Export PDF"** in the toolbar
2. The PDF downloads automatically
3. Filename format: `Timeline_{CaseName}_{YYYY-MM-DD}.pdf`

### PDF Contents

The exported PDF includes:
- Case header (name, jurisdiction, injury date)
- Chronological event list with categories
- Deadline status indicators
- Linked document references
- Tags and notes

---

## Using AI Agent

The timeline integrates with the AI chat agent. Ask the agent to:

### Add Events from Documents
```
"Add the medical appointment from dr_smith_report.pdf to my timeline"
```

### Query Events
```
"What deadlines are coming up in the next 30 days?"
```

### Update Events
```
"Mark the Review Division Appeal deadline as complete"
```

### Available Agent Tools

| Tool | Purpose |
|------|---------|
| `timeline_add_event` | Create new event |
| `timeline_update_event` | Modify existing event |
| `timeline_delete_event` | Remove event |
| `timeline_get_events` | Query with filters |
| `timeline_link_document` | Attach file to event |
| `timeline_get_deadlines` | Get upcoming/overdue |

---

## Tips & Best Practices

### Organizing Your Timeline

1. **Add the injury first** - Start with the initial injury event
2. **Link documents early** - Attach files as you add events
3. **Use deadlines** - Mark important dates for tracking
4. **Set reminders** - Configure reminder days for deadlines
5. **Keep notes** - Use descriptions for important details

### Maintaining Accuracy

- Update events when dates change
- Mark deadlines complete when done
- Review notifications regularly
- Sync from case config when available

### Using with File Organizer

1. Organize files first using File Organizer
2. Then link organized documents to timeline events
3. Use consistent naming for easy identification

---

## Troubleshooting

### Timeline Not Saving

- Ensure you have write access to the workspace
- Check that `.safeAppeals/timeline.json` isn't read-only

### Deadlines Not Showing

- Verify the event has **Is Deadline** checked
- Confirm the date is in the future
- Check that it's not marked complete

### PDF Export Fails

- Try reloading the window (`Ctrl+Shift+P` → "Developer: Reload Window")
- Check the console for errors (`Help` → "Toggle Developer Tools")

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open Timeline | `Ctrl+Shift+T` |
| Command Palette | `F1` |

---

**Need help?** Use the AI chat agent or check the [API Reference](api-reference.md) for technical details.

