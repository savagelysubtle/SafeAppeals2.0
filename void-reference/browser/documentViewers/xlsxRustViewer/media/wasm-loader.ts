// WASM Loader and Worker Bridge

// This is a thin wrapper around the worker
// It handles the message passing and promises

export class WasmLoader {
    private worker: Worker;
    private nextId = 0;
    private pending = new Map<number, { resolve: (val: any) => void, reject: (err: any) => void }>();

    constructor(workerUrl: string) {
        this.worker = new Worker(workerUrl);
        this.worker.onmessage = (e) => this.handleMessage(e);
    }

    init(wasmUrl: string): Promise<any> {
        return this.send('INIT', { wasmUrl });
    }

    loadFile(data: Uint8Array): Promise<any> {
        // Transfer the array buffer to worker
        // Note: we can't use `[data.buffer]` transfer list if the buffer is shared or if we need to reuse it immediately.
        // But for loading, we're giving ownership to the worker.
        return this.send('LOAD', { data }, [data.buffer]);
    }

    saveFile(model: any): Promise<Uint8Array> {
        const modelJson = JSON.stringify(model);
        return this.send('SAVE', { modelJson });
    }

    sortColumnData(valuesJson: string, descending: boolean): Promise<string> {
        return this.send('SORT', { valuesJson, descending });
    }

    getContextMenu(row: number, col: number): Promise<any> {
        return this.send('CONTEXT_MENU', { row, col });
    }

    private send(type: string, payload: any, transfer: Transferable[] = []): Promise<any> {
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.worker.postMessage({ type, payload, id }, transfer);
        });
    }

    private handleMessage(e: MessageEvent) {
        const { id, payload, error } = e.data;
        const p = this.pending.get(id);
        
        // Handle init/generic messages that might not have an ID or correspond to pending promise?
        // Actually, our protocol always includes ID for request/response.
        if (p) {
            this.pending.delete(id);
            if (error) {
                p.reject(new Error(error));
            } else {
                p.resolve(payload);
            }
        }
    }
}
