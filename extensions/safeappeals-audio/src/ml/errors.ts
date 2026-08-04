/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

/**
 * Base error for {@link MlResourceEngine} failures. Prefer `instanceof` checks in UI/services.
 */
export class MlError extends Error {
	readonly code: string;

	constructor(code: string, message: string) {
		super(message);
		this.name = 'MlError';
		this.code = code;
	}
}

export class MlCancelledError extends MlError {
	constructor(message = 'ML job was cancelled.') {
		super('cancelled', message);
		this.name = 'MlCancelledError';
	}
}

export class MlBusyError extends MlError {
	constructor(message = 'ML resource lane is busy.') {
		super('busy', message);
		this.name = 'MlBusyError';
	}
}

export class MlAcquireTimeoutError extends MlError {
	constructor(message = 'Timed out waiting for an ML resource lease.') {
		super('acquire_timeout', message);
		this.name = 'MlAcquireTimeoutError';
	}
}

export class MlBudgetExceededError extends MlError {
	constructor(message = 'ML peak RSS budget would be exceeded.') {
		super('budget_exceeded', message);
		this.name = 'MlBudgetExceededError';
	}
}

export class MlBackendUnavailableError extends MlError {
	constructor(message = 'ML backend is unavailable.') {
		super('backend_unavailable', message);
		this.name = 'MlBackendUnavailableError';
	}
}

export class MlBackendCrashedError extends MlError {
	constructor(message = 'ML backend crashed.') {
		super('backend_crashed', message);
		this.name = 'MlBackendCrashedError';
	}
}
