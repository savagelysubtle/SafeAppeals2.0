/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { AsyncEmitter } from '../../../../base/common/event.js';
import { Promises } from '../../../../base/common/async.js';
import { insert } from '../../../../base/common/arrays.js';
import { Disposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { WorkingCopyFileOperationParticipant } from './workingCopyFileOperationParticipant.js';
import { StoredFileWorkingCopySaveParticipant } from './storedFileWorkingCopySaveParticipant.js';
export const IWorkingCopyFileService = createDecorator('workingCopyFileService');
export class WorkingCopyFileService extends Disposable {
    fileService;
    workingCopyService;
    uriIdentityService;
    //#region Events
    _onWillRunWorkingCopyFileOperation = this._register(new AsyncEmitter());
    onWillRunWorkingCopyFileOperation = this._onWillRunWorkingCopyFileOperation.event;
    _onDidFailWorkingCopyFileOperation = this._register(new AsyncEmitter());
    onDidFailWorkingCopyFileOperation = this._onDidFailWorkingCopyFileOperation.event;
    _onDidRunWorkingCopyFileOperation = this._register(new AsyncEmitter());
    onDidRunWorkingCopyFileOperation = this._onDidRunWorkingCopyFileOperation.event;
    //#endregion
    correlationIds = 0;
    constructor(fileService, workingCopyService, instantiationService, uriIdentityService) {
        super();
        this.fileService = fileService;
        this.workingCopyService = workingCopyService;
        this.uriIdentityService = uriIdentityService;
        this.fileOperationParticipants = this._register(instantiationService.createInstance(WorkingCopyFileOperationParticipant));
        this.saveParticipants = this._register(instantiationService.createInstance(StoredFileWorkingCopySaveParticipant));
        // register a default working copy provider that uses the working copy service
        this._register(this.registerWorkingCopyProvider(resource => {
            return this.workingCopyService.workingCopies.filter(workingCopy => {
                if (this.fileService.hasProvider(resource)) {
                    // only check for parents if the resource can be handled
                    // by the file system where we then assume a folder like
                    // path structure
                    return this.uriIdentityService.extUri.isEqualOrParent(workingCopy.resource, resource);
                }
                return this.uriIdentityService.extUri.isEqual(workingCopy.resource, resource);
            });
        }));
    }
    //#region File operations
    create(operations, token, undoInfo) {
        return this.doCreateFileOrFolder(operations, true, token, undoInfo);
    }
    createFolder(operations, token, undoInfo) {
        return this.doCreateFileOrFolder(operations, false, token, undoInfo);
    }
    async doCreateFileOrFolder(operations, isFile, token, undoInfo) {
        if (operations.length === 0) {
            return [];
        }
        // validate create operation before starting
        if (isFile) {
            const validateCreates = await Promises.settled(operations.map(operation => this.fileService.canCreateFile(operation.resource, { overwrite: operation.overwrite })));
            const error = validateCreates.find(validateCreate => validateCreate instanceof Error);
            if (error instanceof Error) {
                throw error;
            }
        }
        // file operation participant
        const files = operations.map(operation => ({ target: operation.resource }));
        await this.runFileOperationParticipants(files, 0 /* FileOperation.CREATE */, undoInfo, token);
        // before events
        const event = { correlationId: this.correlationIds++, operation: 0 /* FileOperation.CREATE */, files };
        await this._onWillRunWorkingCopyFileOperation.fireAsync(event, CancellationToken.None /* intentional: we currently only forward cancellation to participants */);
        // now actually create on disk
        let stats;
        try {
            if (isFile) {
                stats = await Promises.settled(operations.map(operation => this.fileService.createFile(operation.resource, operation.contents, { overwrite: operation.overwrite })));
            }
            else {
                stats = await Promises.settled(operations.map(operation => this.fileService.createFolder(operation.resource)));
            }
        }
        catch (error) {
            // error event
            await this._onDidFailWorkingCopyFileOperation.fireAsync(event, CancellationToken.None /* intentional: we currently only forward cancellation to participants */);
            throw error;
        }
        // after event
        await this._onDidRunWorkingCopyFileOperation.fireAsync(event, CancellationToken.None /* intentional: we currently only forward cancellation to participants */);
        return stats;
    }
    async move(operations, token, undoInfo) {
        return this.doMoveOrCopy(operations, true, token, undoInfo);
    }
    async copy(operations, token, undoInfo) {
        return this.doMoveOrCopy(operations, false, token, undoInfo);
    }
    async doMoveOrCopy(operations, move, token, undoInfo) {
        const stats = [];
        // validate move/copy operation before starting
        for (const { file: { source, target }, overwrite } of operations) {
            const validateMoveOrCopy = await (move ? this.fileService.canMove(source, target, overwrite) : this.fileService.canCopy(source, target, overwrite));
            if (validateMoveOrCopy instanceof Error) {
                throw validateMoveOrCopy;
            }
        }
        // file operation participant
        const files = operations.map(o => o.file);
        await this.runFileOperationParticipants(files, move ? 2 /* FileOperation.MOVE */ : 3 /* FileOperation.COPY */, undoInfo, token);
        // before event
        const event = { correlationId: this.correlationIds++, operation: move ? 2 /* FileOperation.MOVE */ : 3 /* FileOperation.COPY */, files };
        await this._onWillRunWorkingCopyFileOperation.fireAsync(event, CancellationToken.None /* intentional: we currently only forward cancellation to participants */);
        try {
            for (const { file: { source, target }, overwrite } of operations) {
                // if source and target are not equal, handle dirty working copies
                // depending on the operation:
                // - move: revert both source and target (if any)
                // - copy: revert target (if any)
                if (!this.uriIdentityService.extUri.isEqual(source, target)) {
                    const dirtyWorkingCopies = (move ? [...this.getDirty(source), ...this.getDirty(target)] : this.getDirty(target));
                    await Promises.settled(dirtyWorkingCopies.map(dirtyWorkingCopy => dirtyWorkingCopy.revert({ soft: true })));
                }
                // now we can rename the source to target via file operation
                if (move) {
                    stats.push(await this.fileService.move(source, target, overwrite));
                }
                else {
                    stats.push(await this.fileService.copy(source, target, overwrite));
                }
            }
        }
        catch (error) {
            // error event
            await this._onDidFailWorkingCopyFileOperation.fireAsync(event, CancellationToken.None /* intentional: we currently only forward cancellation to participants */);
            throw error;
        }
        // after event
        await this._onDidRunWorkingCopyFileOperation.fireAsync(event, CancellationToken.None /* intentional: we currently only forward cancellation to participants */);
        return stats;
    }
    async delete(operations, token, undoInfo) {
        // validate delete operation before starting
        for (const operation of operations) {
            const validateDelete = await this.fileService.canDelete(operation.resource, { recursive: operation.recursive, useTrash: operation.useTrash });
            if (validateDelete instanceof Error) {
                throw validateDelete;
            }
        }
        // file operation participant
        const files = operations.map(operation => ({ target: operation.resource }));
        await this.runFileOperationParticipants(files, 1 /* FileOperation.DELETE */, undoInfo, token);
        // before events
        const event = { correlationId: this.correlationIds++, operation: 1 /* FileOperation.DELETE */, files };
        await this._onWillRunWorkingCopyFileOperation.fireAsync(event, CancellationToken.None /* intentional: we currently only forward cancellation to participants */);
        // check for any existing dirty working copies for the resource
        // and do a soft revert before deleting to be able to close
        // any opened editor with these working copies
        for (const operation of operations) {
            const dirtyWorkingCopies = this.getDirty(operation.resource);
            await Promises.settled(dirtyWorkingCopies.map(dirtyWorkingCopy => dirtyWorkingCopy.revert({ soft: true })));
        }
        // now actually delete from disk
        try {
            for (const operation of operations) {
                await this.fileService.del(operation.resource, { recursive: operation.recursive, useTrash: operation.useTrash });
            }
        }
        catch (error) {
            // error event
            await this._onDidFailWorkingCopyFileOperation.fireAsync(event, CancellationToken.None /* intentional: we currently only forward cancellation to participants */);
            throw error;
        }
        // after event
        await this._onDidRunWorkingCopyFileOperation.fireAsync(event, CancellationToken.None /* intentional: we currently only forward cancellation to participants */);
    }
    //#endregion
    //#region File operation participants
    fileOperationParticipants;
    addFileOperationParticipant(participant) {
        return this.fileOperationParticipants.addFileOperationParticipant(participant);
    }
    runFileOperationParticipants(files, operation, undoInfo, token) {
        return this.fileOperationParticipants.participate(files, operation, undoInfo, token);
    }
    //#endregion
    //#region Save participants (stored file working copies only)
    saveParticipants;
    get hasSaveParticipants() { return this.saveParticipants.length > 0; }
    addSaveParticipant(participant) {
        return this.saveParticipants.addSaveParticipant(participant);
    }
    runSaveParticipants(workingCopy, context, progress, token) {
        return this.saveParticipants.participate(workingCopy, context, progress, token);
    }
    //#endregion
    //#region Path related
    workingCopyProviders = [];
    registerWorkingCopyProvider(provider) {
        const remove = insert(this.workingCopyProviders, provider);
        return toDisposable(remove);
    }
    getDirty(resource) {
        const dirtyWorkingCopies = new Set();
        for (const provider of this.workingCopyProviders) {
            for (const workingCopy of provider(resource)) {
                if (workingCopy.isDirty()) {
                    dirtyWorkingCopies.add(workingCopy);
                }
            }
        }
        return Array.from(dirtyWorkingCopies);
    }
}
registerSingleton(IWorkingCopyFileService, WorkingCopyFileService, 1 /* InstantiationType.Delayed */);
