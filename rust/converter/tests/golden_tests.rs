// Copyright (c) Safe Appeals. All rights reserved.

//! Golden fixture tests for P1 pure-Rust engines.

use sa_converter::engines;
use sa_converter::engines::browser::BrowserEngine;
use sa_converter::engines::libreoffice::LibreOfficeWorker;
use sa_converter::engines::ocr::OcrEngine;
use sa_converter::engines::ConvertEngines;
use sa_converter::registry::lookup;
use std::path::PathBuf;

fn convert_ctx<'a>(
	lo: &'a LibreOfficeWorker,
	browser: &'a BrowserEngine,
	ocr: &'a OcrEngine,
) -> ConvertEngines<'a> {
	ConvertEngines { lo, browser, ocr }
}

fn run_convert(type_key: &str, input: &PathBuf, output: &PathBuf) {
	let spec = lookup(type_key).unwrap_or_else(|| panic!("{type_key} not in registry"));
	assert!(spec.available, "{type_key} should be available");
	let lo = LibreOfficeWorker::new();
	let browser = BrowserEngine::new();
	let ocr = OcrEngine::new();
	let ctx = convert_ctx(&lo, &browser, &ocr);
	let result = engines::convert(
		&ctx,
		type_key,
		input,
		output,
		&serde_json::Value::Null,
		&spec,
	);
	assert!(result.is_ok(), "{type_key} failed: {:?}", result.err());
	assert!(output.exists(), "{type_key} output missing");
	assert!(std::fs::metadata(output).unwrap().len() > 0);
}

fn fixtures_dir() -> PathBuf {
	PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("fixtures")
}

fn fixture(name: &str) -> PathBuf {
	fixtures_dir().join(name)
}

#[test]
fn golden_md2html() {
	let tmp = tempfile::tempdir().unwrap();
	let out = tmp.path().join("out.html");
	run_convert("md2html", &fixture("sample.md"), &out);
	let html = std::fs::read_to_string(&out).unwrap();
	assert!(html.contains("Hello SafeAppeals"));
}

#[test]
fn golden_md2docx_and_md2epub() {
	let tmp = tempfile::tempdir().unwrap();
	let docx = tmp.path().join("out.docx");
	let epub = tmp.path().join("out.epub");
	run_convert("md2docx", &fixture("sample.md"), &docx);
	run_convert("md2epub", &fixture("sample.md"), &epub);
}

#[test]
fn golden_html2epub() {
	let tmp = tempfile::tempdir().unwrap();
	let out = tmp.path().join("out.epub");
	run_convert("html2epub", &fixture("sample.html"), &out);
}

#[test]
fn golden_txt2pdf() {
	let tmp = tempfile::tempdir().unwrap();
	let out = tmp.path().join("out.pdf");
	run_convert("txt2pdf", &fixture("sample.txt"), &out);
}

#[test]
fn golden_csv_pipeline() {
	let tmp = tempfile::tempdir().unwrap();
	let xlsx = tmp.path().join("out.xlsx");
	let pdf = tmp.path().join("out.pdf");
	run_convert("csv2xlsx", &fixture("sample.csv"), &xlsx);
	run_convert("csv2pdf", &fixture("sample.csv"), &pdf);
}

#[test]
fn golden_xlsx_from_fixture() {
	let tmp = tempfile::tempdir().unwrap();
	let xlsx = tmp.path().join("sample.xlsx");
	let csv = tmp.path().join("out.csv");
	let md = tmp.path().join("out.md");
	let html = tmp.path().join("out.html");
	sa_converter::engines::spreadsheet::write_fixture_xlsx(&xlsx).unwrap();
	run_convert("xlsx2csv", &xlsx, &csv);
	run_convert("xlsx2md", &xlsx, &md);
	run_convert("xlsx2html", &xlsx, &html);
}

#[test]
fn golden_pdf_text_extract() {
	let tmp = tempfile::tempdir().unwrap();
	let pdf = tmp.path().join("sample.pdf");
	let md = tmp.path().join("out.md");
	let html = tmp.path().join("out.html");
	sa_converter::engines::pdf_extract::write_fixture_pdf(&pdf, "Golden PDF text content").unwrap();
	run_convert("pdf2md", &pdf, &md);
	run_convert("pdf2html", &pdf, &html);
}

#[test]
fn golden_pdf_ops_and_merge() {
	let tmp = tempfile::tempdir().unwrap();
	let pdf1 = tmp.path().join("a.pdf");
	let pdf2 = tmp.path().join("b.pdf");
	let merged = tmp.path().join("merged.pdf");
	let compressed = tmp.path().join("compressed.pdf");
	sa_converter::engines::pdf_extract::write_fixture_pdf(&pdf1, "Doc A").unwrap();
	sa_converter::engines::pdf_extract::write_fixture_pdf(&pdf2, "Doc B").unwrap();
	let spec = lookup("merge_pdfs").unwrap();
	engines::merge_pdfs(&[&pdf1, &pdf2], &merged).unwrap();
	run_convert("pdf2compress", &merged, &compressed);
}

#[test]
fn golden_pptx_extract() {
	let tmp = tempfile::tempdir().unwrap();
	let pptx = tmp.path().join("sample.pptx");
	let md = tmp.path().join("out.md");
	sa_converter::engines::pptx::write_fixture_pptx(&pptx).unwrap();
	run_convert("pptx2md", &pptx, &md);
}

#[test]
fn golden_epub_roundtrip() {
	let tmp = tempfile::tempdir().unwrap();
	let epub = tmp.path().join("out.epub");
	let html = tmp.path().join("round.html");
	let md = tmp.path().join("round.md");
	run_convert("md2epub", &fixture("sample.md"), &epub);
	run_convert("epub2html", &epub, &html);
	run_convert("epub2md", &epub, &md);
}
