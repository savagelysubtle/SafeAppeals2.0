// Viewport logic
// This logic is mostly handled by the CanvasRenderer scroll state in renderer.ts for the proof of concept.
// Ideally, the "Model" is sparse, and the renderer requests a "Viewport" of data from Rust.

// For this plan item, I'll update the Rust parser to support returning a viewport chunk
// instead of the whole file, which is critical for large files.

use wasm_bindgen::prelude::*;
use crate::parser::{WorkbookModel, SheetData};
use std::collections::HashMap;

#[wasm_bindgen]
pub struct ViewportManager {
    // We ideally keep a reference to the loaded model. 
    // In a real app, this might own the model or borrow it.
    // For simplicity here, we'll assume it holds the model directly or via a shared reference.
    // Or we just re-parse the JSON string for now (slow but functional POC).
}

#[wasm_bindgen]
impl ViewportManager {
    #[wasm_bindgen(constructor)]
    pub fn new() -> ViewportManager {
        ViewportManager {}
    }

    /// Returns a JSON string of a `SheetData` containing only the cells in the requested viewport.
    pub fn get_viewport(&self, model_json: &str, sheet_idx: usize, start_row: u32, end_row: u32, start_col: u32, end_col: u32) -> Result<String, JsError> {
        let model: WorkbookModel = serde_json::from_str(model_json)
            .map_err(|e| JsError::new(&e.to_string()))?;

        if sheet_idx >= model.sheets.len() {
             return Ok("{}".to_string());
        }

        let sheet = &model.sheets[sheet_idx];
        let mut viewport_cells = HashMap::new();

        // Very inefficient re-scanning of the whole model if not indexed properly.
        // But the model structure is HashMap<row, HashMap<col, cell>>, so lookups are fast.
        for r in start_row..=end_row {
            if let Some(row_data) = sheet.cells.get(&r) {
                let mut row_map = HashMap::new();
                for c in start_col..=end_col {
                    if let Some(cell) = row_data.get(&c) {
                        row_map.insert(c, cell.clone());
                    }
                }
                if !row_map.is_empty() {
                    viewport_cells.insert(r, row_map);
                }
            }
        }

        let viewport_sheet = SheetData {
            name: sheet.name.clone(),
            cells: viewport_cells,
            row_count: sheet.row_count,
            col_count: sheet.col_count,
            tables: sheet.tables.clone(),
            merged_cells: sheet.merged_cells.clone(),
            col_widths: sheet.col_widths.clone(),
            row_heights: sheet.row_heights.clone(),
            conditional_formats: sheet.conditional_formats.clone(),
            charts: sheet.charts.clone(),
            sparklines: sheet.sparklines.clone(),
        };

        let json = serde_json::to_string(&viewport_sheet).map_err(|e| JsError::new(&e.to_string()))?;
        Ok(json)
    }
}
