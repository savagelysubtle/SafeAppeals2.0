// Copyright (c) Safe Appeals. All rights reserved.

//! Pure-Rust conversion engines (P1) + external engine dispatch (P2/P3).

pub mod batch;
pub mod browser;
pub mod docx;
pub mod epub;
pub mod error;
pub mod html;
pub mod image_conv;
pub mod libreoffice;
pub mod markdown;
pub mod ocr;
pub mod pdf_extract;
pub mod pdf_ops;
pub mod pptx;
pub mod spreadsheet;
pub mod text;

use crate::registry::{ConversionSpec, Fidelity};
use browser::BrowserEngine;
use error::{EngineError, EngineResult};
use libreoffice::LibreOfficeWorker;
use ocr::OcrEngine;
use serde_json::Value;
use std::path::Path;
use std::time::Instant;

/// Engine handles passed into convert dispatch.
pub struct ConvertEngines<'a> {
	pub lo: &'a LibreOfficeWorker,
	pub browser: &'a BrowserEngine,
	pub ocr: &'a OcrEngine,
}

/// Successful conversion output metadata.
#[derive(Debug, Clone)]
pub struct ConvertOutput {
	pub output_path: String,
	pub duration_ms: u64,
	pub fidelity: Fidelity,
	pub engine: String,
}

/// Dispatch a single-file conversion by canonical registry key.
pub fn convert(
	engines: &ConvertEngines<'_>,
	key: &str,
	input: &Path,
	output: &Path,
	options: &Value,
	spec: &ConversionSpec,
) -> EngineResult<ConvertOutput> {
	let start = Instant::now();
	let result = dispatch(engines, key, input, output, options)?;
	let duration_ms = start.elapsed().as_millis() as u64;
	Ok(ConvertOutput {
		output_path: output.to_string_lossy().into_owned(),
		duration_ms,
		fidelity: spec.fidelity,
		engine: result.engine.unwrap_or_else(|| spec.engine.clone()),
	})
}

fn dispatch(
	engines: &ConvertEngines<'_>,
	key: &str,
	input: &Path,
	output: &Path,
	options: &Value,
) -> EngineResult<DispatchResult> {
	if libreoffice::is_lo_conversion(key) {
		return libreoffice::convert(engines.lo, key, input, output).map(|_| DispatchResult {
			engine: Some("libreoffice".to_string()),
		});
	}
	if browser::is_browser_conversion(key) {
		return browser::convert(engines.browser, key, input, output).map(|_| DispatchResult {
			engine: Some("chromium".to_string()),
		});
	}
	if ocr::is_ocr_conversion(key) {
		return ocr::convert(engines.ocr, key, input, output).map(|_| DispatchResult {
			engine: Some(spec_engine_for_ocr(key)),
		});
	}

	match key {
		"md2html" => markdown::md2html(input, output).map(DispatchResult::from_engine),
		"md2docx" => markdown::md2docx(input, output).map(DispatchResult::from_engine),
		"md2epub" => markdown::md2epub(input, output).map(DispatchResult::from_engine),
		"docx2md" => docx::docx2md(input, output).map(DispatchResult::from_engine),
		"docx2epub" => docx::docx2epub(input, output).map(DispatchResult::from_engine),
		"html2epub" => html::html2epub(input, output).map(DispatchResult::from_engine),
		"epub2html" => epub::epub2html(input, output).map(DispatchResult::from_engine),
		"epub2md" => epub::epub2md(input, output).map(DispatchResult::from_engine),
		"epub2docx" => epub::epub2docx(input, output).map(DispatchResult::from_engine),
		"txt2pdf" => text::txt2pdf(input, output).map(DispatchResult::from_engine),
		"xlsx2csv" => spreadsheet::xlsx2csv(input, output).map(DispatchResult::from_engine),
		"xlsx2md" => spreadsheet::xlsx2md(input, output).map(DispatchResult::from_engine),
		"xlsx2html" => spreadsheet::xlsx2html(input, output).map(DispatchResult::from_engine),
		"csv2xlsx" => spreadsheet::csv2xlsx(input, output).map(DispatchResult::from_engine),
		"csv2pdf" => spreadsheet::csv2pdf(input, output).map(DispatchResult::from_engine),
		"pptx2html" => pptx::pptx2html(input, output).map(DispatchResult::from_engine),
		"pptx2md" => pptx::pptx2md(input, output).map(DispatchResult::from_engine),
		"image2pdf" => image_conv::image2pdf(input, output).map(DispatchResult::from_engine),
		"image2image" => image_conv::image2image(input, output, options).map(DispatchResult::from_engine),
		"pdf2md" => pdf_extract::pdf2md(input, output).map(DispatchResult::from_engine),
		"pdf2html" => pdf_extract::pdf2html(input, output).map(DispatchResult::from_engine),
		"pdf2images" => pdf_extract::pdf2images(input, output, options).map(DispatchResult::from_engine),
		"pdf2compress" => pdf_ops::pdf2compress(input, output).map(DispatchResult::from_engine),
		"pdf2encrypt" => pdf_ops::pdf2encrypt(input, output, options).map(DispatchResult::from_engine),
		"pdf2split" => pdf_ops::pdf2split(input, output, options).map(DispatchResult::from_engine),
		"pdf2watermark" => pdf_ops::pdf2watermark(input, output, options).map(DispatchResult::from_engine),
		"pdf2pages" => pdf_ops::pdf2pages(input, output, options).map(DispatchResult::from_engine),
		"merge_pdfs" => Err(EngineError::Internal(
			"merge_pdfs must be invoked via merge handler".into(),
		)),
		"batch_convert" => Err(EngineError::Internal(
			"batch_convert must be invoked via batch handler".into(),
		)),
		other => Err(EngineError::UnsupportedConversion(other.to_string())),
	}
}

fn spec_engine_for_ocr(key: &str) -> String {
	match key {
		"image2text" | "pdf2ocr_layer" => "tesseract".to_string(),
		"pdf2editable" => "ocrmypdf".to_string(),
		_ => "ocr".to_string(),
	}
}

struct DispatchResult {
	engine: Option<String>,
}

impl DispatchResult {
	fn from_engine(_: ()) -> Self {
		Self { engine: None }
	}
}

/// Merge multiple PDFs into one output file.
pub fn merge_pdfs(inputs: &[&Path], output: &Path) -> EngineResult<ConvertOutput> {
	let start = Instant::now();
	pdf_ops::merge_pdfs(inputs, output)?;
	let spec = crate::registry::lookup("merge_pdfs").expect("merge_pdfs registered");
	Ok(ConvertOutput {
		output_path: output.to_string_lossy().into_owned(),
		duration_ms: start.elapsed().as_millis() as u64,
		fidelity: spec.fidelity,
		engine: spec.engine,
	})
}
