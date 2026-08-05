// Copyright (c) Safe Appeals. All rights reserved.

//! OCR engine for image/PDF text extraction (fidelity: ocr).

mod convert;
mod detect;
mod engine;

pub use detect::{detect_ocr, OcrInstall};
pub use engine::OcrEngine;

/// Conversion keys routed through OCR tools.
pub const OCR_CONVERSION_KEYS: &[&str] = &["image2text", "pdf2ocr_layer", "pdf2editable"];

pub fn is_ocr_conversion(key: &str) -> bool {
	OCR_CONVERSION_KEYS.contains(&key)
}

pub fn convert(
	engine: &OcrEngine,
	key: &str,
	input: &std::path::Path,
	output: &std::path::Path,
) -> crate::engines::error::EngineResult<()> {
	if !engine.is_available_for(key) {
		return Err(crate::engines::error::EngineError::Conversion(format!(
			"OCR tool unavailable for {key}"
		)));
	}
	match key {
		"image2text" => convert::image2text(engine, input, output),
		"pdf2ocr_layer" => convert::pdf2ocr_layer(engine, input, output),
		"pdf2editable" => convert::pdf2editable(engine, input, output),
		other => Err(crate::engines::error::EngineError::UnsupportedConversion(
			other.to_string(),
		)),
	}
}
