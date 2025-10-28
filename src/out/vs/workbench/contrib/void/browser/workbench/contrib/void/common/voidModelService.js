import { Disposable } from '../../../../base/common/lifecycle.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
export const IVoidModelService = createDecorator('voidVoidModelService');
class VoidModelService extends Disposable {
    _textModelService;
    _textFileService;
    _serviceBrand;
    static ID = 'voidVoidModelService';
    _modelRefOfURI = {};
    constructor(_textModelService, _textFileService) {
        super();
        this._textModelService = _textModelService;
        this._textFileService = _textFileService;
    }
    saveModel = async (uri) => {
        await this._textFileService.save(uri, {
            skipSaveParticipants: true // avoid triggering extensions etc (if they reformat the page, it will add another item to the undo stack)
        });
    };
    initializeModel = async (uri) => {
        try {
            if (uri.fsPath in this._modelRefOfURI)
                return;
            const editorModelRef = await this._textModelService.createModelReference(uri);
            // Keep a strong reference to prevent disposal
            this._modelRefOfURI[uri.fsPath] = editorModelRef;
        }
        catch (e) {
            console.log('InitializeModel error:', e);
        }
    };
    getModelFromFsPath = (fsPath) => {
        const editorModelRef = this._modelRefOfURI[fsPath];
        if (!editorModelRef) {
            return { model: null, editorModel: null };
        }
        const model = editorModelRef.object.textEditorModel;
        if (!model) {
            return { model: null, editorModel: editorModelRef.object };
        }
        return { model, editorModel: editorModelRef.object };
    };
    getModel = (uri) => {
        return this.getModelFromFsPath(uri.fsPath);
    };
    getModelSafe = async (uri) => {
        if (!(uri.fsPath in this._modelRefOfURI))
            await this.initializeModel(uri);
        return this.getModel(uri);
    };
    dispose() {
        super.dispose();
        for (const ref of Object.values(this._modelRefOfURI)) {
            ref.dispose(); // release reference to allow disposal
        }
    }
}
registerSingleton(IVoidModelService, VoidModelService, 0 /* InstantiationType.Eager */);
