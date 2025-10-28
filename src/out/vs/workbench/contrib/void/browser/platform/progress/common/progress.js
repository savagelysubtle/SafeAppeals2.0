/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { DeferredPromise } from '../../../base/common/async.js';
import { CancellationTokenSource } from '../../../base/common/cancellation.js';
import { Disposable, DisposableStore, toDisposable } from '../../../base/common/lifecycle.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
export const IProgressService = createDecorator('progressService');
export const emptyProgressRunner = Object.freeze({
    total() { },
    worked() { },
    done() { }
});
export class Progress {
    callback;
    static None = Object.freeze({ report() { } });
    _value;
    get value() { return this._value; }
    constructor(callback) {
        this.callback = callback;
    }
    report(item) {
        this._value = item;
        this.callback(this._value);
    }
}
export class AsyncProgress {
    callback;
    _value;
    get value() { return this._value; }
    _asyncQueue;
    _processingAsyncQueue;
    _drainListener;
    constructor(callback) {
        this.callback = callback;
    }
    report(item) {
        if (!this._asyncQueue) {
            this._asyncQueue = [item];
        }
        else {
            this._asyncQueue.push(item);
        }
        this._processAsyncQueue();
    }
    async _processAsyncQueue() {
        if (this._processingAsyncQueue) {
            return;
        }
        try {
            this._processingAsyncQueue = true;
            while (this._asyncQueue && this._asyncQueue.length) {
                const item = this._asyncQueue.shift();
                this._value = item;
                await this.callback(this._value);
            }
        }
        finally {
            this._processingAsyncQueue = false;
            const drainListener = this._drainListener;
            this._drainListener = undefined;
            drainListener?.();
        }
    }
    drain() {
        if (this._processingAsyncQueue) {
            return new Promise(resolve => {
                const prevListener = this._drainListener;
                this._drainListener = () => {
                    prevListener?.();
                    resolve();
                };
            });
        }
        return Promise.resolve();
    }
}
/**
 * RAII-style progress instance that allows imperative reporting and hides
 * once `dispose()` is called.
 */
export class UnmanagedProgress extends Disposable {
    deferred = new DeferredPromise();
    reporter;
    lastStep;
    constructor(options, progressService) {
        super();
        progressService.withProgress(options, reporter => {
            this.reporter = reporter;
            if (this.lastStep) {
                reporter.report(this.lastStep);
            }
            return this.deferred.p;
        });
        this._register(toDisposable(() => this.deferred.complete()));
    }
    report(step) {
        if (this.reporter) {
            this.reporter.report(step);
        }
        else {
            this.lastStep = step;
        }
    }
}
export class LongRunningOperation extends Disposable {
    progressIndicator;
    currentOperationId = 0;
    currentOperationDisposables = this._register(new DisposableStore());
    currentProgressRunner;
    currentProgressTimeout;
    constructor(progressIndicator) {
        super();
        this.progressIndicator = progressIndicator;
    }
    start(progressDelay) {
        // Stop any previous operation
        this.stop();
        // Start new
        const newOperationId = ++this.currentOperationId;
        const newOperationToken = new CancellationTokenSource();
        this.currentProgressTimeout = setTimeout(() => {
            if (newOperationId === this.currentOperationId) {
                this.currentProgressRunner = this.progressIndicator.show(true);
            }
        }, progressDelay);
        this.currentOperationDisposables.add(toDisposable(() => clearTimeout(this.currentProgressTimeout)));
        this.currentOperationDisposables.add(toDisposable(() => newOperationToken.cancel()));
        this.currentOperationDisposables.add(toDisposable(() => this.currentProgressRunner ? this.currentProgressRunner.done() : undefined));
        return {
            id: newOperationId,
            token: newOperationToken.token,
            stop: () => this.doStop(newOperationId),
            isCurrent: () => this.currentOperationId === newOperationId
        };
    }
    stop() {
        this.doStop(this.currentOperationId);
    }
    doStop(operationId) {
        if (this.currentOperationId === operationId) {
            this.currentOperationDisposables.clear();
        }
    }
}
export const IEditorProgressService = createDecorator('editorProgressService');
