/*--------------------------------------------------------------------------------------
 *  Legal Time Tracker - LEDES Formatter
 *  LEDES 1998B format generator for legal billing export
 *--------------------------------------------------------------------------------------*/

import type { TimeEntryWithDetails } from './types';

// LEDES 1998B column headers
const LEDES_COLUMNS = [
	'INVOICE_DATE',
	'INVOICE_NUMBER',
	'CLIENT_ID',
	'LAW_FIRM_MATTER_ID',
	'INVOICE_TOTAL',
	'BILLING_START_DATE',
	'BILLING_END_DATE',
	'INVOICE_DESCRIPTION',
	'LINE_ITEM_NUMBER',
	'EXP/FEE/INV_ADJ_TYPE',
	'LINE_ITEM_NUMBER_OF_UNITS',
	'LINE_ITEM_ADJUSTMENT_AMOUNT',
	'LINE_ITEM_TOTAL',
	'LINE_ITEM_DATE',
	'LINE_ITEM_TASK_CODE',
	'LINE_ITEM_EXPENSE_CODE',
	'LINE_ITEM_ACTIVITY_CODE',
	'TIMEKEEPER_ID',
	'LINE_ITEM_DESCRIPTION',
	'LAW_FIRM_ID',
	'LINE_ITEM_UNIT_COST',
	'TIMEKEEPER_NAME',
	'TIMEKEEPER_CLASSIFICATION',
	'CLIENT_MATTER_ID'
];

export const LEDES_HEADER = LEDES_COLUMNS.join('|');

/**
 * Format a date as YYYYMMDD for LEDES
 */
export function formatLedesDate(timestamp: number | null): string {
	if (!timestamp) return '';

	const date = new Date(timestamp);
	const year = date.getFullYear();
	const month = (date.getMonth() + 1).toString().padStart(2, '0');
	const day = date.getDate().toString().padStart(2, '0');

	return `${year}${month}${day}`;
}

/**
 * Escape pipe characters in text for LEDES format
 */
function escapeLedesText(text: string): string {
	return text.replace(/\|/g, ' ').replace(/[\r\n]+/g, ' ');
}

/**
 * Format a single time entry for LEDES 1998B export
 */
export function formatLedesEntry(
	entry: TimeEntryWithDetails,
	lineNumber: number,
	options: {
		firmId?: string;
		timekeeperId?: string;
		timekeeperName?: string;
		timekeeperClassification?: string;
	} = {}
): string {
	const rate = entry.hourly_rate || 0;
	const units = entry.duration_tenths || 0;
	const total = units * rate;

	const columns = [
		formatLedesDate(entry.end_time),                          // INVOICE_DATE
		'',                                                        // INVOICE_NUMBER (blank for time only)
		escapeLedesText(entry.client_name || ''),                  // CLIENT_ID
		entry.matter_number || entry.matter_id?.toString() || '', // LAW_FIRM_MATTER_ID
		'',                                                        // INVOICE_TOTAL
		formatLedesDate(entry.start_time),                         // BILLING_START_DATE
		formatLedesDate(entry.end_time),                           // BILLING_END_DATE
		'',                                                        // INVOICE_DESCRIPTION
		lineNumber.toString(),                                     // LINE_ITEM_NUMBER
		'F',                                                       // EXP/FEE/INV_ADJ_TYPE (F = Fee)
		units.toFixed(1),                                          // LINE_ITEM_NUMBER_OF_UNITS
		'0',                                                       // LINE_ITEM_ADJUSTMENT_AMOUNT
		total.toFixed(2),                                          // LINE_ITEM_TOTAL
		formatLedesDate(entry.start_time),                         // LINE_ITEM_DATE
		entry.utbms_task || '',                                    // LINE_ITEM_TASK_CODE
		'',                                                        // LINE_ITEM_EXPENSE_CODE
		entry.utbms_activity || '',                                // LINE_ITEM_ACTIVITY_CODE
		options.timekeeperId || '',                                // TIMEKEEPER_ID
		escapeLedesText(entry.description),                        // LINE_ITEM_DESCRIPTION
		options.firmId || '',                                      // LAW_FIRM_ID
		rate.toFixed(2),                                           // LINE_ITEM_UNIT_COST
		options.timekeeperName || '',                              // TIMEKEEPER_NAME
		options.timekeeperClassification || '',                    // TIMEKEEPER_CLASSIFICATION
		entry.matter_number || ''                                  // CLIENT_MATTER_ID
	];

	return columns.join('|');
}

/**
 * Generate complete LEDES 1998B file content
 */
export function generateLedesFile(
	entries: TimeEntryWithDetails[],
	options: {
		firmId?: string;
		timekeeperId?: string;
		timekeeperName?: string;
		timekeeperClassification?: string;
	} = {}
): string {
	const lines: string[] = [];

	// LEDES identifier line
	lines.push('LEDES1998B[]');

	// Header line
	lines.push(LEDES_HEADER);

	// Data lines
	entries.forEach((entry, index) => {
		lines.push(formatLedesEntry(entry, index + 1, options));
	});

	return lines.join('\n');
}

/**
 * Calculate summary for LEDES export
 */
export function calculateLedesSummary(entries: TimeEntryWithDetails[]): {
	totalUnits: number;
	totalFees: number;
	billableUnits: number;
	billableFees: number;
	entryCount: number;
} {
	let totalUnits = 0;
	let totalFees = 0;
	let billableUnits = 0;
	let billableFees = 0;

	for (const entry of entries) {
		const units = entry.duration_tenths || 0;
		const rate = entry.hourly_rate || 0;
		const fees = units * rate;

		totalUnits += units;
		totalFees += fees;

		if (entry.is_billable) {
			billableUnits += units;
			billableFees += fees;
		}
	}

	return {
		totalUnits,
		totalFees,
		billableUnits,
		billableFees,
		entryCount: entries.length
	};
}
