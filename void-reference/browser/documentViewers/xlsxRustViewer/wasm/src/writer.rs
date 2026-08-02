use wasm_bindgen::prelude::*;
use std::collections::HashSet;
use rust_xlsxwriter::{
    Workbook, Format, Table, TableColumn as RxTableColumn, TableFunction, TableStyle,
    ConditionalFormatCell, ConditionalFormatCellRule,
    ConditionalFormatFormula, ConditionalFormatTop, ConditionalFormatTopRule,
    ConditionalFormatAverage, ConditionalFormatAverageRule,
    ConditionalFormatText, ConditionalFormatTextRule,
    ConditionalFormatDuplicate,
    ConditionalFormat2ColorScale, ConditionalFormat3ColorScale,
    ConditionalFormatDataBar, ConditionalFormatIconSet, ConditionalFormatIconType,
    DataValidation, DataValidationRule, DataValidationErrorStyle, Formula,
    Url,
};
use crate::parser::{
    WorkbookModel, CellData, CellStyle, ConditionalFormatRule, DataValidationDef, HyperlinkDef,
    ChartDefinition, DefinedNameDef, PivotTableDef, PageSetupDef, TableDefinition,
};

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub struct XlsxWriter;

#[wasm_bindgen]
impl XlsxWriter {
    #[wasm_bindgen(constructor)]
    pub fn new() -> XlsxWriter {
        XlsxWriter
    }

    pub fn save(&self, model_json: &str) -> Result<Vec<u8>, JsError> {
        let model: WorkbookModel = serde_json::from_str(model_json)
            .map_err(|e| JsError::new(&e.to_string()))?;

        let mut workbook = Workbook::new();

        for sheet_data in &model.sheets {
            let worksheet = workbook.add_worksheet();
            worksheet.set_name(&sheet_data.name).map_err(|e| JsError::new(&e.to_string()))?;

            // Build set of (row, col) that have hyperlinks so we can skip them in
            // the regular cell write loop — write_url() must be the sole writer for
            // those cells, otherwise the hyperlink relationship is not created.
            let hyperlink_cells: HashSet<(u32, u32)> = sheet_data.hyperlinks.iter()
                .map(|link| {
                    let base_ref = link.cell_ref.split(':').next().unwrap_or(&link.cell_ref);
                    parse_cf_cell_ref(base_ref)
                })
                .collect();

            for (row_idx, row_map) in &sheet_data.cells {
                for (col_idx, cell_data) in row_map {
                    // Skip cells that will be written by write_url() below
                    if hyperlink_cells.contains(&(*row_idx, *col_idx)) {
                        continue;
                    }
                    let col_u16 = *col_idx as u16;

                    write_cell_to_worksheet(worksheet, *row_idx, col_u16, cell_data)
                        .map_err(|e| JsError::new(&e.to_string()))?;
                }
            }

            // Write tables -- rust_xlsxwriter uses a builder pattern (each setter consumes self, returns Table)
            for table_def in &sheet_data.tables {
                let table = Table::new();

                // Chain: set_name
                let table = table.set_name(&table_def.name);

                // Header row
                let table = if !table_def.has_header_row {
                    table.set_header_row(false)
                } else {
                    table
                };

                // Totals row
                let table = if table_def.has_totals_row {
                    table.set_total_row(true)
                } else {
                    table
                };

                // Style
                let table = if let Some(ref style_name) = table_def.style_name {
                    if let Some(style) = parse_table_style(style_name) {
                        table.set_style(style)
                    } else {
                        table
                    }
                } else {
                    table
                };

                // Banded rows/cols, first/last column
                let table = table
                    .set_banded_rows(table_def.banded_rows)
                    .set_banded_columns(table_def.banded_cols)
                    .set_first_column(table_def.show_first_column)
                    .set_last_column(table_def.show_last_column);

                // Columns with totals functions
                let mut rx_columns = Vec::new();
                for col_def in &table_def.columns {
                    let rx_col = RxTableColumn::new()
                        .set_header(&col_def.name);

                    let rx_col = if let Some(ref func_name) = col_def.totals_function {
                        if let Some(func) = parse_totals_function(func_name) {
                            rx_col.set_total_function(func)
                        } else {
                            rx_col
                        }
                    } else {
                        rx_col
                    };

                    let rx_col = if let Some(ref label) = col_def.totals_label {
                        rx_col.set_total_label(label)
                    } else {
                        rx_col
                    };

                    rx_columns.push(rx_col);
                }

                let table = if !rx_columns.is_empty() {
                    table.set_columns(&rx_columns)
                } else {
                    table
                };

                // Autofilter
                let table = if !table_def.filter_enabled {
                    table.set_autofilter(false)
                } else {
                    table
                };

                // Add table to worksheet at the correct range
                let r = &table_def.range;
                worksheet.add_table(r.start_row, r.start_col as u16, r.end_row, r.end_col as u16, &table)
                    .map_err(|e| JsError::new(&e.to_string()))?;
            }

            // rust_xlsxwriter `add_table` rewrites header/body cells without formats.
            // Re-apply any cell that still carries an explicit style so bold/fill/numFmt survive.
            if !sheet_data.tables.is_empty() {
                for (row_idx, row_map) in &sheet_data.cells {
                    for (col_idx, cell_data) in row_map {
                        if cell_data.style.is_none() {
                            continue;
                        }
                        if hyperlink_cells.contains(&(*row_idx, *col_idx)) {
                            continue;
                        }
                        if !cell_in_any_table(*row_idx, *col_idx, &sheet_data.tables) {
                            continue;
                        }
                        write_cell_to_worksheet(worksheet, *row_idx, *col_idx as u16, cell_data)
                            .map_err(|e| JsError::new(&e.to_string()))?;
                    }
                }
            }

            // Write merged cells
            for mc in &sheet_data.merged_cells {
                worksheet.merge_range(
                    mc.start_row, mc.start_col as u16,
                    mc.end_row, mc.end_col as u16,
                    "", &Format::new()
                ).map_err(|e| JsError::new(&e.to_string()))?;
            }

            // Write column widths
            for (col_idx, width) in &sheet_data.col_widths {
                // Convert pixels back to Excel character width units
                let char_width = width / 7.5;
                worksheet.set_column_width(*col_idx as u16, char_width)
                    .map_err(|e| JsError::new(&e.to_string()))?;
            }

            // Write hidden columns
            for col_idx in &sheet_data.hidden_cols {
                worksheet.set_column_hidden(*col_idx as u16)
                    .map_err(|e| JsError::new(&e.to_string()))?;
            }

            // Write row heights
            for (row_idx, height) in &sheet_data.row_heights {
                // Convert pixels back to points
                let points = height / 1.333;
                worksheet.set_row_height(*row_idx, points)
                    .map_err(|e| JsError::new(&e.to_string()))?;
            }

            // Write hidden rows
            for row_idx in &sheet_data.hidden_rows {
                worksheet.set_row_hidden(*row_idx)
                    .map_err(|e| JsError::new(&e.to_string()))?;
            }

            // Note: rust_xlsxwriter 0.80 does not expose group_rows/group_columns APIs.
            // Outline group metadata is stored in the model for in-app rendering only.

            // Write conditional formatting rules
            for cf_rule in &sheet_data.conditional_formats {
                write_conditional_format(worksheet, cf_rule)
                    .map_err(|e| JsError::new(&e.to_string()))?;
            }

            // Write data validation rules
            for dv_rule in &sheet_data.data_validations {
                write_data_validation(worksheet, dv_rule)
                    .map_err(|e| JsError::new(&e.to_string()))?;
            }

            // Write hyperlinks — write_url() is the sole writer for hyperlink cells
            for link in &sheet_data.hyperlinks {
                if let Err(e) = write_hyperlink(worksheet, link, sheet_data) {
                    log(&format!("[xlsx-writer] hyperlink write error for {}: {}", link.cell_ref, e));
                }
            }

            // Charts are NOT written via rust_xlsxwriter (its Chart API produces
            // invalid OOXML in the WASM target). Instead we post-process the ZIP
            // with inject_chart_files() below.

            // Write page setup settings
            if let Some(ps) = &sheet_data.page_setup {
                write_page_setup(worksheet, ps);
            }
        }

        // Write defined names (named ranges)
        for dn in &model.defined_names {
            // Skip _xlnm built-in names — page setup handles Print_Area and Print_Titles
            if dn.hidden || dn.name.starts_with("_xlnm.") {
                continue;
            }
            write_defined_name(&mut workbook, dn, &model);
        }

        let base_buf = workbook.save_to_buffer().map_err(|e| JsError::new(&e.to_string()))?;

        // Collect charts by sheet for OOXML injection
        let charts_by_sheet: Vec<(String, Vec<ChartDefinition>)> = model.sheets.iter()
            .filter(|s| !s.charts.is_empty())
            .map(|s| (s.name.clone(), s.charts.clone()))
            .collect();

        // Inject pivot table config as custom JSON part
        let mid_buf = if !model.pivot_tables.is_empty() {
            inject_pivot_tables_json(&base_buf, &model.pivot_tables)
                .unwrap_or(base_buf)
        } else {
            base_buf
        };

        if charts_by_sheet.is_empty() {
            return Ok(mid_buf);
        }

        for (sheet_name, charts) in &charts_by_sheet {
            log(&format!("[Rust Writer] Sheet '{}': {} chart(s)", sheet_name, charts.len()));
            for (i, chart) in charts.iter().enumerate() {
                let series_info: Vec<String> = chart.series.iter().map(|s| {
                    format!("vals_ref={:?} cats_ref={:?} vals_cache_len={} cats_cache_len={}",
                        s.values_ref, s.categories_ref, s.values_cache.len(), s.categories_cache.len())
                }).collect();
                log(&format!("[Rust Writer]   Chart {}: type={}, title={:?}, anchor=({},{})→({},{}), series=[{}]",
                    i, chart.chart_type, chart.title,
                    chart.anchor.from_col, chart.anchor.from_row,
                    chart.anchor.to_col, chart.anchor.to_row,
                    series_info.join("; ")));
            }
        }

        let result = inject_chart_files(&mid_buf, &charts_by_sheet)
            .map_err(|e| JsError::new(&e))?;

        Ok(result)
    }
}

/// Write a defined name (named range) to the workbook.
fn write_defined_name(workbook: &mut Workbook, dn: &DefinedNameDef, model: &WorkbookModel) {

    // Build the full name string. For sheet-scoped names, rust_xlsxwriter
    // requires the prefix "SheetName!Name".
    let name_str = if let Some(sheet_id) = dn.local_sheet_id {
        if let Some(sheet) = model.sheets.get(sheet_id as usize) {
            let sheet_name = &sheet.name;
            if sheet_name.contains(' ') || sheet_name.contains('\'') {
                format!("'{}'!{}", sheet_name.replace('\'', "''"), dn.name)
            } else {
                format!("{}!{}", sheet_name, dn.name)
            }
        } else {
            dn.name.clone()
        }
    } else {
        dn.name.clone()
    };

    // rust_xlsxwriter expects the formula with a leading '='
    let formula = if dn.formula.starts_with('=') {
        dn.formula.clone()
    } else {
        format!("={}", dn.formula)
    };

    let _ = workbook.define_name(&name_str, &formula);
}

/// Parse a hex color string like "#RRGGBB" to rust_xlsxwriter Color
fn parse_hex_color(hex: &str) -> Option<rust_xlsxwriter::Color> {
    let hex = hex.trim_start_matches('#');
    if hex.len() == 6 {
        let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
        let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
        let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
        Some(rust_xlsxwriter::Color::RGB(
            ((r as u32) << 16) | ((g as u32) << 8) | (b as u32)
        ))
    } else {
        None
    }
}

/// Map a totals function name string to rust_xlsxwriter::TableFunction
fn parse_totals_function(name: &str) -> Option<TableFunction> {
    match name.to_lowercase().as_str() {
        "sum" => Some(TableFunction::Sum),
        "average" => Some(TableFunction::Average),
        "count" => Some(TableFunction::Count),
        "countnums" | "count_nums" => Some(TableFunction::CountNumbers),
        "min" => Some(TableFunction::Min),
        "max" => Some(TableFunction::Max),
        "stddev" | "std_dev" => Some(TableFunction::StdDev),
        "var" => Some(TableFunction::Var),
        _ => None,
    }
}

/// Parse sqref string like "A1:D10" into (first_row, first_col, last_row, last_col)
fn parse_sqref_to_coords(sqref: &str) -> Option<(u32, u16, u32, u16)> {
    // Take first range if multiple (e.g., "A1:D10 F1:G5")
    let first_range = sqref.split_whitespace().next().unwrap_or(sqref);
    let parts: Vec<&str> = first_range.split(':').collect();
    if parts.len() == 2 {
        let (r1, c1) = parse_cf_cell_ref(parts[0]);
        let (r2, c2) = parse_cf_cell_ref(parts[1]);
        Some((r1, c1 as u16, r2, c2 as u16))
    } else if parts.len() == 1 {
        let (r, c) = parse_cf_cell_ref(parts[0]);
        Some((r, c as u16, r, c as u16))
    } else {
        None
    }
}

/// Parse a cell reference like "B3" into (row, col) — 0-indexed
fn parse_cf_cell_ref(cell_ref: &str) -> (u32, u32) {
    let cell_ref = cell_ref.replace('$', "");
    let mut col: u32 = 0;
    let mut row: u32 = 0;
    let mut in_digits = false;
    for ch in cell_ref.chars() {
        if ch.is_ascii_alphabetic() && !in_digits {
            col = col * 26 + (ch.to_ascii_uppercase() as u32 - 'A' as u32 + 1);
        } else if ch.is_ascii_digit() {
            in_digits = true;
            row = row * 10 + ch.to_digit(10).unwrap();
        }
    }
    (row.saturating_sub(1), col.saturating_sub(1))
}

fn cell_in_any_table(row: u32, col: u32, tables: &[TableDefinition]) -> bool {
    tables.iter().any(|t| {
        row >= t.range.start_row
            && row <= t.range.end_row
            && col >= t.range.start_col
            && col <= t.range.end_col
    })
}

fn cell_style_to_format(cs: &CellStyle) -> Format {
    let mut f = Format::new();
    if cs.bold == Some(true) {
        f = f.set_bold();
    }
    if cs.italic == Some(true) {
        f = f.set_italic();
    }
    if cs.underline == Some(true) {
        f = f.set_underline(rust_xlsxwriter::FormatUnderline::Single);
    }
    if let Some(sz) = cs.font_size {
        f = f.set_font_size(sz);
    }
    if let Some(ref name) = cs.font_family {
        f = f.set_font_name(name);
    }
    if let Some(ref color) = cs.text_color {
        if let Some(c) = parse_hex_color(color) {
            f = f.set_font_color(c);
        }
    }
    if let Some(ref color) = cs.fill_color {
        if let Some(c) = parse_hex_color(color) {
            f = f.set_background_color(c);
            f = f.set_pattern(rust_xlsxwriter::FormatPattern::Solid);
        }
    }
    if let Some(ref align) = cs.alignment {
        f = match align.as_str() {
            "center" => f.set_align(rust_xlsxwriter::FormatAlign::Center),
            "right" => f.set_align(rust_xlsxwriter::FormatAlign::Right),
            _ => f.set_align(rust_xlsxwriter::FormatAlign::Left),
        };
    }
    if cs.wrap_text == Some(true) {
        f = f.set_text_wrap();
    }
    if let Some(ref nf) = cs.number_format {
        f = f.set_num_format(nf);
    }
    f
}

fn write_cell_to_worksheet(
    worksheet: &mut rust_xlsxwriter::Worksheet,
    row_idx: u32,
    col_u16: u16,
    cell_data: &CellData,
) -> Result<(), rust_xlsxwriter::XlsxError> {
    let fmt = cell_data.style.as_ref().map(cell_style_to_format);
    match cell_data.data_type.as_str() {
        "f" => {
            let formula = if cell_data.value.starts_with('=') {
                cell_data.value.clone()
            } else {
                format!("={}", cell_data.value)
            };
            let mut fx = Formula::new(&formula);
            if let Some(ref result) = cell_data.formula_result {
                fx = fx.set_result(result);
            }
            if let Some(ref f) = fmt {
                worksheet.write_formula_with_format(row_idx, col_u16, fx, f)?;
            } else {
                worksheet.write_formula(row_idx, col_u16, fx)?;
            }
        }
        "n" => {
            if let Ok(num) = cell_data.value.parse::<f64>() {
                if let Some(ref f) = fmt {
                    worksheet.write_number_with_format(row_idx, col_u16, num, f)?;
                } else {
                    worksheet.write_number(row_idx, col_u16, num)?;
                }
            } else if let Some(ref f) = fmt {
                worksheet.write_string_with_format(row_idx, col_u16, &cell_data.value, f)?;
            } else {
                worksheet.write_string(row_idx, col_u16, &cell_data.value)?;
            }
        }
        "b" => {
            let bool_val = cell_data.value == "true";
            if let Some(ref f) = fmt {
                worksheet.write_boolean_with_format(row_idx, col_u16, bool_val, f)?;
            } else {
                worksheet.write_boolean(row_idx, col_u16, bool_val)?;
            }
        }
        _ => {
            if let Some(ref f) = fmt {
                worksheet.write_string_with_format(row_idx, col_u16, &cell_data.value, f)?;
            } else {
                worksheet.write_string(row_idx, col_u16, &cell_data.value)?;
            }
        }
    }
    Ok(())
}

/// Write a single data validation rule to the worksheet.
fn write_data_validation(
    worksheet: &mut rust_xlsxwriter::Worksheet,
    rule: &DataValidationDef,
) -> Result<(), rust_xlsxwriter::XlsxError> {
    let coords = match parse_sqref_to_coords(&rule.sqref) {
        Some(c) => c,
        None => return Ok(()),
    };
    let (r1, c1, r2, c2) = coords;

    let mut dv = DataValidation::new();

    match rule.validation_type.as_str() {
        "whole" => {
            let op = rule.operator.as_deref().unwrap_or("between");
            let v1: i32 = rule.formula1.as_deref().unwrap_or("0").parse().unwrap_or(0);
            let v2: i32 = rule.formula2.as_deref().unwrap_or("0").parse().unwrap_or(0);
            let dv_rule = match op {
                "between"             => DataValidationRule::Between(v1, v2),
                "notBetween"          => DataValidationRule::NotBetween(v1, v2),
                "equal"               => DataValidationRule::EqualTo(v1),
                "notEqual"            => DataValidationRule::NotEqualTo(v1),
                "greaterThan"         => DataValidationRule::GreaterThan(v1),
                "lessThan"            => DataValidationRule::LessThan(v1),
                "greaterThanOrEqual"  => DataValidationRule::GreaterThanOrEqualTo(v1),
                "lessThanOrEqual"     => DataValidationRule::LessThanOrEqualTo(v1),
                _                     => DataValidationRule::Between(v1, v2),
            };
            dv = dv.allow_whole_number(dv_rule);
        }
        "decimal" => {
            let op = rule.operator.as_deref().unwrap_or("between");
            let v1: f64 = rule.formula1.as_deref().unwrap_or("0").parse().unwrap_or(0.0);
            let v2: f64 = rule.formula2.as_deref().unwrap_or("0").parse().unwrap_or(0.0);
            let dv_rule = match op {
                "between"             => DataValidationRule::Between(v1, v2),
                "notBetween"          => DataValidationRule::NotBetween(v1, v2),
                "equal"               => DataValidationRule::EqualTo(v1),
                "notEqual"            => DataValidationRule::NotEqualTo(v1),
                "greaterThan"         => DataValidationRule::GreaterThan(v1),
                "lessThan"            => DataValidationRule::LessThan(v1),
                "greaterThanOrEqual"  => DataValidationRule::GreaterThanOrEqualTo(v1),
                "lessThanOrEqual"     => DataValidationRule::LessThanOrEqualTo(v1),
                _                     => DataValidationRule::Between(v1, v2),
            };
            dv = dv.allow_decimal_number(dv_rule);
        }
        "list" => {
            if let Some(ref f1) = rule.formula1 {
                // Cell range reference (starts with "=") or a quoted formula
                if f1.starts_with('=') || f1.contains('!') || f1.contains(':') {
                    dv = dv.allow_list_formula(Formula::new(f1));
                } else {
                    // Comma-separated inline list — split on comma, handling quoted items
                    let items: Vec<&str> = f1.split(',').map(|s| s.trim().trim_matches('"')).collect();
                    // allow_list_strings can return an error if list is too long; skip silently if so
                    if let Ok(dv2) = dv.allow_list_strings(&items) {
                        dv = dv2;
                    } else {
                        // Fallback: use as formula
                        dv = DataValidation::new().allow_list_formula(Formula::new(f1));
                    }
                }
            }
            dv = dv.show_dropdown(rule.show_dropdown);
        }
        "date" => {
            let op = rule.operator.as_deref().unwrap_or("between");
            let f1 = rule.formula1.as_deref().unwrap_or("0");
            let f2 = rule.formula2.as_deref().unwrap_or("0");
            // Use formula-based date validation (avoids ExcelDateTime parsing complexity)
            let dv_rule = match op {
                "between"            => DataValidationRule::Between(Formula::new(f1), Formula::new(f2)),
                "notBetween"         => DataValidationRule::NotBetween(Formula::new(f1), Formula::new(f2)),
                "equal"              => DataValidationRule::EqualTo(Formula::new(f1)),
                "notEqual"           => DataValidationRule::NotEqualTo(Formula::new(f1)),
                "greaterThan"        => DataValidationRule::GreaterThan(Formula::new(f1)),
                "lessThan"           => DataValidationRule::LessThan(Formula::new(f1)),
                "greaterThanOrEqual" => DataValidationRule::GreaterThanOrEqualTo(Formula::new(f1)),
                "lessThanOrEqual"    => DataValidationRule::LessThanOrEqualTo(Formula::new(f1)),
                _                    => DataValidationRule::Between(Formula::new(f1), Formula::new(f2)),
            };
            dv = dv.allow_date_formula(dv_rule);
        }
        "time" => {
            let op = rule.operator.as_deref().unwrap_or("between");
            let f1 = rule.formula1.as_deref().unwrap_or("0");
            let f2 = rule.formula2.as_deref().unwrap_or("0");
            let dv_rule = match op {
                "between"            => DataValidationRule::Between(Formula::new(f1), Formula::new(f2)),
                "notBetween"         => DataValidationRule::NotBetween(Formula::new(f1), Formula::new(f2)),
                "equal"              => DataValidationRule::EqualTo(Formula::new(f1)),
                "notEqual"           => DataValidationRule::NotEqualTo(Formula::new(f1)),
                "greaterThan"        => DataValidationRule::GreaterThan(Formula::new(f1)),
                "lessThan"           => DataValidationRule::LessThan(Formula::new(f1)),
                "greaterThanOrEqual" => DataValidationRule::GreaterThanOrEqualTo(Formula::new(f1)),
                "lessThanOrEqual"    => DataValidationRule::LessThanOrEqualTo(Formula::new(f1)),
                _                    => DataValidationRule::Between(Formula::new(f1), Formula::new(f2)),
            };
            dv = dv.allow_time_formula(dv_rule);
        }
        "textLength" => {
            let op = rule.operator.as_deref().unwrap_or("between");
            let v1: u32 = rule.formula1.as_deref().unwrap_or("0").parse().unwrap_or(0);
            let v2: u32 = rule.formula2.as_deref().unwrap_or("0").parse().unwrap_or(0);
            let dv_rule = match op {
                "between"             => DataValidationRule::Between(v1, v2),
                "notBetween"          => DataValidationRule::NotBetween(v1, v2),
                "equal"               => DataValidationRule::EqualTo(v1),
                "notEqual"            => DataValidationRule::NotEqualTo(v1),
                "greaterThan"         => DataValidationRule::GreaterThan(v1),
                "lessThan"            => DataValidationRule::LessThan(v1),
                "greaterThanOrEqual"  => DataValidationRule::GreaterThanOrEqualTo(v1),
                "lessThanOrEqual"     => DataValidationRule::LessThanOrEqualTo(v1),
                _                     => DataValidationRule::Between(v1, v2),
            };
            dv = dv.allow_text_length(dv_rule);
        }
        "custom" => {
            if let Some(ref f1) = rule.formula1 {
                dv = dv.allow_custom(Formula::new(f1));
            } else {
                return Ok(());
            }
        }
        "any" | "" => {
            dv = dv.allow_any_value();
        }
        _ => return Ok(()),
    }

    // Input message — pre-truncate to Excel's limits so set_* never returns Err
    if let Some(ref t) = rule.input_title {
        let truncated: String = t.chars().take(32).collect();
        dv = dv.set_input_title(&truncated).unwrap_or_else(|_| DataValidation::new());
    }
    if let Some(ref m) = rule.input_message {
        let truncated: String = m.chars().take(255).collect();
        dv = dv.set_input_message(&truncated).unwrap_or_else(|_| DataValidation::new());
    }
    dv = dv.show_input_message(rule.show_input_message);

    // Error alert — pre-truncate to Excel's limits
    if let Some(ref t) = rule.error_title {
        let truncated: String = t.chars().take(32).collect();
        dv = dv.set_error_title(&truncated).unwrap_or_else(|_| DataValidation::new());
    }
    if let Some(ref m) = rule.error_message {
        let truncated: String = m.chars().take(255).collect();
        dv = dv.set_error_message(&truncated).unwrap_or_else(|_| DataValidation::new());
    }
    dv = dv.show_error_message(rule.show_error_message);

    match rule.error_style.as_str() {
        "warning"     => { dv = dv.set_error_style(DataValidationErrorStyle::Warning); }
        "information" => { dv = dv.set_error_style(DataValidationErrorStyle::Information); }
        _             => { dv = dv.set_error_style(DataValidationErrorStyle::Stop); }
    }

    dv = dv.ignore_blank(rule.allow_blank);

    worksheet.add_data_validation(r1, c1, r2, c2, &dv)?;
    Ok(())
}

/// Write a single hyperlink to the worksheet.
fn write_hyperlink(
    worksheet: &mut rust_xlsxwriter::Worksheet,
    link: &HyperlinkDef,
    sheet_data: &crate::parser::SheetData,
) -> Result<(), rust_xlsxwriter::XlsxError> {
    let (row, col) = parse_cf_cell_ref(&link.cell_ref);
    let mut url = Url::new(&link.url);
    if let Some(ref tip) = link.tooltip {
        let truncated: String = tip.chars().take(255).collect();
        url = url.set_tip(&truncated);
    }
    // Determine display text: explicit display > cell model value > URL
    let display_text = link.display.clone().or_else(|| {
        sheet_data.cells.get(&row)
            .and_then(|row_map| row_map.get(&col))
            .map(|cell| cell.value.clone())
            .filter(|v| !v.is_empty())
    });
    if let Some(ref text) = display_text {
        let truncated: String = text.chars().take(255).collect();
        url = url.set_text(&truncated);
    }
    worksheet.write_url(row, col as u16, &url)?;
    Ok(())
}

/// Build a Format from a DxfStyle for conditional formatting
fn build_dxf_format(rule: &ConditionalFormatRule) -> Option<Format> {
    let dxf = rule.dxf_style.as_ref()?;
    let mut f = Format::new();
    let mut has_any = false;
    if dxf.bold == Some(true) { f = f.set_bold(); has_any = true; }
    if dxf.italic == Some(true) { f = f.set_italic(); has_any = true; }
    if dxf.underline == Some(true) { f = f.set_underline(rust_xlsxwriter::FormatUnderline::Single); has_any = true; }
    if let Some(ref color) = dxf.text_color {
        if let Some(c) = parse_hex_color(color) { f = f.set_font_color(c); has_any = true; }
    }
    if let Some(ref color) = dxf.fill_color {
        if let Some(c) = parse_hex_color(color) {
            f = f.set_background_color(c);
            f = f.set_pattern(rust_xlsxwriter::FormatPattern::Solid);
            has_any = true;
        }
    }
    if has_any { Some(f) } else { None }
}

/// Write a single conditional format rule to the worksheet
fn write_conditional_format(
    worksheet: &mut rust_xlsxwriter::Worksheet,
    rule: &ConditionalFormatRule,
) -> Result<(), rust_xlsxwriter::XlsxError> {
    let coords = match parse_sqref_to_coords(&rule.sqref) {
        Some(c) => c,
        None => return Ok(()),
    };
    let (r1, c1, r2, c2) = coords;

    match rule.rule_type.as_str() {
        "cellIs" => {
            let op = rule.operator.as_deref().unwrap_or("greaterThan");
            let val1 = rule.values.first().map(|v| v.as_str()).unwrap_or("0");
            let val2 = rule.values.get(1).map(|v| v.as_str()).unwrap_or("0");
            let n1: f64 = val1.parse().unwrap_or(0.0);
            let n2: f64 = val2.parse().unwrap_or(0.0);

            let cell_rule = match op {
                "greaterThan" => ConditionalFormatCellRule::GreaterThan(n1),
                "greaterThanOrEqual" => ConditionalFormatCellRule::GreaterThanOrEqualTo(n1),
                "lessThan" => ConditionalFormatCellRule::LessThan(n1),
                "lessThanOrEqual" => ConditionalFormatCellRule::LessThanOrEqualTo(n1),
                "equal" => ConditionalFormatCellRule::EqualTo(n1),
                "notEqual" => ConditionalFormatCellRule::NotEqualTo(n1),
                "between" => ConditionalFormatCellRule::Between(n1, n2),
                "notBetween" => ConditionalFormatCellRule::NotBetween(n1, n2),
                _ => ConditionalFormatCellRule::GreaterThan(n1),
            };

            let mut cf = ConditionalFormatCell::new().set_rule(cell_rule);
            if let Some(fmt) = build_dxf_format(rule) {
                cf = cf.set_format(fmt);
            }
            worksheet.add_conditional_format(r1, c1, r2, c2, &cf)?;
        }
        "expression" => {
            if let Some(formula) = rule.values.first() {
                let mut cf = ConditionalFormatFormula::new().set_rule(formula.as_str());
                if let Some(fmt) = build_dxf_format(rule) {
                    cf = cf.set_format(fmt);
                }
                worksheet.add_conditional_format(r1, c1, r2, c2, &cf)?;
            }
        }
        "top10" => {
            let rank_val = rule.rank.unwrap_or(10) as u16;
            let is_bottom = rule.bottom == Some(true);
            let is_percent = rule.percent == Some(true);

            let top_rule = if is_bottom {
                if is_percent { ConditionalFormatTopRule::BottomPercent(rank_val) }
                else { ConditionalFormatTopRule::Bottom(rank_val) }
            } else {
                if is_percent { ConditionalFormatTopRule::TopPercent(rank_val) }
                else { ConditionalFormatTopRule::Top(rank_val) }
            };

            let mut cf = ConditionalFormatTop::new().set_rule(top_rule);
            if let Some(fmt) = build_dxf_format(rule) {
                cf = cf.set_format(fmt);
            }
            worksheet.add_conditional_format(r1, c1, r2, c2, &cf)?;
        }
        "aboveAverage" => {
            let is_above = rule.above_average.unwrap_or(true);
            let avg_rule = if is_above {
                ConditionalFormatAverageRule::AboveAverage
            } else {
                ConditionalFormatAverageRule::BelowAverage
            };

            let mut cf = ConditionalFormatAverage::new().set_rule(avg_rule);
            if let Some(fmt) = build_dxf_format(rule) {
                cf = cf.set_format(fmt);
            }
            worksheet.add_conditional_format(r1, c1, r2, c2, &cf)?;
        }
        "containsText" | "notContainsText" | "beginsWith" | "endsWith" => {
            let text_val = rule.text.as_deref()
                .or_else(|| rule.values.first().map(|s| s.as_str()))
                .unwrap_or("");
            let text_rule = match rule.rule_type.as_str() {
                "containsText" => ConditionalFormatTextRule::Contains(text_val.to_string()),
                "notContainsText" => ConditionalFormatTextRule::DoesNotContain(text_val.to_string()),
                "beginsWith" => ConditionalFormatTextRule::BeginsWith(text_val.to_string()),
                "endsWith" => ConditionalFormatTextRule::EndsWith(text_val.to_string()),
                _ => ConditionalFormatTextRule::Contains(text_val.to_string()),
            };

            let mut cf = ConditionalFormatText::new().set_rule(text_rule);
            if let Some(fmt) = build_dxf_format(rule) {
                cf = cf.set_format(fmt);
            }
            worksheet.add_conditional_format(r1, c1, r2, c2, &cf)?;
        }
        "duplicateValues" => {
            let mut cf = ConditionalFormatDuplicate::new();
            if let Some(fmt) = build_dxf_format(rule) {
                cf = cf.set_format(fmt);
            }
            worksheet.add_conditional_format(r1, c1, r2, c2, &cf)?;
        }
        "uniqueValues" => {
            let mut cf = ConditionalFormatDuplicate::new().invert();
            if let Some(fmt) = build_dxf_format(rule) {
                cf = cf.set_format(fmt);
            }
            worksheet.add_conditional_format(r1, c1, r2, c2, &cf)?;
        }
        "colorScale" => {
            if let Some(ref cs) = rule.color_scale {
                if cs.colors.len() == 2 {
                    let mut cf = ConditionalFormat2ColorScale::new();
                    let c0 = cs.colors[0].trim_start_matches('#');
                    let c1_color = cs.colors[1].trim_start_matches('#');
                    cf = cf.set_minimum_color(c0);
                    cf = cf.set_maximum_color(c1_color);
                    worksheet.add_conditional_format(r1, c1, r2, c2, &cf)?;
                } else if cs.colors.len() >= 3 {
                    let mut cf = ConditionalFormat3ColorScale::new();
                    let c0 = cs.colors[0].trim_start_matches('#');
                    let c1_color = cs.colors[1].trim_start_matches('#');
                    let c2_color = cs.colors[2].trim_start_matches('#');
                    cf = cf.set_minimum_color(c0);
                    cf = cf.set_midpoint_color(c1_color);
                    cf = cf.set_maximum_color(c2_color);
                    worksheet.add_conditional_format(r1, c1, r2, c2, &cf)?;
                }
            }
        }
        "dataBar" => {
            let mut cf = ConditionalFormatDataBar::new();
            if let Some(ref db) = rule.data_bar {
                let color = db.color.trim_start_matches('#');
                cf = cf.set_fill_color(color);
            }
            worksheet.add_conditional_format(r1, c1, r2, c2, &cf)?;
        }
        "iconSet" => {
            let mut cf = ConditionalFormatIconSet::new();
            if let Some(ref is) = rule.icon_set {
                let icon_type = match is.icon_style.as_str() {
                    "3Arrows" => ConditionalFormatIconType::ThreeArrows,
                    "3ArrowsGray" => ConditionalFormatIconType::ThreeArrowsGray,
                    "3Flags" => ConditionalFormatIconType::ThreeFlags,
                    "3TrafficLights1" | "3TrafficLights" => ConditionalFormatIconType::ThreeTrafficLights,
                    "3TrafficLights2" => ConditionalFormatIconType::ThreeTrafficLightsWithRim,
                    "3Signs" => ConditionalFormatIconType::ThreeSigns,
                    "3Symbols" => ConditionalFormatIconType::ThreeSymbolsCircled,
                    "3Symbols2" => ConditionalFormatIconType::ThreeSymbolsCircled,
                    "3Stars" => ConditionalFormatIconType::ThreeStars,
                    "3Triangles" => ConditionalFormatIconType::ThreeTriangles,
                    "4Arrows" => ConditionalFormatIconType::FourArrows,
                    "4ArrowsGray" => ConditionalFormatIconType::FourArrowsGray,
                    "4RedToBlack" => ConditionalFormatIconType::FourRedToBlack,
                    "4Rating" => ConditionalFormatIconType::FourHistograms,
                    "4TrafficLights" => ConditionalFormatIconType::FourTrafficLights,
                    "5Arrows" => ConditionalFormatIconType::FiveArrows,
                    "5ArrowsGray" => ConditionalFormatIconType::FiveArrowsGray,
                    "5Rating" => ConditionalFormatIconType::FiveHistograms,
                    "5Quarters" => ConditionalFormatIconType::FiveQuadrants,
                    _ => ConditionalFormatIconType::ThreeTrafficLights,
                };
                cf = cf.set_icon_type(icon_type);
                if is.reverse { cf = cf.reverse_icons(true); }
            }
            worksheet.add_conditional_format(r1, c1, r2, c2, &cf)?;
        }
        "containsBlanks" => {
            let first_cell = format_cell_ref(r1, c1 as u32);
            let formula = format!("=LEN(TRIM({}))=0", first_cell);
            let mut cf = ConditionalFormatFormula::new().set_rule(formula.as_str());
            if let Some(fmt) = build_dxf_format(rule) {
                cf = cf.set_format(fmt);
            }
            worksheet.add_conditional_format(r1, c1, r2, c2, &cf)?;
        }
        "notContainsBlanks" => {
            let first_cell = format_cell_ref(r1, c1 as u32);
            let formula = format!("=LEN(TRIM({}))>0", first_cell);
            let mut cf = ConditionalFormatFormula::new().set_rule(formula.as_str());
            if let Some(fmt) = build_dxf_format(rule) {
                cf = cf.set_format(fmt);
            }
            worksheet.add_conditional_format(r1, c1, r2, c2, &cf)?;
        }
        _ => {
            // Unknown rule type — skip
        }
    }
    Ok(())
}

/// Format a (row, col) pair as an Excel cell reference like "A1" (1-indexed)
fn format_cell_ref(row: u32, col: u32) -> String {
    let mut col_str = String::new();
    let mut c = col;
    loop {
        col_str.insert(0, (b'A' + (c % 26) as u8) as char);
        if c < 26 { break; }
        c = c / 26 - 1;
    }
    format!("{}{}", col_str, row + 1)
}

/// Map a table style name string to rust_xlsxwriter::TableStyle
fn parse_table_style(name: &str) -> Option<TableStyle> {
    match name {
        "TableStyleLight1" => Some(TableStyle::Light1),
        "TableStyleLight2" => Some(TableStyle::Light2),
        "TableStyleLight3" => Some(TableStyle::Light3),
        "TableStyleLight4" => Some(TableStyle::Light4),
        "TableStyleLight5" => Some(TableStyle::Light5),
        "TableStyleLight6" => Some(TableStyle::Light6),
        "TableStyleLight7" => Some(TableStyle::Light7),
        "TableStyleLight8" => Some(TableStyle::Light8),
        "TableStyleLight9" => Some(TableStyle::Light9),
        "TableStyleLight10" => Some(TableStyle::Light10),
        "TableStyleLight11" => Some(TableStyle::Light11),
        "TableStyleLight12" => Some(TableStyle::Light12),
        "TableStyleLight13" => Some(TableStyle::Light13),
        "TableStyleLight14" => Some(TableStyle::Light14),
        "TableStyleMedium1" => Some(TableStyle::Medium1),
        "TableStyleMedium2" => Some(TableStyle::Medium2),
        "TableStyleMedium3" => Some(TableStyle::Medium3),
        "TableStyleMedium4" => Some(TableStyle::Medium4),
        "TableStyleMedium5" => Some(TableStyle::Medium5),
        "TableStyleMedium6" => Some(TableStyle::Medium6),
        "TableStyleMedium7" => Some(TableStyle::Medium7),
        "TableStyleMedium8" => Some(TableStyle::Medium8),
        "TableStyleMedium9" => Some(TableStyle::Medium9),
        "TableStyleMedium10" => Some(TableStyle::Medium10),
        "TableStyleMedium11" => Some(TableStyle::Medium11),
        "TableStyleMedium12" => Some(TableStyle::Medium12),
        "TableStyleMedium13" => Some(TableStyle::Medium13),
        "TableStyleMedium14" => Some(TableStyle::Medium14),
        "TableStyleDark1" => Some(TableStyle::Dark1),
        "TableStyleDark2" => Some(TableStyle::Dark2),
        "TableStyleDark3" => Some(TableStyle::Dark3),
        "TableStyleDark4" => Some(TableStyle::Dark4),
        "TableStyleDark5" => Some(TableStyle::Dark5),
        "TableStyleDark6" => Some(TableStyle::Dark6),
        "TableStyleDark7" => Some(TableStyle::Dark7),
        "TableStyleDark8" => Some(TableStyle::Dark8),
        "TableStyleDark9" => Some(TableStyle::Dark9),
        "TableStyleDark10" => Some(TableStyle::Dark10),
        "TableStyleDark11" => Some(TableStyle::Dark11),
        _ => None,
    }
}

// =============================================================================
// OOXML Chart XML Generators
// =============================================================================

/// Convert a plain cell ref like "A1" to OOXML absolute form "$A$1"
fn to_abs_ref(s: &str) -> String {
    let s = s.trim_start_matches('$');
    let col_end = s.chars().take_while(|c| c.is_ascii_alphabetic()).count();
    if col_end == 0 { return s.to_string(); }
    format!("${}${}", &s[..col_end], &s[col_end..])
}

/// Convert a range reference like "Sheet1!A1:D10" or "A1:D10" to OOXML formula
/// format "'Sheet1'!$A$1:$D$10".
fn to_ooxml_range(range: &str, default_sheet: &str) -> String {
    let (sheet, cell_range) = if let Some(pos) = range.find('!') {
        let sh = range[..pos].trim_matches('\'');
        (sh.to_string(), &range[pos + 1..])
    } else {
        (default_sheet.to_string(), range)
    };
    let cell_range = cell_range.replace('$', "");
    let parts: Vec<&str> = cell_range.split(':').collect();
    let from = to_abs_ref(parts[0]);
    let to = if parts.len() > 1 { to_abs_ref(parts[1]) } else { from.clone() };
    format!("'{}'!{}:{}", sheet, from, to)
}

fn generate_chart_xml(chart_def: &ChartDefinition, sheet_name: &str) -> String {
    let ns_c = "http://schemas.openxmlformats.org/drawingml/2006/chart";
    let ns_a = "http://schemas.openxmlformats.org/drawingml/2006/main";
    let ns_r = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

    let mut body = String::new();

    // Title
    if let Some(ref title) = chart_def.title {
        body.push_str(&format!(
            r#"<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>{}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>"#,
            xml_escape(title)
        ));
    } else {
        body.push_str(r#"<c:autoTitleDeleted val="1"/>"#);
    }

    // Plot area
    body.push_str("<c:plotArea><c:layout/>");

    let (chart_elem, extra_attrs) = match chart_def.chart_type.as_str() {
        "bar"      => ("c:barChart", r#"<c:barDir val="bar"/><c:grouping val="clustered"/>"#),
        "line"     => ("c:lineChart", r#"<c:grouping val="standard"/>"#),
        "pie"      => ("c:pieChart", ""),
        "doughnut" => ("c:doughnutChart", ""),
        "scatter"  => ("c:scatterChart", r#"<c:scatterStyle val="lineMarker"/>"#),
        "area"     => ("c:areaChart", r#"<c:grouping val="standard"/>"#),
        "radar"    => ("c:radarChart", r#"<c:radarStyle val="marker"/>"#),
        _          => ("c:barChart", r#"<c:barDir val="col"/><c:grouping val="clustered"/>"#),
    };

    let is_pie = matches!(chart_def.chart_type.as_str(), "pie" | "doughnut");
    let is_scatter = chart_def.chart_type.as_str() == "scatter";

    body.push_str(&format!("<{}>{}<c:varyColors val=\"0\"/>", chart_elem, extra_attrs));

    for (si, series) in chart_def.series.iter().enumerate() {
        body.push_str(&format!(r#"<c:ser><c:idx val="{}"/><c:order val="{}"/>"#, si, si));

        if let Some(ref name) = series.name {
            body.push_str(&format!(
                r#"<c:tx><c:v>{}</c:v></c:tx>"#,
                xml_escape(name)
            ));
        }

        // Categories
        if !is_scatter {
            if let Some(ref cats_ref) = series.categories_ref {
                let formula = to_ooxml_range(cats_ref, sheet_name);
                let cache = build_str_cache(&series.categories_cache);
                body.push_str(&format!(
                    r#"<c:cat><c:strRef><c:f>{}</c:f>{}</c:strRef></c:cat>"#,
                    xml_escape(&formula), cache
                ));
            } else if !series.categories_cache.is_empty() {
                let lit = build_str_lit(&series.categories_cache);
                body.push_str(&format!(r#"<c:cat>{}</c:cat>"#, lit));
            }
        }

        // Values
        if let Some(ref vals_ref) = series.values_ref {
            let formula = to_ooxml_range(vals_ref, sheet_name);
            let cache = build_num_cache(&series.values_cache);
            if is_scatter {
                body.push_str(&format!(
                    r#"<c:yVal><c:numRef><c:f>{}</c:f>{}</c:numRef></c:yVal>"#,
                    xml_escape(&formula), cache
                ));
            } else {
                body.push_str(&format!(
                    r#"<c:val><c:numRef><c:f>{}</c:f>{}</c:numRef></c:val>"#,
                    xml_escape(&formula), cache
                ));
            }
        } else if !series.values_cache.is_empty() {
            let lit = build_num_lit(&series.values_cache);
            if is_scatter {
                body.push_str(&format!(r#"<c:yVal>{}</c:yVal>"#, lit));
            } else {
                body.push_str(&format!(r#"<c:val>{}</c:val>"#, lit));
            }
        }

        body.push_str("</c:ser>");
    }

    // Axis references (not for pie/doughnut)
    if !is_pie {
        body.push_str(r#"<c:axId val="111111111"/><c:axId val="222222222"/>"#);
    }

    body.push_str(&format!("</{}>", chart_elem));

    // Axes
    if !is_pie {
        if is_scatter {
            body.push_str(concat!(
                r#"<c:valAx><c:axId val="111111111"/><c:scaling><c:orientation val="minMax"/></c:scaling>"#,
                r#"<c:delete val="0"/><c:axPos val="b"/><c:crossAx val="222222222"/><c:crosses val="autoZero"/></c:valAx>"#,
                r#"<c:valAx><c:axId val="222222222"/><c:scaling><c:orientation val="minMax"/></c:scaling>"#,
                r#"<c:delete val="0"/><c:axPos val="l"/><c:crossAx val="111111111"/><c:crosses val="autoZero"/></c:valAx>"#
            ));
        } else {
            body.push_str(concat!(
                r#"<c:catAx><c:axId val="111111111"/><c:scaling><c:orientation val="minMax"/></c:scaling>"#,
                r#"<c:delete val="0"/><c:axPos val="b"/><c:crossAx val="222222222"/><c:crosses val="autoZero"/>"#,
                r#"<c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx>"#,
                r#"<c:valAx><c:axId val="222222222"/><c:scaling><c:orientation val="minMax"/></c:scaling>"#,
                r#"<c:delete val="0"/><c:axPos val="l"/><c:crossAx val="111111111"/><c:crosses val="autoZero"/></c:valAx>"#
            ));
        }
    }

    body.push_str("</c:plotArea>");

    // Legend
    let show_legend = chart_def.legend.as_ref().map(|l| l.visible).unwrap_or(true);
    if show_legend {
        let pos = chart_def.legend.as_ref().map(|l| l.position.as_str()).unwrap_or("r");
        let ooxml_pos = match pos { "bottom" => "b", "top" => "t", "left" => "l", _ => "r" };
        body.push_str(&format!(r#"<c:legend><c:legendPos val="{}"/><c:overlay val="0"/></c:legend>"#, ooxml_pos));
    }

    body.push_str(r#"<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/>"#);

    format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="{ns_c}" xmlns:a="{ns_a}" xmlns:r="{ns_r}">
<c:chart>{body}</c:chart>
<c:printSettings><c:headerFooter/><c:pageMargins b="0.75" l="0.7" r="0.7" t="0.75" header="0.3" footer="0.3"/><c:pageSetup/></c:printSettings>
</c:chartSpace>"#,
        ns_c = ns_c, ns_a = ns_a, ns_r = ns_r, body = body
    )
}

fn build_str_cache(values: &[String]) -> String {
    let mut s = format!(r#"<c:strCache><c:ptCount val="{}"/>"#, values.len());
    for (i, v) in values.iter().enumerate() {
        s.push_str(&format!(r#"<c:pt idx="{}"><c:v>{}</c:v></c:pt>"#, i, xml_escape(v)));
    }
    s.push_str("</c:strCache>");
    s
}

fn build_str_lit(values: &[String]) -> String {
    let mut s = format!(r#"<c:strLit><c:ptCount val="{}"/>"#, values.len());
    for (i, v) in values.iter().enumerate() {
        s.push_str(&format!(r#"<c:pt idx="{}"><c:v>{}</c:v></c:pt>"#, i, xml_escape(v)));
    }
    s.push_str("</c:strLit>");
    s
}

fn build_num_cache(values: &[f64]) -> String {
    let mut s = format!(
        r#"<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="{}"/>"#,
        values.len()
    );
    for (i, v) in values.iter().enumerate() {
        s.push_str(&format!(r#"<c:pt idx="{}"><c:v>{}</c:v></c:pt>"#, i, v));
    }
    s.push_str("</c:numCache>");
    s
}

fn build_num_lit(values: &[f64]) -> String {
    let mut s = format!(
        r#"<c:numLit><c:formatCode>General</c:formatCode><c:ptCount val="{}"/>"#,
        values.len()
    );
    for (i, v) in values.iter().enumerate() {
        s.push_str(&format!(r#"<c:pt idx="{}"><c:v>{}</c:v></c:pt>"#, i, v));
    }
    s.push_str("</c:numLit>");
    s
}

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
     .replace('<', "&lt;")
     .replace('>', "&gt;")
     .replace('"', "&quot;")
}

/// Generate xl/drawings/drawingN.xml — positions all charts for one sheet.
fn generate_drawing_xml(charts: &[(usize, &ChartDefinition)]) -> String {
    let ns_xdr = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";
    let ns_a   = "http://schemas.openxmlformats.org/drawingml/2006/main";
    let ns_r   = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

    let mut anchors = String::new();
    for (idx, chart_def) in charts {
        let rid = idx + 1;
        let a = &chart_def.anchor;
        anchors.push_str(&format!(
            r#"<xdr:twoCellAnchor>
<xdr:from><xdr:col>{fc}</xdr:col><xdr:colOff>{fco}</xdr:colOff><xdr:row>{fr}</xdr:row><xdr:rowOff>{fro}</xdr:rowOff></xdr:from>
<xdr:to><xdr:col>{tc}</xdr:col><xdr:colOff>{tco}</xdr:colOff><xdr:row>{tr}</xdr:row><xdr:rowOff>{tro}</xdr:rowOff></xdr:to>
<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr>
<xdr:cNvPr id="{id}" name="Chart {id}"/>
<xdr:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></xdr:cNvGraphicFramePr>
</xdr:nvGraphicFramePr>
<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId{rid}"/>
</a:graphicData></a:graphic>
</xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>
"#,
            fc = a.from_col, fco = a.from_col_off,
            fr = a.from_row, fro = a.from_row_off,
            tc = a.to_col,   tco = a.to_col_off,
            tr = a.to_row,   tro = a.to_row_off,
            id = idx + 2,
            rid = rid,
        ));
    }

    format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="{xdr}" xmlns:a="{a}" xmlns:r="{r}">
{anchors}</xdr:wsDr>"#,
        xdr = ns_xdr, a = ns_a, r = ns_r, anchors = anchors
    )
}

/// Generate a generic OOXML Relationships XML.
fn generate_rels_xml(entries: &[(&str, &str, &str)]) -> String {
    let mut rels = String::new();
    for (id, type_uri, target) in entries {
        rels.push_str(&format!(
            r#"<Relationship Id="{}" Type="{}" Target="{}"/>"#,
            id, type_uri, target
        ));
    }
    format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
{}</Relationships>"#,
        rels
    )
}

// =============================================================================
// Helper Functions
// =============================================================================

/// Scan existing rels file content and find the next available rId number
fn find_next_rid(existing: &[(String, zip::CompressionMethod, Vec<u8>)], rels_path: &str) -> usize {
    let data = existing.iter()
        .find(|(n, _, _)| n == rels_path)
        .map(|(_, _, d)| d.clone());
    let mut max_rid = 0usize;
    if let Some(data) = data {
        let content = String::from_utf8_lossy(&data);
        for part in content.split("Id=\"rId") {
            if let Some(end) = part.find('"') {
                if let Ok(n) = part[..end].parse::<usize>() {
                    if n > max_rid { max_rid = n; }
                }
            }
        }
    }
    max_rid + 1
}

/// Convert xl/worksheets/sheetN.xml -> xl/worksheets/_rels/sheetN.xml.rels
fn sheet_xml_to_rels(sheet_xml: &str) -> String {
    if let Some(pos) = sheet_xml.rfind('/') {
        let dir = &sheet_xml[..pos];
        let file = &sheet_xml[pos + 1..];
        format!("{}/_rels/{}.rels", dir, file)
    } else {
        format!("_rels/{}.rels", sheet_xml)
    }
}

/// Check if a zip archive contained a specific file
fn archive_had_file(xlsx_bytes: &[u8], name: &str) -> bool {
    use std::io::Cursor;
    let reader = Cursor::new(xlsx_bytes);
    let archive = match zip::ZipArchive::new(reader) {
        Ok(a) => a,
        Err(_) => return false,
    };
    let found = archive.file_names().any(|n| n == name);
    found
}

/// Parse xl/workbook.xml from the zip entries to build a map of
/// sheet display name -> xl/worksheets/sheetN.xml path.
fn parse_sheet_name_to_xml(entries: &[(String, zip::CompressionMethod, Vec<u8>)]) -> Vec<(String, String)> {
    let mut result = Vec::new();

    let workbook_data = entries.iter()
        .find(|(n, _, _)| n == "xl/workbook.xml")
        .map(|(_, _, d)| d.clone());

    let workbook_data = match workbook_data {
        Some(d) => d,
        None => return result,
    };

    let workbook_rels_data = entries.iter()
        .find(|(n, _, _)| n == "xl/_rels/workbook.xml.rels")
        .map(|(_, _, d)| d.clone());

    let workbook_rels_data = match workbook_rels_data {
        Some(d) => d,
        None => return result,
    };

    let workbook_str = String::from_utf8_lossy(&workbook_data);
    let mut sheet_pairs: Vec<(String, String)> = Vec::new();
    for part in workbook_str.split("<sheet ") {
        let name = extract_xml_attr(part, "name");
        let rid = extract_xml_attr(part, "r:id");
        if let (Some(n), Some(r)) = (name, rid) {
            sheet_pairs.push((n, r));
        }
    }

    let rels_str = String::from_utf8_lossy(&workbook_rels_data);
    let mut rid_to_target: Vec<(String, String)> = Vec::new();
    for part in rels_str.split("<Relationship ") {
        let id = extract_xml_attr(part, "Id");
        let target = extract_xml_attr(part, "Target");
        if let (Some(i), Some(t)) = (id, target) {
            rid_to_target.push((i, t));
        }
    }

    for (sheet_name, rid) in sheet_pairs {
        if let Some((_, target)) = rid_to_target.iter().find(|(i, _)| *i == rid) {
            let full_path = if target.starts_with('/') {
                target.trim_start_matches('/').to_string()
            } else {
                format!("xl/{}", target)
            };
            result.push((sheet_name, full_path));
        }
    }

    result
}

/// Extract a simple XML attribute value from a fragment of XML text.
fn extract_xml_attr(xml_fragment: &str, attr: &str) -> Option<String> {
    let search = format!("{}=\"", attr);
    if let Some(start) = xml_fragment.find(&search) {
        let after = &xml_fragment[start + search.len()..];
        if let Some(end) = after.find('"') {
            return Some(after[..end].to_string());
        }
    }
    let search2 = format!("{}='", attr);
    if let Some(start) = xml_fragment.find(&search2) {
        let after = &xml_fragment[start + search2.len()..];
        if let Some(end) = after.find('\'') {
            return Some(after[..end].to_string());
        }
    }
    None
}

// =============================================================================
// XLSX ZIP Injection
// =============================================================================

/// Inject pivot table config JSON into the XLSX zip as xl/voidPivotTables.json.
fn inject_pivot_tables_json(xlsx_bytes: &[u8], pivot_tables: &[PivotTableDef]) -> Result<Vec<u8>, String> {
    use std::io::{Read, Write, Cursor};
    use zip::write::SimpleFileOptions;

    let json = serde_json::to_vec(pivot_tables)
        .map_err(|e| format!("pivot tables JSON error: {e}"))?;

    let reader = Cursor::new(xlsx_bytes);
    let mut archive = zip::ZipArchive::new(reader)
        .map_err(|e| format!("zip open error: {e}"))?;

    let mut out_buf: Vec<u8> = Vec::with_capacity(xlsx_bytes.len() + json.len() + 256);
    {
        let cursor = Cursor::new(&mut out_buf);
        let mut writer = zip::ZipWriter::new(cursor);
        let opts = SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        // Copy all existing entries (skip old voidPivotTables.json if present)
        for i in 0..archive.len() {
            let mut entry = archive.by_index(i)
                .map_err(|e| format!("zip entry error: {e}"))?;
            if entry.name() == "xl/voidPivotTables.json" {
                continue;
            }
            let entry_opts = SimpleFileOptions::default()
                .compression_method(entry.compression());
            writer.start_file(entry.name().to_owned(), entry_opts)
                .map_err(|e| format!("zip write start error: {e}"))?;
            let mut buf = Vec::new();
            entry.read_to_end(&mut buf)
                .map_err(|e| format!("zip read error: {e}"))?;
            writer.write_all(&buf)
                .map_err(|e| format!("zip write error: {e}"))?;
        }

        // Add the new pivot tables JSON
        writer.start_file("xl/voidPivotTables.json", opts)
            .map_err(|e| format!("zip add pivot json error: {e}"))?;
        writer.write_all(&json)
            .map_err(|e| format!("zip write pivot json error: {e}"))?;

        writer.finish().map_err(|e| format!("zip finish error: {e}"))?;
    }

    Ok(out_buf)
}

// =============================================================================

/// Post-process an XLSX ZIP to inject proper OOXML chart files.
/// Also stores xl/voidCharts.json as a sidecar for our viewer's metadata.
fn inject_chart_files(
    xlsx_bytes: &[u8],
    charts_by_sheet: &[(String, Vec<ChartDefinition>)],
) -> Result<Vec<u8>, String> {
    use std::io::{Cursor, Read, Write};

    struct SheetChartInfo {
        sheet_name: String,
        drawing_idx: usize,
        chart_start: usize,
        charts: Vec<ChartDefinition>,
    }

    let mut sheet_infos: Vec<SheetChartInfo> = Vec::new();
    let mut global_chart_idx = 1usize;
    for (di, (sheet_name, charts)) in charts_by_sheet.iter().enumerate() {
        sheet_infos.push(SheetChartInfo {
            sheet_name: sheet_name.clone(),
            drawing_idx: di + 1,
            chart_start: global_chart_idx,
            charts: charts.clone(),
        });
        global_chart_idx += charts.len();
    }

    // Read all existing zip entries
    let reader = Cursor::new(xlsx_bytes);
    let mut archive = zip::ZipArchive::new(reader)
        .map_err(|e| format!("Failed to read XLSX zip: {}", e))?;

    let mut existing: Vec<(String, zip::CompressionMethod, Vec<u8>)> = Vec::new();
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)
            .map_err(|e| format!("zip entry {}: {}", i, e))?;
        let name = entry.name().to_string();
        let method = entry.compression();
        let mut data = Vec::new();
        entry.read_to_end(&mut data).map_err(|e| format!("read {}: {}", name, e))?;
        existing.push((name, method, data));
    }

    // Log all files in the base archive for debugging
    let file_list: Vec<&str> = existing.iter().map(|(n, _, _)| n.as_str()).collect();
    log(&format!("[Rust Writer] Base archive files: {:?}", file_list));

    let sheet_name_to_xml = parse_sheet_name_to_xml(&existing);
    log(&format!("[Rust Writer] Sheet name -> XML mapping: {:?}", sheet_name_to_xml));

    let mut new_files: Vec<(String, Vec<u8>)> = Vec::new();
    let mut content_type_overrides: Vec<(String, String)> = Vec::new();
    let mut sheet_drawing_patches: Vec<(String, String, String)> = Vec::new();

    for info in &sheet_infos {
        let drawing_name = format!("xl/drawings/drawing{}.xml", info.drawing_idx);
        let drawing_rels_name = format!("xl/drawings/_rels/drawing{}.xml.rels", info.drawing_idx);

        let chart_refs: Vec<(usize, &ChartDefinition)> = info.charts.iter()
            .enumerate()
            .map(|(i, c)| (i, c))
            .collect();
        let drawing_xml = generate_drawing_xml(&chart_refs);
        new_files.push((drawing_name.clone(), drawing_xml.into_bytes()));
        content_type_overrides.push((
            format!("/{}", drawing_name),
            "application/vnd.openxmlformats-officedocument.drawing+xml".to_string(),
        ));

        // Drawing rels: one entry per chart
        let mut drawing_rel_entries: Vec<(String, String, String)> = Vec::new();
        for (i, _chart) in info.charts.iter().enumerate() {
            let chart_idx = info.chart_start + i;
            let chart_name = format!("../charts/chart{}.xml", chart_idx);
            let chart_type = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart";
            drawing_rel_entries.push((
                format!("rId{}", i + 1),
                chart_type.to_string(),
                chart_name,
            ));
        }
        let rels_entries: Vec<(&str, &str, &str)> = drawing_rel_entries.iter()
            .map(|(a, b, c)| (a.as_str(), b.as_str(), c.as_str()))
            .collect();
        let drawing_rels_xml = generate_rels_xml(&rels_entries);
        new_files.push((drawing_rels_name.clone(), drawing_rels_xml.into_bytes()));

        // Generate each chart XML
        for (i, chart_def) in info.charts.iter().enumerate() {
            let chart_idx = info.chart_start + i;
            let chart_path = format!("xl/charts/chart{}.xml", chart_idx);
            let chart_xml = generate_chart_xml(chart_def, &info.sheet_name);
            let preview = if chart_xml.len() > 500 { &chart_xml[..500] } else { &chart_xml };
            log(&format!("[Rust Writer] Generated {}: {}...", chart_path, preview));
            new_files.push((chart_path.clone(), chart_xml.into_bytes()));
            content_type_overrides.push((
                format!("/{}", chart_path),
                "application/vnd.openxmlformats-officedocument.drawingml.chart+xml".to_string(),
            ));
        }

        // Determine which sheet XML to patch
        let sheet_xml_name = sheet_name_to_xml
            .iter()
            .find(|(name, _)| *name == info.sheet_name)
            .map(|(_, xml)| xml.clone())
            .unwrap_or_else(|| format!("xl/worksheets/sheet{}.xml", info.drawing_idx));

        // Find next available rId by scanning existing rels
        let sheet_rels_path = sheet_xml_to_rels(&sheet_xml_name);
        let next_rid = find_next_rid(&existing, &sheet_rels_path);
        let drawing_rel_id = format!("rId{}", next_rid);

        log(&format!("[Rust Writer] Sheet '{}' -> XML: {}, rels: {}, drawing rId: {}",
            info.sheet_name, sheet_xml_name, sheet_rels_path, drawing_rel_id));

        sheet_drawing_patches.push((sheet_xml_name.clone(), drawing_name.clone(), drawing_rel_id));
    }

    // Serialize voidCharts.json sidecar
    let charts_json = serde_json::to_string(charts_by_sheet)
        .map_err(|e| format!("json: {}", e))?;
    content_type_overrides.push((
        "/xl/voidCharts.json".to_string(),
        "application/json".to_string(),
    ));

    // --- Write output zip ---
    let mut out_buf = Vec::new();
    {
        let cursor = Cursor::new(&mut out_buf);
        let mut zip_writer = zip::ZipWriter::new(cursor);

        let new_file_names: std::collections::HashSet<&str> =
            new_files.iter().map(|(n, _)| n.as_str()).collect();

        for (name, method, mut data) in existing {
            if new_file_names.contains(name.as_str()) { continue; }
            if name == "xl/voidCharts.json" { continue; }

            // Patch [Content_Types].xml
            if name == "[Content_Types].xml" {
                let content = String::from_utf8_lossy(&data).to_string();
                let mut patched = content;
                for (part_name, ct) in &content_type_overrides {
                    if !patched.contains(part_name.as_str()) {
                        let entry = format!(
                            r#"<Override PartName="{}" ContentType="{}"/>"#,
                            part_name, ct
                        );
                        patched = patched.replace("</Types>", &format!("{}</Types>", entry));
                    }
                }
                data = patched.into_bytes();
            }

            // Patch worksheet XML to add <drawing r:id="..."/>
            // OOXML schema: <drawing> is element #30, must come before elements #31-#38.
            for (sheet_xml, _drawing_path, rid) in &sheet_drawing_patches {
                if name == *sheet_xml {
                    let content = String::from_utf8_lossy(&data).to_string();
                    if !content.contains("<drawing") {
                        let drawing_elem = format!(r#"<drawing r:id="{}"/>"#, rid);
                        let insert_before = [
                            "<legacyDrawing", "<legacyDrawingHF", "<picture",
                            "<oleObjects", "<controls", "<webPublishItems",
                            "<tableParts", "<extLst", "</worksheet>",
                        ];
                        let mut patched = content.clone();
                        for tag in &insert_before {
                            if content.contains(tag) {
                                patched = content.replace(tag, &format!("{}{}", drawing_elem, tag));
                                break;
                            }
                        }
                        log(&format!("[Rust Writer] Patched {} with {}", name, drawing_elem));
                        data = patched.into_bytes();
                    } else {
                        log(&format!("[Rust Writer] {} already has <drawing>, skipping", name));
                    }
                }

                // Patch the sheet's _rels file
                let sheet_rels = sheet_xml_to_rels(sheet_xml);
                if name == sheet_rels {
                    let content = String::from_utf8_lossy(&data).to_string();
                    log(&format!("[Rust Writer] Found existing rels {}: {}", name, &content[..content.len().min(200)]));
                    let drawing_file = _drawing_path.trim_start_matches("xl/drawings/");
                    if !content.contains(drawing_file) {
                        let rel_type = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing";
                        let target = format!("../drawings/{}", drawing_file);
                        let rel_entry = format!(
                            r#"<Relationship Id="{}" Type="{}" Target="{}"/>"#,
                            rid, rel_type, target
                        );
                        let patched = content.replace("</Relationships>", &format!("{}</Relationships>", rel_entry));
                        data = patched.into_bytes();
                    }
                }
            }

            let options = zip::write::SimpleFileOptions::default()
                .compression_method(method);
            zip_writer.start_file(&name, options)
                .map_err(|e| format!("start_file {}: {}", name, e))?;
            zip_writer.write_all(&data)
                .map_err(|e| format!("write {}: {}", name, e))?;
        }

        // Write new chart/drawing files
        for (name, data) in &new_files {
            let options = zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Deflated);
            zip_writer.start_file(name, options)
                .map_err(|e| format!("start_file {}: {}", name, e))?;
            zip_writer.write_all(data)
                .map_err(|e| format!("write {}: {}", name, e))?;
        }

        // Write voidCharts.json
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);
        zip_writer.start_file("xl/voidCharts.json", options)
            .map_err(|e| format!("start_file voidCharts.json: {}", e))?;
        zip_writer.write_all(charts_json.as_bytes())
            .map_err(|e| format!("write voidCharts.json: {}", e))?;

        // Create rels files for sheets that don't have one yet
        for (sheet_xml, drawing_path, rid) in &sheet_drawing_patches {
            let sheet_rels = sheet_xml_to_rels(sheet_xml);
            let in_new = new_file_names.contains(sheet_rels.as_str());
            let in_archive = archive_had_file(xlsx_bytes, &sheet_rels);
            log(&format!("[Rust Writer] Checking rels {}: in_new={}, in_archive={}", sheet_rels, in_new, in_archive));
            let exists = in_new || in_archive;
            if !exists {
                let rel_type = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing";
                let drawing_file = drawing_path.trim_start_matches("xl/drawings/");
                let target = format!("../drawings/{}", drawing_file);
                let rels_xml = generate_rels_xml(&[(rid.as_str(), rel_type, target.as_str())]);
                log(&format!("[Rust Writer] Creating new rels file {}: {}", sheet_rels, rels_xml));
                let options = zip::write::SimpleFileOptions::default()
                    .compression_method(zip::CompressionMethod::Deflated);
                zip_writer.start_file(&sheet_rels, options)
                    .map_err(|e| format!("start_file {}: {}", sheet_rels, e))?;
                zip_writer.write_all(rels_xml.as_bytes())
                    .map_err(|e| format!("write {}: {}", sheet_rels, e))?;
            }
        }

        zip_writer.finish().map_err(|e| format!("finish zip: {}", e))?;
    }

    // Log all files we added
    let new_file_list: Vec<&str> = new_files.iter().map(|(n, _)| n.as_str()).collect();
    log(&format!("[Rust Writer] New files added: {:?}", new_file_list));
    log(&format!("[Rust Writer] Chart injection complete, output {} bytes", out_buf.len()));

    Ok(out_buf)
}

/// Apply page setup settings to a rust_xlsxwriter worksheet.
fn write_page_setup(worksheet: &mut rust_xlsxwriter::Worksheet, ps: &PageSetupDef) {
    // Orientation
    if ps.orientation == "landscape" {
        let _ = worksheet.set_landscape();
    } else {
        let _ = worksheet.set_portrait();
    }

    // Paper size (only if non-zero; 0 means unset)
    if ps.paper_size > 0 {
        let _ = worksheet.set_paper_size(ps.paper_size.into());
    }

    // Scale vs Fit-to-pages (mutually exclusive; fit-to takes priority if set)
    if ps.fit_to_width.is_some() || ps.fit_to_height.is_some() {
        let w = ps.fit_to_width.unwrap_or(1);
        let h = ps.fit_to_height.unwrap_or(1);
        let _ = worksheet.set_print_fit_to_pages(w, h);
    } else if ps.scale != 100 && ps.scale > 0 {
        let _ = worksheet.set_print_scale(ps.scale);
    }

    // Margins: set_margins(left, right, top, bottom, header, footer)
    let _ = worksheet.set_margins(
        ps.margin_left,
        ps.margin_right,
        ps.margin_top,
        ps.margin_bottom,
        ps.margin_header,
        ps.margin_footer,
    );

    // Header / Footer
    if !ps.header.is_empty() {
        let _ = worksheet.set_header(&ps.header);
    }
    if !ps.footer.is_empty() {
        let _ = worksheet.set_footer(&ps.footer);
    }

    // Gridlines
    if ps.print_gridlines {
        let _ = worksheet.set_print_gridlines(true);
    }

    // Centering
    if ps.center_horizontally {
        let _ = worksheet.set_print_center_horizontally(true);
    }
    if ps.center_vertically {
        let _ = worksheet.set_print_center_vertically(true);
    }

    // Print area
    if !ps.print_area.is_empty() {
        if let Some((r1, c1, r2, c2)) = parse_range_to_rc(&ps.print_area) {
            let _ = worksheet.set_print_area(r1, c1, r2, c2);
        }
    }

    // Repeat rows (print titles)
    if !ps.print_titles_rows.is_empty() {
        if let Some((r1, r2)) = parse_row_range(&ps.print_titles_rows) {
            let _ = worksheet.set_repeat_rows(r1, r2);
        }
    }

    // Repeat columns (print titles)
    if !ps.print_titles_cols.is_empty() {
        if let Some((c1, c2)) = parse_col_range(&ps.print_titles_cols) {
            let _ = worksheet.set_repeat_columns(c1, c2);
        }
    }

    // Manual row page breaks
    if !ps.row_breaks.is_empty() {
        let breaks: Vec<u32> = ps.row_breaks.clone();
        let _ = worksheet.set_page_breaks(&breaks);
    }
}

/// Parse a cell range like "A1:H50" into (first_row, first_col, last_row, last_col) 0-based.
fn parse_range_to_rc(range: &str) -> Option<(u32, u16, u32, u16)> {
    let parts: Vec<&str> = range.split(':').collect();
    if parts.len() != 2 { return None; }
    let (r1, c1) = parse_cell_ref_rc(parts[0])?;
    let (r2, c2) = parse_cell_ref_rc(parts[1])?;
    Some((r1, c1, r2, c2))
}

fn parse_cell_ref_rc(cell: &str) -> Option<(u32, u16)> {
    let col_str: String = cell.chars().take_while(|c| c.is_alphabetic()).collect();
    let row_str: String = cell.chars().skip_while(|c| c.is_alphabetic()).collect();
    let col = col_letters_to_idx(&col_str)?;
    let row: u32 = row_str.parse::<u32>().ok()?.saturating_sub(1);
    Some((row, col as u16))
}

fn col_letters_to_idx(s: &str) -> Option<u32> {
    if s.is_empty() { return None; }
    let mut idx = 0u32;
    for c in s.chars() {
        let d = (c as u32).checked_sub('A' as u32)? + 1;
        idx = idx * 26 + d;
    }
    Some(idx.saturating_sub(1))
}

/// Parse a row range like "1:3" into 0-based (first_row, last_row).
fn parse_row_range(s: &str) -> Option<(u32, u32)> {
    let parts: Vec<&str> = s.split(':').collect();
    if parts.len() != 2 { return None; }
    let r1: u32 = parts[0].parse::<u32>().ok()?.saturating_sub(1);
    let r2: u32 = parts[1].parse::<u32>().ok()?.saturating_sub(1);
    Some((r1, r2))
}

/// Parse a column range like "A:C" into 0-based (first_col, last_col).
fn parse_col_range(s: &str) -> Option<(u16, u16)> {
    let parts: Vec<&str> = s.split(':').collect();
    if parts.len() != 2 { return None; }
    let c1 = col_letters_to_idx(parts[0])? as u16;
    let c2 = col_letters_to_idx(parts[1])? as u16;
    Some((c1, c2))
}
