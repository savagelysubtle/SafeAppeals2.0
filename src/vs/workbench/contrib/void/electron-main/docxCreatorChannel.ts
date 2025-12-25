/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { IRAGMainService } from '../common/rag/ragServiceTypes.js';

export class DOCXCreatorChannel implements IServerChannel {

	constructor(private service: IRAGMainService) { }

	listen(_: unknown, event: string): Event<any> {
		throw new Error(`Event not found: ${event}`);
	}

	async call(_: unknown, command: string, arg?: any): Promise<any> {
		switch (command) {
			case 'createEmptyDOCX': {
				console.log('[DOCXCreatorChannel] Received createEmptyDOCX request:', {
					rawArg: arg,
					argType: typeof arg,
					isArray: Array.isArray(arg),
					argKeys: arg ? Object.keys(arg) : 'null'
				});

				// Handle the case where arg is an array (ProxyChannel might wrap it)
				let uriArg = arg;
				if (Array.isArray(arg) && arg.length > 0) {
					console.log('[DOCXCreatorChannel] Unwrapping URI from array');
					uriArg = arg[0];
				}

				// Revive the URI from the serialized object
				let revivedURI: URI;
				if (URI.isUri(uriArg)) {
					// Already a URI instance
					revivedURI = uriArg;
				} else {
					// Try to revive from serialized form
					revivedURI = URI.revive(uriArg);
				}

				console.log('[DOCXCreatorChannel] Revived URI:', {
					isUri: URI.isUri(revivedURI),
					scheme: revivedURI?.scheme,
					authority: revivedURI?.authority,
					path: revivedURI?.path,
					fsPath: revivedURI?.fsPath,
					toString: revivedURI?.toString()
				});

				// Validate the URI before proceeding
				if (!revivedURI || !URI.isUri(revivedURI)) {
					throw new Error(`Invalid URI received: URI could not be revived from IPC call. Received: ${JSON.stringify(arg)}`);
				}

				if (!revivedURI.fsPath && !revivedURI.path) {
					throw new Error(`Invalid URI received: URI has no path. Received: ${JSON.stringify(arg)}`);
				}

				return this.service.createEmptyDOCX(revivedURI);
			}
			case 'createEmptyXLSX': {
				// Handle array wrapping
				let uriArg = arg;
				if (Array.isArray(arg) && arg.length > 0) {
					uriArg = arg[0];
				}

				let revivedURI: URI;
				if (URI.isUri(uriArg)) {
					revivedURI = uriArg;
				} else {
					revivedURI = URI.revive(uriArg);
				}

				if (!revivedURI || !URI.isUri(revivedURI)) {
					throw new Error(`Invalid URI received: URI could not be revived from IPC call. Received: ${JSON.stringify(arg)}`);
				}

				return this.service.createEmptyXLSX(revivedURI);
			}
		case 'editDOCX': {
			console.log('[DOCXCreatorChannel] Received editDOCX request:', {
				rawArg: arg,
				argType: typeof arg,
				isArray: Array.isArray(arg)
			});

			// Handle both array format [uri, operations] and object format { uri, operations }
			let uriArg: any;
			let operations: any;

			if (Array.isArray(arg)) {
				// ProxyChannel sends [uri, operations]
				[uriArg, operations] = arg;
				console.log('[DOCXCreatorChannel] Unwrapped from array format:', { uriArg, operations });
			} else {
				// Direct object format { uri, operations }
				({ uri: uriArg, operations } = arg);
				console.log('[DOCXCreatorChannel] Unwrapped from object format:', { uriArg, operations });
			}

			// Revive URI
			let revivedURI: URI;
			if (URI.isUri(uriArg)) {
				revivedURI = uriArg;
			} else {
				revivedURI = URI.revive(uriArg);
			}

			if (!revivedURI || !URI.isUri(revivedURI)) {
				throw new Error(`Invalid URI received for editDOCX. Received: ${JSON.stringify(uriArg)}`);
			}

			console.log('[DOCXCreatorChannel] Calling editDOCX with URI:', revivedURI.fsPath);
			return this.service.editDOCX(revivedURI, operations);
		}
		case 'editXLSX': {
			console.log('[DOCXCreatorChannel] Received editXLSX request:', {
				rawArg: arg,
				argType: typeof arg,
				isArray: Array.isArray(arg)
			});

			// Handle both array format [uri, operations] and object format { uri, operations }
			let uriArg: any;
			let operations: any;

			if (Array.isArray(arg)) {
				// ProxyChannel sends [uri, operations]
				[uriArg, operations] = arg;
				console.log('[DOCXCreatorChannel] Unwrapped from array format:', { uriArg, operations });
			} else {
				// Direct object format { uri, operations }
				({ uri: uriArg, operations } = arg);
				console.log('[DOCXCreatorChannel] Unwrapped from object format:', { uriArg, operations });
			}

			// Revive URI
			let revivedURI: URI;
			if (URI.isUri(uriArg)) {
				revivedURI = uriArg;
			} else {
				revivedURI = URI.revive(uriArg);
			}

			if (!revivedURI || !URI.isUri(revivedURI)) {
				throw new Error(`Invalid URI received for editXLSX. Received: ${JSON.stringify(uriArg)}`);
			}

			console.log('[DOCXCreatorChannel] Calling editXLSX with URI:', revivedURI.fsPath);
			return this.service.editXLSX(revivedURI, operations);
		}
		}
		throw new Error(`Call not found: ${command}`);
	}
}

