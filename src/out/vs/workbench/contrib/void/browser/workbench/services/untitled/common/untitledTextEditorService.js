/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { UntitledTextEditorModel } from './untitledTextEditorModel.js';
import { Event, Emitter } from '../../../../base/common/event.js';
import { ResourceMap } from '../../../../base/common/map.js';
import { Schemas } from '../../../../base/common/network.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
export const IUntitledTextEditorService = createDecorator('untitledTextEditorService');
export class UntitledTextEditorService extends Disposable {
    instantiationService;
    configurationService;
    static UNTITLED_WITHOUT_ASSOCIATED_RESOURCE_REGEX = /Untitled-\d+/;
    _onDidSave = this._register(new Emitter());
    onDidSave = this._onDidSave.event;
    _onDidChangeDirty = this._register(new Emitter());
    onDidChangeDirty = this._onDidChangeDirty.event;
    _onDidChangeEncoding = this._register(new Emitter());
    onDidChangeEncoding = this._onDidChangeEncoding.event;
    _onDidCreate = this._register(new Emitter());
    onDidCreate = this._onDidCreate.event;
    _onWillDispose = this._register(new Emitter());
    onWillDispose = this._onWillDispose.event;
    _onDidChangeLabel = this._register(new Emitter());
    onDidChangeLabel = this._onDidChangeLabel.event;
    mapResourceToModel = new ResourceMap();
    constructor(instantiationService, configurationService) {
        super();
        this.instantiationService = instantiationService;
        this.configurationService = configurationService;
    }
    get(resource) {
        return this.mapResourceToModel.get(resource);
    }
    getValue(resource) {
        return this.get(resource)?.textEditorModel?.getValue();
    }
    async resolve(options) {
        const model = this.doCreateOrGet(options);
        await model.resolve();
        return model;
    }
    create(options) {
        return this.doCreateOrGet(options);
    }
    doCreateOrGet(options = Object.create(null)) {
        const massagedOptions = this.massageOptions(options);
        // Return existing instance if asked for it
        if (massagedOptions.untitledResource && this.mapResourceToModel.has(massagedOptions.untitledResource)) {
            return this.mapResourceToModel.get(massagedOptions.untitledResource);
        }
        // Create new instance otherwise
        return this.doCreate(massagedOptions);
    }
    massageOptions(options) {
        const massagedOptions = Object.create(null);
        // Figure out associated and untitled resource
        if (options.associatedResource) {
            massagedOptions.untitledResource = URI.from({
                scheme: Schemas.untitled,
                authority: options.associatedResource.authority,
                fragment: options.associatedResource.fragment,
                path: options.associatedResource.path,
                query: options.associatedResource.query
            });
            massagedOptions.associatedResource = options.associatedResource;
        }
        else {
            if (options.untitledResource?.scheme === Schemas.untitled) {
                massagedOptions.untitledResource = options.untitledResource;
            }
        }
        // Language id
        if (options.languageId) {
            massagedOptions.languageId = options.languageId;
        }
        else if (!massagedOptions.associatedResource) {
            const configuration = this.configurationService.getValue();
            if (configuration.files?.defaultLanguage) {
                massagedOptions.languageId = configuration.files.defaultLanguage;
            }
        }
        // Take over encoding and initial value
        massagedOptions.encoding = options.encoding;
        massagedOptions.initialValue = options.initialValue;
        return massagedOptions;
    }
    doCreate(options) {
        // Create a new untitled resource if none is provided
        let untitledResource = options.untitledResource;
        if (!untitledResource) {
            let counter = 1;
            do {
                untitledResource = URI.from({ scheme: Schemas.untitled, path: `Untitled-${counter}` });
                counter++;
            } while (this.mapResourceToModel.has(untitledResource));
        }
        // Create new model with provided options
        const model = this._register(this.instantiationService.createInstance(UntitledTextEditorModel, untitledResource, !!options.associatedResource, options.initialValue, options.languageId, options.encoding));
        this.registerModel(model);
        return model;
    }
    registerModel(model) {
        // Install model listeners
        const modelListeners = new DisposableStore();
        modelListeners.add(model.onDidChangeDirty(() => this._onDidChangeDirty.fire(model)));
        modelListeners.add(model.onDidChangeName(() => this._onDidChangeLabel.fire(model)));
        modelListeners.add(model.onDidChangeEncoding(() => this._onDidChangeEncoding.fire(model)));
        modelListeners.add(model.onWillDispose(() => this._onWillDispose.fire(model)));
        // Remove from cache on dispose
        Event.once(model.onWillDispose)(() => {
            // Registry
            this.mapResourceToModel.delete(model.resource);
            // Listeners
            modelListeners.dispose();
        });
        // Add to cache
        this.mapResourceToModel.set(model.resource, model);
        // Emit as event
        this._onDidCreate.fire(model);
        // If the model is dirty right from the beginning,
        // make sure to emit this as an event
        if (model.isDirty()) {
            this._onDidChangeDirty.fire(model);
        }
    }
    isUntitledWithAssociatedResource(resource) {
        return resource.scheme === Schemas.untitled && resource.path.length > 1 && !UntitledTextEditorService.UNTITLED_WITHOUT_ASSOCIATED_RESOURCE_REGEX.test(resource.path);
    }
    canDispose(model) {
        if (model.isDisposed()) {
            return true; // quick return if model already disposed
        }
        // promise based return in all other cases
        return this.doCanDispose(model);
    }
    async doCanDispose(model) {
        // dirty model: we do not allow to dispose dirty models to prevent
        // data loss cases. dirty models can only be disposed when they are
        // either saved or reverted
        if (model.isDirty()) {
            await Event.toPromise(model.onDidChangeDirty);
            return this.canDispose(model);
        }
        return true;
    }
    notifyDidSave(source, target) {
        this._onDidSave.fire({ source, target });
    }
}
registerSingleton(IUntitledTextEditorService, UntitledTextEditorService, 1 /* InstantiationType.Delayed */);
