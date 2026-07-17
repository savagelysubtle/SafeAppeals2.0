/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { EditorInput } from '../../../../common/editor/editorInput.js';
import { URI } from '../../../../../base/common/uri.js';
import { basename } from '../../../../../base/common/path.js';
import { ILabelService } from '../../../../../platform/label/common/label.js';
import { IUntypedEditorInput } from '../../../../common/editor.js';
import { Email } from '../../common/emailService.js';

export class EmailViewerInput extends EditorInput {
	static readonly TYPE_ID = 'void.emailViewerInput';
	static readonly EDITOR_ID = 'void.emailViewer';

	private _email: Email | null = null;

	constructor(
		public readonly resource: URI,
		public readonly emailId: string,
		@ILabelService private readonly labelService: ILabelService
	) {
		super();
	}

	/**
	 * Set the email data for this input
	 */
	setEmail(email: Email): void {
		this._email = email;
	}

	/**
	 * Get the email data
	 */
	getEmail(): Email | null {
		return this._email;
	}

	override get typeId(): string {
		return EmailViewerInput.TYPE_ID;
	}

	override get editorId(): string {
		return EmailViewerInput.EDITOR_ID;
	}

	override get capabilities() {
		return 0; // Read-only
	}

	override getName(): string {
		if (this._email) {
			return this._email.subject || '(No Subject)';
		}
		return basename(this.resource.path);
	}

	override getDescription(): string {
		if (this._email) {
			return `From: ${this._email.from}`;
		}
		return this.labelService.getUriLabel(this.resource, { relative: true });
	}

	override matches(otherInput: EditorInput | IUntypedEditorInput): boolean {
		if (otherInput instanceof EmailViewerInput) {
			return this.emailId === otherInput.emailId;
		}
		return false;
	}

	// For serialization
	toJSON(): object {
		return {
			resource: this.resource.toJSON(),
			emailId: this.emailId
		};
	}
}

