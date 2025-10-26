/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IURLService } from '../../../../platform/url/common/url.js';
import { URI } from '../../../../base/common/uri.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { AbstractURLService } from '../../../../platform/url/common/urlService.js';
import { matchesScheme } from '../../../../base/common/network.js';
class BrowserURLOpener {
    urlService;
    productService;
    constructor(urlService, productService) {
        this.urlService = urlService;
        this.productService = productService;
    }
    async open(resource, options) {
        if (options?.openExternal) {
            return false;
        }
        if (!matchesScheme(resource, this.productService.urlProtocol)) {
            return false;
        }
        if (typeof resource === 'string') {
            resource = URI.parse(resource);
        }
        return this.urlService.open(resource, { trusted: true });
    }
}
export class BrowserURLService extends AbstractURLService {
    provider;
    constructor(environmentService, openerService, productService) {
        super();
        this.provider = environmentService.options?.urlCallbackProvider;
        if (this.provider) {
            this._register(this.provider.onCallback(uri => this.open(uri, { trusted: true })));
        }
        this._register(openerService.registerOpener(new BrowserURLOpener(this, productService)));
    }
    create(options) {
        if (this.provider) {
            return this.provider.create(options);
        }
        return URI.parse('unsupported://');
    }
}
registerSingleton(IURLService, BrowserURLService, 1 /* InstantiationType.Delayed */);
