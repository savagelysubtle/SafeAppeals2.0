/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';

export interface IDocxCreatorService {
	createEmptyDOCX(uri: URI): Promise<void>;
	createEmptyXLSX(uri: URI): Promise<void>;
}

export class DOCXCreatorChannel implements IServerChannel {

	constructor(private service: IDocxCreatorService) { }

	listen(_: unknown, event: string): Event<any> {
		throw new Error(`Event not found: ${event}`);
	}

	async call(_: unknown, command: string, arg?: any): Promise<any> {
		switch (command) {
			case 'createEmptyDOCX': return this.service.createEmptyDOCX(URI.revive(arg));
			case 'createEmptyXLSX': return this.service.createEmptyXLSX(URI.revive(arg));
		}
		throw new Error(`Call not found: ${command}`);
	}
}

