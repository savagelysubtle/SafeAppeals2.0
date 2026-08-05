// Copyright (c) Safe Appeals. All rights reserved.

//! Detect Tesseract and ocrmypdf on PATH.

use std::path::{Path, PathBuf};
use std::process::Command;

/// Resolved OCR tool installations.
#[derive(Debug, Clone, Default)]
pub struct OcrInstall {
	pub tesseract: Option<PathBuf>,
	pub ocrmypdf: Option<PathBuf>,
}

impl OcrInstall {
	pub fn has_tesseract(&self) -> bool {
		self.tesseract.is_some()
	}

	pub fn has_ocrmypdf(&self) -> bool {
		self.ocrmypdf.is_some()
	}
}

pub fn detect_ocr() -> OcrInstall {
	OcrInstall {
		tesseract: detect_tesseract(),
		ocrmypdf: detect_ocrmypdf(),
	}
}

fn detect_tesseract() -> Option<PathBuf> {
	resolve_tool("tesseract", &["--version"])
}

fn detect_ocrmypdf() -> Option<PathBuf> {
	resolve_tool("ocrmypdf", &["--version"])
}

fn resolve_tool(name: &str, verify_args: &[&str]) -> Option<PathBuf> {
	if let Some(path) = find_in_path(name) {
		if verify_tool(&path, verify_args) {
			return Some(path);
		}
	}
	None
}

fn find_in_path(name: &str) -> Option<PathBuf> {
	let path_var = std::env::var_os("PATH")?;
	for dir in std::env::split_paths(&path_var) {
		let candidate = dir.join(name);
		if candidate.is_file() {
			return Some(candidate);
		}
		#[cfg(windows)]
		{
			let candidate = dir.join(format!("{name}.exe"));
			if candidate.is_file() {
				return Some(candidate);
			}
		}
	}
	None
}

fn verify_tool(path: &Path, args: &[&str]) -> bool {
	Command::new(path)
		.args(args)
		.output()
		.map(|o| o.status.success())
		.unwrap_or(false)
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn detect_does_not_hang() {
		let install = detect_ocr();
		if let Some(path) = install.tesseract {
			assert!(path.is_file());
		}
		if let Some(path) = install.ocrmypdf {
			assert!(path.is_file());
		}
	}
}
