/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../../base/common/cancellation.js';
import { Emitter } from '../../../../../../base/common/event.js';
import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../../base/common/uri.js';
import { IRevertOptions, ISaveOptions, SaveReason } from '../../../../../common/editor.js';
import { IWorkingCopy, IWorkingCopyBackup, IWorkingCopySaveEvent, WorkingCopyCapabilities } from '../../../../../services/workingCopy/common/workingCopy.js';

/**
 * Working copy implementation for XLSX files to enable VSCode auto-save integration
 */
export class XLSXWorkingCopy extends Disposable implements IWorkingCopy {
	readonly typeId = 'void.xlsx';
	readonly capabilities = WorkingCopyCapabilities.None;

	private _name: string;
	private _isDirty: boolean = false;
	private _saveHandler: ((reason?: SaveReason) => Promise<boolean>) | undefined;

	private readonly _onDidChangeDirty = this._register(new Emitter<void>());
	readonly onDidChangeDirty = this._onDidChangeDirty.event;

	private readonly _onDidChangeContent = this._register(new Emitter<void>());
	readonly onDidChangeContent = this._onDidChangeContent.event;

	private readonly _onDidSave = this._register(new Emitter<IWorkingCopySaveEvent>());
	readonly onDidSave = this._onDidSave.event;

	constructor(
		public readonly resource: URI,
		name: string
	) {
		super();
		this._name = name;
	}

	get name(): string {
		return this._name;
	}

	isDirty(): boolean {
		return this._isDirty;
	}

	isModified(): boolean {
		return this._isDirty;
	}

	/**
	 * Mark the working copy as dirty (modified)
	 */
	markDirty(): void {
		if (!this._isDirty) {
			this._isDirty = true;
			this._onDidChangeDirty.fire();
		}
		// Fire content change event (triggers auto-save timer)
		this._onDidChangeContent.fire();
	}

	/**
	 * Mark the working copy as clean (saved)
	 */
	markSaved(): void {
		if (this._isDirty) {
			this._isDirty = false;
			this._onDidChangeDirty.fire();
		}
	}

	/**
	 * Set the save handler that will be called when save() is invoked
	 */
	setSaveHandler(handler: (reason?: SaveReason) => Promise<boolean>): void {
		this._saveHandler = handler;
	}

	async save(options?: ISaveOptions): Promise<boolean> {
		if (!this._saveHandler) {
			console.warn('[XLSXWorkingCopy] No save handler registered');
			return false;
		}

		try {
			const success = await this._saveHandler(options?.reason);

			if (success) {
				this.markSaved();
				this._onDidSave.fire({
					reason: options?.reason,
					source: options?.source
				});
			}

			return success;
		} catch (error) {
			console.error('[XLSXWorkingCopy] Save failed:', error);
			return false;
		}
	}

	async revert(_options?: IRevertOptions): Promise<void> {
		// For XLSX, revert means reload from disk
		// The editor should handle this by reloading the file
		this.markSaved();
	}

	async backup(_token: CancellationToken): Promise<IWorkingCopyBackup> {
		// For now, we don't implement backup for XLSX files
		return {};
	}
}
