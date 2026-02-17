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
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WorkbookModel {
    pub sheets: Vec<SheetData>,
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

        let model = WorkbookModel { sheets };
        let json = serde_json::to_string(&model).map_err(|e| JsError::new(&e.to_string()))?;
        self.model = Some(model);

        Ok(json)
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
