# Rust WASM Excel Implementation - Production Code

## Complete Cargo.toml

```toml
[package]
name = "excel-engine"
version = "0.1.0"
edition = "2021"

[dependencies]
calamine = "0.24"
polars = { version = "0.20", features = ["sql", "json", "lazy", "strings"] }
arrow = "52"
wasm-bindgen = "0.2"
wasm-bindgen-futures = "0.4"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
thiserror = "1.0"
regex = "1.10"
lru = "0.12"

[lib]
crate-type = ["cdylib", "rlib"]

[profile.release]
opt-level = 3
lto = true
codegen-units = 1
strip = true
```

## Excel Parser (src/parser.rs)

```rust
use calamine::{Reader, Xlsx, DataType, Range};
use serde::{Serialize, Deserialize};
use std::io::Cursor;
use wasm_bindgen::prelude::*;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cell {
    pub row: u32,
    pub col: u32,
    pub value: CellValue,
    pub formula: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "value")]
pub enum CellValue {
    Number(f64),
    String(String),
    Boolean(bool),
    Error(String),
    Empty,
}

#[wasm_bindgen]
pub struct ExcelParser {
    sheets: HashMap<String, SheetData>,
    current_sheet: String,
}

pub struct SheetData {
    pub name: String,
    pub cells: Vec<Cell>,
    pub dimensions: (u32, u32),
}

#[wasm_bindgen]
impl ExcelParser {
    #[wasm_bindgen(constructor)]
    pub fn new() -> ExcelParser {
        ExcelParser {
            sheets: HashMap::new(),
            current_sheet: String::new(),
        }
    }

    pub fn load_file(&mut self, data: &[u8]) -> Result<u32, String> {
        let cursor = Cursor::new(data);
        let mut workbook = Xlsx::new(cursor)
            .map_err(|e| format!("Failed to open Excel: {}", e))?;

        let sheet_names = workbook.sheet_names().to_owned();
        let mut total_cells = 0u32;

        for sheet_name in sheet_names {
            let cells = match workbook.worksheet_range(&sheet_name) {
                Ok(range) => self.parse_range(&range),
                Err(_) => Vec::new(),
            };

            let dimensions = self.calculate_dimensions(&cells);
            total_cells += cells.len() as u32;

            self.sheets.insert(
                sheet_name.clone(),
                SheetData {
                    name: sheet_name,
                    cells,
                    dimensions,
                },
            );
        }

        self.current_sheet = self.sheets.keys().next().cloned().unwrap_or_default();
        Ok(total_cells)
    }

    pub fn get_sheet_names(&self) -> String {
        let names: Vec<&str> = self.sheets.keys().map(|s| s.as_str()).collect();
        serde_json::to_string(&names).unwrap_or_default()
    }

    pub fn set_current_sheet(&mut self, name: &str) -> Result<(), String> {
        if self.sheets.contains_key(name) {
            self.current_sheet = name.to_string();
            Ok(())
        } else {
            Err(format!("Sheet '{}' not found", name))
        }
    }

    pub fn get_range(&self, range_str: &str) -> Result<String, String> {
        let sheet = self.sheets.get(&self.current_sheet).ok_or("No sheet selected")?;
        let (start_row, start_col, end_row, end_col) = parse_range_string(range_str)?;

        let cells: Vec<Cell> = sheet
            .cells
            .iter()
            .filter(|c| {
                c.row >= start_row && c.row <= end_row &&
                c.col >= start_col && c.col <= end_col
            })
            .cloned()
            .collect();

        serde_json::to_string(&cells).map_err(|e| e.to_string())
    }

    pub fn get_all_cells(&self) -> Result<String, String> {
        let sheet = self.sheets.get(&self.current_sheet).ok_or("No sheet")?;
        serde_json::to_string(&sheet.cells).map_err(|e| e.to_string())
    }

    fn parse_range(&self, range: &Range<DataType>) -> Vec<Cell> {
        let mut cells = Vec::new();

        for (row_idx, row) in range.rows().enumerate() {
            for (col_idx, cell_data) in row.iter().enumerate() {
                let value = match cell_data {
                    DataType::Empty => CellValue::Empty,
                    DataType::String(s) => CellValue::String(s.clone()),
                    DataType::Float(f) => CellValue::Number(*f),
                    DataType::Int(i) => CellValue::Number(*i as f64),
                    DataType::Bool(b) => CellValue::Boolean(*b),
                    DataType::Error(e) => CellValue::Error(format!("{:?}", e)),
                    _ => CellValue::String(cell_data.to_string()),
                };

                if !matches!(value, CellValue::Empty) {
                    cells.push(Cell {
                        row: row_idx as u32,
                        col: col_idx as u32,
                        value,
                        formula: None,
                    });
                }
            }
        }
        cells
    }

    fn calculate_dimensions(&self, cells: &[Cell]) -> (u32, u32) {
        let max_row = cells.iter().map(|c| c.row).max().unwrap_or(0);
        let max_col = cells.iter().map(|c| c.col).max().unwrap_or(0);
        (max_row + 1, max_col + 1)
    }
}

fn parse_range_string(range: &str) -> Result<(u32, u32, u32, u32), String> {
    let parts: Vec<&str> = range.split(':').collect();

    match parts.len() {
        1 => {
            let (row, col) = parse_cell_reference(parts[0])?;
            Ok((row, col, row, col))
        }
        2 => {
            let (row1, col1) = parse_cell_reference(parts[0])?;
            let (row2, col2) = parse_cell_reference(parts[1])?;
            Ok((row1.min(row2), col1.min(col2), row1.max(row2), col1.max(col2)))
        }
        _ => Err(format!("Invalid range: {}", range)),
    }
}

fn parse_cell_reference(cell: &str) -> Result<(u32, u32), String> {
    let mut col_str = String::new();
    let mut row_str = String::new();

    for c in cell.chars() {
        if c.is_alphabetic() {
            col_str.push(c);
        } else if c.is_numeric() {
            row_str.push(c);
        }
    }

    let col = excel_column_to_index(&col_str.to_uppercase())?;
    let row = row_str.parse::<u32>().map_err(|_| "Invalid row")?.saturating_sub(1);

    Ok((row, col))
}

fn excel_column_to_index(col: &str) -> Result<u32, String> {
    let mut result: u32 = 0;
    for c in col.chars() {
        result = result * 26 + (c as u32 - 'A' as u32 + 1);
    }
    Ok(result - 1)
}
```

## Formula Engine (src/formulas.rs)

```rust
use crate::parser::CellValue;
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct FormulaEngine {
    cells: HashMap<String, CellValue>,
}

#[wasm_bindgen]
impl FormulaEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> FormulaEngine {
        FormulaEngine {
            cells: HashMap::new(),
        }
    }

    pub fn init_from_json(&mut self, json: &str) -> Result<(), String> {
        let cells: HashMap<String, CellValue> = serde_json::from_str(json)
            .map_err(|e| e.to_string())?;
        self.cells = cells;
        Ok(())
    }

    pub fn sum(&self, range: &str) -> Result<f64, String> {
        let values = self.get_range_values(range)?;
        Ok(values.iter().sum())
    }

    pub fn average(&self, range: &str) -> Result<f64, String> {
        let values = self.get_range_values(range)?;
        if values.is_empty() {
            return Err("Empty range".to_string());
        }
        Ok(values.iter().sum::<f64>() / values.len() as f64)
    }

    pub fn count(&self, range: &str) -> Result<f64, String> {
        let values = self.get_range_values(range)?;
        Ok(values.len() as f64)
    }

    pub fn min(&self, range: &str) -> Result<f64, String> {
        let values = self.get_range_values(range)?;
        values.iter().fold(f64::INFINITY, |a, &b| a.min(b))
            .is_finite()
            .then(|| values.iter().fold(f64::INFINITY, |a, &b| a.min(b)))
            .ok_or("Empty range".to_string())
    }

    pub fn max(&self, range: &str) -> Result<f64, String> {
        let values = self.get_range_values(range)?;
        values.iter().fold(f64::NEG_INFINITY, |a, &b| a.max(b))
            .is_finite()
            .then(|| values.iter().fold(f64::NEG_INFINITY, |a, &b| a.max(b)))
            .ok_or("Empty range".to_string())
    }

    fn get_range_values(&self, range: &str) -> Result<Vec<f64>, String> {
        let keys: Vec<&str> = range.split(',').map(|s| s.trim()).collect();
        let mut values = Vec::new();

        for key in keys {
            if let Some(CellValue::Number(n)) = self.cells.get(key) {
                values.push(*n);
            }
        }
        Ok(values)
    }
}
```

## Table Operations (src/tables.rs)

```rust
use polars::prelude::*;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct TableEngine;

#[wasm_bindgen]
impl TableEngine {
    pub fn filter(
        data_json: &str,
        column: &str,
        operator: &str,
        value: &str,
    ) -> Result<String, String> {
        let df: DataFrame = serde_json::from_str(data_json)
            .map_err(|e| e.to_string())?;

        let filtered = match operator {
            ">" => df.filter(&col(column).gt(lit(value.parse::<f64>().unwrap_or(0.0))))
                .map_err(|e| e.to_string())?,
            "<" => df.filter(&col(column).lt(lit(value.parse::<f64>().unwrap_or(0.0))))
                .map_err(|e| e.to_string())?,
            "==" => df.filter(&col(column).eq(lit(value)))
                .map_err(|e| e.to_string())?,
            _ => return Err("Unknown operator".to_string()),
        };

        serde_json::to_string(&filtered).map_err(|e| e.to_string())
    }

    pub fn sort(
        data_json: &str,
        column: &str,
        descending: bool,
    ) -> Result<String, String> {
        let df: DataFrame = serde_json::from_str(data_json)
            .map_err(|e| e.to_string())?;

        let sorted = df.sort(column, descending, false)
            .map_err(|e| e.to_string())?;

        serde_json::to_string(&sorted).map_err(|e| e.to_string())
    }

    pub fn groupby_aggregate(
        data_json: &str,
        group_by: &str,
        agg_column: &str,
        agg_func: &str,
    ) -> Result<String, String> {
        let df: DataFrame = serde_json::from_str(data_json)
            .map_err(|e| e.to_string())?;

        let agg_expr = match agg_func {
            "sum" => col(agg_column).sum(),
            "mean" => col(agg_column).mean(),
            "count" => col(agg_column).count(),
            "max" => col(agg_column).max(),
            "min" => col(agg_column).min(),
            _ => return Err("Unknown function".to_string()),
        };

        let result = df
            .lazy()
            .groupby([col(group_by)])
            .agg([agg_expr])
            .collect()
            .map_err(|e| e.to_string())?;

        serde_json::to_string(&result).map_err(|e| e.to_string())
    }
}
```

## TypeScript Integration (src/wasm-loader.ts)

```typescript
import init, { ExcelParser, FormulaEngine } from '../wasm/excel_engine';

interface WasmModule {
    parser: ExcelParser | null;
    formulas: FormulaEngine | null;
    ready: boolean;
}

const wasmModule: WasmModule = {
    parser: null,
    formulas: null,
    ready: false,
};

export async function initializeWasm(): Promise<WasmModule> {
    if (wasmModule.ready) return wasmModule;

    await init();
    wasmModule.parser = new ExcelParser();
    wasmModule.formulas = new FormulaEngine();
    wasmModule.ready = true;

    return wasmModule;
}

export function getWasmModule(): WasmModule {
    if (!wasmModule.ready) {
        throw new Error('WASM not initialized');
    }
    return wasmModule;
}
```

## Excel Service (src/excel-service.ts)

```typescript
import { initializeWasm, getWasmModule } from './wasm-loader';

export interface ParsedCell {
    row: number;
    col: number;
    value: any;
}

export class ExcelService {
    private initialized = false;

    async initialize() {
        if (this.initialized) return;
        await initializeWasm();
        this.initialized = true;
    }

    async openFile(arrayBuffer: ArrayBuffer): Promise<{
        cellCount: number;
        sheets: string[];
    }> {
        await this.initialize();
        const { parser } = getWasmModule();

        const uint8Array = new Uint8Array(arrayBuffer);
        const cellCount = parser.load_file(uint8Array);
        const sheetsJson = parser.get_sheet_names();
        const sheets = JSON.parse(sheetsJson);

        return { cellCount, sheets };
    }

    async getCells(rangeStr: string): Promise<ParsedCell[]> {
        await this.initialize();
        const { parser } = getWasmModule();
        const json = parser.get_range(rangeStr);
        return JSON.parse(json);
    }

    async getAllCells(): Promise<ParsedCell[]> {
        await this.initialize();
        const { parser } = getWasmModule();
        const json = parser.get_all_cells();
        return JSON.parse(json);
    }
}
```

## VSCode Extension (src/extension.ts)

```typescript
import * as vscode from 'vscode';
import { ExcelService } from './excel-service';

export async function activate(context: vscode.ExtensionContext) {
    const excelService = new ExcelService();

    context.subscriptions.push(
        vscode.commands.registerCommand('excelViewer.open', async (uri: vscode.Uri) => {
            const fileData = await vscode.workspace.fs.readFile(uri);
            const panel = vscode.window.createWebviewPanel(
                'excelViewer',
                `📊 ${uri.fsPath.split('/').pop()}`,
                vscode.ViewColumn.One,
                { enableScripts: true }
            );

            panel.webview.html = getWebviewContent();
            panel.webview.postMessage({
                type: 'file:load',
                data: Array.from(fileData),
            });
        })
    );
}

function getWebviewContent(): string {
    return `<!DOCTYPE html>
<html>
<head>
    <title>Excel Viewer</title>
</head>
<body>
    <div id="grid-container"></div>
    <script src="webview.js"></script>
</body>
</html>`;
}
```

## Build Script (build.sh)

```bash
#!/bin/bash
set -e

echo "🔨 Building Rust WASM..."
cd excel-engine
wasm-pack build --target bundler --release

echo "📦 Building TypeScript..."
cd ..
npm run build

echo "✓ Build complete!"
```

## package.json

```json
{
  "name": "vscode-excel-viewer",
  "version": "1.0.0",
  "scripts": {
    "build": "npm run build:wasm && npm run build:ts",
    "build:wasm": "cd excel-engine && wasm-pack build --target bundler --release",
    "build:ts": "esbuild src/extension.ts --bundle --outfile=dist/extension.js"
  },
  "devDependencies": {
    "@types/vscode": "^1.80.0",
    "esbuild": "^0.19.0",
    "typescript": "^5.2.0"
  }
}
```
