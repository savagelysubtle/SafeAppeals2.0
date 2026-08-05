// Copyright (c) Safe Appeals. All rights reserved.

use crate::engines;
use crate::engines::error::{EngineError, EngineResult};
use crate::engines::ConvertEngines;
use crate::registry::{lookup_with_availability, resolve_key, EngineAvailability};
use serde_json::Value;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct BatchItemResult {
	pub input: String,
	pub success: bool,
	pub output_path: Option<String>,
	pub error: Option<String>,
}

#[derive(Debug, Clone)]
pub struct BatchOutput {
	pub results: Vec<BatchItemResult>,
	pub duration_ms: u64,
	pub fidelity: crate::registry::Fidelity,
	pub engine: String,
}

pub fn batch_convert(
	engines: &ConvertEngines<'_>,
	avail: EngineAvailability,
	inputs: &[String],
	convert_type: &str,
	output_dir: Option<&str>,
	options: &Value,
) -> EngineResult<BatchOutput> {
	let canonical = resolve_key(convert_type);
	let spec = lookup_with_availability(convert_type, avail).ok_or_else(|| {
		EngineError::UnsupportedConversion(convert_type.to_string())
	})?;
	if !spec.available {
		return Err(EngineError::Conversion(format!(
			"batch conversion {canonical} is unavailable"
		)));
	}

	let out_dir = output_dir
		.map(PathBuf::from)
		.unwrap_or_else(|| PathBuf::from("."));

	let start = std::time::Instant::now();
	let mut results = Vec::with_capacity(inputs.len());

	for input_str in inputs {
		let input = Path::new(input_str);
		let output = derive_batch_output(input, &out_dir, &canonical);
		match engines::convert(engines, &canonical, input, &output, options, &spec) {
			Ok(out) => {
				results.push(BatchItemResult {
					input: input_str.clone(),
					success: true,
					output_path: Some(out.output_path),
					error: None,
				});
			}
			Err(e) => {
				results.push(BatchItemResult {
					input: input_str.clone(),
					success: false,
					output_path: None,
					error: Some(e.to_string()),
				});
			}
		}
	}

	Ok(BatchOutput {
		results,
		duration_ms: start.elapsed().as_millis() as u64,
		fidelity: spec.fidelity,
		engine: "batch".to_string(),
	})
}

fn derive_batch_output(input: &Path, output_dir: &Path, convert_type: &str) -> PathBuf {
	let stem = input.file_stem().and_then(|s| s.to_str()).unwrap_or("output");
	let ext = target_extension(convert_type);
	output_dir.join(format!("{stem}.{ext}"))
}

fn target_extension(convert_type: &str) -> &'static str {
	match convert_type {
		"md2html" | "epub2html" | "xlsx2html" | "pptx2html" | "pdf2html" => "html",
		"md2docx" | "epub2docx" => "docx",
		"csv2xlsx" => "xlsx",
		"md2epub" | "docx2epub" | "html2epub" => "epub",
		"docx2md" | "epub2md" | "xlsx2md" | "pptx2md" | "pdf2md" | "image2text" => "md",
		"xlsx2csv" => "csv",
		"txt2pdf" | "csv2pdf" | "image2pdf" | "docx2pdf" | "xlsx2pdf" | "pptx2pdf" | "epub2pdf"
		| "html2pdf" | "md2pdf" => "pdf",
		"image2image" | "pptx2images" => "png",
		_ => "out",
	}
}
