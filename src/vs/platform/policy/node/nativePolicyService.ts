/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AbstractPolicyService, IPolicyService, PolicyDefinition } from '../common/policy.js';
import { IStringDictionary } from '../../../base/common/collections.js';
import { ILogService } from '../../log/common/log.js';

export class NativePolicyService extends AbstractPolicyService implements IPolicyService {

	constructor(
		@ILogService private readonly logService: ILogService
	) {
		super();
	}

	protected async _updatePolicyDefinitions(policyDefinitions: IStringDictionary<PolicyDefinition>): Promise<void> {
		this.logService.trace(`NativePolicyService#_updatePolicyDefinitions - Found ${Object.keys(policyDefinitions).length} policy definitions`);

		// Skip policy watcher for doc-focused editor
		this.logService.trace(`NativePolicyService#_updatePolicyDefinitions - Skipping policy watcher for doc-focused editor`);
		return;
	}

}
