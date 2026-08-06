# Time Tracker API Reference

Complete TypeScript interface and service documentation.

## Table of Contents

- [Types](#types)
- [Services](#services)
- [UTBMS Codes](#utbms-codes)
- [LEDES Formatter](#ledes-formatter)
- [Webview Messages](#webview-messages)
- [Agent LM Tools](#agent-lm-tools)

## Types

### Core Interfaces

#### Matter

Represents a client case or project.

```typescript
interface Matter {
	id: number; // Auto-generated primary key
	workspace_id: string; // Workspace hash for isolation
	client_name: string; // Client or party name
	matter_name: string; // Case or project name
	matter_number: string | null; // Optional case number (e.g., "2026-WC-001")
	default_rate: number | null; // Default hourly rate, null = use global
	is_active: number; // 1 = active, 0 = archived
	created_at: number; // Unix timestamp (ms)
}
```

#### BillingRate

Hourly billing rate configuration.

```typescript
interface BillingRate {
	id: number; // Auto-generated primary key
	workspace_id: string; // Workspace hash
	name: string; // Rate tier name (e.g., "Partner")
	hourly_rate: number; // $/hour
	is_default: number; // 1 if default rate
	created_at: number; // Unix timestamp (ms)
}
```

#### TimeEntry

A recorded time entry.

```typescript
interface TimeEntry {
	id: number; // Auto-generated primary key
	workspace_id: string; // Workspace hash
	matter_id: number | null; // FK to matters table
	rate_id: number | null; // FK to billing_rates table
	start_time: number; // Start timestamp (ms)
	end_time: number | null; // End timestamp, null if running
	duration_tenths: number | null; // Duration in 0.1 hour increments
	utbms_task: string | null; // Task code (e.g., "L110")
	utbms_activity: string | null; // Activity code (e.g., "A101")
	description: string; // Work description (required)
	is_billable: number; // 1 = billable, 0 = non-billable
	created_at: number; // Unix timestamp (ms)
}
```

#### TimeEntryWithDetails

Extended time entry with joined matter and rate data.

```typescript
interface TimeEntryWithDetails extends TimeEntry {
	matter_name?: string; // From matters table
	client_name?: string; // From matters table
	matter_number?: string; // From matters table
	rate_name?: string; // From billing_rates table
	hourly_rate?: number; // From billing_rates table
}
```

#### TimerState

Current state of the timer.

```typescript
interface TimerState {
	isRunning: boolean; // Timer active
	startTime: number | null; // Start timestamp if running
	currentMatterId: number | null;
	currentRateId: number | null;
	currentDescription: string;
	currentUtbmsTask: string | null;
	currentUtbmsActivity: string | null;
	isBillable: boolean;
}
```

#### RoundingMode

Time rounding options.

```typescript
type RoundingMode = "up" | "down" | "nearest";
```

#### ExportOptions

Filter options for exports.

```typescript
interface ExportOptions {
	startDate?: number; // Start of date range (timestamp)
	endDate?: number; // End of date range (timestamp)
	matterId?: number; // Filter by specific matter
	billableOnly?: boolean; // Only include billable entries
}
```

#### ExportResult

JSON export structure.

```typescript
interface ExportResult {
	workspace: string; // Workspace name
	exported_at: string; // ISO timestamp
	summary: {
		total_hours: number;
		billable_hours: number;
		total_value: number;
		entry_count: number;
	};
	entries: TimeEntryWithDetails[];
}
```

## Services

### StorageService

SQLite database operations.

```typescript
class StorageService {
	constructor(context: vscode.ExtensionContext);

	/**
	 * Initialize database connection and create tables
	 * @throws Error if database cannot be opened
	 */
	async initialize(): Promise<void>;

	/**
	 * Get workspace identifier (16-char hash)
	 */
	getWorkspaceId(): string;

	// === MATTERS ===

	/**
	 * Create a new matter
	 * @param clientName - Client or party name
	 * @param matterName - Case or project name
	 * @param matterNumber - Optional case number
	 * @param defaultRate - Optional default hourly rate
	 * @returns Created matter with id
	 */
	createMatter(
		clientName: string,
		matterName: string,
		matterNumber?: string,
		defaultRate?: number,
	): Matter;

	/**
	 * Get matter by ID
	 */
	getMatterById(id: number): Matter | undefined;

	/**
	 * Get all matters for workspace
	 * @param activeOnly - If true, exclude archived matters (default: true)
	 */
	getMatters(activeOnly?: boolean): Matter[];

	/**
	 * Update matter fields
	 * @param id - Matter ID
	 * @param updates - Partial matter object with fields to update
	 */
	updateMatter(id: number, updates: Partial<Matter>): Matter | undefined;

	/**
	 * Soft delete matter (sets is_active = 0)
	 */
	deleteMatter(id: number): void;

	// === BILLING RATES ===

	/**
	 * Create a new billing rate
	 * @param name - Rate tier name
	 * @param hourlyRate - Hourly rate in dollars
	 * @param isDefault - Set as workspace default
	 */
	createRate(
		name: string,
		hourlyRate: number,
		isDefault?: boolean,
	): BillingRate;

	getRateById(id: number): BillingRate | undefined;
	getRates(): BillingRate[];
	getDefaultRate(): BillingRate | undefined;
	updateRate(
		id: number,
		updates: Partial<BillingRate>,
	): BillingRate | undefined;
	deleteRate(id: number): void;

	// === TIME ENTRIES ===

	/**
	 * Create a time entry
	 * @param startTime - Start timestamp (ms)
	 * @param endTime - End timestamp (ms), null if still running
	 * @param durationTenths - Duration in 0.1 hour increments
	 * @param description - Work description (required)
	 */
	createEntry(
		startTime: number,
		endTime: number | null,
		durationTenths: number | null,
		description: string,
		matterId?: number,
		rateId?: number,
		utbmsTask?: string,
		utbmsActivity?: string,
		isBillable?: boolean,
	): TimeEntry;

	getEntryById(id: number): TimeEntry | undefined;

	/**
	 * Get entries with optional filtering
	 */
	getEntries(options?: ExportOptions): TimeEntryWithDetails[];

	/**
	 * Get currently running entry (if any)
	 */
	getRunningEntry(): TimeEntry | undefined;

	updateEntry(id: number, updates: Partial<TimeEntry>): TimeEntry | undefined;
	deleteEntry(id: number): void;

	/**
	 * Get all entries from today
	 */
	getTodayEntries(): TimeEntryWithDetails[];

	/**
	 * Get sum of today's hours
	 */
	getTodayTotalHours(): number;

	/**
	 * Close database connection
	 */
	close(): void;
}
```

### TimeTrackerService

Timer logic with billing increment support.

```typescript
class TimeTrackerService {
	constructor(storageService: StorageService, context: vscode.ExtensionContext);

	/**
	 * Event fired when timer state changes
	 */
	readonly onStateChanged: Event<TimerState & { elapsedMs: number }>;

	/**
	 * Get current timer state with elapsed time
	 */
	getState(): TimerState & { elapsedMs: number };

	/**
	 * Get elapsed milliseconds since timer start
	 */
	getElapsedMs(): number;

	/**
	 * Get elapsed time rounded to tenths (0.1 hours)
	 */
	getElapsedTenths(): number;

	/**
	 * Round duration to 0.1 hour increments
	 * @param durationMs - Duration in milliseconds
	 * @param mode - Rounding mode (up, down, nearest)
	 * @returns Duration in hours (0.1 increments)
	 *
	 * @example
	 * roundToTenths(300000, 'up')  // 5 min → 0.1 hours
	 * roundToTenths(420000, 'up')  // 7 min → 0.2 hours
	 */
	roundToTenths(durationMs: number, mode: RoundingMode): number;

	/**
	 * Start the timer
	 * @returns Updated timer state
	 */
	start(
		matterId?: number | null,
		rateId?: number | null,
		description?: string,
		utbmsTask?: string | null,
		utbmsActivity?: string | null,
		isBillable?: boolean,
	): TimerState;

	/**
	 * Stop the timer and save entry
	 * @returns Created time entry, or null if no timer running
	 */
	stop(): TimeEntry | null;

	/**
	 * Toggle timer on/off
	 * @returns Object with started boolean and entry if stopped
	 */
	toggle(): { started: boolean; entry?: TimeEntry };

	/**
	 * Update current timer configuration without stopping
	 */
	updateTimerState(updates: {
		description?: string;
		utbmsTask?: string | null;
		utbmsActivity?: string | null;
		isBillable?: boolean;
		matterId?: number | null;
		rateId?: number | null;
	}): void;

	/**
	 * Clean up resources
	 */
	dispose(): void;
}
```

### MatterService

Matter management with UI dialogs.

```typescript
class MatterService {
	constructor(storageService: StorageService);

	/**
	 * Create matter via input dialogs
	 * @returns Created matter or undefined if cancelled
	 */
	async createMatter(): Promise<Matter | undefined>;

	/**
	 * Show quick pick to select a matter
	 */
	async selectMatter(): Promise<Matter | undefined>;

	getMatters(activeOnly?: boolean): Matter[];
	getMatterById(id: number): Matter | undefined;
	updateMatter(id: number, updates: Partial<Matter>): Matter | undefined;
	deleteMatter(id: number): void;

	/**
	 * Show management dialog for a matter
	 */
	async manageMatter(matter: Matter): Promise<void>;
}
```

### RateService

Billing rate management with UI dialogs.

```typescript
class RateService {
	constructor(storageService: StorageService);

	async createRate(): Promise<BillingRate | undefined>;
	async selectRate(): Promise<BillingRate | undefined>;

	getRates(): BillingRate[];
	getRateById(id: number): BillingRate | undefined;
	getDefaultRate(): BillingRate | undefined;
	updateRate(
		id: number,
		updates: Partial<BillingRate>,
	): BillingRate | undefined;
	deleteRate(id: number): void;

	async manageRate(rate: BillingRate): Promise<void>;
}
```

### ExportService

Export functionality.

```typescript
class ExportService {
	constructor(storageService: StorageService);

	/**
	 * Export to CSV format
	 * @returns File path or undefined if cancelled/failed
	 */
	async exportToCSV(options?: ExportOptions): Promise<string | undefined>;

	/**
	 * Export to JSON format
	 */
	async exportToJSON(options?: ExportOptions): Promise<string | undefined>;

	/**
	 * Export to LEDES 1998B format
	 * Note: Only includes entries with associated matters
	 */
	async exportToLEDES(options?: ExportOptions): Promise<string | undefined>;

	/**
	 * Export with date range picker dialog
	 */
	async exportWithDateRange(
		format: "csv" | "json" | "ledes",
	): Promise<string | undefined>;
}
```

### StatusBarController

Status bar UI.

```typescript
class StatusBarController implements vscode.Disposable {
	constructor(
		timeTrackerService: TimeTrackerService,
		matterService: MatterService,
		storageService: StorageService,
	);

	/**
	 * Clean up status bar item
	 */
	dispose(): void;
}
```

### SidebarProvider

Webview sidebar panel.

```typescript
class SidebarProvider implements vscode.WebviewViewProvider {
	static readonly viewType = "timeTracker.sidebar";

	constructor(
		extensionUri: vscode.Uri,
		timeTrackerService: TimeTrackerService,
		matterService: MatterService,
		rateService: RateService,
		storageService: StorageService,
		exportService: ExportService,
	);

	resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		token: vscode.CancellationToken,
	): void;

	dispose(): void;
}
```

## UTBMS Codes

### Functions

```typescript
/**
 * Get all UTBMS codes
 */
function getUTBMSCodes(): {
	tasks: Record<string, string>;
	activities: Record<string, string>;
};

/**
 * Get description for a task code
 */
function getTaskDescription(code: string): string | undefined;

/**
 * Get description for an activity code
 */
function getActivityDescription(code: string): string | undefined;

/**
 * Validate task code
 */
function isValidTaskCode(code: string): boolean;

/**
 * Validate activity code
 */
function isValidActivityCode(code: string): boolean;
```

### Task Codes

```typescript
const UTBMS_TASKS: Record<string, string> = {
	// Litigation
	L100: "Case Assessment, Development, and Administration",
	L110: "Fact Investigation/Development",
	L120: "Analysis/Strategy",
	L130: "Experts/Consultants",
	L140: "Document/File Management",
	L150: "Budgeting",
	L160: "Settlement/Non-Binding ADR",
	L200: "Pre-Trial Pleadings and Motions",
	L300: "Discovery",
	L400: "Trial Preparation and Trial",
	L500: "Appeal",

	// Workers' Compensation
	W100: "Initial Claim Review",
	W110: "Medical Records Review",
	W120: "Employer/Witness Interviews",
	W130: "Medical Provider Communications",
	W140: "Benefits Calculation",
	W200: "Hearing Preparation",
	W210: "WCAB Communications",
	W220: "IME Coordination",
	W300: "Settlement Negotiations",
	W310: "Compromise and Release",
	W320: "Stipulated Awards",
};
```

### Activity Codes

```typescript
const UTBMS_ACTIVITIES: Record<string, string> = {
	A101: "Plan and prepare for",
	A102: "Research",
	A103: "Draft/revise",
	A104: "Review/analyze",
	A105: "Communicate (in firm)",
	A106: "Communicate (with client)",
	A107: "Communicate (other outside counsel)",
	A108: "Appear for/attend",
	A109: "Travel",
	A110: "Manage data/files",
	A111: "Other",
};
```

## LEDES Formatter

### Functions

```typescript
/**
 * Format date as YYYYMMDD for LEDES
 */
function formatLedesDate(timestamp: number | null): string;

/**
 * Format single entry for LEDES export
 */
function formatLedesEntry(
	entry: TimeEntryWithDetails,
	lineNumber: number,
	options?: {
		firmId?: string;
		timekeeperId?: string;
		timekeeperName?: string;
		timekeeperClassification?: string;
	},
): string;

/**
 * Generate complete LEDES 1998B file
 */
function generateLedesFile(
	entries: TimeEntryWithDetails[],
	options?: LedesOptions,
): string;

/**
 * Calculate summary for LEDES export
 */
function calculateLedesSummary(entries: TimeEntryWithDetails[]): {
	totalUnits: number;
	totalFees: number;
	billableUnits: number;
	billableFees: number;
	entryCount: number;
};
```

### LEDES Column Header

```typescript
const LEDES_HEADER = [
	"INVOICE_DATE",
	"INVOICE_NUMBER",
	"CLIENT_ID",
	"LAW_FIRM_MATTER_ID",
	"INVOICE_TOTAL",
	"BILLING_START_DATE",
	"BILLING_END_DATE",
	"INVOICE_DESCRIPTION",
	"LINE_ITEM_NUMBER",
	"EXP/FEE/INV_ADJ_TYPE",
	"LINE_ITEM_NUMBER_OF_UNITS",
	"LINE_ITEM_ADJUSTMENT_AMOUNT",
	"LINE_ITEM_TOTAL",
	"LINE_ITEM_DATE",
	"LINE_ITEM_TASK_CODE",
	"LINE_ITEM_EXPENSE_CODE",
	"LINE_ITEM_ACTIVITY_CODE",
	"TIMEKEEPER_ID",
	"LINE_ITEM_DESCRIPTION",
	"LAW_FIRM_ID",
	"LINE_ITEM_UNIT_COST",
	"TIMEKEEPER_NAME",
	"TIMEKEEPER_CLASSIFICATION",
	"CLIENT_MATTER_ID",
].join("|");
```

## Webview Messages

### Extension → Webview

```typescript
type WebviewResponse =
	| { type: "state"; data: TimerState & { elapsedMs: number } }
	| { type: "matters"; data: Matter[] }
	| { type: "rates"; data: BillingRate[] }
	| { type: "entries"; data: TimeEntryWithDetails[] }
	| { type: "utbmsCodes"; data: UTBMSCodes }
	| { type: "timerStarted"; data: TimerState }
	| { type: "timerStopped"; entry: TimeEntry }
	| { type: "matterCreated"; data: Matter }
	| { type: "matterUpdated"; data: Matter }
	| { type: "matterDeleted"; id: number }
	| { type: "rateCreated"; data: BillingRate }
	| { type: "rateUpdated"; data: BillingRate }
	| { type: "rateDeleted"; id: number }
	| { type: "entryUpdated"; data: TimeEntry }
	| { type: "entryDeleted"; id: number }
	| { type: "exportComplete"; format: string; path: string }
	| { type: "error"; message: string };
```

### Webview → Extension

```typescript
type WebviewMessage =
	| { type: "getState" }
	| {
			type: "startTimer";
			matterId: number | null;
			rateId: number | null;
			description: string;
			utbmsTask: string | null;
			utbmsActivity: string | null;
			isBillable: boolean;
	  }
	| { type: "stopTimer" }
	| { type: "toggleTimer" }
	| { type: "getMatters" }
	| { type: "getRates" }
	| { type: "getEntries"; options?: ExportOptions }
	| { type: "getUTBMSCodes" }
	| {
			type: "createMatter";
			clientName: string;
			matterName: string;
			matterNumber?: string;
			defaultRate?: number;
	  }
	| { type: "updateMatter"; id: number; updates: Partial<Matter> }
	| { type: "deleteMatter"; id: number }
	| {
			type: "createRate";
			name: string;
			hourlyRate: number;
			isDefault?: boolean;
	  }
	| { type: "updateRate"; id: number; updates: Partial<BillingRate> }
	| { type: "deleteRate"; id: number }
	| { type: "updateEntry"; id: number; updates: Partial<TimeEntry> }
	| { type: "deleteEntry"; id: number }
	| { type: "exportCSV"; options?: ExportOptions }
	| { type: "exportJSON"; options?: ExportOptions }
	| { type: "exportLEDES"; options?: ExportOptions }
	| {
			type: "updateTimerState";
			description?: string;
			utbmsTask?: string | null;
			utbmsActivity?: string | null;
			isBillable?: boolean;
	  };
```

## Agent LM Tools

Registered from `src/agentTools.ts` (`vscode.lm.registerTool`). See [Agent LM Tools Pattern](../../agent-tools-pattern.md).

| Name | Inputs | Notes |
| ---- | ------ | ----- |
| `safeappeals_timer_getState` | none | JSON state: `isRunning`, elapsed, matter/rate ids, description, billable |
| `safeappeals_timer_start` | optional `description`, `matterId`, `rateId`, `isBillable` (default true) | User confirmation; starts via `TimeTrackerService.start` |
| `safeappeals_timer_stop` | none | User confirmation; saves a time entry when a timer was running |

---

**See Also:** [Developer Guide](./developer-guide.md) | [User Guide](./user-guide.md) | [README](./README.md) | [Agent LM Tools Pattern](../../agent-tools-pattern.md)
