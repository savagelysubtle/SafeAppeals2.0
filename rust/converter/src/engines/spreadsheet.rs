// Copyright (c) Safe Appeals. All rights reserved.

use crate::engines::error::{EngineError, EngineResult};
use calamine::{open_workbook, Reader, Xlsx};
use html_escape::encode_text as html_encode;
use rust_xlsxwriter::{Format, Workbook};
use std::fs::File;
use std::path::Path;

pub fn xlsx2csv(input: &Path, output: &Path) -> EngineResult<()> {
	let mut workbook: Xlsx<_> = open_workbook(input).map_err(|e| EngineError::conversion(format!("xlsx: {e}")))?;
	let sheet_names = workbook.sheet_names().to_vec();
	let name = sheet_names
		.first()
		.ok_or_else(|| EngineError::conversion("xlsx has no sheets"))?;
	let range = workbook
		.worksheet_range(name)
		.map_err(|e| EngineError::conversion(format!("sheet: {e}")))?;
	let mut wtr = csv::Writer::from_path(output)?;
	for row in range.rows() {
		let record: Vec<String> = row.iter().map(cell_to_string).collect();
		wtr.write_record(&record)?;
	}
	wtr.flush()?;
	Ok(())
}

pub fn xlsx2md(input: &Path, output: &Path) -> EngineResult<()> {
	let mut workbook: Xlsx<_> = open_workbook(input).map_err(|e| EngineError::conversion(format!("xlsx: {e}")))?;
	let name = workbook
		.sheet_names()
		.first()
		.ok_or_else(|| EngineError::conversion("xlsx has no sheets"))?
		.clone();
	let range = workbook
		.worksheet_range(&name)
		.map_err(|e| EngineError::conversion(format!("sheet: {e}")))?;
	let mut md = format!("## {name}\n\n");
	let rows: Vec<Vec<String>> = range.rows().map(|r| r.iter().map(cell_to_string).collect()).collect();
	if rows.is_empty() {
		std::fs::write(output, md)?;
		return Ok(());
	}
	let header = &rows[0];
	md.push('|');
	for h in header {
		md.push_str(h);
		md.push('|');
	}
	md.push('\n');
	md.push('|');
	for _ in header {
		md.push_str("---|");
	}
	md.push('\n');
	for row in rows.iter().skip(1) {
		md.push('|');
		for cell in row {
			md.push_str(cell);
			md.push('|');
		}
		md.push('\n');
	}
	std::fs::write(output, md)?;
	Ok(())
}

pub fn xlsx2html(input: &Path, output: &Path) -> EngineResult<()> {
	let mut workbook: Xlsx<_> = open_workbook(input).map_err(|e| EngineError::conversion(format!("xlsx: {e}")))?;
	let name = workbook
		.sheet_names()
		.first()
		.ok_or_else(|| EngineError::conversion("xlsx has no sheets"))?
		.clone();
	let range = workbook
		.worksheet_range(&name)
		.map_err(|e| EngineError::conversion(format!("sheet: {e}")))?;
	let mut html = format!(
		"<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>{}</title></head><body><table border=\"1\">",
		html_encode(&name)
	);
	for (i, row) in range.rows().enumerate() {
		html.push_str(if i == 0 { "<thead>" } else if i == 1 { "</thead><tbody>" } else { "" });
		html.push_str("<tr>");
		for cell in row {
			let tag = if i == 0 { "th" } else { "td" };
			html.push_str(&format!("<{tag}>{}</{tag}>", html_encode(&cell_to_string(cell))));
		}
		html.push_str("</tr>");
	}
	html.push_str("</tbody></table></body></html>");
	std::fs::write(output, html)?;
	Ok(())
}

pub fn csv2xlsx(input: &Path, output: &Path) -> EngineResult<()> {
	let mut rdr = csv::Reader::from_path(input)?;
	let mut workbook = Workbook::new();
	let worksheet = workbook.add_worksheet();
	let header_format = Format::new().set_bold();
	for (row_idx, result) in rdr.records().enumerate() {
		let record = result?;
		for (col_idx, field) in record.iter().enumerate() {
			let r = row_idx as u32;
			let c = col_idx as u16;
			if row_idx == 0 {
				worksheet.write_string_with_format(r, c, field, &header_format)?;
			} else {
				worksheet.write_string(r, c, field)?;
			}
		}
	}
	workbook.save(output).map_err(|e| EngineError::conversion(format!("xlsx save: {e}")))?;
	Ok(())
}

pub fn csv2pdf(input: &Path, output: &Path) -> EngineResult<()> {
	let mut rdr = csv::Reader::from_path(input)?;
	let mut text = String::from("CSV Export\n\n");
	for result in rdr.records() {
		let record = result?;
		text.push_str(&record.iter().collect::<Vec<_>>().join(" | "));
		text.push('\n');
	}
	crate::engines::text::write_text_pdf(&text, output)
}

fn cell_to_string(cell: &calamine::Data) -> String {
	match cell {
		calamine::Data::Empty => String::new(),
		calamine::Data::String(s) => s.clone(),
		calamine::Data::Float(f) => f.to_string(),
		calamine::Data::Int(i) => i.to_string(),
		calamine::Data::Bool(b) => b.to_string(),
		calamine::Data::DateTime(d) => format!("{d}"),
		calamine::Data::DateTimeIso(s) => s.clone(),
		calamine::Data::DurationIso(s) => s.clone(),
		calamine::Data::Error(e) => format!("{e:?}"),
	}
}

/// Create a minimal xlsx fixture for tests.
pub fn write_fixture_xlsx(path: &Path) -> EngineResult<()> {
	let mut workbook = Workbook::new();
	let worksheet = workbook.add_worksheet();
	worksheet.write_string(0, 0, "Name")?;
	worksheet.write_string(0, 1, "Value")?;
	worksheet.write_string(1, 0, "Alpha")?;
	worksheet.write_string(1, 1, "1")?;
	workbook.save(path).map_err(|e| EngineError::conversion(format!("fixture xlsx: {e}")))?;
	Ok(())
}

#[cfg(test)]
mod tests {
	use super::*;
	use std::fs;

	#[test]
	fn xlsx_csv_roundtrip() {
		let tmp = tempfile::tempdir().unwrap();
		let xlsx_path = tmp.path().join("test.xlsx");
		let csv_path = tmp.path().join("test.csv");
		let xlsx2_path = tmp.path().join("out.xlsx");
		write_fixture_xlsx(&xlsx_path).unwrap();
		xlsx2csv(&xlsx_path, &csv_path).unwrap();
		let csv = fs::read_to_string(&csv_path).unwrap();
		assert!(csv.contains("Alpha"));
		csv2xlsx(&csv_path, &xlsx2_path).unwrap();
		assert!(xlsx2_path.exists());
	}
}
