// Copyright (c) Safe Appeals. All rights reserved.

use crate::pdf::ParseResult;
use serde::Deserialize;
use std::path::{Path, PathBuf};
use std::process::Command;
use thiserror::Error;

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
struct OcrStdout {
	markdown: String,
	#[serde(rename = "pageCount")]
	page_count: u32,
}

#[derive(Debug, Error)]
pub enum OcrError {
	#[error("OCR infer script not found")]
	ScriptNotFound,
	#[error("python interpreter not found on PATH")]
	PythonNotFound,
	#[error("OCR helper exited with status {status}: {stderr}")]
	ProcessFailed { status: i32, stderr: String },
	#[error("OCR helper stdout was not valid JSON: {0}")]
	InvalidJson(String),
	#[error("OCR helper missing markdown in JSON response")]
	MissingMarkdown,
}

/// Resolve Python interpreter: explicit override, env, then `python3` on PATH.
pub fn resolve_python(explicit: Option<&str>) -> Option<String> {
	if let Some(p) = explicit {
		if command_exists(p) {
			return Some(p.to_string());
		}
	}
	if let Ok(env) = std::env::var("SA_DOCPARSE_PYTHON") {
		let trimmed = env.trim();
		if !trimmed.is_empty() && command_exists(trimmed) {
			return Some(trimmed.to_string());
		}
	}
	if command_exists("python3") {
		return Some("python3".into());
	}
	None
}

/// Locate infer_unlimited_ocr.py: explicit override, env, next to binary, or crate tree.
pub fn resolve_infer_script(explicit: Option<&Path>) -> Option<PathBuf> {
	if let Some(path) = explicit {
		if path.is_file() {
			return Some(path.to_path_buf());
		}
	}
	if let Ok(env) = std::env::var("SA_DOCPARSE_INFER_SCRIPT") {
		let path = PathBuf::from(env.trim());
		if path.is_file() {
			return Some(path);
		}
	}
	if let Ok(exe) = std::env::current_exe() {
		if let Some(dir) = exe.parent() {
			for candidate in [
				dir.join("python/infer_unlimited_ocr.py"),
				dir.join("../python/infer_unlimited_ocr.py"),
			] {
				if candidate.is_file() {
					return candidate.canonicalize().ok();
				}
			}
		}
	}
	let manifest_script =
		PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("python/infer_unlimited_ocr.py");
	if manifest_script.is_file() {
		return Some(manifest_script);
	}
	None
}

pub fn ocr_available(python: Option<&str>, script: Option<&Path>) -> bool {
	resolve_python(python).is_some() && script.is_some_and(|s| s.is_file())
}

pub fn run_ocr_infer(
	python: &str,
	script: &Path,
	model_dir: &Path,
	pdf_path: &Path,
	source_uri: &str,
	page_from: Option<u32>,
	page_to: Option<u32>,
) -> Result<ParseResult, OcrError> {
	if !script.is_file() {
		return Err(OcrError::ScriptNotFound);
	}
	if !command_exists(python) {
		return Err(OcrError::PythonNotFound);
	}

	let output = Command::new(python)
		.arg(script)
		.arg(pdf_path)
		.env("SA_DOCPARSE_MODEL_DIR", model_dir)
		.env("SA_DOCPARSE_PDF_PATH", pdf_path)
		.env(
			"SA_DOCPARSE_PAGE_FROM",
			page_from.unwrap_or(1).to_string(),
		)
		.env(
			"SA_DOCPARSE_PAGE_TO",
			page_to.map(|v| v.to_string()).unwrap_or_default(),
		)
		.env("SA_DOCPARSE_SOURCE_URI", source_uri)
		.output()
		.map_err(|_| OcrError::PythonNotFound)?;

	if !output.status.success() {
		let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
		return Err(OcrError::ProcessFailed {
			status: output.status.code().unwrap_or(-1),
			stderr,
		});
	}

	let stdout = String::from_utf8_lossy(&output.stdout);
	let parsed: OcrStdout = serde_json::from_str(stdout.trim())
		.map_err(|e| OcrError::InvalidJson(format!("{e}; stdout={stdout}")))?;
	if parsed.markdown.is_empty() && parsed.page_count == 0 {
		return Err(OcrError::MissingMarkdown);
	}

	Ok(ParseResult {
		markdown: parsed.markdown,
		page_count: parsed.page_count.max(1),
		anchors: Vec::new(),
	})
}

fn command_exists(name: &str) -> bool {
	Command::new(name)
		.arg("--version")
		.output()
		.map(|o| o.status.success())
		.unwrap_or(false)
		|| Command::new(name)
			.arg("-V")
			.output()
			.map(|o| o.status.success())
			.unwrap_or(false)
		|| which_via_path(name)
}

fn which_via_path(name: &str) -> bool {
	if name.contains('/') || name.contains('\\') {
		return Path::new(name).is_file();
	}
	std::env::var_os("PATH").is_some_and(|paths| {
		std::env::split_paths(&paths).any(|dir| dir.join(name).is_file())
	})
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn resolve_infer_script_finds_crate_script() {
		let script = resolve_infer_script(None);
		assert!(script.is_some());
		assert!(script.unwrap().ends_with("infer_unlimited_ocr.py"));
	}
}
