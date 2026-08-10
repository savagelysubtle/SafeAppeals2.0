# Plan: Make Timer Task Codes/Activities Editable (Step 8)

## Overview
Currently UTBMS task/activity codes are hardcoded in `utbmsCodes.ts`. This plan makes them configurable via a JSON file in the workspace (aligned with `.cde-workspace` pattern) with a UI for management, while preserving built-in codes as fallback.

---

## Architecture

### 1. Configuration File Format
Create `time-tracker-codes.json` in workspace root (or read from `.cde-workspace` if present):

```json
{
  "version": 1,
  "taskCodes": {
    "L100": "Case Assessment, Development, and Administration",
    "CUSTOM01": "Client Intake",
    "CUSTOM02": "Document Review"
  },
  "activityCodes": {
    "A101": "Plan and prepare for",
    "CUSTOM_A01": "Medical Review"
  },
  "inheritBuiltIn": true
}
```

### 2. Type Extensions (`types.ts`)
```typescript
export interface CustomUTBMSCodes {
  version: number;
  taskCodes: Record<string, string>;
  activityCodes: Record<string, string>;
  inheritBuiltIn?: boolean; // default: true
}
```

### 3. New Service: `CodesService` (`codesService.ts`)
- Load codes from workspace config file
- Merge with built-in codes (if `inheritBuiltIn: true`)
- Validate codes on save (no duplicates, proper format)
- Emit change event for UI refresh
- CRUD operations for custom codes

### 4. UI Additions (`sidebarProvider.ts` webview)
- Add "Manage Codes" button in Manage section
- New modal with two tabs: Task Codes / Activity Codes
- Each tab shows: built-in (read-only) + custom (editable)
- Add/Edit/Delete custom codes
- Inline validation (code format: alphanumeric + underscore)

---

## Implementation Steps

### Step 1: Create `codesService.ts`
- `loadCodes(): Promise<UTBMSCodes>` - reads config, merges with built-in
- `saveCustomCodes(custom: Partial<CustomUTBMSCodes>): Promise<void>` - writes config file
- `addTaskCode(code: string, desc: string): Promise<void>`
- `addActivityCode(code: string, desc: string): Promise<void>`
- `deleteTaskCode(code: string): Promise<void>`
- `deleteActivityCode(code: string): Promise<void>`
- EventEmitter for `onCodesChanged`

### Step 2: Update `types.ts`
- Add `CustomUTBMSCodes` interface
- Add `CodesService` to service imports

### Step 3: Wire into `extension.ts`
- Instantiate `CodesService` after `StorageService`
- Pass to `SidebarProvider`

### Step 4: Update `SidebarProvider`
- Handle new message types: `getCustomCodes`, `saveCustomCodes`, `deleteCustomCode`
- Call `CodesService` methods
- Broadcast `utbmsCodes` update on change

### Step 5: Extend Webview HTML (`getHtmlContent`)
- Add "Manage Codes" button in Manage section
- Add modal HTML for codes management
- Two tabs: Task Codes, Activity Codes
- Each row: Code | Description | Actions (edit/delete for custom only)
- Add new code form at bottom

### Step 6: Update `utbmsCodes.ts`
- Export `BUILTIN_TASKS` and `BUILTIN_ACTIVITIES` as `const` (for reference)
- `getUTBMSCodes()` now delegates to `CodesService` (or returns built-in if service unavailable)
- Keep validation helpers (`isValidTaskCode`, etc.) but make them check merged set

### Step 7: Add Configuration Setting (optional)
- `timeTracker.customCodesPath` - path to JSON file (default: `time-tracker-codes.json`)

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/types.ts` | Add `CustomUTBMSCodes` interface |
| `src/utbmsCodes.ts` | Export built-in constants; make `getUTBMSCodes` dynamic |
| `src/codesService.ts` | **NEW** - Custom codes management |
| `src/extension.ts` | Instantiate and wire `CodesService` |
| `src/sidebarProvider.ts` | Add message handlers; extend webview HTML |
| `package.json` | Add `timeTracker.customCodesPath` config (optional) |

---

## Validation Rules
- Code format: `^[A-Z0-9_]+$` (uppercase, numbers, underscore)
- Code length: 2-20 characters
- Description: 1-200 characters
- No duplicate codes (custom cannot override built-in)
- Must have at least one task code and one activity code

---

## Testing Checklist
- [ ] Built-in codes load when no config file exists
- [ ] Custom codes merge with built-in (when `inheritBuiltIn: true`)
- [ ] Custom codes replace built-in (when `inheritBuiltIn: false`)
- [ ] Add/edit/delete custom codes via UI
- [ ] Timer dropdown shows merged codes
- [ ] Time entries save with custom codes
- [ ] Exports (CSV/JSON/LEDES) include custom codes
- [ ] Config file persists across reloads
- [ ] Validation prevents invalid codes

---

## Future Enhancements (out of scope)
- Import/export codes as JSON
- Per-matter code subsets
- Code hierarchies (parent/child)
- Integration with `.cde-workspace` `timerCodes` section