// Copyright (c) Safe Appeals. All rights reserved.

//! Chromium browser-print engine for court HTML→PDF paths.

mod detect;
mod engine;
mod print;

pub use detect::{detect_chromium, BrowserInstall};
pub use engine::BrowserEngine;

/// Conversion keys routed through headless browser print.
pub const BROWSER_CONVERSION_KEYS: &[&str] = &["html2pdf", "md2pdf"];

pub fn is_browser_conversion(key: &str) -> bool {
	BROWSER_CONVERSION_KEYS.contains(&key)
}

pub fn convert(
	engine: &BrowserEngine,
	key: &str,
	input: &std::path::Path,
	output: &std::path::Path,
) -> crate::engines::error::EngineResult<()> {
	if !engine.is_available() {
		return Err(crate::engines::error::EngineError::Conversion(
			"Chromium/Chrome is unavailable".into(),
		));
	}
	match key {
		"html2pdf" => print::html2pdf(engine, input, output),
		"md2pdf" => print::md2pdf(engine, input, output),
		other => Err(crate::engines::error::EngineError::UnsupportedConversion(
			other.to_string(),
		)),
	}
}
