/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { registerExtensionAgentsProvider } from './chat/extensionAgentsProvider';
import { registerSafeAppealsAgentTools } from './chat/tools';
import type { ICloudApiClient } from './cloudApiClient';

let cloudApiClient: ICloudApiClient | undefined;

/**
 * Gets the Cloud API client from the authentication extension.
 */
async function getCloudApiClient(): Promise<ICloudApiClient | undefined> {
	if (cloudApiClient) {
		return cloudApiClient;
	}

	const authExt = vscode.extensions.getExtension('safeappeals.safeappeals-authentication');
	if (!authExt) {
		console.warn('[SafeAppeals Agents] Authentication extension not found');
		return undefined;
	}

	if (!authExt.isActive) {
		await authExt.activate();
	}

	const api = authExt.exports as { cloudApiClient?: ICloudApiClient } | undefined;
	cloudApiClient = api?.cloudApiClient;
	return cloudApiClient;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	// Get the Cloud API client from the authentication extension
	const apiClient = await getCloudApiClient();

	// Register agent tools that need the Cloud API client
	if (apiClient) {
		context.subscriptions.push(registerSafeAppealsAgentTools(apiClient));
	} else {
		console.warn('[SafeAppeals Agents] Cloud API client not available; some tools will be disabled');
	}

	// Register the SafeAppeals extension agents (research, case-summary)
	context.subscriptions.push(registerExtensionAgentsProvider(context));
}

export function deactivate(): void {
	cloudApiClient = undefined;
}