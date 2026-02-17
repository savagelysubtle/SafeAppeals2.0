use wasm_bindgen::prelude::*;
use rust_xlsxwriter::{Workbook, Format, Table, TableColumn as RxTableColumn, TableFunction, TableStyle};
use crate::parser::WorkbookModel;

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

        for sheet_data in model.sheets {
            let worksheet = workbook.add_worksheet();
            worksheet.set_name(&sheet_data.name).map_err(|e| JsError::new(&e.to_string()))?;

            for (row_idx, row_map) in &sheet_data.cells {
                for (col_idx, cell_data) in row_map {
                    let col_u16 = *col_idx as u16;

                    // Build format if cell has styles
                    let has_style = cell_data.style.is_some();
                    let fmt = if has_style {
                        let cs = cell_data.style.as_ref().unwrap();
                        let mut f = Format::new();
                        if cs.bold == Some(true) { f = f.set_bold(); }
                        if cs.italic == Some(true) { f = f.set_italic(); }
                        if cs.underline == Some(true) { f = f.set_underline(rust_xlsxwriter::FormatUnderline::Single); }
                        if let Some(sz) = cs.font_size { f = f.set_font_size(sz); }
                        if let Some(ref name) = cs.font_family { f = f.set_font_name(name); }
                        if let Some(ref color) = cs.text_color {
                            if let Some(c) = parse_hex_color(color) { f = f.set_font_color(c); }
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
                        if cs.wrap_text == Some(true) { f = f.set_text_wrap(); }
                        Some(f)
                    } else {
                        None
                    };

                    match cell_data.data_type.as_str() {
                        "n" => {
                             if let Ok(num) = cell_data.value.parse::<f64>() {
                                if let Some(ref f) = fmt {
                                    worksheet.write_number_with_format(*row_idx, col_u16, num, f).map_err(|e| JsError::new(&e.to_string()))?;
                                } else {
                                    worksheet.write_number(*row_idx, col_u16, num).map_err(|e| JsError::new(&e.to_string()))?;
                                }
                             } else if let Some(ref f) = fmt {
                                worksheet.write_string_with_format(*row_idx, col_u16, &cell_data.value, f).map_err(|e| JsError::new(&e.to_string()))?;
                             } else {
                                worksheet.write_string(*row_idx, col_u16, &cell_data.value).map_err(|e| JsError::new(&e.to_string()))?;
                             }
                        }
                        "b" => {
                            let bool_val = cell_data.value == "true";
                            if let Some(ref f) = fmt {
                                worksheet.write_boolean_with_format(*row_idx, col_u16, bool_val, f).map_err(|e| JsError::new(&e.to_string()))?;
                            } else {
                                worksheet.write_boolean(*row_idx, col_u16, bool_val).map_err(|e| JsError::new(&e.to_string()))?;
                            }
                        }
                        _ => {
                            if let Some(ref f) = fmt {
                                worksheet.write_string_with_format(*row_idx, col_u16, &cell_data.value, f).map_err(|e| JsError::new(&e.to_string()))?;
                            } else {
                                worksheet.write_string(*row_idx, col_u16, &cell_data.value).map_err(|e| JsError::new(&e.to_string()))?;
                            }
                        }
                    }
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

            // Write row heights
            for (row_idx, height) in &sheet_data.row_heights {
                // Convert pixels back to points
                let points = height / 1.333;
                worksheet.set_row_height(*row_idx, points)
                    .map_err(|e| JsError::new(&e.to_string()))?;
            }
        }

        let buf = workbook.save_to_buffer().map_err(|e| JsError::new(&e.to_string()))?;
        Ok(buf)
    }
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
