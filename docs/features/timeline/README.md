# Case Timeline & Event Tracker

A visual timeline system for tracking case events in workers' compensation appeals, including injury progression, medical visits, hearings, decisions, and statutory deadlines.

## Features

- **📅 Event Management** - Add, edit, delete events with dates, categories, and descriptions
- **⏰ Deadline Tracking** - Automatic deadline calculations based on jurisdiction rules
- **🗺️ 12 Jurisdictions** - Pre-configured statute of limitations for Canada & US regions
- **🔔 Notifications** - Alerts for upcoming/overdue deadlines and document reminders
- **📎 Document Linking** - Attach files to events from the Explorer
- **📄 PDF Export** - Export timeline to formatted PDF document
- **🤖 Agent Tools** - CORE allowlist names `timeline_*` (not `safeappeals_*`); see [Agent LM Tools Pattern](../../agent-tools-pattern.md)

## Quick Start

### Open Timeline

- **Keyboard**: `Ctrl+Shift+T`
- **Command Palette**: `F1` → "Open Case Timeline"
- **Activity Bar**: Click the calendar icon in the sidebar

### Add Your First Event

1. Open the Timeline panel
2. Click the **"+ Add Event"** button
3. Fill in:
   - **Date** (required)
   - **Title** (required)
   - **Category** (Injury, Medical, Hearing, Decision, Deadline, Filing, Correspondence, Custom)
   - **Description** (optional)
   - **Is Deadline** checkbox for deadline tracking
4. Click **Save**

### Link Documents to Events

Right-click any file in Explorer → **"Link to Timeline Event..."** → Select the event

## Storage

Timeline data is stored in `.safeAppeals/timeline.json` under the workspace root:

```json
{
  "version": "1.0",
  "caseId": "12345",
  "caseName": "Smith v. Employer",
  "jurisdiction": "bc-wcb",
  "injuryDate": "2024-06-15",
  "events": [...],
  "notificationsEnabled": true
}
```

## Documentation

| Document | Description |
|----------|-------------|
| [User Guide](user-guide.md) | Complete usage instructions |
| [Configuration Guide](configuration-guide.md) | Jurisdictions and settings |
| [API Reference](api-reference.md) | Service interface and types |
| [Architecture](architecture.md) | Technical implementation details |

## Event Categories

| Category | Color | Use Case |
|----------|-------|----------|
| 🔴 Injury | Red | Initial injury events |
| 🔵 Medical | Blue | Doctor visits, treatments, evaluations |
| 🟣 Hearing | Purple | Oral hearings, conferences |
| 🟠 Decision | Amber | Board decisions, rulings |
| 🔴 Deadline | Dark Red | Filing deadlines, due dates |
| 🟢 Filing | Emerald | Document submissions |
| ⚫ Correspondence | Gray | Letters, emails, communications |
| 🔘 Custom | Slate | User-defined events |

## Supported Jurisdictions

### Canada
- British Columbia WorkSafeBC (90 days)
- Ontario WSIB (30 days)
- Alberta WCB (60 days)
- Quebec CNESST (30 days)
- Manitoba WCB (30 days)
- Saskatchewan WCB (60 days)
- Nova Scotia WCB (30 days)

### United States
- California DWC (365 days)
- Texas DWC (365 days)
- New York WCB (730 days)
- Florida DWC (730 days)
- Washington L&I (60 days)

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open Timeline | `Ctrl+Shift+T` |

## Tutorials & sample case

- Command: `safeappeals-timeline.openTutorials` (Help → Tutorials; Get Started CTA “Tutorials”)
- Opens/ensures the bundled sample case as a real `file://` workspace (not a virtual `vscode-userdata:` workspace) so extensions activate, then runs the Setup/Beginner walkthrough
- Explore More links feature walkthroughs: Private Search, Case Files, Email and Calendar, Hearings and Audio
- Local Git is optional backup only — Safe Appeals does not auto-run `git init`; agents are taught never to push legal case data

## File Structure

```
extensions/safeappeals-timeline/
├── src/
│   ├── timelineStore.ts       # `.safeAppeals/timeline.json` persistence
│   ├── timelineService.ts     # Core service
│   ├── sampleCase.ts          # Sample matter materialization
│   ├── tutorialsHub.ts        # openTutorials / resume pending
│   ├── scaffold.ts            # Standard snake_case case folders
│   └── agentTools.ts          # Timeline LM tools
├── media/walkthrough/         # Get Started + feature steps
└── skills/                    # project-setup, organize-files
```

## Related Features

- **organize-files skill** — file case documents into standard folders
- **Private Search** — on-device index (`docs/rag/`); status bar `$(search) Private Search`
- **`.safeAppeals/`** — settings, skills, agents, plans, timeline

---

**Version**: 1.0
**Last Updated**: August 2026

