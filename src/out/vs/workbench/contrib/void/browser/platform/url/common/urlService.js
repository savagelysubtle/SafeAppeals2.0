/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { first } from '../../../base/common/async.js';
import { Disposable, toDisposable } from '../../../base/common/lifecycle.js';
import { URI } from '../../../base/common/uri.js';
export class AbstractURLService extends Disposable {
    handlers = new Set();
    open(uri, options) {
        const handlers = [...this.handlers.values()];
        return first(handlers.map(h => () => h.handleURL(uri, options)), undefined, false).then(val => val || false);
    }
    registerHandler(handler) {
        this.handlers.add(handler);
        return toDisposable(() => this.handlers.delete(handler));
    }
}
export class NativeURLService extends AbstractURLService {
    productService;
    constructor(productService) {
        super();
        this.productService = productService;
    }
    create(options) {
        let { authority, path, query, fragment } = options ? options : { authority: undefined, path: undefined, query: undefined, fragment: undefined };
        if (authority && path && path.indexOf('/') !== 0) {
            path = `/${path}`; // URI validation requires a path if there is an authority
        }
        return URI.from({ scheme: this.productService.urlProtocol, authority, path, query, fragment });
    }
}
