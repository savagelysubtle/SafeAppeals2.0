/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { Event } from '../../../../base/common/event.js';
import { braveWebSearch, braveMultiLinkSearch } from './tools/braveSearchService.js';

export class BraveSearchChannel implements IServerChannel {
	constructor() { }

	listen(_: unknown, event: string): Event<any> {
		throw new Error(`Event not found: ${event}`);
	}

	async call(ctx: any, command: string, args?: any): Promise<any> {
		switch (command) {
			case 'webSearch': {
				const { apiKey, query, count, offset } = args;
				return braveWebSearch(apiKey, query, count, offset);
			}
			case 'multiLinkSearch': {
				const { apiKey, queries, count } = args;
				return braveMultiLinkSearch(apiKey, queries, count);
			}
			default:
				throw new Error(`Call not found: ${command}`);
		}
	}
}

