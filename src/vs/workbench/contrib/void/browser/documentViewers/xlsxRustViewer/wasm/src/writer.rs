use wasm_bindgen::prelude::*;
use rust_xlsxwriter::{
    Workbook, Format, Table, TableColumn as RxTableColumn, TableFunction, TableStyle,
    ConditionalFormatCell, ConditionalFormatCellRule,
    ConditionalFormatFormula, ConditionalFormatTop, ConditionalFormatTopRule,
    ConditionalFormatAverage, ConditionalFormatAverageRule,
    ConditionalFormatText, ConditionalFormatTextRule,
    ConditionalFormatDuplicate,
    ConditionalFormat2ColorScale, ConditionalFormat3ColorScale,
    ConditionalFormatDataBar, ConditionalFormatIconSet, ConditionalFormatIconType,
    Chart, ChartType, ChartSeries as RxChartSeries,
};
use crate::parser::{WorkbookModel, ConditionalFormatRule, ChartDefinition};

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

            // Write conditional formatting rules
            for cf_rule in &sheet_data.conditional_formats {
                write_conditional_format(worksheet, cf_rule)
                    .map_err(|e| JsError::new(&e.to_string()))?;
            }

            // Write charts
            for chart_def in &sheet_data.charts {
                write_chart(worksheet, chart_def)
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

/// Write a single chart to the worksheet using rust_xlsxwriter Chart API
fn write_chart(
    worksheet: &mut rust_xlsxwriter::Worksheet,
    chart_def: &ChartDefinition,
) -> Result<(), rust_xlsxwriter::XlsxError> {
    let chart_type = match chart_def.chart_type.as_str() {
        "bar" => ChartType::Bar,
        "column" => ChartType::Column,
        "line" => ChartType::Line,
        "pie" => ChartType::Pie,
        "doughnut" => ChartType::Doughnut,
        "scatter" => ChartType::Scatter,
        "area" => ChartType::Area,
        "radar" => ChartType::Radar,
        "stock" => ChartType::Stock,
        _ => ChartType::Column,
    };

    let mut chart = Chart::new(chart_type);

    for series_def in &chart_def.series {
        let mut series = RxChartSeries::new();
        if let Some(ref cats) = series_def.categories_ref {
            if let Some((sheet, r1, c1, r2, c2)) = parse_chart_range(cats) {
                series.set_categories((sheet.as_str(), r1, c1, r2, c2));
            }
        }
        if let Some(ref vals) = series_def.values_ref {
            if let Some((sheet, r1, c1, r2, c2)) = parse_chart_range(vals) {
                series.set_values((sheet.as_str(), r1, c1, r2, c2));
            }
        }
        if let Some(ref name) = series_def.name {
            series.set_name(name.as_str());
        }
        chart.push_series(&series);
    }

    if let Some(ref title) = chart_def.title {
        chart.title().set_name(title.as_str());
    }

    if let Some(ref legend) = chart_def.legend {
        if !legend.visible {
            chart.legend().set_hidden();
        }
    }

    worksheet.insert_chart(
        chart_def.anchor.from_row,
        chart_def.anchor.from_col as u16,
        &chart,
    )?;
    Ok(())
}

/// Parse a chart range like "Sheet1!$A$2:$B$10" into (sheet_name, first_row, first_col, last_row, last_col)
fn parse_chart_range(range: &str) -> Option<(String, u32, u16, u32, u16)> {
    let (sheet, cell_range) = if let Some(pos) = range.rfind('!') {
        let s = range[..pos].trim_matches('\'').to_string();
        (s, &range[pos + 1..])
    } else {
        (String::new(), range)
    };

    let parts: Vec<&str> = cell_range.split(':').collect();
    if parts.is_empty() { return None; }

    let (r1, c1) = parse_cf_cell_ref(parts[0]);
    let (r2, c2) = if parts.len() > 1 {
        parse_cf_cell_ref(parts[1])
    } else {
        (r1, c1)
    };

    Some((sheet, r1, c1 as u16, r2, c2 as u16))
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
