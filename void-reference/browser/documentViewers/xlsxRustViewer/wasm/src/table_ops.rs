use wasm_bindgen::prelude::*;
use serde::Deserialize;
use crate::parser::{WorkbookModel, TableDefinition, TableColumn, TableRange};

/// Input range for creating a table
#[derive(Deserialize)]
struct RangeInput {
    start_row: u32,
    start_col: u32,
    end_row: u32,
    end_col: u32,
}

/// Totals function input per column
#[derive(Deserialize)]
struct TotalsFunctionInput {
    col_index: u32,
    function: String, // "sum", "average", "count", "min", "max", etc.
}

#[wasm_bindgen]
pub struct TableOps;

#[wasm_bindgen]
impl TableOps {
    #[wasm_bindgen(constructor)]
    pub fn new() -> TableOps {
        TableOps
    }

    /// Create a new table from the given range on the specified sheet.
    /// Returns updated model JSON.
    pub fn create_table(
        &self,
        model_json: &str,
        sheet_idx: usize,
        range_json: &str,
        table_name: &str,
        style_name: &str,
    ) -> Result<String, JsError> {
        let mut model: WorkbookModel = serde_json::from_str(model_json)
            .map_err(|e| JsError::new(&e.to_string()))?;
        let range_input: RangeInput = serde_json::from_str(range_json)
            .map_err(|e| JsError::new(&e.to_string()))?;

        let sheet = model.sheets.get_mut(sheet_idx)
            .ok_or_else(|| JsError::new("Sheet index out of bounds"))?;

        // Check for overlapping tables
        for existing in &sheet.tables {
            if ranges_overlap(&existing.range, &range_input) {
                return Err(JsError::new(&format!(
                    "New table overlaps with existing table '{}'", existing.name
                )));
            }
        }

        // Build columns from header row data (first row of range)
        let mut columns = Vec::new();
        let header_row = range_input.start_row;
        for c in range_input.start_col..=range_input.end_col {
            let col_name = if let Some(row_data) = sheet.cells.get(&header_row) {
                if let Some(cell) = row_data.get(&c) {
                    cell.value.clone()
                } else {
                    format!("Column{}", c - range_input.start_col + 1)
                }
            } else {
                format!("Column{}", c - range_input.start_col + 1)
            };

            columns.push(TableColumn {
                name: col_name,
                col_index: c - range_input.start_col,
                totals_function: None,
                totals_label: None,
            });
        }

        let table = TableDefinition {
            name: table_name.to_string(),
            display_name: table_name.to_string(),
            range: TableRange {
                start_row: range_input.start_row,
                start_col: range_input.start_col,
                end_row: range_input.end_row,
                end_col: range_input.end_col,
            },
            columns,
            has_header_row: true,
            has_totals_row: false,
            style_name: if style_name.is_empty() { None } else { Some(style_name.to_string()) },
            banded_rows: true,
            banded_cols: false,
            show_first_column: false,
            show_last_column: false,
            filter_enabled: true,
        };

        sheet.tables.push(table);

        serde_json::to_string(&model).map_err(|e| JsError::new(&e.to_string()))
    }

    /// Resize an existing table to a new range. Returns updated model JSON.
    pub fn resize_table(
        &self,
        model_json: &str,
        table_name: &str,
        new_range_json: &str,
    ) -> Result<String, JsError> {
        let mut model: WorkbookModel = serde_json::from_str(model_json)
            .map_err(|e| JsError::new(&e.to_string()))?;
        let range_input: RangeInput = serde_json::from_str(new_range_json)
            .map_err(|e| JsError::new(&e.to_string()))?;

        let table = find_table_mut(&mut model, table_name)?;
        table.range = TableRange {
            start_row: range_input.start_row,
            start_col: range_input.start_col,
            end_row: range_input.end_row,
            end_col: range_input.end_col,
        };

        // Adjust columns count if range width changed
        let new_col_count = (range_input.end_col - range_input.start_col + 1) as usize;
        while table.columns.len() < new_col_count {
            let idx = table.columns.len() as u32;
            table.columns.push(TableColumn {
                name: format!("Column{}", idx + 1),
                col_index: idx,
                totals_function: None,
                totals_label: None,
            });
        }
        table.columns.truncate(new_col_count);

        serde_json::to_string(&model).map_err(|e| JsError::new(&e.to_string()))
    }

    /// Rename a table. Returns updated model JSON.
    pub fn rename_table(
        &self,
        model_json: &str,
        old_name: &str,
        new_name: &str,
    ) -> Result<String, JsError> {
        let mut model: WorkbookModel = serde_json::from_str(model_json)
            .map_err(|e| JsError::new(&e.to_string()))?;

        let table = find_table_mut(&mut model, old_name)?;
        table.name = new_name.to_string();
        table.display_name = new_name.to_string();

        serde_json::to_string(&model).map_err(|e| JsError::new(&e.to_string()))
    }

    /// Add a column to a table. Returns updated model JSON.
    pub fn add_table_column(
        &self,
        model_json: &str,
        table_name: &str,
        col_name: &str,
    ) -> Result<String, JsError> {
        let mut model: WorkbookModel = serde_json::from_str(model_json)
            .map_err(|e| JsError::new(&e.to_string()))?;

        let table = find_table_mut(&mut model, table_name)?;
        let new_idx = table.columns.len() as u32;
        table.columns.push(TableColumn {
            name: col_name.to_string(),
            col_index: new_idx,
            totals_function: None,
            totals_label: None,
        });
        table.range.end_col += 1;

        serde_json::to_string(&model).map_err(|e| JsError::new(&e.to_string()))
    }

    /// Remove a column from a table by index. Returns updated model JSON.
    pub fn remove_table_column(
        &self,
        model_json: &str,
        table_name: &str,
        col_index: u32,
    ) -> Result<String, JsError> {
        let mut model: WorkbookModel = serde_json::from_str(model_json)
            .map_err(|e| JsError::new(&e.to_string()))?;

        let table = find_table_mut(&mut model, table_name)?;
        let idx = col_index as usize;
        if idx >= table.columns.len() {
            return Err(JsError::new("Column index out of bounds"));
        }
        if table.columns.len() <= 1 {
            return Err(JsError::new("Cannot remove the last column from a table"));
        }

        table.columns.remove(idx);
        table.range.end_col = table.range.end_col.saturating_sub(1);
        // Re-index remaining columns
        for (i, col) in table.columns.iter_mut().enumerate() {
            col.col_index = i as u32;
        }

        serde_json::to_string(&model).map_err(|e| JsError::new(&e.to_string()))
    }

    /// Toggle or set the totals row. Returns updated model JSON.
    /// functions_json is a JSON array of TotalsFunctionInput objects.
    pub fn set_totals_row(
        &self,
        model_json: &str,
        table_name: &str,
        enabled: bool,
        functions_json: &str,
    ) -> Result<String, JsError> {
        let mut model: WorkbookModel = serde_json::from_str(model_json)
            .map_err(|e| JsError::new(&e.to_string()))?;

        let table = find_table_mut(&mut model, table_name)?;
        table.has_totals_row = enabled;

        if enabled && !functions_json.is_empty() {
            let funcs: Vec<TotalsFunctionInput> = serde_json::from_str(functions_json)
                .map_err(|e| JsError::new(&e.to_string()))?;

            for func_input in funcs {
                let idx = func_input.col_index as usize;
                if idx < table.columns.len() {
                    table.columns[idx].totals_function = Some(func_input.function);
                }
            }
        } else if !enabled {
            for col in &mut table.columns {
                col.totals_function = None;
                col.totals_label = None;
            }
        }

        // Adjust end_row for totals row
        if enabled {
            table.range.end_row += 1;
        }

        serde_json::to_string(&model).map_err(|e| JsError::new(&e.to_string()))
    }

    /// Set table style. Returns updated model JSON.
    pub fn set_table_style(
        &self,
        model_json: &str,
        table_name: &str,
        style_name: &str,
    ) -> Result<String, JsError> {
        let mut model: WorkbookModel = serde_json::from_str(model_json)
            .map_err(|e| JsError::new(&e.to_string()))?;

        let table = find_table_mut(&mut model, table_name)?;
        table.style_name = if style_name.is_empty() { None } else { Some(style_name.to_string()) };

        serde_json::to_string(&model).map_err(|e| JsError::new(&e.to_string()))
    }

    /// Toggle filter on a table. Returns updated model JSON.
    pub fn toggle_filter(
        &self,
        model_json: &str,
        table_name: &str,
    ) -> Result<String, JsError> {
        let mut model: WorkbookModel = serde_json::from_str(model_json)
            .map_err(|e| JsError::new(&e.to_string()))?;

        let table = find_table_mut(&mut model, table_name)?;
        table.filter_enabled = !table.filter_enabled;

        serde_json::to_string(&model).map_err(|e| JsError::new(&e.to_string()))
    }

    /// Convert a table back to a plain range (removes table, keeps data). Returns updated model JSON.
    pub fn convert_to_range(
        &self,
        model_json: &str,
        table_name: &str,
    ) -> Result<String, JsError> {
        let mut model: WorkbookModel = serde_json::from_str(model_json)
            .map_err(|e| JsError::new(&e.to_string()))?;

        for sheet in &mut model.sheets {
            let before_len = sheet.tables.len();
            sheet.tables.retain(|t| t.name != table_name);
            if sheet.tables.len() < before_len {
                return serde_json::to_string(&model).map_err(|e| JsError::new(&e.to_string()));
            }
        }

        Err(JsError::new(&format!("Table '{}' not found", table_name)))
    }
}

// --- Helpers ---

fn find_table_mut<'a>(model: &'a mut WorkbookModel, table_name: &str) -> Result<&'a mut TableDefinition, JsError> {
    for sheet in &mut model.sheets {
        if let Some(table) = sheet.tables.iter_mut().find(|t| t.name == table_name) {
            return Ok(table);
        }
    }
    Err(JsError::new(&format!("Table '{}' not found", table_name)))
}

fn ranges_overlap(existing: &TableRange, new_range: &RangeInput) -> bool {
    !(existing.end_row < new_range.start_row
        || existing.start_row > new_range.end_row
        || existing.end_col < new_range.start_col
        || existing.start_col > new_range.end_col)
}
