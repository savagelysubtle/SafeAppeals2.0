// Copyright (c) Safe Appeals. All rights reserved.

use std::path::{Path, PathBuf};
use thiserror::Error;

pub const MODEL_NAME: &str = "unlimited-ocr";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ModelHealth {
	pub ok: bool,
	pub model: Option<String>,
	pub detail: Option<String>,
}

#[derive(Debug, Error)]
pub enum ModelError {
	#[error("model directory not configured")]
	NotConfigured,
	#[error("model directory does not exist: {0}")]
	NotFound(PathBuf),
	#[error("failed to read model directory {path}: {source}")]
	ReadDir {
		path: PathBuf,
		source: std::io::Error,
	},
}

/// Validate Unlimited-OCR model pack: config.json + weights on disk.
pub fn check_model_dir(model_dir: Option<&Path>) -> ModelHealth {
	match model_dir {
		None => ModelHealth {
			ok: false,
			model: None,
			detail: Some("SA_DOCPARSE_MODEL_DIR is not set".into()),
		},
		Some(dir) if !dir.is_dir() => ModelHealth {
			ok: false,
			model: None,
			detail: Some(format!("model directory not found: {}", dir.display())),
		},
		Some(dir) => match validate_model_pack(dir) {
			Ok(()) => ModelHealth {
				ok: true,
				model: Some(MODEL_NAME.into()),
				detail: None,
			},
			Err(reason) => ModelHealth {
				ok: false,
				model: None,
				detail: Some(reason),
			},
		},
	}
}

fn validate_model_pack(dir: &Path) -> Result<(), String> {
	let config = dir.join("config.json");
	if !config.is_file() {
		return Err(format!("missing config.json in {}", dir.display()));
	}
	if has_safetensors_weights(dir)? {
		return Ok(());
	}
	Err(format!(
		"no *.safetensors or model.safetensors.index.json in {}",
		dir.display()
	))
}

fn has_safetensors_weights(dir: &Path) -> Result<bool, String> {
	if dir.join("model.safetensors.index.json").is_file() {
		return Ok(true);
	}
	let entries = std::fs::read_dir(dir).map_err(|e| format!("read model dir: {e}"))?;
	for entry in entries {
		let entry = entry.map_err(|e| format!("read model dir entry: {e}"))?;
		let name = entry.file_name();
		let name = name.to_string_lossy();
		if name.ends_with(".safetensors") {
			return Ok(true);
		}
	}
	Ok(false)
}

#[cfg(test)]
mod tests {
	use super::*;
	use std::fs;
	use tempfile::tempdir;

	#[test]
	fn health_fails_when_model_dir_missing() {
		let health = check_model_dir(None);
		assert!(!health.ok);
		assert!(health.detail.unwrap().contains("SA_DOCPARSE_MODEL_DIR"));
	}

	#[test]
	fn health_fails_without_weights() {
		let tmp = tempdir().unwrap();
		fs::write(tmp.path().join("config.json"), b"{}").unwrap();
		let health = check_model_dir(Some(tmp.path()));
		assert!(!health.ok);
		assert!(health.detail.unwrap().contains("safetensors"));
	}

	#[test]
	fn health_ok_with_config_and_safetensors() {
		let tmp = tempdir().unwrap();
		fs::write(tmp.path().join("config.json"), b"{}").unwrap();
		fs::write(tmp.path().join("model.safetensors"), b"fake").unwrap();
		let health = check_model_dir(Some(tmp.path()));
		assert!(health.ok);
		assert_eq!(health.model.as_deref(), Some(MODEL_NAME));
	}

	#[test]
	fn health_ok_with_index_json() {
		let tmp = tempdir().unwrap();
		fs::write(tmp.path().join("config.json"), b"{}").unwrap();
		fs::write(tmp.path().join("model.safetensors.index.json"), b"{}").unwrap();
		let health = check_model_dir(Some(tmp.path()));
		assert!(health.ok);
	}
}
