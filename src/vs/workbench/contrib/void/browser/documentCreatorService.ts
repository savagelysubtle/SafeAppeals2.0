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

	/**
	 * Edit a DOCX file with the given operations
	 */
	editDOCX(uri: URI, operations: Array<{
		type: 'insert_text' | 'replace_text';
		position?: number;
		text?: string;
		search?: string;
		replace?: string;
		all?: boolean;
	}>): Promise<{ success: boolean; message: string }>;

	/**
	 * Edit an XLSX file with the given operations
	 */
	editXLSX(uri: URI, operations: Array<{
		type: 'set_cell_value' | 'set_cell_formula';
		sheet: string | number;
		cell: string;
		value?: any;
		formula?: string;
	}>): Promise<{ success: boolean; message: string }>;
}

export class DocumentCreatorService implements IDocumentCreatorService {
	readonly _serviceBrand: undefined;

	private readonly channel: IDocumentCreatorService;

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService
	) {
		this.channel = ProxyChannel.toService<IDocumentCreatorService>(mainProcessService.getChannel('void-channel-docx-creator'));
	}

	async createEmptyDOCX(uri: URI): Promise<void> {
		console.log('[DocumentCreatorService] Creating empty DOCX for URI:', {
			uri: uri,
			scheme: uri?.scheme,
			path: uri?.path,
			fsPath: uri?.fsPath,
			toString: uri?.toString(),
			isURI: uri instanceof URI
		});
		try {
			const result = await this.channel.createEmptyDOCX(uri);
			console.log('[DocumentCreatorService] ✅ Successfully called createEmptyDOCX via IPC');
			return result;
		} catch (error) {
			console.error('[DocumentCreatorService] ❌ IPC call failed:', error);
			throw error;
		}
	}

	async createEmptyXLSX(uri: URI): Promise<void> {
		return this.channel.createEmptyXLSX(uri);
	}

	async editDOCX(uri: URI, operations: Array<{
		type: 'insert_text' | 'replace_text';
		position?: number;
		text?: string;
		search?: string;
		replace?: string;
		all?: boolean;
	}>): Promise<{ success: boolean; message: string }> {
		console.log('[DocumentCreatorService] Editing DOCX via IPC:', uri.fsPath, operations.length, 'operation(s)');
		try {
			const result = await this.channel.editDOCX(uri, operations);
			console.log('[DocumentCreatorService] ✅ Successfully edited DOCX via IPC');
			return result;
		} catch (error) {
			console.error('[DocumentCreatorService] ❌ IPC call failed:', error);
			throw error;
		}
	}

	async editXLSX(uri: URI, operations: Array<{
		type: 'set_cell_value' | 'set_cell_formula';
		sheet: string | number;
		cell: string;
		value?: any;
		formula?: string;
	}>): Promise<{ success: boolean; message: string }> {
		console.log('[DocumentCreatorService] Editing XLSX via IPC:', uri.fsPath, operations.length, 'operation(s)');
		try {
			const result = await this.channel.editXLSX(uri, operations);
			console.log('[DocumentCreatorService] ✅ Successfully edited XLSX via IPC');
			return result;
		} catch (error) {
			console.error('[DocumentCreatorService] ❌ IPC call failed:', error);
			throw error;
		}
	}
}

// Register as singleton
registerSingleton(IDocumentCreatorService, DocumentCreatorService, InstantiationType.Delayed);

