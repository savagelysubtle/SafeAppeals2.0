# Timeline Configuration Guide

Configure jurisdictions, notifications, and timeline behavior.

## Table of Contents

1. [Timeline Storage](#timeline-storage)
2. [Jurisdiction Configuration](#jurisdiction-configuration)
3. [Notification Settings](#notification-settings)
4. [Case Config Integration](#case-config-integration)
5. [Custom Jurisdictions](#custom-jurisdictions)

---

## Timeline Storage

### File Location

Timeline data is stored in `.timeline.json` at your workspace root.

```
my-case-folder/
├── .timeline.json          # Timeline data
├── .caseinfo               # Case metadata (optional)
├── documents/
└── ...
```

### File Format

```json
{
  "version": "1.0",
  "caseId": "WC-2024-12345",
  "caseName": "Smith v. ABC Corporation",
  "jurisdiction": "bc-wcb",
  "injuryDate": "2024-06-15",
  "events": [
    {
      "id": "evt_1703505600000_abc1234",
      "date": "2024-06-15",
      "title": "Workplace Injury",
      "category": "injury",
      "description": "Back injury while lifting equipment",
      "linkedDocuments": ["file:///path/to/incident_report.pdf"],
      "isDeadline": false,
      "tags": ["initial", "back"],
      "createdAt": "2024-06-15T10:00:00.000Z",
      "updatedAt": "2024-06-15T10:00:00.000Z"
    }
  ],
  "customStatuteDays": null,
  "notificationsEnabled": true,
  "notificationPreferences": {
    "enabled": true,
    "deadlineAlerts": true,
    "deadlineReminderDays": [7, 3, 1],
    "documentExpirationMonths": 6,
    "documentMissingAlerts": true,
    "followUpReminders": true,
    "statuteWarningDays": 30
  },
  "notifications": [],
  "createdAt": "2024-06-15T10:00:00.000Z",
  "updatedAt": "2024-12-25T14:30:00.000Z"
}
```

---

## Jurisdiction Configuration

### Available Jurisdictions

#### Canada

| ID | Name | Statute Days | Region |
|----|------|--------------|--------|
| `bc-wcb` | British Columbia WorkSafeBC | 90 | CA-BC |
| `ontario-wsib` | Ontario WSIB | 30 | CA-ON |
| `alberta-wcb` | Alberta WCB | 60 | CA-AB |
| `quebec-cnesst` | Quebec CNESST | 30 | CA-QC |
| `manitoba-wcb` | Manitoba WCB | 30 | CA-MB |
| `saskatchewan-wcb` | Saskatchewan WCB | 60 | CA-SK |
| `nova-scotia-wcb` | Nova Scotia WCB | 30 | CA-NS |

#### United States

| ID | Name | Statute Days | Region |
|----|------|--------------|--------|
| `california-dwc` | California DWC | 365 | US-CA |
| `texas-dwc` | Texas DWC | 365 | US-TX |
| `new-york-wcb` | New York WCB | 730 | US-NY |
| `florida-dwc` | Florida DWC | 730 | US-FL |
| `washington-lni` | Washington L&I | 60 | US-WA |

#### Custom

| ID | Name | Statute Days | Region |
|----|------|--------------|--------|
| `custom` | Custom Jurisdiction | 90 | CUSTOM |

### Deadline Rules by Jurisdiction

Each jurisdiction has specific appeal deadlines:

#### BC WorkSafeBC

| Rule | Days | Trigger | Description |
|------|------|---------|-------------|
| Review Division Appeal | 90 | Decision | Appeal to Review Division |
| WCAT Appeal | 30 | Decision | Appeal to WCAT |
| Reconsideration Request | 75 | Decision | Request reconsideration |

#### Ontario WSIB

| Rule | Days | Trigger | Description |
|------|------|---------|-------------|
| ARO Review | 30 | Decision | Appeals Resolution Officer |
| WSIAT Appeal | 30 | Decision | Appeal ARO decision |

#### California DWC

| Rule | Days | Trigger | Description |
|------|------|---------|-------------|
| Petition for Reconsideration | 20 | Decision | File petition |
| Appeal to Court | 45 | Decision | Court of Appeal |

### Changing Jurisdiction

**Via UI:**
1. Open Timeline
2. Click jurisdiction badge in toolbar
3. Select new jurisdiction

**Via Code:**
```typescript
await timelineService.setJurisdiction('ontario-wsib');
```

### Custom Statute Days

Override the default statute days for your case:

```json
{
  "jurisdiction": "bc-wcb",
  "customStatuteDays": 120
}
```

This overrides the jurisdiction's default (90 days) with your custom value (120 days).

---

## Notification Settings

### Default Preferences

```typescript
{
  enabled: true,
  deadlineAlerts: true,
  deadlineReminderDays: [7, 3, 1],
  documentExpirationMonths: 6,
  documentMissingAlerts: true,
  followUpReminders: true,
  statuteWarningDays: 30
}
```

### Setting Descriptions

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enabled` | boolean | `true` | Master toggle for all notifications |
| `deadlineAlerts` | boolean | `true` | Alert when deadlines approach |
| `deadlineReminderDays` | number[] | `[7, 3, 1]` | Days before deadline to remind |
| `documentExpirationMonths` | number | `6` | Alert when medical docs are old |
| `documentMissingAlerts` | boolean | `true` | Alert for events without docs |
| `followUpReminders` | boolean | `true` | Enable follow-up reminders |
| `statuteWarningDays` | number | `30` | Days before statute to warn |

### Configuring Reminder Days

The `deadlineReminderDays` array specifies when to send reminders before a deadline:

```json
{
  "deadlineReminderDays": [14, 7, 3, 1]
}
```

This sends reminders at:
- 14 days before
- 7 days before
- 3 days before
- 1 day before

### Notification Types

| Type | Severity | Trigger |
|------|----------|---------|
| `deadline_upcoming` | warning | Deadline within reminder days |
| `deadline_overdue` | error | Deadline passed, not complete |
| `document_expiring` | warning | Medical doc older than threshold |
| `document_missing` | info | Event without linked documents |
| `follow_up` | info | Follow-up reminder |
| `statute_warning` | warning | Statute of limitations approaching |

---

## Case Config Integration

### Syncing with `.caseinfo`

If you use the File Organizer's `.caseinfo` file, the timeline can sync data:

```json
// .caseinfo
{
  "caseNumber": "WC-2024-12345",
  "claimantName": "John Smith",
  "injuryDate": "2024-06-15",
  "caseType": "workers_compensation"
}
```

**Sync Behavior:**

| Case Config Field | Timeline Field |
|-------------------|----------------|
| `claimantName` | `caseName` |
| `caseNumber` | `caseId` |
| `injuryDate` | `injuryDate` + auto-creates injury event |

### Manual Sync

```typescript
const updated = await timelineService.syncFromCaseConfig();
if (updated) {
  console.log('Timeline synced with case config');
}
```

### Auto-Create Injury Event

When syncing, if an injury date exists in case config:

```typescript
const injuryEvent = await timelineService.createInjuryEventFromCaseConfig();
```

Creates:
```json
{
  "date": "2024-06-15",
  "title": "Initial Injury",
  "category": "injury",
  "description": "Auto-generated from case configuration",
  "isDeadline": false
}
```

---

## Custom Jurisdictions

### Using the Custom Jurisdiction

Select `custom` jurisdiction for cases not covered by built-in options:

```json
{
  "jurisdiction": "custom",
  "customStatuteDays": 180
}
```

### Deadline Rules

The custom jurisdiction has no pre-defined deadline rules. You can:

1. Manually add deadline events
2. Set custom reminder days on each event
3. Use the `customStatuteDays` field

### Future: Custom Jurisdiction Definitions

*Planned feature:* Define custom jurisdictions in your workspace:

```json
// .timeline-config.json (future)
{
  "jurisdictions": [
    {
      "id": "my-custom",
      "name": "My Custom Jurisdiction",
      "region": "CUSTOM",
      "statuteOfLimitationsDays": 180,
      "deadlineRules": [
        {
          "id": "custom-appeal",
          "name": "Custom Appeal",
          "daysFromTrigger": 60,
          "triggerEvent": "decision",
          "description": "Custom appeal deadline"
        }
      ]
    }
  ]
}
```

---

## Environment Variables

Currently, the timeline does not use environment variables. All configuration is stored in:

- `.timeline.json` - Timeline data and preferences
- `.caseinfo` - Case metadata (optional sync source)

---

## Best Practices

### Jurisdiction Selection

1. **Select early** - Set jurisdiction when creating the timeline
2. **Match your region** - Choose the correct workers' comp board
3. **Use custom sparingly** - Built-in jurisdictions have accurate deadlines

### Notification Configuration

1. **Start with defaults** - The defaults work for most cases
2. **Adjust reminder days** - Add more lead time for complex deadlines
3. **Review regularly** - Check notification center weekly

### Case Config Integration

1. **Create `.caseinfo` first** - Set up case metadata before timeline
2. **Sync after changes** - Re-sync when case config updates
3. **Verify injury date** - Ensure accurate date for statute calculations

---

## Troubleshooting

### Timeline Not Loading

- Check `.timeline.json` exists and is valid JSON
- Verify file permissions
- Look for parse errors in DevTools console

### Wrong Deadline Calculations

- Verify correct jurisdiction selected
- Check `customStatuteDays` isn't overriding
- Confirm injury date is correct

### Notifications Not Appearing

- Check `notificationsEnabled: true`
- Verify `deadlineAlerts: true`
- Ensure dates are in the future

### Sync Not Working

- Verify `.caseinfo` exists and is valid
- Check for required fields (caseNumber, injuryDate)
- Look for sync errors in console

---

**See Also:**
- [User Guide](user-guide.md) - Usage instructions
- [API Reference](api-reference.md) - Programmatic access

