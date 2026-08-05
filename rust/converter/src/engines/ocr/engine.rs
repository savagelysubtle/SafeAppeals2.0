// Copyright (c) Safe Appeals. All rights reserved.

//! OCR engine state: detect on configure, shell out on convert.

use super::detect::{detect_ocr, OcrInstall};
use std::time::Duration;

/// Holds detected OCR tools; shells out only on convert.
#[derive(Debug, Default)]
pub struct OcrEngine {
	install: OcrInstall,
	job_timeout: Option<Duration>,
}

impl OcrEngine {
	pub fn new() -> Self {
		Self::default()
	}

	pub fn install(&self) -> &OcrInstall {
		&self.install
	}

	pub fn has_tesseract(&self) -> bool {
		self.install.has_tesseract()
	}

	pub fn has_ocrmypdf(&self) -> bool {
		self.install.has_ocrmypdf()
	}

	pub fn is_available_for(&self, key: &str) -> bool {
		match key {
			"image2text" => self.has_tesseract(),
			"pdf2ocr_layer" | "pdf2editable" => self.has_ocrmypdf(),
			_ => false,
		}
	}

	pub fn job_timeout(&self) -> Option<Duration> {
		self.job_timeout
	}

	/// Detect OCR tools (`--version` only; no OCR jobs).
	pub fn probe(&mut self, timeout_ms: Option<u64>) -> OcrInstall {
		if let Some(ms) = timeout_ms {
			self.job_timeout = Some(Duration::from_millis(ms.max(1_000)));
		}
		self.install = detect_ocr();
		self.install.clone()
	}
}
