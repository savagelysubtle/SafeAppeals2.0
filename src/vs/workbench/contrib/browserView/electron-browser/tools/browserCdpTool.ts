/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { CancellationToken } from '../../../../../base/common/cancellation.js';
import { CancellationError } from '../../../../../base/common/errors.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../nls.js';
import { BrowserChatToolReferenceName } from '../../../../../platform/browserView/common/browserChatToolReferenceNames.js';
import { CDPEvent, CDPRequest, CDPResponse } from '../../../../../platform/browserView/common/cdp/types.js';
import { ToolDataSource, type CountTokensCallback, type IPreparedToolInvocation, type IToolData, type IToolImpl, type IToolInvocation, type IToolInvocationPreparationContext, type IToolResult, type ToolProgress } from '../../../chat/common/tools/languageModelToolsService.js';
import { BrowserViewSharingState, IBrowserViewCDPService, IBrowserViewWorkbenchService } from '../../common/browserView.js';
import { browserCdpSessionStore } from './browserCdpSessionStore.js';
import { createBrowserPageLink, errorResult, getSessionId } from './browserToolHelpers.js';
import { evaluateCdpAgentMethod } from './cdpAgentDenyList.js';
import { OpenPageToolId } from './openBrowserTool.js';

/** In-memory JSON size cap for CDP tool results (no disk dumps of page/CDP content). */
export const BROWSER_CDP_MAX_RESULT_CHARS = 64 * 1024;

export const BrowserCdpToolId = 'browser_cdp';

export const BrowserCdpToolData: IToolData = {
	id: BrowserCdpToolId,
	toolReferenceName: BrowserChatToolReferenceName.BrowserCdp,
	displayName: localize('browserCdpTool.displayName', 'Browser CDP'),
	userDescription: localize('browserCdpTool.userDescription', 'Send a Chrome DevTools Protocol command to a shared browser page'),
	modelDescription:
		'Send a single Chrome DevTools Protocol (CDP) method to a shared integrated browser page. ' +
		'Only use this when read_page / click_element / type_in_page / run_playwright_code are insufficient ' +
		'(e.g. Runtime.evaluate, DOM inspection, CSS computed styles, Profiler, Performance metrics). ' +
		'Input.*, cookies, storage, permissions, downloads, and target-escape methods are blocked.',
	icon: Codicon.debugConsole,
	source: ToolDataSource.Internal,
	inputSchema: {
		type: 'object',
		properties: {
			pageId: {
				type: 'string',
				description: 'The browser page ID, acquired from context or the open tool.',
			},
			method: {
				type: 'string',
				description: 'CDP method name, e.g. Runtime.evaluate or DOM.getDocument.',
			},
			params: {
				type: 'object',
				description: 'Optional CDP params object for the method.',
			},
			timeoutMs: {
				type: 'number',
				description: 'Maximum time in milliseconds to wait for the CDP response. Defaults to 10000 (10 seconds).',
			},
		},
		required: ['pageId', 'method'],
	},
};

interface IBrowserCdpToolParams {
	pageId: string;
	method: string;
	params?: Record<string, unknown>;
	timeoutMs?: number;
}

/**
 * Truncate a JSON-serializable value to a string capped at {@link maxChars}.
 * Never writes to disk — oversized payloads are cut in memory only.
 */
export function truncateCdpJson(value: unknown, maxChars: number = BROWSER_CDP_MAX_RESULT_CHARS): string {
	let text: string;
	try {
		text = JSON.stringify(value, null, 2);
	} catch {
		text = String(value);
	}
	if (text.length <= maxChars) {
		return text;
	}
	const omitted = text.length - maxChars;
	return `${text.slice(0, maxChars)}\n…[truncated ${omitted} more characters; response capped at ${maxChars} chars in memory]`;
}

function isCDPResponse(message: CDPResponse | CDPEvent): message is CDPResponse {
	return typeof (message as CDPResponse).id === 'number';
}

export class BrowserCdpTool implements IToolImpl {
	constructor(
		@IBrowserViewCDPService private readonly cdpService: IBrowserViewCDPService,
		@IBrowserViewWorkbenchService private readonly browserViewService: IBrowserViewWorkbenchService,
	) { }

	async prepareToolInvocation(context: IToolInvocationPreparationContext, _token: CancellationToken): Promise<IPreparedToolInvocation | undefined> {
		const params = context.parameters as IBrowserCdpToolParams;
		const method = params.method ?? '';
		const link = params.pageId ? createBrowserPageLink(params.pageId) : localize('browser.page', 'page');

		// Surface deny-list failures before confirmation so the user is not asked
		// to approve a command that will be rejected. invoke() re-checks as defense-in-depth.
		const deny = evaluateCdpAgentMethod(method);
		if (deny.denied) {
			const reason = deny.reason ?? localize('browser.cdp.denied', "CDP method '{0}' is blocked.", method);
			return {
				invocationMessage: new MarkdownString(reason),
				pastTenseMessage: new MarkdownString(reason),
				confirmationMessages: undefined,
			};
		}

		return {
			invocationMessage: new MarkdownString(localize('browser.cdp.invocation', "Sending CDP `{0}` to {1}...", method, link)),
			pastTenseMessage: new MarkdownString(localize('browser.cdp.past', "Sent CDP `{0}` to {1}", method, link)),
			confirmationMessages: {
				title: localize('browser.cdp.confirmTitle', 'Send Browser CDP Command?'),
				message: new MarkdownString(`\`\`\`json\n${truncateCdpJson({ method, params: params.params ?? {} }, 8 * 1024)}\n\`\`\``),
				disclaimer: localize('browser.cdp.confirmDisclaimer', 'CDP can inspect or mutate the shared page. Make sure you trust the command before continuing.'),
				allowAutoConfirm: true,
			},
		};
	}

	async invoke(invocation: IToolInvocation, _countTokens: CountTokensCallback, _progress: ToolProgress, token: CancellationToken): Promise<IToolResult> {
		const params = invocation.parameters as IBrowserCdpToolParams;
		const chatSessionId = getSessionId(invocation);

		if (!this.browserViewService.isSharingAvailable) {
			// When sharing is unavailable (chat/agent/enableChatTools off), only the
			// non-agentic open tool is registered — interactive tools including CDP are unreachable.
			return errorResult(
				'Browser chat tools are not available. Enable chat Agent mode and `workbench.browser.enableChatTools`, then share a page.'
			);
		}

		if (!params.pageId) {
			return errorResult(`No page ID provided. Use '${OpenPageToolId}' first.`);
		}
		if (!params.method || typeof params.method !== 'string') {
			return errorResult('No CDP method provided.');
		}

		const deny = evaluateCdpAgentMethod(params.method);
		if (deny.denied) {
			return errorResult(deny.reason ?? `CDP method '${params.method}' is blocked.`);
		}

		const views = this.browserViewService.getContextualBrowserViews({
			activeSessionId: invocation.context?.sessionResource?.toString(),
		});
		const input = views.get(params.pageId);
		if (!input?.model) {
			return errorResult(`Unknown browser page '${params.pageId}'. Use '${OpenPageToolId}' or share an existing page.`);
		}
		if (input.model.sharingState !== BrowserViewSharingState.Shared) {
			return errorResult(
				`Page '${params.pageId}' is not shared with the agent. Ask the user to share it, or use '${OpenPageToolId}'.`
			);
		}

		// Ensure the underlying web contents exist before attaching CDP.
		await input.resolve();

		const timeoutMs = typeof params.timeoutMs === 'number' && params.timeoutMs > 0
			? params.timeoutMs
			: 10_000;

		let groupId: string;
		try {
			groupId = await browserCdpSessionStore.getOrCreateGroup(this.cdpService, chatSessionId, params.pageId);
		} catch (e) {
			return errorResult(`Failed to start CDP session: ${e instanceof Error ? e.message : String(e)}`);
		}

		const requestId = browserCdpSessionStore.nextRequestId();
		const request: CDPRequest = {
			id: requestId,
			method: params.method.trim(),
			params: params.params,
		};

		const store = new DisposableStore();
		try {
			const response = await new Promise<CDPResponse>((resolve, reject) => {
				const timer = setTimeout(() => {
					reject(new Error(`CDP method '${request.method}' timed out after ${timeoutMs}ms.`));
				}, timeoutMs);
				store.add({ dispose: () => clearTimeout(timer) });

				if (token.isCancellationRequested) {
					reject(new CancellationError());
					return;
				}
				store.add(token.onCancellationRequested(() => reject(new CancellationError())));

				store.add(this.cdpService.onCDPMessage(groupId)(message => {
					if (isCDPResponse(message) && message.id === requestId) {
						resolve(message);
					}
				}));
				store.add(this.cdpService.onDidDestroy(groupId)(() => {
					// Session store also drops the mapping via its own onDidDestroy listener.
					reject(new Error('CDP session was destroyed before a response arrived.'));
				}));

				void this.cdpService.sendCDPMessage(groupId, request).catch(err => {
					reject(err instanceof Error ? err : new Error(String(err)));
				});
			});

			if (response.error) {
				return errorResult(`CDP error ${response.error.code}: ${response.error.message}`);
			}

			const body = truncateCdpJson({
				method: request.method,
				result: response.result ?? null,
			});
			return {
				content: [{ kind: 'text', value: body }],
			};
		} catch (e) {
			if (e instanceof CancellationError) {
				return errorResult('CDP request was cancelled.');
			}
			return errorResult(e instanceof Error ? e.message : String(e));
		} finally {
			store.dispose();
		}
	}
}
