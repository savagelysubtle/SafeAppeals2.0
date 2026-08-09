/*--------------------------------------------------------------------------------------
 *  Legal Time Tracker - Types
 *  TypeScript interfaces and types for the time tracker extension
 *--------------------------------------------------------------------------------------*/

export interface Matter {
	id: number;
	workspace_id: string;
	client_name: string;
	matter_name: string;
	matter_number: string | null;
	default_rate: number | null;
	is_active: number;
	created_at: number;
}

export interface BillingRate {
	id: number;
	workspace_id: string;
	name: string;
	hourly_rate: number;
	is_default: number;
	created_at: number;
}

export interface TimeEntry {
	id: number;
	workspace_id: string;
	matter_id: number | null;
	rate_id: number | null;
	start_time: number;
	end_time: number | null;
	duration_tenths: number | null;
	utbms_task: string | null;
	utbms_activity: string | null;
	description: string;
	is_billable: number;
	created_at: number;
}

export interface TimeEntryWithDetails extends TimeEntry {
	matter_name?: string;
	client_name?: string;
	matter_number?: string;
	rate_name?: string;
	hourly_rate?: number;
}

export interface TimerState {
	isRunning: boolean;
	startTime: number | null;
	currentMatterId: number | null;
	currentRateId: number | null;
	currentDescription: string;
	currentUtbmsTask: string | null;
	currentUtbmsActivity: string | null;
	isBillable: boolean;
}

export type RoundingMode = 'up' | 'down' | 'nearest';

export interface ExportOptions {
	startDate?: number;
	endDate?: number;
	matterId?: number;
	billableOnly?: boolean;
}

export interface ExportSummary {
	total_hours: number;
	billable_hours: number;
	total_value: number;
	entry_count: number;
}

export interface ExportResult {
	workspace: string;
	exported_at: string;
	summary: ExportSummary;
	entries: TimeEntryWithDetails[];
}

// UTBMS Code Types
export interface UTBMSCode {
	code: string;
	description: string;
}

export interface UTBMSCodes {
	tasks: Record<string, string>;
	activities: Record<string, string>;
}

export interface CustomUTBMSCodes {
	version: number;
	taskCodes: Record<string, string>;
	activityCodes: Record<string, string>;
	inheritBuiltIn?: boolean;
}

export interface CodeValidationResult {
	valid: boolean;
	error?: string;
}

// Message types for webview communication
export type WebviewMessage =
	| { type: 'getState' }
	| { type: 'startTimer'; matterId: number | null; rateId: number | null; description: string; utbmsTask: string | null; utbmsActivity: string | null; isBillable: boolean }
	| { type: 'stopTimer' }
	| { type: 'toggleTimer' }
	| { type: 'getMatters' }
	| { type: 'getRates' }
	| { type: 'getEntries'; options?: ExportOptions }
	| { type: 'getUTBMSCodes' }
	| { type: 'getCustomCodes' }
	| { type: 'saveCustomCodes'; codes: Partial<CustomUTBMSCodes> }
	| { type: 'addTaskCode'; code: string; description: string }
	| { type: 'addActivityCode'; code: string; description: string }
	| { type: 'deleteTaskCode'; code: string }
	| { type: 'deleteActivityCode'; code: string }
	| { type: 'setInheritBuiltIn'; inherit: boolean }
	| { type: 'validateCode'; code: string; description: string }
	| { type: 'createMatter'; clientName: string; matterName: string; matterNumber?: string; defaultRate?: number }
	| { type: 'updateMatter'; id: number; updates: Partial<Matter> }
	| { type: 'deleteMatter'; id: number }
	| { type: 'createRate'; name: string; hourlyRate: number; isDefault?: boolean }
	| { type: 'updateRate'; id: number; updates: Partial<BillingRate> }
	| { type: 'deleteRate'; id: number }
	| { type: 'updateEntry'; id: number; updates: Partial<TimeEntry> }
	| { type: 'deleteEntry'; id: number }
	| { type: 'confirmDeleteEntry'; id: number }
	| { type: 'exportCSV'; options?: ExportOptions }
	| { type: 'exportJSON'; options?: ExportOptions }
	| { type: 'exportLEDES'; options?: ExportOptions }
	| { type: 'updateTimerState'; description?: string; utbmsTask?: string | null; utbmsActivity?: string | null; isBillable?: boolean }
	| { type: 'executeCommand'; command: string };

export type WebviewResponse =
	| { type: 'state'; data: TimerState & { elapsedMs: number } }
	| { type: 'matters'; data: Matter[] }
	| { type: 'rates'; data: BillingRate[] }
	| { type: 'entries'; data: TimeEntryWithDetails[] }
	| { type: 'utbmsCodes'; data: UTBMSCodes }
	| { type: 'customCodes'; data: CustomUTBMSCodes | null }
	| { type: 'codeValidation'; data: CodeValidationResult }
	| { type: 'timerStarted'; data: TimerState }
	| { type: 'timerStopped'; entry: TimeEntry }
	| { type: 'matterCreated'; data: Matter }
	| { type: 'matterUpdated'; data: Matter }
	| { type: 'matterDeleted'; id: number }
	| { type: 'rateCreated'; data: BillingRate }
	| { type: 'rateUpdated'; data: BillingRate }
	| { type: 'rateDeleted'; id: number }
	| { type: 'entryUpdated'; data: TimeEntry }
	| { type: 'entryDeleted'; id: number }
	| { type: 'exportComplete'; format: string; path: string }
	| { type: 'error'; message: string };
