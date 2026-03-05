/*--------------------------------------------------------------------------------------
 *  Cloud API Proxy Channel
 *  Routes HTTP requests through the main process to bypass browser CORS restrictions.
 *  The browser process's fetch() is subject to CORS policy, which blocks responses
 *  from Railway's edge proxy when they lack Access-Control-Allow-Origin headers (e.g. 503s).
 *  Node.js fetch in the main process has no such restriction.
 *--------------------------------------------------------------------------------------*/

import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { Event } from '../../../../base/common/event.js';

export interface CloudProxyRequestArgs {
	url: string;
	method: string;
	headers: Record<string, string>;
	body?: string;
	timeoutMs: number;
}

export interface CloudProxyResponse {
	ok: boolean;
	status: number;
	statusText: string;
	headers: Record<string, string>;
	body: string;
}

export class CloudProxyChannel implements IServerChannel {

	listen(_: unknown, event: string): Event<any> {
		throw new Error(`Event not found: ${event}`);
	}

	async call(_: unknown, command: string, args?: any): Promise<any> {
		switch (command) {
			case 'fetch':
				return this._fetch(args as CloudProxyRequestArgs);
			default:
				throw new Error(`Call not found: ${command}`);
		}
	}

	private async _fetch(args: CloudProxyRequestArgs): Promise<CloudProxyResponse> {
		const { url, method, headers, body, timeoutMs } = args;

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

		try {
			const response = await fetch(url, {
				method,
				headers,
				body: body ?? undefined,
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			const responseHeaders: Record<string, string> = {};
			response.headers.forEach((value, key) => {
				responseHeaders[key] = value;
			});

			const responseBody = await response.text();

			return {
				ok: response.ok,
				status: response.status,
				statusText: response.statusText,
				headers: responseHeaders,
				body: responseBody,
			};
		} catch (error) {
			clearTimeout(timeoutId);

			if (error instanceof Error && error.name === 'AbortError') {
				return {
					ok: false,
					status: 0,
					statusText: 'AbortError',
					headers: {},
					body: `Request timed out after ${timeoutMs / 1000}s`,
				};
			}

			const message = error instanceof Error ? error.message : String(error);
			return {
				ok: false,
				status: 0,
				statusText: 'NetworkError',
				headers: {},
				body: message,
			};
		}
	}
}
