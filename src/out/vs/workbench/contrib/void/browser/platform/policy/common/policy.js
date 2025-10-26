/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter, Event } from '../../../base/common/event.js';
import { Iterable } from '../../../base/common/iterator.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
export const IPolicyService = createDecorator('policy');
export class AbstractPolicyService extends Disposable {
    _serviceBrand;
    policyDefinitions = {};
    policies = new Map();
    _onDidChange = this._register(new Emitter());
    onDidChange = this._onDidChange.event;
    async updatePolicyDefinitions(policyDefinitions) {
        const size = Object.keys(this.policyDefinitions).length;
        this.policyDefinitions = { ...policyDefinitions, ...this.policyDefinitions };
        if (size !== Object.keys(this.policyDefinitions).length) {
            await this._updatePolicyDefinitions(this.policyDefinitions);
        }
        return Iterable.reduce(this.policies.entries(), (r, [name, value]) => ({ ...r, [name]: value }), {});
    }
    getPolicyValue(name) {
        return this.policies.get(name);
    }
    serialize() {
        return Iterable.reduce(Object.entries(this.policyDefinitions), (r, [name, definition]) => ({ ...r, [name]: { definition, value: this.policies.get(name) } }), {});
    }
}
export class NullPolicyService {
    _serviceBrand;
    onDidChange = Event.None;
    async updatePolicyDefinitions() { return {}; }
    getPolicyValue() { return undefined; }
    serialize() { return undefined; }
    policyDefinitions = {};
}
