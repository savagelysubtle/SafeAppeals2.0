# Time Tracker User Guide

Complete guide to using the Legal Time Tracker extension for professional time tracking.

## Table of Contents

- [Getting Started](#getting-started)
- [Timer Operations](#timer-operations)
- [Managing Matters](#managing-matters)
- [Managing Billing Rates](#managing-billing-rates)
- [UTBMS Codes](#utbms-codes)
- [Exporting Time](#exporting-time)
- [Settings](#settings)
- [Tips for Legal Professionals](#tips-for-legal-professionals)
- [Troubleshooting](#troubleshooting)

## Getting Started

### Opening the Time Tracker

The Time Tracker can be accessed in three ways:

1. **Activity Bar** - Click the clock icon in the left activity bar
2. **Status Bar** - Look for the timer display in the bottom status bar
3. **Command Palette** - Press `Ctrl+Shift+P` and type "Time Tracker"

### Understanding the Interface

#### Status Bar

The status bar item shows:

- **When idle:** `0.0 hrs today` - Your total tracked time for today
- **When running:** `00:05:23 [Matter Name]` - Elapsed time and current matter

Click the status bar item to quickly toggle the timer.

#### Sidebar Panel

The sidebar is organized into sections:

1. **Timer Display** - Shows current elapsed time and billable hours
2. **Entry Details** - Configure the current time entry
3. **Today's Entries** - View all entries for today
4. **Export** - Export buttons for CSV, JSON, and LEDES
5. **Manage** - Buttons to manage matters and rates

## Timer Operations

### Starting a Timer

**Quick Start (No Details):**

- Click the status bar item
- Or press `Ctrl+Shift+T`

**With Full Details:**

1. Open the Time Tracker sidebar
2. Select a **Matter** from the dropdown
3. Select a **Billing Rate**
4. Choose **UTBMS Task** and **Activity** codes
5. Enter a **Description**
6. Check/uncheck **Billable**
7. Click **Start Timer**

### Stopping a Timer

**Quick Stop:**

- Click the status bar item
- Or press `Ctrl+Shift+T`

If you haven't entered a description, you'll be prompted to add one before the entry is saved.

**From Sidebar:**

1. Click the **Stop Timer** button (red when running)
2. The entry is automatically saved with all configured details

### Adding Manual Entries

For work you forgot to track:

1. Press `Ctrl+Shift+E` or use Command Palette: "Time Tracker: Add Manual Entry"
2. Select a matter (optional)
3. Select a billing rate (optional)
4. Enter hours in 0.1 increments (e.g., `0.5` for 30 minutes)
5. Enter a description
6. The entry is saved with the specified duration

### Editing Entries

To edit an existing entry:

1. Find the entry in "Today's Entries" section
2. Hover over the entry to reveal action buttons
3. Click the **edit** icon to modify details
4. Changes are saved immediately

### Deleting Entries

1. Find the entry in "Today's Entries"
2. Hover to reveal action buttons
3. Click the **trash** icon
4. Confirm deletion when prompted

## Managing Matters

Matters represent client cases or projects you track time against.

### Creating a Matter

1. Use Command Palette: "Time Tracker: Manage Matters"
2. Select "Create New Matter"
3. Enter the following information:
   - **Client Name** (required): e.g., "Smith, John"
   - **Matter Name** (required): e.g., "Smith v. ABC Corporation"
   - **Matter Number** (optional): e.g., "2026-WC-001"
   - **Default Rate** (optional): e.g., "250.00"

### Editing a Matter

1. Use Command Palette: "Time Tracker: Manage Matters"
2. Select the matter to edit
3. Choose "Edit"
4. Modify any fields as needed

### Archiving a Matter

When a case is closed:

1. Select the matter from "Manage Matters"
2. Choose "Archive"
3. The matter will no longer appear in dropdowns but existing entries are preserved

## Managing Billing Rates

Set up different hourly rates for various billing categories.

### Creating a Rate

1. Use Command Palette: "Time Tracker: Manage Billing Rates"
2. Select "Create New Rate"
3. Enter:
   - **Rate Name**: e.g., "Partner", "Associate", "Paralegal"
   - **Hourly Rate**: e.g., "350.00"
   - **Set as Default**: If yes, this rate is pre-selected for new entries

### Example Rate Structure

| Rate Name        | Hourly Rate |
| ---------------- | ----------- |
| Partner          | $450.00     |
| Senior Associate | $350.00     |
| Associate        | $275.00     |
| Paralegal        | $150.00     |

## UTBMS Codes

The Uniform Task-Based Management System provides standardized codes for legal billing.

### Selecting Codes

1. In the sidebar, use the **Task Code** dropdown to select a phase
2. Use the **Activity** dropdown to specify what you did
3. Codes appear on exported entries

### Common Code Combinations

| Task                      | Activity              | Example Work                  |
| ------------------------- | --------------------- | ----------------------------- |
| L110 (Fact Investigation) | A104 (Review/analyze) | Reviewing discovery documents |
| L300 (Discovery)          | A103 (Draft/revise)   | Drafting interrogatories      |
| W110 (Medical Records)    | A104 (Review/analyze) | Reviewing medical reports     |
| L200 (Pre-Trial Motions)  | A102 (Research)       | Legal research for motion     |

### Workers' Compensation Codes

Special codes for workers' comp cases:

| Code | Use For                                |
| ---- | -------------------------------------- |
| W100 | Initial case review and claim analysis |
| W110 | Reviewing medical records and reports  |
| W120 | Interviewing employer and witnesses    |
| W130 | Communications with medical providers  |
| W200 | Preparing for WCAB hearings            |
| W300 | Settlement negotiations                |

## Exporting Time

### Export Formats

**CSV (Spreadsheet)**

- Human-readable format
- Opens in Excel, Google Sheets
- Good for internal billing review

**JSON (API)**

- Structured data format
- Good for integration with other systems
- Includes full entry details and summary

**LEDES 1998B (Legal Standard)**

- Industry-standard format for legal billing
- Required by many insurance companies and corporate clients
- Pipe-delimited with specific column order

### Exporting Entries

1. Open the Time Tracker sidebar
2. Click the desired export button (CSV, JSON, or LEDES)
3. Select a date range:
   - Today
   - This Week
   - This Month
   - This Year
   - All Time
   - Custom Range
4. Choose a save location
5. File is created with timestamp in name

### LEDES Export Notes

- Only entries with associated matters are included
- Entries without matters are excluded (LEDES requires matter info)
- You'll see a warning if any entries are excluded

### CSV Format Example

```csv
date,client,matter,matter_number,hours,rate,amount,task_code,activity_code,description,billable
2026-02-02,Smith,Smith v. ABC Corp,2026-WC-001,1.5,250.00,375.00,L300,A104,"Review discovery documents",true
```

## Settings

### Accessing Settings

1. Go to `File > Preferences > Settings`
2. Search for "Time Tracker"

### Available Settings

#### Rounding Mode

**Setting:** `timeTracker.defaultRoundingMode`

How to round time to 0.1 hour increments:

- **up** (default): Always round up (5 min → 0.1 hr)
- **down**: Always round down (11 min → 0.1 hr)
- **nearest**: Round to nearest (8 min → 0.1 hr, 9 min → 0.2 hr)

Most law firms use "up" rounding as standard practice.

#### Minimum Increment

**Setting:** `timeTracker.minimumIncrement`

Minimum billable time in hours. Default is `0.1` (6 minutes).

Any time tracked becomes at least this amount when saved.

#### Description Max Length

**Setting:** `timeTracker.descriptionMaxLength`

Maximum characters for descriptions. Default is `500`.

Many clients and billing systems cap descriptions at 500 characters.

#### Auto-Stop on Close

**Setting:** `timeTracker.autoStopOnClose`

When enabled (default), if VSCode closes while a timer is running:

- Timer is automatically stopped
- Entry is saved with current duration
- Description defaults to "Auto-saved on exit" if empty

## Tips for Legal Professionals

### Daily Workflow

1. **Start of day:** Open Time Tracker sidebar, review yesterday's entries
2. **Starting work:** Select matter and codes, start timer
3. **Switching tasks:** Stop timer, adjust details, start new timer
4. **End of day:** Review today's entries, add any missed manual entries

### Accurate Time Keeping

- **Start timer immediately** when beginning billable work
- **Be specific** in descriptions: "Reviewed plaintiff's responses to interrogatories 1-15" rather than "Document review"
- **Use UTBMS codes** consistently for client reporting
- **Add manual entries promptly** if you forget to track time

### Block Billing vs. Task Billing

The extension supports both styles:

**Block Billing:**

- One long timer for multiple related tasks
- Single description covering all work
- Good for: Long research sessions, document drafting

**Task Billing:**

- Separate entries for each distinct task
- Multiple short entries
- Good for: Client reporting, detailed audits

### End of Month Export

1. Export to LEDES for client billing
2. Export to CSV for internal records
3. Export to JSON for accounting system integration

## Troubleshooting

### Timer Not Starting

**Problem:** Timer doesn't start when clicking Start button

**Solutions:**

1. Check if there's already a running timer (look at status bar)
2. Reload the window: `Ctrl+Shift+P` → "Developer: Reload Window"
3. Check the Developer Console for errors: `Help > Toggle Developer Tools`

### Entries Not Saving

**Problem:** Timer stops but entry doesn't appear

**Solutions:**

1. Ensure you entered a description (required)
2. Check database permissions in the storage location
3. Look for error messages in the Developer Console

### Export Not Working

**Problem:** Export fails or file is empty

**Solutions:**

1. Verify you have entries in the selected date range
2. For LEDES: Ensure entries have matters assigned
3. Check write permissions for the selected save location

### Status Bar Missing

**Problem:** Timer not visible in status bar

**Solutions:**

1. The extension may not have activated - reload window
2. Check if extension is enabled in Extensions panel
3. Look for errors in Developer Console

### Database Reset

If you need to start fresh:

1. Close VSCode
2. Navigate to:
   ```
   %APPDATA%\Void\User\.safe-appeals-navigator\databases\workspaces\{workspaceId}\
   ```
3. Delete or rename `timetracker.db`
4. Restart VSCode

**Warning:** This deletes all time entries, matters, and rates for this workspace.

---

**Next:** [Developer Guide](./developer-guide.md) | [API Reference](./api-reference.md)
