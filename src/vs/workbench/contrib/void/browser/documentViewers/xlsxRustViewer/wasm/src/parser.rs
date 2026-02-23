use wasm_bindgen::prelude::*;
use calamine::{Reader, Xlsx, Data};
use std::io::{Cursor, Read as IoRead};
use serde::{Serialize, Deserialize};
use std::collections::HashMap;

// --- Cell Data ---

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct CellStyle {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bold: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub italic: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub underline: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub font_size: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub font_family: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text_color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fill_color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alignment: Option<String>, // "left", "center", "right"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub number_format: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wrap_text: Option<bool>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CellData {
    pub value: String,
    pub data_type: String, // "s" (string), "n" (number), "b" (boolean), "e" (error), "d" (date), "null"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub style: Option<CellStyle>,
}

// --- Table Types ---

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TableRange {
    pub start_row: u32,
    pub start_col: u32,
    pub end_row: u32,
    pub end_col: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TableColumn {
    pub name: String,
    pub col_index: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub totals_function: Option<String>, // "sum", "average", "count", "min", "max", "countNums", "stdDev", "var", "custom"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub totals_label: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TableDefinition {
    pub name: String,
    pub display_name: String,
    pub range: TableRange,
    pub columns: Vec<TableColumn>,
    #[serde(default = "default_true")]
    pub has_header_row: bool,
    #[serde(default)]
    pub has_totals_row: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub style_name: Option<String>,
    #[serde(default = "default_true")]
    pub banded_rows: bool,
    #[serde(default)]
    pub banded_cols: bool,
    #[serde(default)]
    pub show_first_column: bool,
    #[serde(default)]
    pub show_last_column: bool,
    #[serde(default = "default_true")]
    pub filter_enabled: bool,
}

fn default_true() -> bool { true }

// --- Sheet and Workbook ---

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MergedCellRange {
    pub start_row: u32,
    pub start_col: u32,
    pub end_row: u32,
    pub end_col: u32,
}

// --- Conditional Formatting Types ---

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct DxfStyle {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bold: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub italic: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub underline: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text_color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fill_color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub number_format: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ColorScaleSpec {
    pub colors: Vec<String>,
    #[serde(default)]
    pub values: Vec<f64>,
    #[serde(default)]
    pub value_types: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DataBarSpec {
    pub color: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_value: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_value: Option<f64>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct IconSetSpec {
    pub icon_style: String,
    #[serde(default)]
    pub thresholds: Vec<f64>,
    #[serde(default)]
    pub reverse: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ConditionalFormatRule {
    pub rule_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operator: Option<String>,
    #[serde(default = "default_priority")]
    pub priority: u32,
    #[serde(default)]
    pub values: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dxf_id: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dxf_style: Option<DxfStyle>,
    pub sqref: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color_scale: Option<ColorScaleSpec>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data_bar: Option<DataBarSpec>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon_set: Option<IconSetSpec>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rank: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub percent: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bottom: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub above_average: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub std_dev: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
}

fn default_priority() -> u32 { 1 }

// --- Data Validation Types ---

fn default_error_style() -> String { "stop".to_string() }

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DataValidationDef {
    pub validation_type: String,   // "whole", "decimal", "list", "date", "time", "textLength", "custom", "any"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operator: Option<String>,  // "between", "notBetween", "equal", "notEqual", "greaterThan", "lessThan", "greaterThanOrEqual", "lessThanOrEqual"
    pub sqref: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub formula1: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub formula2: Option<String>,
    #[serde(default = "default_true")]
    pub allow_blank: bool,
    #[serde(default = "default_true")]
    pub show_input_message: bool,
    #[serde(default = "default_true")]
    pub show_error_message: bool,
    #[serde(default = "default_true")]
    pub show_dropdown: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
    #[serde(default = "default_error_style")]
    pub error_style: String,       // "stop", "warning", "information"
}

// --- Hyperlink Types ---

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HyperlinkDef {
    pub cell_ref: String,        // "A1" or "B3:B5"
    pub url: String,             // full URL, mailto:, or internal #Sheet!A1
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tooltip: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display: Option<String>, // explicit display text
    #[serde(default)]
    pub is_internal: bool,       // true for cross-sheet/named-range links
}

// --- Defined Name Types ---

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DefinedNameDef {
    pub name: String,
    pub formula: String,           // e.g. "Sheet1!$A$1:$C$10" or "0.96"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub local_sheet_id: Option<u32>, // None = workbook scope
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
    #[serde(default)]
    pub hidden: bool,
}

// --- Chart Types ---

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChartAnchor {
    pub from_col: u32,
    pub from_row: u32,
    #[serde(default)]
    pub from_col_off: i64,
    #[serde(default)]
    pub from_row_off: i64,
    pub to_col: u32,
    pub to_row: u32,
    #[serde(default)]
    pub to_col_off: i64,
    #[serde(default)]
    pub to_row_off: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChartSeries {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub categories_ref: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub values_ref: Option<String>,
    #[serde(default)]
    pub categories_cache: Vec<String>,
    #[serde(default)]
    pub values_cache: Vec<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chart_type: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChartAxis {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default)]
    pub position: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_val: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_val: Option<f64>,
    pub axis_type: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChartLegend {
    #[serde(default = "default_legend_position")]
    pub position: String,
    #[serde(default = "default_true")]
    pub visible: bool,
}

fn default_legend_position() -> String { "right".to_string() }

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChartStyle {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color_scheme: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChartDefinition {
    pub chart_type: String,
    #[serde(default)]
    pub series: Vec<ChartSeries>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub legend: Option<ChartLegend>,
    #[serde(default)]
    pub axes: Vec<ChartAxis>,
    pub anchor: ChartAnchor,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub style: Option<ChartStyle>,
}

// --- Sparkline Types ---

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SparklineDefinition {
    pub sparkline_type: String,
    pub data_range: String,
    pub location: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub negative_color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub axis_color: Option<String>,
    #[serde(default)]
    pub high_point: bool,
    #[serde(default)]
    pub low_point: bool,
    #[serde(default)]
    pub first_point: bool,
    #[serde(default)]
    pub last_point: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SheetData {
    pub name: String,
    pub cells: HashMap<u32, HashMap<u32, CellData>>,
    pub row_count: usize,
    pub col_count: usize,
    #[serde(default)]
    pub tables: Vec<TableDefinition>,
    #[serde(default)]
    pub merged_cells: Vec<MergedCellRange>,
    #[serde(default)]
    pub col_widths: HashMap<u32, f64>,
    #[serde(default)]
    pub row_heights: HashMap<u32, f64>,
    #[serde(default)]
    pub conditional_formats: Vec<ConditionalFormatRule>,
    #[serde(default)]
    pub data_validations: Vec<DataValidationDef>,
    #[serde(default)]
    pub hyperlinks: Vec<HyperlinkDef>,
    #[serde(default)]
    pub charts: Vec<ChartDefinition>,
    #[serde(default)]
    pub sparklines: Vec<SparklineDefinition>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WorkbookModel {
    pub sheets: Vec<SheetData>,
    #[serde(default)]
    pub defined_names: Vec<DefinedNameDef>,
}

// --- WASM Parser ---

#[wasm_bindgen]
pub struct XlsxParser {
    model: Option<WorkbookModel>,
}

#[wasm_bindgen]
impl XlsxParser {
    #[wasm_bindgen(constructor)]
    pub fn new() -> XlsxParser {
        XlsxParser { model: None }
    }

    /// Loads XLSX bytes and returns the full workbook model as JSON string.
    pub fn load(&mut self, data: &[u8]) -> Result<String, JsError> {
        let cursor = Cursor::new(data);
        let mut excel: Xlsx<_> = calamine::open_workbook_from_rs(cursor)
            .map_err(|e: calamine::XlsxError| JsError::new(&e.to_string()))?;

        let sheet_names = excel.sheet_names().to_owned();
        let mut sheets = Vec::new();

        for sheet_name in &sheet_names {
            if let Ok(range) = excel.worksheet_range(sheet_name) {
                let (row_count, col_count) = range.get_size();
                let mut cells = HashMap::new();

                for (row_idx, row) in range.rows().enumerate() {
                    let mut row_map = HashMap::new();
                    for (col_idx, cell) in row.iter().enumerate() {
                         let (value, dtype) = match cell {
                            Data::String(s) => (s.clone(), "s"),
                            Data::Float(f) => (f.to_string(), "n"),
                            Data::Int(i) => (i.to_string(), "n"),
                            Data::Bool(b) => (b.to_string(), "b"),
                            Data::Error(e) => (e.to_string(), "e"),
                            Data::Empty => (String::new(), "null"),
                            Data::DateTime(d) => (d.to_string(), "d"),
                            Data::DateTimeIso(d) => (d.clone(), "d"),
                            Data::DurationIso(d) => (d.to_string(), "d"),
                        };

                        if dtype != "null" {
                            row_map.insert(col_idx as u32, CellData {
                                value,
                                data_type: dtype.to_string(),
                                style: None,
                            });
                        }
                    }
                    if !row_map.is_empty() {
                        cells.insert(row_idx as u32, row_map);
                    }
                }

                sheets.push(SheetData {
                    name: sheet_name.clone(),
                    cells,
                    row_count,
                    col_count,
                    tables: Vec::new(),
                    merged_cells: Vec::new(),
                    col_widths: HashMap::new(),
                    row_heights: HashMap::new(),
                    conditional_formats: Vec::new(),
                    data_validations: Vec::new(),
                    hyperlinks: Vec::new(),
                    charts: Vec::new(),
                    sparklines: Vec::new(),
                });
            }
        }

        // Parse table metadata from the XLSX zip
        let table_map = parse_tables_from_zip(data);
        for sheet in &mut sheets {
            if let Some(tables) = table_map.get(&sheet.name) {
                sheet.tables = tables.clone();
            }
        }

        // Parse merged cells and column/row dimensions from the XLSX zip
        parse_sheet_metadata_from_zip(data, &mut sheets);

        // Parse cell styles from xl/styles.xml and apply to cells
        parse_cell_styles_from_zip(data, &mut sheets);

        // Parse conditional formatting rules from worksheets and dxf styles
        parse_conditional_formatting_from_zip(data, &mut sheets);

        // Parse data validation rules from worksheets
        parse_data_validations_from_zip(data, &mut sheets);

        // Parse hyperlinks from worksheet XML and relationship files
        parse_hyperlinks_from_zip(data, &mut sheets);

        // Parse charts from drawings and chart XML parts
        parse_charts_from_zip(data, &mut sheets);

        // Parse sparklines from worksheet extension lists
        parse_sparklines_from_zip(data, &mut sheets);

        // Extract custom chart definitions stored by our writer as xl/voidCharts.json
        extract_void_charts(data, &mut sheets);

        // Parse defined names (named ranges) from xl/workbook.xml
        let defined_names = parse_defined_names_from_zip(data);

        let model = WorkbookModel { sheets, defined_names };
        let json = serde_json::to_string(&model).map_err(|e| JsError::new(&e.to_string()))?;
        self.model = Some(model);

        Ok(json)
    }
}

// --- Custom Chart JSON Extraction ---

/// Extract chart definitions from our custom xl/voidCharts.json stored in the XLSX zip.
/// This is our own persistence format — not standard OOXML chart XML.
fn extract_void_charts(data: &[u8], sheets: &mut [SheetData]) {
    let cursor = Cursor::new(data);
    let mut archive = match zip::ZipArchive::new(cursor) {
        Ok(a) => a,
        Err(_) => return,
    };

    let mut json_bytes = Vec::new();
    {
        let mut entry = match archive.by_name("xl/voidCharts.json") {
            Ok(e) => e,
            Err(_) => return, // No custom chart data
        };
        use std::io::Read;
        if entry.read_to_end(&mut json_bytes).is_err() { return; }
    }

    // Deserialize: Vec<(sheet_name, Vec<ChartDefinition>)>
    let charts_by_sheet: Vec<(String, Vec<ChartDefinition>)> = match serde_json::from_slice(&json_bytes) {
        Ok(v) => v,
        Err(_) => return,
    };

    for (sheet_name, charts) in charts_by_sheet {
        if let Some(sheet) = sheets.iter_mut().find(|s| s.name == sheet_name) {
            // Only apply custom JSON charts if the sheet has no OOXML-parsed charts.
            // OOXML is the authoritative source; voidCharts.json is a fallback for
            // files saved by older versions of this viewer.
            if sheet.charts.is_empty() {
                sheet.charts = charts;
            }
        }
    }
}

// --- Table XML Parsing ---

/// Parse table definitions from xl/tables/*.xml inside the XLSX zip.
/// Returns a map of sheet_name -> Vec<TableDefinition>.
fn parse_tables_from_zip(data: &[u8]) -> HashMap<String, Vec<TableDefinition>> {
    let mut result: HashMap<String, Vec<TableDefinition>> = HashMap::new();

    let cursor = Cursor::new(data);
    let mut archive = match zip::ZipArchive::new(cursor) {
        Ok(a) => a,
        Err(_) => return result,
    };

    // Step 1: Build a mapping from table rId -> table file path from sheet rels
    // Step 2: Build a mapping from sheet index -> sheet name from workbook.xml
    // Step 3: Read each xl/tables/table*.xml and parse the table definition
    // Step 4: Map tables to sheets via xl/worksheets/_rels/sheet*.xml.rels

    // Collect sheet names from workbook.xml relationships
    // For simplicity, we map tables to sheets by reading the sheet rels files

    // First, find all table XML files and parse them into TableDefinition
    let mut table_defs_by_file: HashMap<String, TableDefinition> = HashMap::new();

    let file_names: Vec<String> = (0..archive.len())
        .filter_map(|i| archive.by_index(i).ok().map(|f| f.name().to_string()))
        .collect();

    for file_name in &file_names {
        if file_name.starts_with("xl/tables/table") && file_name.ends_with(".xml") {
            if let Ok(mut file) = archive.by_name(file_name) {
                let mut xml_content = String::new();
                if file.read_to_string(&mut xml_content).is_ok() {
                    if let Some(table_def) = parse_table_xml(&xml_content) {
                        table_defs_by_file.insert(file_name.clone(), table_def);
                    }
                }
            }
        }
    }

    if table_defs_by_file.is_empty() {
        return result;
    }

    // Now map tables to sheets via sheet relationship files
    // xl/worksheets/_rels/sheet1.xml.rels references ../tables/table1.xml
    for (sheet_idx, file_name) in file_names.iter().enumerate() {
        if file_name.starts_with("xl/worksheets/sheet") && file_name.ends_with(".xml") && !file_name.contains("_rels") {
            // Derive rels path: xl/worksheets/_rels/sheet1.xml.rels
            let base_name = file_name.trim_start_matches("xl/worksheets/");
            let rels_path = format!("xl/worksheets/_rels/{}.rels", base_name);

            if let Ok(mut rels_file) = archive.by_name(&rels_path) {
                let mut rels_content = String::new();
                if rels_file.read_to_string(&mut rels_content).is_ok() {
                    let table_refs = extract_table_refs_from_rels(&rels_content);
                    let mut sheet_tables = Vec::new();
                    for table_ref in table_refs {
                        // Resolve relative path: ../tables/table1.xml -> xl/tables/table1.xml
                        let resolved = if table_ref.starts_with("../") {
                            format!("xl/{}", table_ref.trim_start_matches("../"))
                        } else {
                            format!("xl/worksheets/{}", table_ref)
                        };
                        if let Some(table_def) = table_defs_by_file.get(&resolved) {
                            sheet_tables.push(table_def.clone());
                        }
                    }
                    if !sheet_tables.is_empty() {
                        // We need the sheet name. Parse it from the sheet index.
                        // The sheet_idx here is unreliable. Instead, let's use the file name
                        // to derive an index and look it up in the result map later.
                        // For now, store by the sheet file name and resolve after.
                        // Actually, let's read the workbook.xml to get sheet names in order.
                        // Store temporarily by file index.
                        let _ = sheet_idx; // used below
                        // We'll resolve this differently -- store by file path for now
                        result.insert(file_name.clone(), sheet_tables);
                    }
                }
            }
        }
    }

    // Now resolve file paths to sheet names via xl/workbook.xml
    let sheet_name_order = parse_sheet_name_order(&mut archive);
    let mut resolved_result: HashMap<String, Vec<TableDefinition>> = HashMap::new();

    // Sort worksheet file names to match ordering
    let mut worksheet_files: Vec<&String> = file_names.iter()
        .filter(|f| f.starts_with("xl/worksheets/sheet") && f.ends_with(".xml") && !f.contains("_rels"))
        .collect();
    worksheet_files.sort();

    for (idx, ws_file) in worksheet_files.iter().enumerate() {
        if let Some(tables) = result.get(*ws_file) {
            if let Some(sheet_name) = sheet_name_order.get(idx) {
                resolved_result.insert(sheet_name.clone(), tables.clone());
            }
        }
    }

    resolved_result
}

/// Parse sheet name ordering from xl/workbook.xml
fn parse_sheet_name_order(archive: &mut zip::ZipArchive<Cursor<&[u8]>>) -> Vec<String> {
    let mut names = Vec::new();
    if let Ok(mut file) = archive.by_name("xl/workbook.xml") {
        let mut content = String::new();
        if file.read_to_string(&mut content).is_ok() {
            // Use quick-xml to parse <sheet> elements
            let mut reader = quick_xml::Reader::from_str(&content);
            let mut buf = Vec::new();
            loop {
                match reader.read_event_into(&mut buf) {
                    Ok(quick_xml::events::Event::Empty(ref e)) | Ok(quick_xml::events::Event::Start(ref e)) => {
                        if e.name().as_ref() == b"sheet" {
                            for attr in e.attributes().flatten() {
                                if attr.key.as_ref() == b"name" {
                                    if let Ok(val) = attr.unescape_value() {
                                        names.push(val.to_string());
                                    }
                                }
                            }
                        }
                    }
                    Ok(quick_xml::events::Event::Eof) => break,
                    Err(_) => break,
                    _ => {}
                }
                buf.clear();
            }
        }
    }
    names
}

/// Parse defined names (named ranges) from xl/workbook.xml
fn parse_defined_names_from_zip(data: &[u8]) -> Vec<DefinedNameDef> {
    let cursor = Cursor::new(data);
    let mut archive = match zip::ZipArchive::new(cursor) {
        Ok(a) => a,
        Err(_) => return Vec::new(),
    };

    let mut content = String::new();
    if let Ok(mut file) = archive.by_name("xl/workbook.xml") {
        if file.read_to_string(&mut content).is_err() {
            return Vec::new();
        }
    } else {
        return Vec::new();
    }

    let mut names = Vec::new();
    let mut reader = quick_xml::Reader::from_str(&content);
    let mut buf = Vec::new();
    let mut in_defined_names = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(quick_xml::events::Event::Start(ref e)) => {
                let tag = e.name();
                let tag_str = std::str::from_utf8(tag.as_ref()).unwrap_or("");
                let local_tag = tag_str.split(':').last().unwrap_or(tag_str);
                if local_tag == "definedNames" {
                    in_defined_names = true;
                } else if in_defined_names && local_tag == "definedName" {
                    let mut name_attr = String::new();
                    let mut local_sheet_id: Option<u32> = None;
                    let mut comment: Option<String> = None;
                    let mut hidden = false;

                    for attr in e.attributes().flatten() {
                        let key = attr.key.as_ref();
                        let key_str = std::str::from_utf8(key).unwrap_or("");
                        let local_key = key_str.split(':').last().unwrap_or(key_str);
                        let val = attr.unescape_value().unwrap_or_default().to_string();
                        match local_key {
                            "name" => name_attr = val,
                            "localSheetId" => local_sheet_id = val.parse::<u32>().ok(),
                            "comment" => comment = Some(val),
                            "hidden" => hidden = val == "1" || val == "true",
                            _ => {}
                        }
                    }

                    // Read the formula text content
                    let mut formula = String::new();
                    buf.clear();
                    loop {
                        match reader.read_event_into(&mut buf) {
                            Ok(quick_xml::events::Event::Text(e)) => {
                                formula = e.unescape().unwrap_or_default().to_string();
                            }
                            Ok(quick_xml::events::Event::End(_)) => break,
                            Ok(quick_xml::events::Event::Eof) => break,
                            Err(_) => break,
                            _ => {}
                        }
                        buf.clear();
                    }

                    if !name_attr.is_empty() && !formula.is_empty() {
                        names.push(DefinedNameDef {
                            name: name_attr,
                            formula,
                            local_sheet_id,
                            comment,
                            hidden,
                        });
                    }
                    continue; // buf already cleared in inner loop
                }
            }
            Ok(quick_xml::events::Event::End(ref e)) => {
                let tag = e.name();
                let tag_str = std::str::from_utf8(tag.as_ref()).unwrap_or("");
                let local_tag = tag_str.split(':').last().unwrap_or(tag_str);
                if local_tag == "definedNames" {
                    in_defined_names = false;
                }
            }
            Ok(quick_xml::events::Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }

    names
}

/// Parse a single xl/tables/table*.xml into a TableDefinition
fn parse_table_xml(xml: &str) -> Option<TableDefinition> {
    let mut reader = quick_xml::Reader::from_str(xml);
    let mut buf = Vec::new();

    let mut name = String::new();
    let mut display_name = String::new();
    let mut range = TableRange { start_row: 0, start_col: 0, end_row: 0, end_col: 0 };
    let mut has_header_row = true;
    let mut has_totals_row = false;
    let mut style_name = None;
    let mut banded_rows = true;
    let mut banded_cols = false;
    let mut show_first_column = false;
    let mut show_last_column = false;
    let mut filter_enabled = true;
    let mut columns = Vec::new();
    let mut found_table = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(quick_xml::events::Event::Start(ref e)) | Ok(quick_xml::events::Event::Empty(ref e)) => {
                let tag_name = e.name();
                let tag = tag_name.as_ref();
                if tag == b"table" {
                    found_table = true;
                    for attr in e.attributes().flatten() {
                        let key = attr.key.as_ref();
                        let val = attr.unescape_value().unwrap_or_default().to_string();
                        match key {
                            b"name" => name = val,
                            b"displayName" => display_name = val,
                            b"ref" => range = parse_cell_range(&val),
                            b"headerRowCount" => {
                                has_header_row = val != "0";
                            }
                            b"totalsRowCount" => {
                                has_totals_row = val != "0";
                            }
                            _ => {}
                        }
                    }
                } else if tag == b"tableColumn" {
                    let mut col_name = String::new();
                    let col_idx: u32 = columns.len() as u32;
                    let mut totals_fn = None;
                    let mut totals_label = None;

                    for attr in e.attributes().flatten() {
                        let key = attr.key.as_ref();
                        let val = attr.unescape_value().unwrap_or_default().to_string();
                        match key {
                            b"name" => col_name = val,
                            b"id" => { /* id is 1-based, not the col index */ }
                            b"totalsRowFunction" => totals_fn = Some(val),
                            b"totalsRowLabel" => totals_label = Some(val),
                            _ => {}
                        }
                    }
                    columns.push(TableColumn {
                        name: col_name,
                        col_index: col_idx,
                        totals_function: totals_fn,
                        totals_label,
                    });
                } else if tag == b"tableStyleInfo" {
                    for attr in e.attributes().flatten() {
                        let key = attr.key.as_ref();
                        let val = attr.unescape_value().unwrap_or_default().to_string();
                        match key {
                            b"name" => style_name = Some(val),
                            b"showRowStripes" => banded_rows = val == "1",
                            b"showColumnStripes" => banded_cols = val == "1",
                            b"showFirstColumn" => show_first_column = val == "1",
                            b"showLastColumn" => show_last_column = val == "1",
                            _ => {}
                        }
                    }
                } else if tag == b"autoFilter" {
                    filter_enabled = true;
                }
            }
            Ok(quick_xml::events::Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }

    if !found_table {
        return None;
    }

    if display_name.is_empty() {
        display_name = name.clone();
    }

    Some(TableDefinition {
        name,
        display_name,
        range,
        columns,
        has_header_row,
        has_totals_row,
        style_name,
        banded_rows,
        banded_cols,
        show_first_column,
        show_last_column,
        filter_enabled,
    })
}

/// Parse an Excel cell range like "A1:D10" into a TableRange
fn parse_cell_range(range_str: &str) -> TableRange {
    let parts: Vec<&str> = range_str.split(':').collect();
    if parts.len() == 2 {
        let (sr, sc) = parse_cell_ref(parts[0]);
        let (er, ec) = parse_cell_ref(parts[1]);
        TableRange { start_row: sr, start_col: sc, end_row: er, end_col: ec }
    } else if parts.len() == 1 {
        let (r, c) = parse_cell_ref(parts[0]);
        TableRange { start_row: r, start_col: c, end_row: r, end_col: c }
    } else {
        TableRange { start_row: 0, start_col: 0, end_row: 0, end_col: 0 }
    }
}

/// Parse "A1" -> (row: 0, col: 0), "B3" -> (row: 2, col: 1)
fn parse_cell_ref(cell_ref: &str) -> (u32, u32) {
    let mut col: u32 = 0;
    let mut row: u32 = 0;
    let mut in_digits = false;

    for ch in cell_ref.chars() {
        if ch.is_ascii_alphabetic() && !in_digits {
            col = col * 26 + (ch.to_ascii_uppercase() as u32 - 'A' as u32 + 1);
        } else if ch.is_ascii_digit() {
            in_digits = true;
            row = row * 10 + (ch as u32 - '0' as u32);
        }
    }
    // Convert from 1-based to 0-based
    (row.saturating_sub(1), col.saturating_sub(1))
}

/// Parsed style components from xl/styles.xml
#[derive(Default, Clone, Debug)]
struct ParsedFont {
    bold: bool,
    italic: bool,
    underline: bool,
    size: Option<f64>,
    name: Option<String>,
    color: Option<String>,
}

#[derive(Default, Clone, Debug)]
struct ParsedFill {
    color: Option<String>,
}

#[derive(Default, Clone, Debug)]
struct ParsedAlignment {
    horizontal: Option<String>,
    wrap_text: bool,
}

#[derive(Default, Clone, Debug)]
struct ParsedXf {
    font_id: usize,
    fill_id: usize,
    num_fmt_id: usize,
    alignment: ParsedAlignment,
    apply_font: bool,
    apply_fill: bool,
    apply_alignment: bool,
    apply_number_format: bool,
}

/// Parse xl/styles.xml and map cell xf indices to actual style properties.
/// Then read each sheet's XML to find cell style indices (s="...") and apply to cells.
fn parse_cell_styles_from_zip(data: &[u8], sheets: &mut [SheetData]) {
    let cursor = Cursor::new(data);
    let mut archive = match zip::ZipArchive::new(cursor) {
        Ok(a) => a,
        Err(_) => return,
    };

    // Step 1: Parse xl/styles.xml
    let mut fonts: Vec<ParsedFont> = Vec::new();
    let mut fills: Vec<ParsedFill> = Vec::new();
    let mut num_fmts: HashMap<usize, String> = HashMap::new();
    let mut cell_xfs: Vec<ParsedXf> = Vec::new();

    // Built-in number formats
    let builtin_fmts: HashMap<usize, &str> = [
        (0, "General"), (1, "0"), (2, "0.00"), (3, "#,##0"), (4, "#,##0.00"),
        (9, "0%"), (10, "0.00%"), (11, "0.00E+00"), (14, "mm-dd-yy"),
        (15, "d-mmm-yy"), (16, "d-mmm"), (17, "mmm-yy"), (22, "m/d/yy h:mm"),
        (37, "#,##0 ;(#,##0)"), (38, "#,##0 ;[Red](#,##0)"),
        (39, "#,##0.00;(#,##0.00)"), (40, "#,##0.00;[Red](#,##0.00)"),
        (44, "_-\"$\"* #,##0.00_-"), (49, "@"),
    ].iter().cloned().collect();

    if let Ok(mut file) = archive.by_name("xl/styles.xml") {
        let mut content = String::new();
        if file.read_to_string(&mut content).is_ok() {
            let mut reader = quick_xml::Reader::from_str(&content);
            let mut buf = Vec::new();

            let mut in_fonts = false;
            let mut in_fills = false;
            let mut in_cell_xfs = false;
            let mut in_num_fmts = false;
            let mut current_font = ParsedFont::default();
            let mut current_fill = ParsedFill::default();
            let mut current_xf = ParsedXf::default();
            let mut in_font = false;
            let mut in_fill = false;

            loop {
                match reader.read_event_into(&mut buf) {
                    Ok(quick_xml::events::Event::Start(ref e)) => {
                        let tag = e.name();
                        let tag_ref = tag.as_ref();

                        if tag_ref == b"fonts" { in_fonts = true; }
                        else if tag_ref == b"fills" { in_fills = true; }
                        else if tag_ref == b"cellXfs" { in_cell_xfs = true; }
                        else if tag_ref == b"numFmts" { in_num_fmts = true; }
                        else if tag_ref == b"font" && in_fonts {
                            in_font = true;
                            current_font = ParsedFont::default();
                        }
                        else if tag_ref == b"fill" && in_fills {
                            in_fill = true;
                            current_fill = ParsedFill::default();
                        }
                        else if tag_ref == b"xf" && in_cell_xfs {
                            current_xf = ParsedXf::default();
                            for attr in e.attributes().flatten() {
                                let key = attr.key.as_ref();
                                let val = attr.unescape_value().unwrap_or_default().to_string();
                                match key {
                                    b"fontId" => current_xf.font_id = val.parse().unwrap_or(0),
                                    b"fillId" => current_xf.fill_id = val.parse().unwrap_or(0),
                                    b"numFmtId" => current_xf.num_fmt_id = val.parse().unwrap_or(0),
                                    b"applyFont" => current_xf.apply_font = val == "1",
                                    b"applyFill" => current_xf.apply_fill = val == "1",
                                    b"applyAlignment" => current_xf.apply_alignment = val == "1",
                                    b"applyNumberFormat" => current_xf.apply_number_format = val == "1",
                                    _ => {}
                                }
                            }
                        }
                        else if tag_ref == b"alignment" && in_cell_xfs {
                            for attr in e.attributes().flatten() {
                                let key = attr.key.as_ref();
                                let val = attr.unescape_value().unwrap_or_default().to_string();
                                match key {
                                    b"horizontal" => current_xf.alignment.horizontal = Some(val),
                                    b"wrapText" => current_xf.alignment.wrap_text = val == "1",
                                    _ => {}
                                }
                            }
                        }
                    }
                    Ok(quick_xml::events::Event::Empty(ref e)) => {
                        let tag = e.name();
                        let tag_ref = tag.as_ref();

                        if tag_ref == b"b" && in_font { current_font.bold = true; }
                        else if tag_ref == b"i" && in_font { current_font.italic = true; }
                        else if tag_ref == b"u" && in_font { current_font.underline = true; }
                        else if tag_ref == b"sz" && in_font {
                            for attr in e.attributes().flatten() {
                                if attr.key.as_ref() == b"val" {
                                    current_font.size = attr.unescape_value().ok().and_then(|v| v.parse().ok());
                                }
                            }
                        }
                        else if tag_ref == b"name" && in_font {
                            for attr in e.attributes().flatten() {
                                if attr.key.as_ref() == b"val" {
                                    current_font.name = attr.unescape_value().ok().map(|v| v.to_string());
                                }
                            }
                        }
                        else if tag_ref == b"color" && in_font {
                            for attr in e.attributes().flatten() {
                                if attr.key.as_ref() == b"rgb" {
                                    if let Ok(v) = attr.unescape_value() {
                                        let s = v.to_string();
                                        // ARGB -> #RRGGBB
                                        if s.len() == 8 {
                                            current_font.color = Some(format!("#{}", &s[2..]));
                                        } else {
                                            current_font.color = Some(format!("#{}", s));
                                        }
                                    }
                                }
                            }
                        }
                        else if tag_ref == b"fgColor" && in_fill {
                            for attr in e.attributes().flatten() {
                                if attr.key.as_ref() == b"rgb" {
                                    if let Ok(v) = attr.unescape_value() {
                                        let s = v.to_string();
                                        if s.len() == 8 {
                                            current_fill.color = Some(format!("#{}", &s[2..]));
                                        } else {
                                            current_fill.color = Some(format!("#{}", s));
                                        }
                                    }
                                }
                            }
                        }
                        else if tag_ref == b"numFmt" && in_num_fmts {
                            let mut fmt_id: usize = 0;
                            let mut fmt_code = String::new();
                            for attr in e.attributes().flatten() {
                                let key = attr.key.as_ref();
                                let val = attr.unescape_value().unwrap_or_default().to_string();
                                match key {
                                    b"numFmtId" => fmt_id = val.parse().unwrap_or(0),
                                    b"formatCode" => fmt_code = val,
                                    _ => {}
                                }
                            }
                            if !fmt_code.is_empty() {
                                num_fmts.insert(fmt_id, fmt_code);
                            }
                        }
                        else if tag_ref == b"xf" && in_cell_xfs {
                            // Self-closing <xf/> tag
                            current_xf = ParsedXf::default();
                            for attr in e.attributes().flatten() {
                                let key = attr.key.as_ref();
                                let val = attr.unescape_value().unwrap_or_default().to_string();
                                match key {
                                    b"fontId" => current_xf.font_id = val.parse().unwrap_or(0),
                                    b"fillId" => current_xf.fill_id = val.parse().unwrap_or(0),
                                    b"numFmtId" => current_xf.num_fmt_id = val.parse().unwrap_or(0),
                                    b"applyFont" => current_xf.apply_font = val == "1",
                                    b"applyFill" => current_xf.apply_fill = val == "1",
                                    b"applyAlignment" => current_xf.apply_alignment = val == "1",
                                    b"applyNumberFormat" => current_xf.apply_number_format = val == "1",
                                    _ => {}
                                }
                            }
                            cell_xfs.push(current_xf.clone());
                            current_xf = ParsedXf::default();
                        }
                        else if tag_ref == b"alignment" && in_cell_xfs {
                            for attr in e.attributes().flatten() {
                                let key = attr.key.as_ref();
                                let val = attr.unescape_value().unwrap_or_default().to_string();
                                match key {
                                    b"horizontal" => current_xf.alignment.horizontal = Some(val),
                                    b"wrapText" => current_xf.alignment.wrap_text = val == "1",
                                    _ => {}
                                }
                            }
                        }
                    }
                    Ok(quick_xml::events::Event::End(ref e)) => {
                        let tag = e.name();
                        let tag_ref = tag.as_ref();
                        if tag_ref == b"fonts" { in_fonts = false; }
                        else if tag_ref == b"fills" { in_fills = false; }
                        else if tag_ref == b"cellXfs" { in_cell_xfs = false; }
                        else if tag_ref == b"numFmts" { in_num_fmts = false; }
                        else if tag_ref == b"font" && in_font {
                            in_font = false;
                            fonts.push(current_font.clone());
                        }
                        else if tag_ref == b"fill" && in_fill {
                            in_fill = false;
                            fills.push(current_fill.clone());
                        }
                        else if tag_ref == b"xf" && in_cell_xfs {
                            cell_xfs.push(current_xf.clone());
                            current_xf = ParsedXf::default();
                        }
                    }
                    Ok(quick_xml::events::Event::Eof) => break,
                    Err(_) => break,
                    _ => {}
                }
                buf.clear();
            }
        }
    }

    if cell_xfs.is_empty() {
        return;
    }

    // Step 2: Read each sheet XML, find cell s="..." attributes, resolve to styles
    let sheet_name_order = parse_sheet_name_order(&mut archive);

    let file_names: Vec<String> = (0..archive.len())
        .filter_map(|i| archive.by_index(i).ok().map(|f| f.name().to_string()))
        .collect();

    let mut worksheet_files: Vec<&String> = file_names.iter()
        .filter(|f| f.starts_with("xl/worksheets/sheet") && f.ends_with(".xml") && !f.contains("_rels"))
        .collect();
    worksheet_files.sort();

    for (idx, ws_file) in worksheet_files.iter().enumerate() {
        let sheet_name = match sheet_name_order.get(idx) {
            Some(n) => n.clone(),
            None => continue,
        };

        let sheet = match sheets.iter_mut().find(|s| s.name == sheet_name) {
            Some(s) => s,
            None => continue,
        };

        if let Ok(mut file) = archive.by_name(ws_file) {
            let mut content = String::new();
            if file.read_to_string(&mut content).is_err() {
                continue;
            }

            let mut reader = quick_xml::Reader::from_str(&content);
            let mut buf = Vec::new();

            loop {
                match reader.read_event_into(&mut buf) {
                    Ok(quick_xml::events::Event::Start(ref e)) | Ok(quick_xml::events::Event::Empty(ref e)) => {
                        if e.name().as_ref() == b"c" {
                            let mut cell_ref_str = String::new();
                            let mut style_idx: Option<usize> = None;

                            for attr in e.attributes().flatten() {
                                let key = attr.key.as_ref();
                                let val = attr.unescape_value().unwrap_or_default().to_string();
                                match key {
                                    b"r" => cell_ref_str = val,
                                    b"s" => style_idx = val.parse().ok(),
                                    _ => {}
                                }
                            }

                            if let Some(si) = style_idx {
                                if si > 0 && si < cell_xfs.len() && !cell_ref_str.is_empty() {
                                    let (row, col) = parse_cell_ref(&cell_ref_str);
                                    let xf = &cell_xfs[si];

                                    let mut cs = CellStyle::default();
                                    let mut has_style = false;

                                    // Font
                                    if xf.font_id < fonts.len() {
                                        let font = &fonts[xf.font_id];
                                        if font.bold { cs.bold = Some(true); has_style = true; }
                                        if font.italic { cs.italic = Some(true); has_style = true; }
                                        if font.underline { cs.underline = Some(true); has_style = true; }
                                        if let Some(sz) = font.size {
                                            if (sz - 11.0).abs() > 0.1 { cs.font_size = Some(sz); has_style = true; }
                                        }
                                        if let Some(ref name) = font.name {
                                            cs.font_family = Some(name.clone()); has_style = true;
                                        }
                                        if let Some(ref color) = font.color {
                                            if color != "#000000" { cs.text_color = Some(color.clone()); has_style = true; }
                                        }
                                    }

                                    // Fill
                                    if xf.fill_id < fills.len() && xf.fill_id >= 2 {
                                        // fill_id 0 = none, 1 = gray125 (default), 2+ = actual fills
                                        let fill = &fills[xf.fill_id];
                                        if let Some(ref color) = fill.color {
                                            cs.fill_color = Some(color.clone()); has_style = true;
                                        }
                                    }

                                    // Alignment
                                    if let Some(ref h) = xf.alignment.horizontal {
                                        cs.alignment = Some(h.clone()); has_style = true;
                                    }
                                    if xf.alignment.wrap_text {
                                        cs.wrap_text = Some(true); has_style = true;
                                    }

                                    // Number format
                                    if xf.num_fmt_id > 0 {
                                        let fmt = num_fmts.get(&xf.num_fmt_id)
                                            .map(|s| s.as_str())
                                            .or_else(|| builtin_fmts.get(&xf.num_fmt_id).copied());
                                        if let Some(f) = fmt {
                                            cs.number_format = Some(f.to_string()); has_style = true;
                                        }
                                    }

                                    if has_style {
                                        if let Some(cell) = sheet.cells.get_mut(&row).and_then(|r| r.get_mut(&col)) {
                                            cell.style = Some(cs);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Ok(quick_xml::events::Event::Eof) => break,
                    Err(_) => break,
                    _ => {}
                }
                buf.clear();
            }
        }
    }
}

/// Parse merged cells and column widths / row heights from each worksheet XML
fn parse_sheet_metadata_from_zip(data: &[u8], sheets: &mut Vec<SheetData>) {
    let cursor = Cursor::new(data);
    let mut archive = match zip::ZipArchive::new(cursor) {
        Ok(a) => a,
        Err(_) => return,
    };

    let sheet_name_order = parse_sheet_name_order(&mut archive);

    // Collect worksheet file names
    let file_names: Vec<String> = (0..archive.len())
        .filter_map(|i| archive.by_index(i).ok().map(|f| f.name().to_string()))
        .collect();

    let mut worksheet_files: Vec<&String> = file_names.iter()
        .filter(|f| f.starts_with("xl/worksheets/sheet") && f.ends_with(".xml") && !f.contains("_rels"))
        .collect();
    worksheet_files.sort();

    for (idx, ws_file) in worksheet_files.iter().enumerate() {
        let sheet_name = match sheet_name_order.get(idx) {
            Some(n) => n.clone(),
            None => continue,
        };

        // Find matching sheet in the model
        let sheet = match sheets.iter_mut().find(|s| s.name == sheet_name) {
            Some(s) => s,
            None => continue,
        };

        if let Ok(mut file) = archive.by_name(ws_file) {
            let mut content = String::new();
            if file.read_to_string(&mut content).is_err() {
                continue;
            }

            let mut reader = quick_xml::Reader::from_str(&content);
            let mut buf = Vec::new();
            let mut in_merge_cells = false;

            loop {
                match reader.read_event_into(&mut buf) {
                    Ok(quick_xml::events::Event::Start(ref e)) => {
                        let tag = e.name();
                        if tag.as_ref() == b"mergeCells" {
                            in_merge_cells = true;
                        } else if tag.as_ref() == b"mergeCell" && in_merge_cells {
                            for attr in e.attributes().flatten() {
                                if attr.key.as_ref() == b"ref" {
                                    if let Ok(val) = attr.unescape_value() {
                                        let range = parse_cell_range(&val);
                                        sheet.merged_cells.push(MergedCellRange {
                                            start_row: range.start_row,
                                            start_col: range.start_col,
                                            end_row: range.end_row,
                                            end_col: range.end_col,
                                        });
                                    }
                                }
                            }
                        } else if tag.as_ref() == b"col" {
                            let mut min_col: Option<u32> = None;
                            let mut max_col: Option<u32> = None;
                            let mut width: Option<f64> = None;
                            for attr in e.attributes().flatten() {
                                let key = attr.key.as_ref();
                                let val = attr.unescape_value().unwrap_or_default().to_string();
                                match key {
                                    b"min" => min_col = val.parse().ok(),
                                    b"max" => max_col = val.parse().ok(),
                                    b"width" => width = val.parse().ok(),
                                    _ => {}
                                }
                            }
                            if let (Some(mn), Some(mx), Some(w)) = (min_col, max_col, width) {
                                // Excel col widths are in character units; approximate to pixels
                                let px = (w * 7.5).round();
                                for c in mn..=mx {
                                    sheet.col_widths.insert(c.saturating_sub(1), px);
                                }
                            }
                        } else if tag.as_ref() == b"row" {
                            let mut row_idx: Option<u32> = None;
                            let mut height: Option<f64> = None;
                            let mut custom_height = false;
                            for attr in e.attributes().flatten() {
                                let key = attr.key.as_ref();
                                let val = attr.unescape_value().unwrap_or_default().to_string();
                                match key {
                                    b"r" => row_idx = val.parse().ok(),
                                    b"ht" => height = val.parse().ok(),
                                    b"customHeight" => custom_height = val == "1",
                                    _ => {}
                                }
                            }
                            if custom_height {
                                if let (Some(r), Some(h)) = (row_idx, height) {
                                    // Excel row heights are in points; approximate to pixels
                                    let px = (h * 1.333).round();
                                    sheet.row_heights.insert(r.saturating_sub(1), px);
                                }
                            }
                        }
                    }
                    Ok(quick_xml::events::Event::Empty(ref e)) => {
                        let tag = e.name();
                        if tag.as_ref() == b"mergeCell" && in_merge_cells {
                            for attr in e.attributes().flatten() {
                                if attr.key.as_ref() == b"ref" {
                                    if let Ok(val) = attr.unescape_value() {
                                        let range = parse_cell_range(&val);
                                        sheet.merged_cells.push(MergedCellRange {
                                            start_row: range.start_row,
                                            start_col: range.start_col,
                                            end_row: range.end_row,
                                            end_col: range.end_col,
                                        });
                                    }
                                }
                            }
                        } else if tag.as_ref() == b"col" {
                            let mut min_col: Option<u32> = None;
                            let mut max_col: Option<u32> = None;
                            let mut width: Option<f64> = None;
                            for attr in e.attributes().flatten() {
                                let key = attr.key.as_ref();
                                let val = attr.unescape_value().unwrap_or_default().to_string();
                                match key {
                                    b"min" => min_col = val.parse().ok(),
                                    b"max" => max_col = val.parse().ok(),
                                    b"width" => width = val.parse().ok(),
                                    _ => {}
                                }
                            }
                            if let (Some(mn), Some(mx), Some(w)) = (min_col, max_col, width) {
                                let px = (w * 7.5).round();
                                for c in mn..=mx {
                                    sheet.col_widths.insert(c.saturating_sub(1), px);
                                }
                            }
                        }
                    }
                    Ok(quick_xml::events::Event::End(ref e)) => {
                        if e.name().as_ref() == b"mergeCells" {
                            in_merge_cells = false;
                        }
                    }
                    Ok(quick_xml::events::Event::Eof) => break,
                    Err(_) => break,
                    _ => {}
                }
                buf.clear();
            }
        }
    }
}

// --- Conditional Formatting Parsing ---

/// Parse DXF (Differential Formatting) styles from xl/styles.xml
fn parse_dxf_styles(styles_xml: &str) -> Vec<DxfStyle> {
    let mut dxf_styles = Vec::new();
    let mut reader = quick_xml::Reader::from_str(styles_xml);
    let mut buf = Vec::new();
    let mut in_dxfs = false;
    let mut in_dxf = false;
    let mut in_font = false;
    let mut in_fill = false;
    let mut in_numfmt = false;
    let mut current_dxf = DxfStyle::default();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(quick_xml::events::Event::Start(ref e)) => {
                let tag = e.name();
                match tag.as_ref() {
                    b"dxfs" => { in_dxfs = true; }
                    b"dxf" if in_dxfs => {
                        in_dxf = true;
                        current_dxf = DxfStyle::default();
                    }
                    b"font" if in_dxf => { in_font = true; }
                    b"fill" if in_dxf => { in_fill = true; }
                    b"numFmt" if in_dxf => { in_numfmt = true; }
                    b"b" if in_font => { current_dxf.bold = Some(true); }
                    b"i" if in_font => { current_dxf.italic = Some(true); }
                    b"u" if in_font => { current_dxf.underline = Some(true); }
                    b"color" if in_font => {
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == b"rgb" {
                                if let Ok(val) = attr.unescape_value() {
                                    let s = val.to_string();
                                    // ARGB -> RGB
                                    let rgb = if s.len() == 8 { format!("#{}", &s[2..]) } else { format!("#{}", s) };
                                    current_dxf.text_color = Some(rgb);
                                }
                            }
                        }
                    }
                    b"fgColor" | b"bgColor" if in_fill => {
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == b"rgb" {
                                if let Ok(val) = attr.unescape_value() {
                                    let s = val.to_string();
                                    let rgb = if s.len() == 8 { format!("#{}", &s[2..]) } else { format!("#{}", s) };
                                    current_dxf.fill_color = Some(rgb);
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
            Ok(quick_xml::events::Event::Empty(ref e)) => {
                let tag = e.name();
                match tag.as_ref() {
                    b"b" if in_font => { current_dxf.bold = Some(true); }
                    b"i" if in_font => { current_dxf.italic = Some(true); }
                    b"u" if in_font => { current_dxf.underline = Some(true); }
                    b"color" if in_font => {
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == b"rgb" {
                                if let Ok(val) = attr.unescape_value() {
                                    let s = val.to_string();
                                    let rgb = if s.len() == 8 { format!("#{}", &s[2..]) } else { format!("#{}", s) };
                                    current_dxf.text_color = Some(rgb);
                                }
                            }
                        }
                    }
                    b"fgColor" | b"bgColor" if in_fill => {
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == b"rgb" {
                                if let Ok(val) = attr.unescape_value() {
                                    let s = val.to_string();
                                    let rgb = if s.len() == 8 { format!("#{}", &s[2..]) } else { format!("#{}", s) };
                                    current_dxf.fill_color = Some(rgb);
                                }
                            }
                        }
                    }
                    b"numFmt" if in_dxf => {
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == b"formatCode" {
                                if let Ok(val) = attr.unescape_value() {
                                    current_dxf.number_format = Some(val.to_string());
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
            Ok(quick_xml::events::Event::End(ref e)) => {
                let tag = e.name();
                match tag.as_ref() {
                    b"dxfs" => { in_dxfs = false; }
                    b"dxf" if in_dxf => {
                        dxf_styles.push(current_dxf.clone());
                        in_dxf = false;
                    }
                    b"font" if in_font => { in_font = false; }
                    b"fill" if in_fill => { in_fill = false; }
                    b"numFmt" if in_numfmt => { in_numfmt = false; }
                    _ => {}
                }
            }
            Ok(quick_xml::events::Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    dxf_styles
}

/// Parse a single <cfRule> element's attributes and children
fn parse_cf_rule(reader: &mut quick_xml::Reader<&[u8]>, start_attrs: &quick_xml::events::BytesStart, sqref: &str) -> Option<ConditionalFormatRule> {
    let mut rule_type = String::new();
    let mut operator: Option<String> = None;
    let mut priority: u32 = 1;
    let mut dxf_id: Option<u32> = None;
    let mut rank: Option<u32> = None;
    let mut percent: Option<bool> = None;
    let mut bottom: Option<bool> = None;
    let mut above_average: Option<bool> = None;
    let mut std_dev: Option<u32> = None;
    let mut text: Option<String> = None;

    for attr in start_attrs.attributes().flatten() {
        let key = attr.key.as_ref();
        let val = attr.unescape_value().unwrap_or_default().to_string();
        match key {
            b"type" => rule_type = val,
            b"operator" => operator = Some(val),
            b"priority" => priority = val.parse().unwrap_or(1),
            b"dxfId" => dxf_id = val.parse().ok(),
            b"rank" => rank = val.parse().ok(),
            b"percent" => percent = Some(val == "1"),
            b"bottom" => bottom = Some(val == "1"),
            b"aboveAverage" => {
                // aboveAverage="0" means BELOW average
                above_average = Some(val != "0");
            }
            b"stdDev" => std_dev = val.parse().ok(),
            b"text" => text = Some(val),
            _ => {}
        }
    }

    if rule_type.is_empty() {
        return None;
    }

    let mut formulas: Vec<String> = Vec::new();
    let mut color_scale: Option<ColorScaleSpec> = None;
    let mut data_bar: Option<DataBarSpec> = None;
    let mut icon_set: Option<IconSetSpec> = None;
    let mut buf = Vec::new();
    let mut in_formula = false;
    let mut formula_text = String::new();
    let mut in_color_scale = false;
    let mut cs_colors: Vec<String> = Vec::new();
    let mut cs_values: Vec<f64> = Vec::new();
    let mut cs_value_types: Vec<String> = Vec::new();
    let mut in_data_bar = false;
    let mut db_color = String::from("#638EC6");
    let mut in_icon_set = false;
    let mut is_thresholds: Vec<f64> = Vec::new();
    let mut is_style = String::from("3TrafficLights1");
    let mut is_reverse = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(quick_xml::events::Event::Start(ref e)) => {
                let tag = e.name();
                match tag.as_ref() {
                    b"formula" => { in_formula = true; formula_text.clear(); }
                    b"colorScale" => { in_color_scale = true; }
                    b"dataBar" => { in_data_bar = true; }
                    b"iconSet" => {
                        in_icon_set = true;
                        for attr in e.attributes().flatten() {
                            match attr.key.as_ref() {
                                b"iconSet" => {
                                    if let Ok(v) = attr.unescape_value() { is_style = v.to_string(); }
                                }
                                b"reverse" => {
                                    if let Ok(v) = attr.unescape_value() { is_reverse = v.as_ref() == "1"; }
                                }
                                _ => {}
                            }
                        }
                    }
                    b"cfvo" if in_color_scale || in_data_bar || in_icon_set => {
                        let mut cfvo_type = String::new();
                        let mut cfvo_val: Option<f64> = None;
                        for attr in e.attributes().flatten() {
                            match attr.key.as_ref() {
                                b"type" => { if let Ok(v) = attr.unescape_value() { cfvo_type = v.to_string(); } }
                                b"val" => { if let Ok(v) = attr.unescape_value() { cfvo_val = v.parse().ok(); } }
                                _ => {}
                            }
                        }
                        if in_color_scale {
                            cs_value_types.push(cfvo_type);
                            cs_values.push(cfvo_val.unwrap_or(0.0));
                        } else if in_icon_set {
                            if let Some(v) = cfvo_val { is_thresholds.push(v); }
                        }
                    }
                    b"color" if in_color_scale => {
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == b"rgb" {
                                if let Ok(v) = attr.unescape_value() {
                                    let s = v.to_string();
                                    let rgb = if s.len() == 8 { format!("#{}", &s[2..]) } else { format!("#{}", s) };
                                    cs_colors.push(rgb);
                                }
                            }
                        }
                    }
                    b"color" if in_data_bar => {
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == b"rgb" {
                                if let Ok(v) = attr.unescape_value() {
                                    let s = v.to_string();
                                    db_color = if s.len() == 8 { format!("#{}", &s[2..]) } else { format!("#{}", s) };
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
            Ok(quick_xml::events::Event::Empty(ref e)) => {
                let tag = e.name();
                match tag.as_ref() {
                    b"cfvo" if in_color_scale || in_data_bar || in_icon_set => {
                        let mut cfvo_type = String::new();
                        let mut cfvo_val: Option<f64> = None;
                        for attr in e.attributes().flatten() {
                            match attr.key.as_ref() {
                                b"type" => { if let Ok(v) = attr.unescape_value() { cfvo_type = v.to_string(); } }
                                b"val" => { if let Ok(v) = attr.unescape_value() { cfvo_val = v.parse().ok(); } }
                                _ => {}
                            }
                        }
                        if in_color_scale {
                            cs_value_types.push(cfvo_type);
                            cs_values.push(cfvo_val.unwrap_or(0.0));
                        } else if in_icon_set {
                            if let Some(v) = cfvo_val { is_thresholds.push(v); }
                        }
                    }
                    b"color" if in_color_scale => {
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == b"rgb" {
                                if let Ok(v) = attr.unescape_value() {
                                    let s = v.to_string();
                                    let rgb = if s.len() == 8 { format!("#{}", &s[2..]) } else { format!("#{}", s) };
                                    cs_colors.push(rgb);
                                }
                            }
                        }
                    }
                    b"color" if in_data_bar => {
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == b"rgb" {
                                if let Ok(v) = attr.unescape_value() {
                                    let s = v.to_string();
                                    db_color = if s.len() == 8 { format!("#{}", &s[2..]) } else { format!("#{}", s) };
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
            Ok(quick_xml::events::Event::Text(ref e)) => {
                if in_formula {
                    if let Ok(t) = e.unescape() {
                        formula_text.push_str(&t);
                    }
                }
            }
            Ok(quick_xml::events::Event::End(ref e)) => {
                let tag = e.name();
                match tag.as_ref() {
                    b"formula" => {
                        in_formula = false;
                        if !formula_text.is_empty() {
                            formulas.push(formula_text.clone());
                        }
                    }
                    b"colorScale" => {
                        in_color_scale = false;
                        color_scale = Some(ColorScaleSpec {
                            colors: cs_colors.clone(),
                            values: cs_values.clone(),
                            value_types: cs_value_types.clone(),
                        });
                    }
                    b"dataBar" => {
                        in_data_bar = false;
                        data_bar = Some(DataBarSpec {
                            color: db_color.clone(),
                            min_value: None,
                            max_value: None,
                        });
                    }
                    b"iconSet" => {
                        in_icon_set = false;
                        icon_set = Some(IconSetSpec {
                            icon_style: is_style.clone(),
                            thresholds: is_thresholds.clone(),
                            reverse: is_reverse,
                        });
                    }
                    b"cfRule" => break,
                    _ => {}
                }
            }
            Ok(quick_xml::events::Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }

    Some(ConditionalFormatRule {
        rule_type,
        operator,
        priority,
        values: formulas,
        dxf_id,
        dxf_style: None, // resolved later
        sqref: sqref.to_string(),
        color_scale,
        data_bar,
        icon_set,
        rank,
        percent,
        bottom,
        above_average,
        std_dev,
        text,
    })
}

/// Parse conditional formatting from all worksheet XMLs plus DXF styles from styles.xml
fn parse_conditional_formatting_from_zip(data: &[u8], sheets: &mut [SheetData]) {
    let cursor = Cursor::new(data);
    let mut archive = match zip::ZipArchive::new(cursor) {
        Ok(a) => a,
        Err(_) => return,
    };

    // Step 1: Parse DXF styles from xl/styles.xml
    let dxf_styles = if let Ok(mut file) = archive.by_name("xl/styles.xml") {
        let mut content = String::new();
        if file.read_to_string(&mut content).is_ok() {
            parse_dxf_styles(&content)
        } else {
            Vec::new()
        }
    } else {
        Vec::new()
    };

    // Step 2: Parse CF rules from each worksheet
    let sheet_name_order = parse_sheet_name_order(&mut archive);

    let file_names: Vec<String> = (0..archive.len())
        .filter_map(|i| archive.by_index(i).ok().map(|f| f.name().to_string()))
        .collect();

    let mut worksheet_files: Vec<&String> = file_names.iter()
        .filter(|f| f.starts_with("xl/worksheets/sheet") && f.ends_with(".xml") && !f.contains("_rels"))
        .collect();
    worksheet_files.sort();

    for (idx, ws_file) in worksheet_files.iter().enumerate() {
        let sheet_name = match sheet_name_order.get(idx) {
            Some(n) => n.clone(),
            None => continue,
        };

        let sheet = match sheets.iter_mut().find(|s| s.name == sheet_name) {
            Some(s) => s,
            None => continue,
        };

        if let Ok(mut file) = archive.by_name(ws_file) {
            let mut content = String::new();
            if file.read_to_string(&mut content).is_err() {
                continue;
            }

            let mut reader = quick_xml::Reader::from_str(&content);
            let mut buf = Vec::new();
            let mut current_sqref = String::new();

            loop {
                match reader.read_event_into(&mut buf) {
                    Ok(quick_xml::events::Event::Start(ref e)) => {
                        let tag = e.name();
                        if tag.as_ref() == b"conditionalFormatting" {
                            for attr in e.attributes().flatten() {
                                if attr.key.as_ref() == b"sqref" {
                                    if let Ok(val) = attr.unescape_value() {
                                        current_sqref = val.to_string();
                                    }
                                }
                            }
                        } else if tag.as_ref() == b"cfRule" && !current_sqref.is_empty() {
                            if let Some(mut rule) = parse_cf_rule(&mut reader, e, &current_sqref) {
                                // Resolve dxfId to inline DxfStyle
                                if let Some(did) = rule.dxf_id {
                                    if let Some(dxf) = dxf_styles.get(did as usize) {
                                        rule.dxf_style = Some(dxf.clone());
                                    }
                                }
                                sheet.conditional_formats.push(rule);
                            }
                        }
                    }
                    Ok(quick_xml::events::Event::End(ref e)) => {
                        if e.name().as_ref() == b"conditionalFormatting" {
                            current_sqref.clear();
                        }
                    }
                    Ok(quick_xml::events::Event::Eof) => break,
                    Err(_) => break,
                    _ => {}
                }
                buf.clear();
            }

            // Sort by priority
            sheet.conditional_formats.sort_by_key(|r| r.priority);
        }
    }
}

/// Parse data validation rules from all worksheet XMLs in the XLSX ZIP archive.
fn parse_data_validations_from_zip(data: &[u8], sheets: &mut [SheetData]) {
    let cursor = Cursor::new(data);
    let mut archive = match zip::ZipArchive::new(cursor) {
        Ok(a) => a,
        Err(_) => return,
    };

    let sheet_name_order = parse_sheet_name_order(&mut archive);

    let file_names: Vec<String> = (0..archive.len())
        .filter_map(|i| archive.by_index(i).ok().map(|f| f.name().to_string()))
        .collect();

    let mut worksheet_files: Vec<&String> = file_names.iter()
        .filter(|f| f.starts_with("xl/worksheets/sheet") && f.ends_with(".xml") && !f.contains("_rels"))
        .collect();
    worksheet_files.sort();

    for (idx, ws_file) in worksheet_files.iter().enumerate() {
        let sheet_name = match sheet_name_order.get(idx) {
            Some(n) => n.clone(),
            None => continue,
        };

        let sheet = match sheets.iter_mut().find(|s| s.name == sheet_name) {
            Some(s) => s,
            None => continue,
        };

        if let Ok(mut file) = archive.by_name(ws_file) {
            let mut content = String::new();
            if file.read_to_string(&mut content).is_err() {
                continue;
            }

            let mut reader = quick_xml::Reader::from_str(&content);
            let mut buf = Vec::new();
            let mut in_data_validations = false;
            let mut in_data_validation = false;
            let mut current_dv: Option<DataValidationPartial> = None;
            let mut in_formula1 = false;
            let mut in_formula2 = false;
            let mut formula1_text = String::new();
            let mut formula2_text = String::new();

            loop {
                match reader.read_event_into(&mut buf) {
                    Ok(quick_xml::events::Event::Start(ref e)) => {
                        let tag = e.name();
                        match tag.as_ref() {
                            b"dataValidations" => { in_data_validations = true; }
                            b"dataValidation" if in_data_validations => {
                                in_data_validation = true;
                                let mut partial = DataValidationPartial::default();
                                for attr in e.attributes().flatten() {
                                    let key = attr.key.as_ref();
                                    let val = attr.unescape_value().unwrap_or_default().to_string();
                                    match key {
                                        b"type" => partial.validation_type = val,
                                        b"operator" => partial.operator = Some(val),
                                        b"sqref" => partial.sqref = val,
                                        b"allowBlank" => partial.allow_blank = val != "0",
                                        b"showInputMessage" => partial.show_input_message = val != "0",
                                        b"showErrorMessage" => partial.show_error_message = val != "0",
                                        b"showDropDown" => {
                                            // In OOXML, showDropDown="1" means HIDE dropdown (counterintuitive)
                                            partial.show_dropdown = val == "0" || val.is_empty();
                                        }
                                        b"promptTitle" => partial.input_title = Some(val),
                                        b"prompt" => partial.input_message = Some(val),
                                        b"errorTitle" => partial.error_title = Some(val),
                                        b"error" => partial.error_message = Some(val),
                                        b"errorStyle" => partial.error_style = val,
                                        _ => {}
                                    }
                                }
                                // Default type to "any" if not specified
                                if partial.validation_type.is_empty() {
                                    partial.validation_type = "any".to_string();
                                }
                                current_dv = Some(partial);
                            }
                            b"formula1" if in_data_validation => {
                                in_formula1 = true;
                                formula1_text.clear();
                            }
                            b"formula2" if in_data_validation => {
                                in_formula2 = true;
                                formula2_text.clear();
                            }
                            _ => {}
                        }
                    }
                    Ok(quick_xml::events::Event::Text(ref e)) => {
                        if let Ok(t) = e.unescape() {
                            if in_formula1 {
                                formula1_text.push_str(&t);
                            } else if in_formula2 {
                                formula2_text.push_str(&t);
                            }
                        }
                    }
                    Ok(quick_xml::events::Event::End(ref e)) => {
                        let tag = e.name();
                        match tag.as_ref() {
                            b"dataValidations" => { in_data_validations = false; }
                            b"dataValidation" if in_data_validation => {
                                if let Some(mut partial) = current_dv.take() {
                                    if !formula1_text.is_empty() {
                                        partial.formula1 = Some(formula1_text.clone());
                                    }
                                    if !formula2_text.is_empty() {
                                        partial.formula2 = Some(formula2_text.clone());
                                    }
                                    sheet.data_validations.push(DataValidationDef {
                                        validation_type: partial.validation_type,
                                        operator: partial.operator,
                                        sqref: partial.sqref,
                                        formula1: partial.formula1,
                                        formula2: partial.formula2,
                                        allow_blank: partial.allow_blank,
                                        show_input_message: partial.show_input_message,
                                        show_error_message: partial.show_error_message,
                                        show_dropdown: partial.show_dropdown,
                                        input_title: partial.input_title,
                                        input_message: partial.input_message,
                                        error_title: partial.error_title,
                                        error_message: partial.error_message,
                                        error_style: if partial.error_style.is_empty() {
                                            "stop".to_string()
                                        } else {
                                            partial.error_style
                                        },
                                    });
                                }
                                in_data_validation = false;
                                formula1_text.clear();
                                formula2_text.clear();
                            }
                            b"formula1" => { in_formula1 = false; }
                            b"formula2" => { in_formula2 = false; }
                            _ => {}
                        }
                    }
                    Ok(quick_xml::events::Event::Empty(ref e)) => {
                        let tag = e.name();
                        if tag.as_ref() == b"dataValidation" && in_data_validations {
                            let mut partial = DataValidationPartial::default();
                            for attr in e.attributes().flatten() {
                                let key = attr.key.as_ref();
                                let val = attr.unescape_value().unwrap_or_default().to_string();
                                match key {
                                    b"type" => partial.validation_type = val,
                                    b"operator" => partial.operator = Some(val),
                                    b"sqref" => partial.sqref = val,
                                    b"allowBlank" => partial.allow_blank = val != "0",
                                    b"showInputMessage" => partial.show_input_message = val != "0",
                                    b"showErrorMessage" => partial.show_error_message = val != "0",
                                    b"showDropDown" => {
                                        partial.show_dropdown = val == "0" || val.is_empty();
                                    }
                                    b"promptTitle" => partial.input_title = Some(val),
                                    b"prompt" => partial.input_message = Some(val),
                                    b"errorTitle" => partial.error_title = Some(val),
                                    b"error" => partial.error_message = Some(val),
                                    b"errorStyle" => partial.error_style = val,
                                    _ => {}
                                }
                            }
                            if partial.validation_type.is_empty() {
                                partial.validation_type = "any".to_string();
                            }
                            sheet.data_validations.push(DataValidationDef {
                                validation_type: partial.validation_type,
                                operator: partial.operator,
                                sqref: partial.sqref,
                                formula1: partial.formula1,
                                formula2: partial.formula2,
                                allow_blank: partial.allow_blank,
                                show_input_message: partial.show_input_message,
                                show_error_message: partial.show_error_message,
                                show_dropdown: partial.show_dropdown,
                                input_title: partial.input_title,
                                input_message: partial.input_message,
                                error_title: partial.error_title,
                                error_message: partial.error_message,
                                error_style: if partial.error_style.is_empty() {
                                    "stop".to_string()
                                } else {
                                    partial.error_style
                                },
                            });
                        }
                    }
                    Ok(quick_xml::events::Event::Eof) => break,
                    Err(_) => break,
                    _ => {}
                }
                buf.clear();
            }
        }
    }
}

/// Intermediate struct for building DataValidationDef during XML parsing
struct DataValidationPartial {
    validation_type: String,
    operator: Option<String>,
    sqref: String,
    formula1: Option<String>,
    formula2: Option<String>,
    allow_blank: bool,
    show_input_message: bool,
    show_error_message: bool,
    show_dropdown: bool,
    input_title: Option<String>,
    input_message: Option<String>,
    error_title: Option<String>,
    error_message: Option<String>,
    error_style: String,
}

impl Default for DataValidationPartial {
    fn default() -> Self {
        DataValidationPartial {
            validation_type: String::new(),
            operator: None,
            sqref: String::new(),
            formula1: None,
            formula2: None,
            allow_blank: true,
            show_input_message: true,
            show_error_message: true,
            show_dropdown: true,
            input_title: None,
            input_message: None,
            error_title: None,
            error_message: None,
            error_style: String::new(),
        }
    }
}

// --- Chart Parsing ---

/// Extract drawing relationship targets from a .rels file
fn extract_drawing_refs_from_rels(rels_xml: &str) -> Vec<(String, String)> {
    let mut refs = Vec::new();
    let mut reader = quick_xml::Reader::from_str(rels_xml);
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(quick_xml::events::Event::Empty(ref e)) | Ok(quick_xml::events::Event::Start(ref e)) => {
                if e.name().as_ref() == b"Relationship" {
                    let mut rel_type = String::new();
                    let mut target = String::new();
                    let mut rid = String::new();
                    for attr in e.attributes().flatten() {
                        let key = attr.key.as_ref();
                        let val = attr.unescape_value().unwrap_or_default().to_string();
                        match key {
                            b"Type" => rel_type = val,
                            b"Target" => target = val,
                            b"Id" => rid = val,
                            _ => {}
                        }
                    }
                    if rel_type.contains("/drawing") && !target.is_empty() {
                        refs.push((rid, target));
                    }
                }
            }
            Ok(quick_xml::events::Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    refs
}

/// Extract chart relationship targets from a drawing .rels file
fn extract_chart_refs_from_rels(rels_xml: &str) -> HashMap<String, String> {
    let mut refs = HashMap::new();
    let mut reader = quick_xml::Reader::from_str(rels_xml);
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(quick_xml::events::Event::Empty(ref e)) | Ok(quick_xml::events::Event::Start(ref e)) => {
                if e.name().as_ref() == b"Relationship" {
                    let mut rel_type = String::new();
                    let mut target = String::new();
                    let mut rid = String::new();
                    for attr in e.attributes().flatten() {
                        let key = attr.key.as_ref();
                        let val = attr.unescape_value().unwrap_or_default().to_string();
                        match key {
                            b"Type" => rel_type = val,
                            b"Target" => target = val,
                            b"Id" => rid = val,
                            _ => {}
                        }
                    }
                    if rel_type.contains("/chart") && !target.is_empty() {
                        refs.insert(rid, target);
                    }
                }
            }
            Ok(quick_xml::events::Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    refs
}

/// Parse a drawing XML to extract anchors and their chart rIds
fn parse_drawing_anchors(drawing_xml: &str) -> Vec<(ChartAnchor, String)> {
    let mut results = Vec::new();
    let mut reader = quick_xml::Reader::from_str(drawing_xml);
    let mut buf = Vec::new();

    let mut in_anchor = false;
    let mut in_from = false;
    let mut in_to = false;
    let mut from_col: u32 = 0;
    let mut from_row: u32 = 0;
    let mut from_col_off: i64 = 0;
    let mut from_row_off: i64 = 0;
    let mut to_col: u32 = 0;
    let mut to_row: u32 = 0;
    let mut to_col_off: i64 = 0;
    let mut to_row_off: i64 = 0;
    let mut chart_rid = String::new();
    let mut current_text_tag = String::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(quick_xml::events::Event::Start(ref e)) => {
                let name_val = e.name();
                let local = local_name(name_val.as_ref());
                match local {
                    b"twoCellAnchor" | b"oneCellAnchor" => {
                        in_anchor = true;
                        from_col = 0; from_row = 0; from_col_off = 0; from_row_off = 0;
                        to_col = 0; to_row = 0; to_col_off = 0; to_row_off = 0;
                        chart_rid.clear();
                    }
                    b"from" if in_anchor => { in_from = true; }
                    b"to" if in_anchor => { in_to = true; }
                    b"col" | b"colOff" | b"row" | b"rowOff" if in_from || in_to => {
                        current_text_tag = String::from_utf8_lossy(local).to_string();
                    }
                    _ => {}
                }
            }
            Ok(quick_xml::events::Event::Empty(ref e)) => {
                let name_val = e.name();
                let local = local_name(name_val.as_ref());
                if local == b"chart" && in_anchor {
                    for attr in e.attributes().flatten() {
                        let key_local = local_name(attr.key.as_ref());
                        if key_local == b"id" {
                            if let Ok(v) = attr.unescape_value() {
                                chart_rid = v.to_string();
                            }
                        }
                    }
                }
            }
            Ok(quick_xml::events::Event::Text(ref e)) => {
                if let Ok(text) = e.unescape() {
                    let val = text.trim();
                    if in_from {
                        match current_text_tag.as_str() {
                            "col" => from_col = val.parse().unwrap_or(0),
                            "colOff" => from_col_off = val.parse().unwrap_or(0),
                            "row" => from_row = val.parse().unwrap_or(0),
                            "rowOff" => from_row_off = val.parse().unwrap_or(0),
                            _ => {}
                        }
                    } else if in_to {
                        match current_text_tag.as_str() {
                            "col" => to_col = val.parse().unwrap_or(0),
                            "colOff" => to_col_off = val.parse().unwrap_or(0),
                            "row" => to_row = val.parse().unwrap_or(0),
                            "rowOff" => to_row_off = val.parse().unwrap_or(0),
                            _ => {}
                        }
                    }
                }
                current_text_tag.clear();
            }
            Ok(quick_xml::events::Event::End(ref e)) => {
                let name_val = e.name();
                let local = local_name(name_val.as_ref());
                match local {
                    b"from" => { in_from = false; }
                    b"to" => { in_to = false; }
                    b"twoCellAnchor" | b"oneCellAnchor" => {
                        if in_anchor && !chart_rid.is_empty() {
                            // Default to_col/to_row if not provided (oneCellAnchor)
                            if to_col == 0 && to_row == 0 {
                                to_col = from_col + 8;
                                to_row = from_row + 15;
                            }
                            results.push((
                                ChartAnchor {
                                    from_col, from_row, from_col_off, from_row_off,
                                    to_col, to_row, to_col_off, to_row_off,
                                },
                                chart_rid.clone(),
                            ));
                        }
                        in_anchor = false;
                    }
                    _ => {}
                }
            }
            Ok(quick_xml::events::Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    results
}

/// Get local name from a possibly namespaced tag (e.g., "xdr:twoCellAnchor" -> "twoCellAnchor")
fn local_name(name: &[u8]) -> &[u8] {
    if let Some(pos) = name.iter().position(|&b| b == b':') {
        &name[pos + 1..]
    } else {
        name
    }
}

/// Parse a chart XML file (xl/charts/chartN.xml) into a partial ChartDefinition
fn parse_chart_xml(chart_xml: &str) -> Option<(String, Vec<ChartSeries>, Option<String>, Option<ChartLegend>, Vec<ChartAxis>)> {
    let mut reader = quick_xml::Reader::from_str(chart_xml);
    let mut buf = Vec::new();

    let mut chart_type = String::new();
    let mut series_list: Vec<ChartSeries> = Vec::new();
    let mut title: Option<String> = None;
    let mut legend: Option<ChartLegend> = None;
    let mut axes: Vec<ChartAxis> = Vec::new();

    // Track chart type element nesting
    let chart_type_tags: &[&[u8]] = &[
        b"barChart", b"bar3DChart", b"lineChart", b"line3DChart",
        b"pieChart", b"pie3DChart", b"doughnutChart",
        b"areaChart", b"area3DChart", b"scatterChart",
        b"radarChart", b"stockChart", b"bubbleChart", b"surfaceChart",
    ];

    let mut in_chart_type = false;
    let mut in_ser = false;
    let mut in_title = false;
    let mut in_legend = false;
    let mut in_cat = false;
    let mut in_val = false;
    let mut in_x_val = false;
    let mut in_y_val = false;
    let mut in_tx = false;
    let mut in_str_ref = false;
    let mut in_num_ref = false;
    let mut in_str_cache = false;
    let mut in_num_cache = false;
    let mut in_cat_ax = false;
    let mut in_val_ax = false;
    let mut in_formula = false;
    let mut in_chart_title_t = false;

    let mut current_formula = String::new();
    let mut current_series = ChartSeries {
        name: None, categories_ref: None, values_ref: None,
        categories_cache: Vec::new(), values_cache: Vec::new(), chart_type: None,
    };
    let mut cache_strings: Vec<String> = Vec::new();
    let mut cache_nums: Vec<f64> = Vec::new();
    let mut series_name_text = String::new();
    let mut legend_pos = String::from("right");
    let mut title_text = String::new();
    let mut axis_title = String::new();
    let mut in_axis_title = false;

    let mut current_text_tag = String::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(quick_xml::events::Event::Start(ref e)) => {
                let name_val = e.name();
                let local = local_name(name_val.as_ref());

                // Chart type detection
                for tag in chart_type_tags {
                    if local == *tag {
                        in_chart_type = true;
                        chart_type = match local {
                            b"barChart" | b"bar3DChart" => "bar".to_string(),
                            b"lineChart" | b"line3DChart" => "line".to_string(),
                            b"pieChart" | b"pie3DChart" => "pie".to_string(),
                            b"doughnutChart" => "doughnut".to_string(),
                            b"areaChart" | b"area3DChart" => "area".to_string(),
                            b"scatterChart" => "scatter".to_string(),
                            b"radarChart" => "radar".to_string(),
                            b"stockChart" => "stock".to_string(),
                            b"bubbleChart" => "bubble".to_string(),
                            b"surfaceChart" => "surface".to_string(),
                            _ => "bar".to_string(),
                        };
                        break;
                    }
                }

                match local {
                    b"ser" if in_chart_type => {
                        in_ser = true;
                        current_series = ChartSeries {
                            name: None, categories_ref: None, values_ref: None,
                            categories_cache: Vec::new(), values_cache: Vec::new(), chart_type: None,
                        };
                        series_name_text.clear();
                    }
                    b"title" if !in_ser && !in_cat_ax && !in_val_ax => { in_title = true; title_text.clear(); }
                    b"title" if (in_cat_ax || in_val_ax) => { in_axis_title = true; axis_title.clear(); }
                    b"legend" => { in_legend = true; legend_pos = "right".to_string(); }
                    b"cat" if in_ser => { in_cat = true; }
                    b"val" if in_ser => { in_val = true; }
                    b"xVal" if in_ser => { in_x_val = true; }
                    b"yVal" if in_ser => { in_y_val = true; }
                    b"tx" if in_ser => { in_tx = true; }
                    b"strRef" => { in_str_ref = true; }
                    b"numRef" => { in_num_ref = true; }
                    b"strCache" => { in_str_cache = true; cache_strings.clear(); }
                    b"numCache" => { in_num_cache = true; cache_nums.clear(); }
                    b"f" if in_str_ref || in_num_ref => { in_formula = true; current_formula.clear(); }
                    b"catAx" => { in_cat_ax = true; }
                    b"valAx" => { in_val_ax = true; }
                    b"t" if in_title => { in_chart_title_t = true; }
                    b"t" if in_axis_title => { in_chart_title_t = true; }
                    b"v" if in_str_cache || in_num_cache => { current_text_tag = "v".to_string(); }
                    _ => {}
                }
            }
            Ok(quick_xml::events::Event::Empty(ref e)) => {
                let name_val = e.name();
                let local = local_name(name_val.as_ref());
                if local == b"legendPos" && in_legend {
                    for attr in e.attributes().flatten() {
                        if local_name(attr.key.as_ref()) == b"val" {
                            if let Ok(v) = attr.unescape_value() {
                                legend_pos = match v.as_ref() {
                                    "b" => "bottom".to_string(),
                                    "t" => "top".to_string(),
                                    "l" => "left".to_string(),
                                    "r" => "right".to_string(),
                                    "tr" => "top".to_string(),
                                    _ => "right".to_string(),
                                };
                            }
                        }
                    }
                }
            }
            Ok(quick_xml::events::Event::Text(ref e)) => {
                if let Ok(text) = e.unescape() {
                    let val = text.trim().to_string();
                    if in_formula {
                        current_formula.push_str(&val);
                    } else if in_chart_title_t {
                        if in_axis_title {
                            axis_title.push_str(&val);
                        } else if in_title && !in_ser {
                            title_text.push_str(&val);
                        } else if in_tx && in_ser {
                            series_name_text.push_str(&val);
                        }
                    } else if current_text_tag == "v" {
                        if in_str_cache {
                            cache_strings.push(val);
                        } else if in_num_cache {
                            cache_nums.push(val.parse().unwrap_or(0.0));
                        }
                    }
                }
            }
            Ok(quick_xml::events::Event::End(ref e)) => {
                let name_val = e.name();
                let local = local_name(name_val.as_ref());

                // Check for chart type end tags
                for tag in chart_type_tags {
                    if local == *tag {
                        in_chart_type = false;
                        break;
                    }
                }

                match local {
                    b"ser" => {
                        if in_ser {
                            if !series_name_text.is_empty() {
                                current_series.name = Some(series_name_text.clone());
                            }
                            series_list.push(current_series.clone());
                        }
                        in_ser = false;
                        series_name_text.clear();
                    }
                    b"f" => {
                        if in_formula && !current_formula.is_empty() {
                            if in_cat || in_x_val {
                                current_series.categories_ref = Some(current_formula.clone());
                            } else if in_val || in_y_val {
                                current_series.values_ref = Some(current_formula.clone());
                            } else if in_tx {
                                // Series name from formula -- usually a single cell
                            }
                        }
                        in_formula = false;
                    }
                    b"strCache" => {
                        if in_cat || in_x_val {
                            current_series.categories_cache = cache_strings.clone();
                        } else if in_tx {
                            if let Some(first) = cache_strings.first() {
                                series_name_text = first.clone();
                            }
                        }
                        in_str_cache = false;
                    }
                    b"numCache" => {
                        if in_val || in_y_val {
                            current_series.values_cache = cache_nums.clone();
                        }
                        in_num_cache = false;
                    }
                    b"strRef" => { in_str_ref = false; }
                    b"numRef" => { in_num_ref = false; }
                    b"cat" => { in_cat = false; }
                    b"val" => { in_val = false; }
                    b"xVal" => { in_x_val = false; }
                    b"yVal" => { in_y_val = false; }
                    b"tx" => { in_tx = false; }
                    b"title" if in_axis_title => {
                        in_axis_title = false;
                    }
                    b"title" => { in_title = false; }
                    b"t" => { in_chart_title_t = false; }
                    b"v" => { current_text_tag.clear(); }
                    b"legend" => {
                        in_legend = false;
                        legend = Some(ChartLegend {
                            position: legend_pos.clone(),
                            visible: true,
                        });
                    }
                    b"catAx" => {
                        axes.push(ChartAxis {
                            title: if axis_title.is_empty() { None } else { Some(axis_title.clone()) },
                            position: "bottom".to_string(),
                            min_val: None, max_val: None,
                            axis_type: "category".to_string(),
                        });
                        in_cat_ax = false;
                        axis_title.clear();
                    }
                    b"valAx" => {
                        axes.push(ChartAxis {
                            title: if axis_title.is_empty() { None } else { Some(axis_title.clone()) },
                            position: "left".to_string(),
                            min_val: None, max_val: None,
                            axis_type: "value".to_string(),
                        });
                        in_val_ax = false;
                        axis_title.clear();
                    }
                    _ => {}
                }
            }
            Ok(quick_xml::events::Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }

    if chart_type.is_empty() && series_list.is_empty() {
        return None;
    }
    if chart_type.is_empty() { chart_type = "bar".to_string(); }

    if !title_text.is_empty() {
        title = Some(title_text);
    }

    Some((chart_type, series_list, title, legend, axes))
}

/// Extract hyperlink relationship targets from a worksheet .rels file.
/// Returns HashMap<rId, url> for all hyperlink relationships.
fn extract_hyperlink_refs_from_rels(rels_xml: &str) -> HashMap<String, String> {
    let mut refs = HashMap::new();
    let mut reader = quick_xml::Reader::from_str(rels_xml);
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(quick_xml::events::Event::Empty(ref e)) | Ok(quick_xml::events::Event::Start(ref e)) => {
                if e.name().as_ref() == b"Relationship" {
                    let mut rel_type = String::new();
                    let mut target = String::new();
                    let mut rid = String::new();
                    for attr in e.attributes().flatten() {
                        let key = attr.key.as_ref();
                        let val = attr.unescape_value().unwrap_or_default().to_string();
                        match key {
                            b"Type" => rel_type = val,
                            b"Target" => target = val,
                            b"Id" => rid = val,
                            _ => {}
                        }
                    }
                    if rel_type.contains("/hyperlink") && !target.is_empty() {
                        refs.insert(rid, target);
                    }
                }
            }
            Ok(quick_xml::events::Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    refs
}

/// Parse all hyperlinks from worksheet XML and their relationship files.
fn parse_hyperlinks_from_zip(data: &[u8], sheets: &mut [SheetData]) {
    let cursor = Cursor::new(data);
    let mut archive = match zip::ZipArchive::new(cursor) {
        Ok(a) => a,
        Err(_) => return,
    };

    let sheet_name_order = parse_sheet_name_order(&mut archive);

    let file_names: Vec<String> = (0..archive.len())
        .filter_map(|i| archive.by_index(i).ok().map(|f| f.name().to_string()))
        .collect();

    let mut worksheet_files: Vec<&String> = file_names.iter()
        .filter(|f| f.starts_with("xl/worksheets/sheet") && f.ends_with(".xml") && !f.contains("_rels"))
        .collect();
    worksheet_files.sort();

    for (idx, ws_file) in worksheet_files.iter().enumerate() {
        let sheet_name = match sheet_name_order.get(idx) {
            Some(n) => n.clone(),
            None => continue,
        };

        let sheet = match sheets.iter_mut().find(|s| s.name == sheet_name) {
            Some(s) => s,
            None => continue,
        };

        // Read the .rels file for this worksheet
        let base_name = ws_file.trim_start_matches("xl/worksheets/");
        let rels_path = format!("xl/worksheets/_rels/{}.rels", base_name);

        let rels_map = if let Ok(mut rels_file) = archive.by_name(&rels_path) {
            let mut content = String::new();
            if rels_file.read_to_string(&mut content).is_ok() {
                extract_hyperlink_refs_from_rels(&content)
            } else {
                HashMap::new()
            }
        } else {
            HashMap::new()
        };

        // Read and parse worksheet XML for <hyperlinks> section
        let ws_xml = if let Ok(mut f) = archive.by_name(ws_file) {
            let mut s = String::new();
            if f.read_to_string(&mut s).is_ok() { s } else { continue; }
        } else {
            continue;
        };

        let mut reader = quick_xml::Reader::from_str(&ws_xml);
        let mut buf = Vec::new();
        let mut in_hyperlinks = false;

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(quick_xml::events::Event::Start(ref e)) => {
                    if e.name().as_ref() == b"hyperlinks" {
                        in_hyperlinks = true;
                    } else if in_hyperlinks && e.name().as_ref() == b"hyperlink" {
                        let link = parse_hyperlink_element(e, &rels_map);
                        if let Some(l) = link { sheet.hyperlinks.push(l); }
                    }
                }
                Ok(quick_xml::events::Event::Empty(ref e)) => {
                    if in_hyperlinks && e.name().as_ref() == b"hyperlink" {
                        let link = parse_hyperlink_element(e, &rels_map);
                        if let Some(l) = link { sheet.hyperlinks.push(l); }
                    }
                }
                Ok(quick_xml::events::Event::End(ref e)) => {
                    if e.name().as_ref() == b"hyperlinks" {
                        in_hyperlinks = false;
                    }
                }
                Ok(quick_xml::events::Event::Eof) => break,
                Err(_) => break,
                _ => {}
            }
            buf.clear();
        }
    }
}

/// Parse a single <hyperlink> element into a HyperlinkDef.
fn parse_hyperlink_element(
    e: &quick_xml::events::BytesStart,
    rels_map: &HashMap<String, String>,
) -> Option<HyperlinkDef> {
    let mut cell_ref = String::new();
    let mut rid = String::new();
    let mut location = String::new();
    let mut tooltip = String::new();
    let mut display = String::new();

    for attr in e.attributes().flatten() {
        let val = attr.unescape_value().unwrap_or_default().to_string();
        match attr.key.as_ref() {
            b"ref" => cell_ref = val,
            b"r:id" => rid = val,
            b"location" => location = val,
            b"tooltip" => tooltip = val,
            b"display" => display = val,
            _ => {}
        }
    }

    if cell_ref.is_empty() {
        return None;
    }

    let (url, is_internal) = if !rid.is_empty() {
        // External link (or mailto:) - look up URL from rels map
        let base_url = rels_map.get(&rid).cloned().unwrap_or_default();
        if base_url.is_empty() {
            return None;
        }
        // If there's also a location, append it as a fragment
        let full_url = if !location.is_empty() {
            format!("{}#{}", base_url, location)
        } else {
            base_url
        };
        (full_url, false)
    } else if !location.is_empty() {
        // Internal link only (cross-sheet or named range)
        (format!("#{}", location), true)
    } else {
        return None;
    };

    Some(HyperlinkDef {
        cell_ref,
        url,
        tooltip: if tooltip.is_empty() { None } else { Some(tooltip) },
        display: if display.is_empty() { None } else { Some(display) },
        is_internal,
    })
}

/// Parse all charts from the XLSX zip file and add them to the corresponding sheets
fn parse_charts_from_zip(data: &[u8], sheets: &mut [SheetData]) {
    let cursor = Cursor::new(data);
    let mut archive = match zip::ZipArchive::new(cursor) {
        Ok(a) => a,
        Err(_) => return,
    };

    let sheet_name_order = parse_sheet_name_order(&mut archive);

    let file_names: Vec<String> = (0..archive.len())
        .filter_map(|i| archive.by_index(i).ok().map(|f| f.name().to_string()))
        .collect();

    let mut worksheet_files: Vec<&String> = file_names.iter()
        .filter(|f| f.starts_with("xl/worksheets/sheet") && f.ends_with(".xml") && !f.contains("_rels"))
        .collect();
    worksheet_files.sort();

    for (idx, ws_file) in worksheet_files.iter().enumerate() {
        let sheet_name = match sheet_name_order.get(idx) {
            Some(n) => n.clone(),
            None => continue,
        };

        let sheet = match sheets.iter_mut().find(|s| s.name == sheet_name) {
            Some(s) => s,
            None => continue,
        };

        // Find drawing relationships for this worksheet
        let base_name = ws_file.trim_start_matches("xl/worksheets/");
        let rels_path = format!("xl/worksheets/_rels/{}.rels", base_name);

        let drawing_refs = if let Ok(mut rels_file) = archive.by_name(&rels_path) {
            let mut content = String::new();
            if rels_file.read_to_string(&mut content).is_ok() {
                extract_drawing_refs_from_rels(&content)
            } else {
                Vec::new()
            }
        } else {
            Vec::new()
        };

        for (_rid, drawing_target) in &drawing_refs {
            // Resolve relative path
            let drawing_path = if drawing_target.starts_with("../") {
                format!("xl/{}", drawing_target.trim_start_matches("../"))
            } else if drawing_target.starts_with("/") {
                drawing_target.trim_start_matches('/').to_string()
            } else {
                format!("xl/worksheets/{}", drawing_target)
            };

            // Read drawing XML
            let drawing_xml = if let Ok(mut f) = archive.by_name(&drawing_path) {
                let mut s = String::new();
                if f.read_to_string(&mut s).is_ok() { s } else { continue; }
            } else {
                continue;
            };

            // Parse drawing anchors
            let anchors = parse_drawing_anchors(&drawing_xml);
            if anchors.is_empty() { continue; }

            // Read drawing rels to map rIds to chart file paths
            let drawing_base = drawing_path.rsplit('/').next().unwrap_or(&drawing_path);
            let drawing_dir = drawing_path.trim_end_matches(drawing_base);
            let drawing_rels_path = format!("{}_rels/{}.rels", drawing_dir, drawing_base);

            let chart_refs = if let Ok(mut f) = archive.by_name(&drawing_rels_path) {
                let mut s = String::new();
                if f.read_to_string(&mut s).is_ok() {
                    extract_chart_refs_from_rels(&s)
                } else {
                    HashMap::new()
                }
            } else {
                HashMap::new()
            };

            // For each anchor with a chart reference, parse the chart XML
            for (anchor, chart_rid) in &anchors {
                let chart_target = match chart_refs.get(chart_rid) {
                    Some(t) => t,
                    None => continue,
                };

                let chart_path = if chart_target.starts_with("../") {
                    format!("xl/{}", chart_target.trim_start_matches("../"))
                } else if chart_target.starts_with("/") {
                    chart_target.trim_start_matches('/').to_string()
                } else {
                    format!("{}{}",  drawing_dir, chart_target)
                };

                let chart_xml = if let Ok(mut f) = archive.by_name(&chart_path) {
                    let mut s = String::new();
                    if f.read_to_string(&mut s).is_ok() { s } else { continue; }
                } else {
                    continue;
                };

                if let Some((chart_type, series, title, legend, axes)) = parse_chart_xml(&chart_xml) {
                    sheet.charts.push(ChartDefinition {
                        chart_type,
                        series,
                        title,
                        legend,
                        axes,
                        anchor: anchor.clone(),
                        style: None,
                    });
                }
            }
        }
    }
}

// --- Sparkline Parsing ---

/// Parse sparklines from worksheet extension lists (<x14:sparklineGroups>)
fn parse_sparklines_from_zip(data: &[u8], sheets: &mut [SheetData]) {
    let cursor = Cursor::new(data);
    let mut archive = match zip::ZipArchive::new(cursor) {
        Ok(a) => a,
        Err(_) => return,
    };

    let sheet_name_order = parse_sheet_name_order(&mut archive);

    let file_names: Vec<String> = (0..archive.len())
        .filter_map(|i| archive.by_index(i).ok().map(|f| f.name().to_string()))
        .collect();

    let mut worksheet_files: Vec<&String> = file_names.iter()
        .filter(|f| f.starts_with("xl/worksheets/sheet") && f.ends_with(".xml") && !f.contains("_rels"))
        .collect();
    worksheet_files.sort();

    for (idx, ws_file) in worksheet_files.iter().enumerate() {
        let sheet_name = match sheet_name_order.get(idx) {
            Some(n) => n.clone(),
            None => continue,
        };

        let sheet = match sheets.iter_mut().find(|s| s.name == sheet_name) {
            Some(s) => s,
            None => continue,
        };

        if let Ok(mut file) = archive.by_name(ws_file) {
            let mut content = String::new();
            if file.read_to_string(&mut content).is_err() { continue; }

            let mut reader = quick_xml::Reader::from_str(&content);
            let mut buf = Vec::new();

            let mut in_sparkline_group = false;
            let mut in_sparkline = false;
            let mut spark_type = String::from("line");
            let mut spark_color: Option<String> = None;
            let mut spark_negative_color: Option<String> = None;
            let mut spark_high = false;
            let mut spark_low = false;
            let mut spark_first = false;
            let mut spark_last = false;
            let mut current_text_tag = String::new();
            let mut data_range = String::new();
            let mut location = String::new();

            loop {
                match reader.read_event_into(&mut buf) {
                    Ok(quick_xml::events::Event::Start(ref e)) => {
                        let name_val = e.name();
                        let local = local_name(name_val.as_ref());
                        if local == b"sparklineGroup" {
                            in_sparkline_group = true;
                            spark_type = "line".to_string();
                            spark_color = None;
                            spark_negative_color = None;
                            spark_high = false;
                            spark_low = false;
                            spark_first = false;
                            spark_last = false;

                            for attr in e.attributes().flatten() {
                                let key = local_name(attr.key.as_ref());
                                let val = attr.unescape_value().unwrap_or_default().to_string();
                                match key {
                                    b"type" => spark_type = val,
                                    b"high" => spark_high = val == "1",
                                    b"low" => spark_low = val == "1",
                                    b"first" => spark_first = val == "1",
                                    b"last" => spark_last = val == "1",
                                    _ => {}
                                }
                            }
                        } else if local == b"sparkline" && in_sparkline_group {
                            in_sparkline = true;
                            data_range.clear();
                            location.clear();
                        } else if (local == b"f" || local == b"sqref") && in_sparkline {
                            current_text_tag = String::from_utf8_lossy(local).to_string();
                        } else if local == b"colorSeries" && in_sparkline_group {
                            for attr in e.attributes().flatten() {
                                if local_name(attr.key.as_ref()) == b"rgb" {
                                    if let Ok(v) = attr.unescape_value() {
                                        let s = v.to_string();
                                        spark_color = Some(if s.len() == 8 { format!("#{}", &s[2..]) } else { format!("#{}", s) });
                                    }
                                }
                            }
                        } else if local == b"colorNegative" && in_sparkline_group {
                            for attr in e.attributes().flatten() {
                                if local_name(attr.key.as_ref()) == b"rgb" {
                                    if let Ok(v) = attr.unescape_value() {
                                        let s = v.to_string();
                                        spark_negative_color = Some(if s.len() == 8 { format!("#{}", &s[2..]) } else { format!("#{}", s) });
                                    }
                                }
                            }
                        }
                    }
                    Ok(quick_xml::events::Event::Empty(ref e)) => {
                        let name_val = e.name();
                        let local = local_name(name_val.as_ref());
                        if local == b"colorSeries" && in_sparkline_group {
                            for attr in e.attributes().flatten() {
                                if local_name(attr.key.as_ref()) == b"rgb" {
                                    if let Ok(v) = attr.unescape_value() {
                                        let s = v.to_string();
                                        spark_color = Some(if s.len() == 8 { format!("#{}", &s[2..]) } else { format!("#{}", s) });
                                    }
                                }
                            }
                        } else if local == b"colorNegative" && in_sparkline_group {
                            for attr in e.attributes().flatten() {
                                if local_name(attr.key.as_ref()) == b"rgb" {
                                    if let Ok(v) = attr.unescape_value() {
                                        let s = v.to_string();
                                        spark_negative_color = Some(if s.len() == 8 { format!("#{}", &s[2..]) } else { format!("#{}", s) });
                                    }
                                }
                            }
                        }
                    }
                    Ok(quick_xml::events::Event::Text(ref e)) => {
                        if let Ok(text) = e.unescape() {
                            let val = text.trim().to_string();
                            match current_text_tag.as_str() {
                                "f" => data_range = val,
                                "sqref" => location = val,
                                _ => {}
                            }
                        }
                        current_text_tag.clear();
                    }
                    Ok(quick_xml::events::Event::End(ref e)) => {
                        let name_val = e.name();
                        let local = local_name(name_val.as_ref());
                        if local == b"sparkline" && in_sparkline {
                            if !data_range.is_empty() && !location.is_empty() {
                                sheet.sparklines.push(SparklineDefinition {
                                    sparkline_type: spark_type.clone(),
                                    data_range: data_range.clone(),
                                    location: location.clone(),
                                    color: spark_color.clone(),
                                    negative_color: spark_negative_color.clone(),
                                    axis_color: None,
                                    high_point: spark_high,
                                    low_point: spark_low,
                                    first_point: spark_first,
                                    last_point: spark_last,
                                });
                            }
                            in_sparkline = false;
                        } else if local == b"sparklineGroup" {
                            in_sparkline_group = false;
                        }
                    }
                    Ok(quick_xml::events::Event::Eof) => break,
                    Err(_) => break,
                    _ => {}
                }
                buf.clear();
            }
        }
    }
}

/// Extract table file references from a sheet .rels file
fn extract_table_refs_from_rels(rels_xml: &str) -> Vec<String> {
    let mut refs = Vec::new();
    let mut reader = quick_xml::Reader::from_str(rels_xml);
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(quick_xml::events::Event::Empty(ref e)) | Ok(quick_xml::events::Event::Start(ref e)) => {
                if e.name().as_ref() == b"Relationship" {
                    let mut is_table = false;
                    let mut target = String::new();
                    for attr in e.attributes().flatten() {
                        let key = attr.key.as_ref();
                        let val = attr.unescape_value().unwrap_or_default().to_string();
                        if key == b"Type" && val.contains("/table") {
                            is_table = true;
                        }
                        if key == b"Target" {
                            target = val;
                        }
                    }
                    if is_table && !target.is_empty() {
                        refs.push(target);
                    }
                }
            }
            Ok(quick_xml::events::Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    refs
}
