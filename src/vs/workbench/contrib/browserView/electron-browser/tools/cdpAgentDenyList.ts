/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Fail-closed CDP method filter for the Agent `browser_cdp` tool only.
 *
 * Intentionally NOT applied to {@link MainThreadBrowsers} / proposed
 * `BrowserTab.startCDPSession` — extension API tests need full protocol access.
 *
 * Denied families mirror Cursor's browser_cdp posture: no Input.* (use dedicated
 * click/type tools), no cookie/storage/permission/download exfil, no target escape
 * off the shared page WebContents.
 */

export interface ICdpAgentDenyResult {
	readonly denied: boolean;
	readonly reason?: string;
}

const DENIED_EXACT_METHODS = new Set<string>([
	// Cookies
	'Network.getCookies',
	'Network.setCookie',
	'Network.deleteCookies',
	'Network.getAllCookies',
	'Network.clearBrowserCookies',
	// Permissions
	'Browser.setPermission',
	'Browser.grantPermissions',
	'Browser.resetPermissions',
	// Downloads
	'Browser.setDownloadBehavior',
	'Page.setDownloadBehavior',
	'Browser.cancelDownload',
	// Target / browser escape (leave the current page WebContents)
	'Target.attachToTarget',
	'Target.createTarget',
	'Target.activateTarget',
	'Target.closeTarget',
	'Target.detachFromTarget',
	'Target.getTargets',
	'Target.setDiscoverTargets',
	'Target.setAutoAttach',
	'Target.createBrowserContext',
	'Target.disposeBrowserContext',
	'Target.getBrowserContexts',
	'Browser.close',
	'Browser.crash',
	'Browser.crashGpuProcess',
]);

const DENIED_DOMAIN_PREFIXES = [
	'Input.',
	'Storage.',
	'IndexedDB.',
	'CacheStorage.',
] as const;

/**
 * Returns whether an Agent `browser_cdp` call must be rejected before send.
 * Unknown methods that are not on the deny list are allowed (dedicated tools
 * remain preferred; confirmation still gates each call).
 */
export function evaluateCdpAgentMethod(method: string): ICdpAgentDenyResult {
	const trimmed = typeof method === 'string' ? method.trim() : '';
	if (!trimmed || !trimmed.includes('.')) {
		return {
			denied: true,
			reason: 'CDP method must be a non-empty Domain.method string.',
		};
	}

	if (DENIED_EXACT_METHODS.has(trimmed)) {
		return {
			denied: true,
			reason: `CDP method '${trimmed}' is blocked for Agent tools (cookies, storage, permissions, downloads, or target escape).`,
		};
	}

	for (const prefix of DENIED_DOMAIN_PREFIXES) {
		if (trimmed.startsWith(prefix)) {
			return {
				denied: true,
				reason: `CDP domain '${prefix.slice(0, -1)}' is blocked for Agent tools. Use dedicated browser tools for page interaction.`,
			};
		}
	}

	return { denied: false };
}

/**
 * Convenience: true when {@link evaluateCdpAgentMethod} denies the method.
 */
export function isCdpMethodDeniedForAgent(method: string): boolean {
	return evaluateCdpAgentMethod(method).denied;
}
