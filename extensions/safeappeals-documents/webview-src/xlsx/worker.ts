// Worker script to handle heavy lifting
// This file will import the WASM module and expose an API via postMessage

import init, { XlsxParser, XlsxWriter, TableOps, FormulaEngine, ContextMenuManager } from './wasm/xlsx_rust_viewer.js';

let parser: XlsxParser | null = null;
let writer: XlsxWriter | null = null;
let tableOps: TableOps | null = null;
let formulaEngine: FormulaEngine | null = null;
let contextMenuManager: ContextMenuManager | null = null;

self.onmessage = async (e: MessageEvent) => {
    const { type, payload, id } = e.data;

    try {
        switch (type) {
            case 'INIT':
                await init(payload.wasmUrl); // Initialize WASM with the URL provided
                parser = new XlsxParser();
                writer = new XlsxWriter();
                tableOps = new TableOps();
                formulaEngine = new FormulaEngine();
                contextMenuManager = new ContextMenuManager();
                self.postMessage({ type: 'INIT_SUCCESS', id });
                break;

            case 'LOAD':
                if (!parser) throw new Error("WASM not initialized");
                const json = parser.load(payload.data);
                // Zero-copy transfer if possible, but here we return JSON string for simplicity
                self.postMessage({ type: 'LOAD_SUCCESS', id, payload: json });
                break;

            case 'SAVE':
                if (!writer) throw new Error("WASM not initialized");
                const savedBytes = writer.save(payload.modelJson);
                // TODO: Add transfer list for zero-copy once worker type declarations are available
                self.postMessage({ type: 'SAVE_SUCCESS', id, payload: savedBytes });
                break;
                
            case 'TABLE_OP':
                if (!tableOps) throw new Error("WASM not initialized");
                let tableResult: string;
                switch (payload.action) {
                    case 'create_table':
                        tableResult = tableOps.create_table(payload.modelJson, payload.sheetIdx, payload.rangeJson, payload.tableName, payload.styleName);
                        break;
                    case 'resize_table':
                        tableResult = tableOps.resize_table(payload.modelJson, payload.tableName, payload.rangeJson);
                        break;
                    case 'rename_table':
                        tableResult = tableOps.rename_table(payload.modelJson, payload.oldName, payload.newName);
                        break;
                    case 'toggle_filter':
                        tableResult = tableOps.toggle_filter(payload.modelJson, payload.tableName);
                        break;
                    case 'set_table_style':
                        tableResult = tableOps.set_table_style(payload.modelJson, payload.tableName, payload.styleName);
                        break;
                    case 'set_totals_row':
                        tableResult = tableOps.set_totals_row(payload.modelJson, payload.tableName, payload.enabled, payload.functionsJson);
                        break;
                    case 'convert_to_range':
                        tableResult = tableOps.convert_to_range(payload.modelJson, payload.tableName);
                        break;
                    case 'add_table_column':
                        tableResult = tableOps.add_table_column(payload.modelJson, payload.tableName, payload.colName);
                        break;
                    case 'remove_table_column':
                        tableResult = tableOps.remove_table_column(payload.modelJson, payload.tableName, payload.colIndex);
                        break;
                    default:
                        throw new Error(`Unknown table action: ${payload.action}`);
                }
                self.postMessage({ type: 'TABLE_OP_SUCCESS', id, payload: tableResult });
                break;
                
             case 'CONTEXT_MENU':
                if (!contextMenuManager) throw new Error("WASM not initialized");
                const menuJson = contextMenuManager.get_context_menu(payload.row, payload.col);
                self.postMessage({ type: 'CONTEXT_MENU_SUCCESS', id, payload: menuJson });
                break;
                
            case 'EVAL_FORMULA':
                 if (!formulaEngine) throw new Error("WASM not initialized");
                 // Evaluate all formulas with the provided cells JSON
                 const result = formulaEngine.evaluate_all(payload.cellsJson, payload.activeSheet ?? '');
                 self.postMessage({ type: 'EVAL_SUCCESS', id, payload: result });
                 break;

            default:
                throw new Error(`Unknown message type: ${type}`);
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        self.postMessage({ type: 'ERROR', id, error: message });
    }
};
