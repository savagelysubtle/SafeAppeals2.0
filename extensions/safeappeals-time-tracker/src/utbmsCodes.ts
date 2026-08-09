/*--------------------------------------------------------------------------------------
 *  Legal Time Tracker - UTBMS Codes
 *  Uniform Task-Based Management System codes for legal billing
 *--------------------------------------------------------------------------------------*/

import type { UTBMSCodes } from './types';

// Phase/Task codes (L = Litigation, W = Workers' Compensation custom)
export const BUILTIN_TASKS: Record<string, string> = {
	// Litigation (Standard)
	L100: 'Case Assessment, Development, and Administration',
	L110: 'Fact Investigation/Development',
	L120: 'Analysis/Strategy',
	L130: 'Experts/Consultants',
	L140: 'Document/File Management',
	L150: 'Budgeting',
	L160: 'Settlement/Non-Binding ADR',
	L200: 'Pre-Trial Pleadings and Motions',
	L210: 'Pleadings',
	L220: 'Preliminary Injunctions/Provisional Remedies',
	L230: 'Court Mandated Conferences',
	L240: 'Dispositive Motions',
	L250: 'Other Written Motions and Submissions',
	L300: 'Discovery',
	L310: 'Written Discovery',
	L320: 'Document Production',
	L330: 'Depositions',
	L340: 'Expert Discovery',
	L350: 'Discovery Motions',
	L400: 'Trial Preparation and Trial',
	L410: 'Fact Witnesses',
	L420: 'Expert Witnesses',
	L430: 'Written Submissions',
	L440: 'Other Trial Preparation',
	L450: 'Trial and Hearing Attendance',
	L500: 'Appeal',
	L510: 'Appellate Pleadings and Briefs',
	L520: 'Appellate Motions',
	L530: 'Appellate Hearing',
	// Workers' Compensation Specific
	W100: 'Initial Claim Review',
	W110: 'Medical Records Review',
	W120: 'Employer/Witness Interviews',
	W130: 'Medical Provider Communications',
	W140: 'Benefits Calculation',
	W200: 'Hearing Preparation',
	W210: 'WCAB Communications',
	W220: 'IME Coordination',
	W300: 'Settlement Negotiations',
	W310: 'Compromise and Release',
	W320: 'Stipulated Awards'
};

// Activity codes
export const BUILTIN_ACTIVITIES: Record<string, string> = {
	A101: 'Plan and prepare for',
	A102: 'Research',
	A103: 'Draft/revise',
	A104: 'Review/analyze',
	A105: 'Communicate (in firm)',
	A106: 'Communicate (with client)',
	A107: 'Communicate (with other outside counsel)',
	A108: 'Appear for/attend',
	A109: 'Travel',
	A110: 'Manage data/files',
	A111: 'Other'
};

/**
 * Get merged UTBMS codes (built-in + custom).
 * If codesService is provided, returns merged codes from config.
 * Otherwise returns built-in codes only.
 */
export function getUTBMSCodes(codesService?: { getMergedCodes?: () => UTBMSCodes }): UTBMSCodes {
	if (codesService?.getMergedCodes) {
		return codesService.getMergedCodes();
	}
	return {
		tasks: BUILTIN_TASKS,
		activities: BUILTIN_ACTIVITIES
	};
}

export function getTaskDescription(code: string, codesService?: { getMergedCodes?: () => UTBMSCodes }): string | undefined {
	const codes = getUTBMSCodes(codesService);
	return codes.tasks[code];
}

export function getActivityDescription(code: string, codesService?: { getMergedCodes?: () => UTBMSCodes }): string | undefined {
	const codes = getUTBMSCodes(codesService);
	return codes.activities[code];
}

export function isValidTaskCode(code: string, codesService?: { getMergedCodes?: () => UTBMSCodes }): boolean {
	const codes = getUTBMSCodes(codesService);
	return code in codes.tasks;
}

export function isValidActivityCode(code: string, codesService?: { getMergedCodes?: () => UTBMSCodes }): boolean {
	const codes = getUTBMSCodes(codesService);
	return code in codes.activities;
}