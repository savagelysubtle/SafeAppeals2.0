// Copyright (c) Safe Appeals. All rights reserved.

use crate::config::ServerConfig;
use crate::model::{check_model_dir, ModelHealth};
use crate::ocr::{ocr_available, resolve_infer_script, resolve_python, run_ocr_infer, OcrError};
use crate::pdf::{
	extract_pages_from_file, has_substantial_text, pages_to_markdown, slice_pages, ParseResult,
};
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tempfile::NamedTempFile;

#[derive(Clone)]
pub struct AppState {
	pub config: ServerConfig,
	pub infer_script: Option<PathBuf>,
	pub python: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct HealthResponse {
	pub ok: bool,
	#[serde(skip_serializing_if = "Option::is_none")]
	pub model: Option<String>,
	#[serde(skip_serializing_if = "Option::is_none")]
	pub detail: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ParseRequest {
	#[serde(rename = "sourceUri")]
	pub source_uri: String,
	#[serde(rename = "pdfBase64")]
	pub pdf_base64: String,
	#[serde(default, rename = "pageFrom")]
	pub page_from: Option<u32>,
	#[serde(default, rename = "pageTo")]
	pub page_to: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct ParseResponse {
	pub markdown: String,
	#[serde(rename = "pageCount")]
	pub page_count: u32,
	#[serde(skip_serializing_if = "Vec::is_empty")]
	pub anchors: Vec<crate::pdf::CitationAnchor>,
}

#[derive(Debug, Serialize)]
pub struct ParseErrorResponse {
	pub error: String,
}

impl From<ModelHealth> for HealthResponse {
	fn from(value: ModelHealth) -> Self {
		Self {
			ok: value.ok,
			model: value.model,
			detail: value.detail,
		}
	}
}

pub fn build_router(state: AppState) -> Router {
	Router::new()
		.route("/health", get(health_handler))
		.route("/parse", post(parse_handler))
		.with_state(Arc::new(state))
}

pub fn app_state_from_config(config: ServerConfig) -> AppState {
	let infer_script = resolve_infer_script(config.infer_script.as_deref());
	let python = resolve_python(config.python.as_deref());
	AppState {
		config,
		infer_script,
		python,
	}
}

async fn health_handler(State(state): State<Arc<AppState>>) -> Response {
	let health = check_model_dir(state.config.model_dir.as_deref());
	let body: HealthResponse = health.into();
	if body.ok {
		(Json(body)).into_response()
	} else {
		(StatusCode::SERVICE_UNAVAILABLE, Json(body)).into_response()
	}
}

async fn parse_handler(
	State(state): State<Arc<AppState>>,
	Json(request): Json<ParseRequest>,
) -> Response {
	match parse_pdf(&state, &request).await {
		Ok(result) => Json(ParseResponse {
			markdown: result.markdown,
			page_count: result.page_count,
			anchors: result.anchors,
		})
		.into_response(),
		Err(err) => (
			StatusCode::SERVICE_UNAVAILABLE,
			Json(ParseErrorResponse {
				error: err.to_string(),
			}),
		)
			.into_response(),
	}
}

async fn parse_pdf(state: &AppState, request: &ParseRequest) -> Result<ParseResult, ParseError> {
	let model_health = check_model_dir(state.config.model_dir.as_deref());
	if !model_health.ok {
		return Err(ParseError::ModelUnavailable(
			model_health.detail.unwrap_or_else(|| "model not ready".into()),
		));
	}
	let model_dir = state
		.config
		.model_dir
		.clone()
		.ok_or_else(|| ParseError::ModelUnavailable("SA_DOCPARSE_MODEL_DIR not set".into()))?;

	let pdf_bytes = base64::engine::general_purpose::STANDARD
		.decode(request.pdf_base64.trim())
		.map_err(|e| ParseError::InvalidPdfBase64(e.to_string()))?;

	let temp = NamedTempFile::new().map_err(ParseError::Io)?;
	std::fs::write(temp.path(), &pdf_bytes).map_err(ParseError::Io)?;

	let all_pages = extract_pages_from_file(temp.path()).map_err(ParseError::Pdf)?;
	let page_from = request.page_from;
	let page_to = request.page_to;
	let selected = slice_pages(&all_pages, page_from, page_to);
	let offset = page_from.unwrap_or(1);

	if has_substantial_text(&selected) {
		return Ok(pages_to_markdown(
			&selected,
			&request.source_uri,
			offset,
		));
	}

	if !ocr_available(state.python.as_deref(), state.infer_script.as_deref()) {
		return Err(ParseError::OcrUnavailable(
			"Scanned PDF OCR helper not available".into(),
		));
	}

	let python = state
		.python
		.as_deref()
		.ok_or_else(|| ParseError::OcrUnavailable("python3 not found".into()))?;
	let script = state
		.infer_script
		.as_deref()
		.ok_or_else(|| ParseError::OcrUnavailable("infer script not found".into()))?;

	run_ocr_infer(
		python,
		script,
		&model_dir,
		temp.path(),
		&request.source_uri,
		page_from,
		page_to,
	)
	.map_err(|e| match e {
		OcrError::ScriptNotFound | OcrError::PythonNotFound => {
			ParseError::OcrUnavailable("Scanned PDF OCR helper not available".into())
		}
		other => ParseError::OcrFailed(other.to_string()),
	})
}

#[derive(Debug, thiserror::Error)]
pub enum ParseError {
	#[error("invalid pdfBase64: {0}")]
	InvalidPdfBase64(String),
	#[error("model unavailable: {0}")]
	ModelUnavailable(String),
	#[error("{0}")]
	OcrUnavailable(String),
	#[error("OCR failed: {0}")]
	OcrFailed(String),
	#[error("pdf error: {0}")]
	Pdf(#[from] crate::pdf::PdfError),
	#[error("io error: {0}")]
	Io(#[from] std::io::Error),
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::pdf::write_fixture_pdf;
	use base64::Engine;
	use std::fs;
	use tempfile::tempdir;

	fn test_state(model_dir: Option<PathBuf>) -> AppState {
		let config = ServerConfig::from_parts("127.0.0.1", 18742, model_dir, None, None).unwrap();
		app_state_from_config(config)
	}

	#[test]
	fn health_ok_when_model_pack_valid() {
		let tmp = tempdir().unwrap();
		fs::write(tmp.path().join("config.json"), b"{}").unwrap();
		fs::write(tmp.path().join("model.safetensors"), b"x").unwrap();
		let state = test_state(Some(tmp.path().to_path_buf()));
		let health = check_model_dir(state.config.model_dir.as_deref());
		let body: HealthResponse = health.into();
		assert!(body.ok);
		assert_eq!(body.model.as_deref(), Some("unlimited-ocr"));
	}

	#[test]
	fn parse_digital_pdf_returns_markdown() {
		let model_tmp = tempdir().unwrap();
		fs::write(model_tmp.path().join("config.json"), b"{}").unwrap();
		fs::write(model_tmp.path().join("model.safetensors"), b"x").unwrap();

		let pdf_tmp = tempdir().unwrap();
		let pdf_path = pdf_tmp.path().join("doc.pdf");
		write_fixture_pdf(
			&pdf_path,
			"Workers compensation appeal brief with sufficient extractable text.",
		)
		.unwrap();
		let bytes = fs::read(&pdf_path).unwrap();
		let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);

		let state = test_state(Some(model_tmp.path().to_path_buf()));
		let request = ParseRequest {
			source_uri: "file:///doc.pdf".into(),
			pdf_base64: b64,
			page_from: None,
			page_to: None,
		};
		let result = tokio::runtime::Runtime::new()
			.unwrap()
			.block_on(parse_pdf(&state, &request))
			.unwrap();
		assert!(!result.markdown.is_empty());
		assert!(result.page_count >= 1);
	}
}
