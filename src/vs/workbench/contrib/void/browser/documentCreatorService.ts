/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';

export const IDocumentCreatorService = createDecorator<IDocumentCreatorService>('documentCreatorService');

export interface IDocumentCreatorService {
	readonly _serviceBrand: undefined;

	/**
	 * Create an empty but valid DOCX file
	 */
	createEmptyDOCX(uri: URI): Promise<void>;

	/**
	 * Create an empty but valid XLSX file
	 */
	createEmptyXLSX(uri: URI): Promise<void>;
}

export class DocumentCreatorService implements IDocumentCreatorService {
	readonly _serviceBrand: undefined;

	private readonly channel: any;

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService
	) {
		this.channel = ProxyChannel.toService(mainProcessService.getChannel('void-channel-docx-creator'));
	}

	async createEmptyDOCX(uri: URI): Promise<void> {
		return this.channel.call('createEmptyDOCX', uri);
	}

	async createEmptyXLSX(uri: URI): Promise<void> {
		return this.channel.call('createEmptyXLSX', uri);
	}
}

// Register as singleton
registerSingleton(IDocumentCreatorService, DocumentCreatorService, InstantiationType.Delayed);

