// Copyright (c) Safe Appeals. All rights reserved.

//! sa-converter library: protocol handler, registry, and sandbox.

pub mod engines;
pub mod protocol;
pub mod registry;
pub mod sandbox;

use engines::error::EngineError;
use engines::browser::BrowserEngine;
use engines::libreoffice::LibreOfficeWorker;
use engines::ocr::OcrEngine;
use engines::ConvertEngines;
use protocol::{write_error, write_error_with_data, write_response, Request, VERSION};
use registry::{alias_entries, build_registry, lookup_with_availability, resolve_key, EngineAvailability};
use sandbox::{Sandbox, SandboxError};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{self, Write};

/// Per-engine timeout overrides in milliseconds.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct TimeoutConfig {
	#[serde(skip_serializing_if = "Option::is_none")]
	pub default_ms: Option<u64>,
	#[serde(skip_serializing_if = "Option::is_none")]
	pub libreoffice_ms: Option<u64>,
	#[serde(skip_serializing_if = "Option::is_none")]
	pub chromium_ms: Option<u64>,
	#[serde(skip_serializing_if = "Option::is_none")]
	pub ocr_ms: Option<u64>,
}

/// Server-side state for the NDJSON sidecar.
#[derive(Debug)]
pub struct Server {
	sandbox: Sandbox,
	timeouts_ms: TimeoutConfig,
	shutdown_requested: bool,
	lo_worker: LibreOfficeWorker,
	browser: BrowserEngine,
	ocr: OcrEngine,
}

impl Default for Server {
	fn default() -> Self {
		Self {
			sandbox: Sandbox::default(),
			timeouts_ms: TimeoutConfig::default(),
			shutdown_requested: false,
			lo_worker: LibreOfficeWorker::new(),
			browser: BrowserEngine::new(),
			ocr: OcrEngine::new(),
		}
	}
}

impl Server {
	pub fn new() -> Self {
		Self::default()
	}

	pub fn lo_worker(&self) -> &LibreOfficeWorker {
		&self.lo_worker
	}

	pub fn lo_worker_mut(&mut self) -> &mut LibreOfficeWorker {
		&mut self.lo_worker
	}

	fn engine_availability(&self) -> EngineAvailability {
		EngineAvailability {
			lo: self.lo_worker.is_available(),
			browser: self.browser.is_available(),
			ocr_tesseract: self.ocr.has_tesseract(),
			ocr_ocrmypdf: self.ocr.has_ocrmypdf(),
		}
	}

	fn convert_engines(&self) -> ConvertEngines<'_> {
		ConvertEngines {
			lo: &self.lo_worker,
			browser: &self.browser,
			ocr: &self.ocr,
		}
	}

	pub fn sandbox(&self) -> &Sandbox {
		&self.sandbox
	}

	pub fn sandbox_mut(&mut self) -> &mut Sandbox {
		&mut self.sandbox
	}

	pub fn shutdown_requested(&self) -> bool {
		self.shutdown_requested
	}

	/// Handle one protocol request and write the response.
	pub fn handle_request<W: Write>(&mut self, request: &Request, writer: &mut W) -> io::Result<()> {
		match request.method.as_str() {
			"ping" => self.handle_ping(&request.id, writer),
			"shutdown" => self.handle_shutdown(&request.id, writer),
			"configure" => self.handle_configure(&request.id, &request.params, writer),
			"get_available_conversions" => {
				self.handle_get_available_conversions(&request.id, writer)
			}
			"convert" => self.handle_convert(&request.id, &request.params, writer),
			"batch_convert" => self.handle_batch_convert(&request.id, &request.params, writer),
			"merge_pdfs" => self.handle_merge_pdfs(&request.id, &request.params, writer),
			"extract_pdf_pages" => {
				self.handle_extract_pdf_pages(&request.id, &request.params, writer)
			}
			other => write_error(
				writer,
				&request.id,
				"UNKNOWN_METHOD",
				&format!("unknown method: {other}"),
			),
		}
	}

	fn handle_ping<W: Write>(&self, id: &str, writer: &mut W) -> io::Result<()> {
		write_response(
			writer,
			id,
			json!({
				"ok": true,
				"version": VERSION,
			}),
		)
	}

	fn handle_shutdown<W: Write>(&mut self, id: &str, writer: &mut W) -> io::Result<()> {
		self.lo_worker.shutdown();
		self.shutdown_requested = true;
		write_response(writer, id, json!({ "ok": true }))
	}

	fn handle_configure<W: Write>(
		&mut self,
		id: &str,
		params: &Value,
		writer: &mut W,
	) -> io::Result<()> {
		let configure_params: ConfigureParams = match serde_json::from_value(params.clone()) {
			Ok(p) => p,
			Err(e) => {
				return write_error(
					writer,
					id,
					"INVALID_PARAMS",
					&format!("configure params invalid: {e}"),
				);
			}
		};

		if let Err(e) = self.sandbox.configure(&configure_params.roots) {
			return write_sandbox_error(writer, id, &e);
		}

		if let Some(timeouts) = configure_params.timeouts_ms {
			self.timeouts_ms = timeouts;
		}

		let lo_profile = configure_params
			.lo_profile_dir
			.as_ref()
			.map(std::path::PathBuf::from);
		if let Some(dir) = lo_profile {
			self.lo_worker = LibreOfficeWorker::new().with_profile_dir(dir);
		}
		let lo_detected = self.lo_worker.probe(self.timeouts_ms.libreoffice_ms);

		if let Some(path) = configure_params.chromium_path.as_ref() {
			self.browser = BrowserEngine::new().with_configured_path(path.into());
		}
		let browser_detected = self.browser.probe(
			configure_params.chromium_path.as_ref().map(std::path::PathBuf::from),
			self.timeouts_ms.chromium_ms,
		);

		let ocr_install = self.ocr.probe(self.timeouts_ms.ocr_ms);

		let roots: Vec<String> = self
			.sandbox
			.roots()
			.iter()
			.map(|p| p.to_string_lossy().into_owned())
			.collect();

		write_response(
			writer,
			id,
			json!({
				"roots": roots,
				"libreoffice": {
					"available": lo_detected,
					"healthy": self.lo_worker.is_healthy(),
				},
				"chromium": {
					"available": browser_detected,
				},
				"ocr": {
					"tesseract": ocr_install.has_tesseract(),
					"ocrmypdf": ocr_install.has_ocrmypdf(),
				},
			}),
		)
	}

	fn handle_get_available_conversions<W: Write>(&self, id: &str, writer: &mut W) -> io::Result<()> {
		let conversions: HashMap<String, Value> = build_registry(self.engine_availability())
			.into_iter()
			.map(|(key, spec)| (key, serde_json::to_value(spec).unwrap_or(json!({}))))
			.collect();

		let aliases: HashMap<String, String> = alias_entries().into_iter().collect();

		write_response(
			writer,
			id,
			json!({
				"conversions": conversions,
				"aliases": aliases,
			}),
		)
	}

	fn handle_convert<W: Write>(
		&mut self,
		id: &str,
		params: &Value,
		writer: &mut W,
	) -> io::Result<()> {
		let convert_params: ConvertParams = match serde_json::from_value(params.clone()) {
			Ok(p) => p,
			Err(e) => {
				return write_error(
					writer,
					id,
					"INVALID_PARAMS",
					&format!("convert params invalid: {e}"),
				);
			}
		};

		if let Err(e) = self.sandbox.validate_path(&convert_params.input) {
			return write_sandbox_error(writer, id, &e);
		}
		if let Err(e) = self.sandbox.validate_path(&convert_params.output) {
			return write_sandbox_error(writer, id, &e);
		}

		let canonical_type = resolve_key(&convert_params.r#type);
		let avail = self.engine_availability();
		let Some(spec) = lookup_with_availability(&convert_params.r#type, avail) else {
			return write_error(
				writer,
				id,
				"UNKNOWN_CONVERSION",
				&format!("unknown conversion type: {}", convert_params.r#type),
			);
		};

		if !spec.available {
			let mut data = json!({
				"type": canonical_type,
				"fidelity": spec.fidelity,
				"engine": spec.engine,
			});
			if let Some(hint) = &spec.install_hint {
				data["install_hint"] = json!(hint);
			}
			return write_error_with_data(
				writer,
				id,
				"ENGINE_UNAVAILABLE",
				&format!(
					"conversion {canonical_type} is unavailable (engine: {})",
					spec.engine
				),
				Some(data),
			);
		}

		match engines::convert(
			&self.convert_engines(),
			&canonical_type,
			std::path::Path::new(&convert_params.input),
			std::path::Path::new(&convert_params.output),
			&convert_params.options,
			&spec,
		) {
			Ok(result) => write_response(
				writer,
				id,
				json!({
					"success": true,
					"output_path": result.output_path,
					"duration_ms": result.duration_ms,
					"fidelity": result.fidelity,
					"engine": result.engine,
				}),
			),
			Err(e) => write_engine_error(writer, id, &e),
		}
	}

	fn handle_batch_convert<W: Write>(
		&mut self,
		id: &str,
		params: &Value,
		writer: &mut W,
	) -> io::Result<()> {
		let batch_params: BatchConvertParams = match serde_json::from_value(params.clone()) {
			Ok(p) => p,
			Err(e) => {
				return write_error(
					writer,
					id,
					"INVALID_PARAMS",
					&format!("batch_convert params invalid: {e}"),
				);
			}
		};

		for input in &batch_params.inputs {
			if let Err(e) = self.sandbox.validate_path(input) {
				return write_sandbox_error(writer, id, &e);
			}
		}
		if let Some(output_dir) = &batch_params.output_dir {
			if let Err(e) = self.sandbox.validate_path(output_dir) {
				return write_sandbox_error(writer, id, &e);
			}
		}

		let canonical_type = resolve_key(&batch_params.r#type);
		let avail = self.engine_availability();
		let Some(spec) = lookup_with_availability(&batch_params.r#type, avail) else {
			return write_error(
				writer,
				id,
				"UNKNOWN_CONVERSION",
				&format!("unknown conversion type: {}", batch_params.r#type),
			);
		};

		if !spec.available {
			let mut data = json!({ "type": canonical_type, "engine": spec.engine });
			if let Some(hint) = &spec.install_hint {
				data["install_hint"] = json!(hint);
			}
			return write_error_with_data(
				writer,
				id,
				"ENGINE_UNAVAILABLE",
				&format!("batch conversion {canonical_type} is unavailable"),
				Some(data),
			);
		}

		match engines::batch::batch_convert(
			&self.convert_engines(),
			avail,
			&batch_params.inputs,
			&batch_params.r#type,
			batch_params.output_dir.as_deref(),
			&batch_params.options,
		) {
			Ok(result) => {
				let items: Vec<Value> = result
					.results
					.iter()
					.map(|r| {
						json!({
							"input": r.input,
							"success": r.success,
							"output_path": r.output_path,
							"error": r.error,
						})
					})
					.collect();
				write_response(
					writer,
					id,
					json!({
						"success": result.results.iter().all(|r| r.success),
						"results": items,
						"duration_ms": result.duration_ms,
						"fidelity": result.fidelity,
						"engine": result.engine,
					}),
				)
			}
			Err(e) => write_engine_error(writer, id, &e),
		}
	}

	fn handle_extract_pdf_pages<W: Write>(
		&mut self,
		id: &str,
		params: &Value,
		writer: &mut W,
	) -> io::Result<()> {
		let extract_params: ExtractPdfPagesParams = match serde_json::from_value(params.clone()) {
			Ok(p) => p,
			Err(e) => {
				return write_error(
					writer,
					id,
					"INVALID_PARAMS",
					&format!("extract_pdf_pages params invalid: {e}"),
				);
			}
		};

		if let Err(e) = self.sandbox.validate_path(&extract_params.source) {
			return write_sandbox_error(writer, id, &e);
		}

		match engines::pdf_extract::extract_pdf_pages(std::path::Path::new(
			&extract_params.source,
		)) {
			Ok(pages) => {
				let page_count = pages.len();
				let items: Vec<Value> = pages
					.into_iter()
					.enumerate()
					.map(|(idx, text)| {
						json!({
							"page": idx + 1,
							"text": text,
						})
					})
					.collect();
				write_response(
					writer,
					id,
					json!({
						"success": true,
						"pages": items,
						"page_count": page_count,
					}),
				)
			}
			Err(e) => write_engine_error(writer, id, &e),
		}
	}

	fn handle_merge_pdfs<W: Write>(
		&mut self,
		id: &str,
		params: &Value,
		writer: &mut W,
	) -> io::Result<()> {
		let merge_params: MergePdfsParams = match serde_json::from_value(params.clone()) {
			Ok(p) => p,
			Err(e) => {
				return write_error(
					writer,
					id,
					"INVALID_PARAMS",
					&format!("merge_pdfs params invalid: {e}"),
				);
			}
		};

		for input in &merge_params.inputs {
			if let Err(e) = self.sandbox.validate_path(input) {
				return write_sandbox_error(writer, id, &e);
			}
		}
		if let Err(e) = self.sandbox.validate_path(&merge_params.output) {
			return write_sandbox_error(writer, id, &e);
		}

		let spec = lookup_with_availability("merge_pdfs", self.engine_availability())
			.expect("merge_pdfs must be registered");
		if !spec.available {
			return write_error(
				writer,
				id,
				"ENGINE_UNAVAILABLE",
				"merge_pdfs is unavailable",
			);
		}

		let input_paths: Vec<&std::path::Path> = merge_params
			.inputs
			.iter()
			.map(std::path::Path::new)
			.collect();
		match engines::merge_pdfs(
			&input_paths,
			std::path::Path::new(&merge_params.output),
		) {
			Ok(result) => write_response(
				writer,
				id,
				json!({
					"success": true,
					"output_path": result.output_path,
					"duration_ms": result.duration_ms,
					"fidelity": result.fidelity,
					"engine": result.engine,
				}),
			),
			Err(e) => write_engine_error(writer, id, &e),
		}
	}
}

fn write_engine_error<W: Write>(writer: &mut W, id: &str, err: &EngineError) -> io::Result<()> {
	let code = match err {
		EngineError::UnsupportedConversion(_) => "UNKNOWN_CONVERSION",
		EngineError::InvalidOptions(_) => "INVALID_PARAMS",
		EngineError::Io(_) => "IO_ERROR",
		EngineError::Conversion(_) | EngineError::Internal(_) => "CONVERSION_FAILED",
	};
	write_error(writer, id, code, &err.to_string())
}

fn write_sandbox_error<W: Write>(writer: &mut W, id: &str, err: &SandboxError) -> io::Result<()> {
	let (code, message) = match err {
		SandboxError::NoRootsConfigured => (
			"NO_ROOTS_CONFIGURED",
			"no roots configured; call configure first",
		),
		SandboxError::PathEscape(p) => ("PATH_ESCAPE", p.as_str()),
		SandboxError::OutsideRoots(p) => ("PATH_OUTSIDE_ROOTS", p.as_str()),
		SandboxError::InvalidPath(p) => ("INVALID_PATH", p.as_str()),
	};
	write_error(writer, id, code, message)
}

#[derive(Debug, Deserialize)]
struct ConfigureParams {
	roots: Vec<String>,
	#[serde(default)]
	timeouts_ms: Option<TimeoutConfig>,
	#[serde(default)]
	lo_profile_dir: Option<String>,
	#[serde(default)]
	chromium_path: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ConvertParams {
	input: String,
	output: String,
	r#type: String,
	#[serde(default, rename = "options")]
	options: Value,
}

#[derive(Debug, Deserialize)]
struct BatchConvertParams {
	inputs: Vec<String>,
	r#type: String,
	#[serde(default)]
	output_dir: Option<String>,
	#[serde(default, rename = "options")]
	options: Value,
}

#[derive(Debug, Deserialize)]
struct ExtractPdfPagesParams {
	source: String,
}

#[derive(Debug, Deserialize)]
struct MergePdfsParams {
	inputs: Vec<String>,
	output: String,
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::protocol::{read_request, parse_response_id};
	use std::io::Cursor;

	fn handle_json(server: &mut Server, line: &str) -> String {
		let mut input = Cursor::new(format!("{line}\n"));
		let req = read_request(&mut input).unwrap().unwrap();
		let mut output = Vec::new();
		server.handle_request(&req, &mut output).unwrap();
		String::from_utf8(output).unwrap()
	}

	#[test]
	fn ping_returns_version() {
		let mut server = Server::new();
		let resp = handle_json(
			&mut server,
			r#"{"id":"1","method":"ping","params":{}}"#,
		);
		assert_eq!(parse_response_id(&resp), Some("1".to_string()));
		assert!(resp.contains(r#""ok":true"#));
		assert!(resp.contains(VERSION));
	}

	#[test]
	fn shutdown_sets_flag() {
		let mut server = Server::new();
		let resp = handle_json(
			&mut server,
			r#"{"id":"2","method":"shutdown","params":{}}"#,
		);
		assert!(resp.contains(r#""ok":true"#));
		assert!(server.shutdown_requested());
	}

	#[test]
	fn convert_unknown_type_errors() {
		let mut server = Server::new();
		server
			.sandbox_mut()
			.configure(&["/tmp".to_string()])
			.unwrap();
		let resp = handle_json(
			&mut server,
			r#"{"id":"3","method":"convert","params":{"input":"/tmp/in.docx","output":"/tmp/out.pdf","type":"unknown2pdf"}}"#,
		);
		assert!(resp.contains("UNKNOWN_CONVERSION"));
	}

	#[test]
	fn convert_unavailable_lo_pair() {
		let mut server = Server::new();
		let tmp = tempfile::TempDir::new().unwrap();
		let root = tmp.path().to_string_lossy().to_string();
		server.sandbox_mut().configure(&[root.clone()]).unwrap();
		let input = tmp.path().join("in.docx");
		std::fs::write(&input, b"x").unwrap();
		let output = tmp.path().join("out.pdf");
		let line = format!(
			r#"{{"id":"4","method":"convert","params":{{"input":"{}","output":"{}","type":"docx2pdf"}}}}"#,
			input.display(),
			output.display()
		);
		let resp = handle_json(&mut server, &line);
		assert!(resp.contains("ENGINE_UNAVAILABLE"));
		assert!(resp.contains("install_hint"));
	}

	#[test]
	fn convert_md2html_succeeds() {
		let mut server = Server::new();
		let tmp = tempfile::TempDir::new().unwrap();
		let root = tmp.path().to_string_lossy().to_string();
		server.sandbox_mut().configure(&[root.clone()]).unwrap();
		let input = tmp.path().join("in.md");
		std::fs::write(&input, b"# hi").unwrap();
		let output = tmp.path().join("out.html");
		let line = format!(
			r#"{{"id":"5","method":"convert","params":{{"input":"{}","output":"{}","type":"md2html"}}}}"#,
			input.display(),
			output.display()
		);
		let resp = handle_json(&mut server, &line);
		assert!(resp.contains(r#""success":true"#));
		assert!(output.exists());
	}

	#[test]
	fn convert_unavailable_browser_pair() {
		let mut server = Server::new();
		let tmp = tempfile::TempDir::new().unwrap();
		let root = tmp.path().to_string_lossy().to_string();
		server.sandbox_mut().configure(&[root.clone()]).unwrap();
		let input = tmp.path().join("in.html");
		std::fs::write(&input, b"<html><body>hi</body></html>").unwrap();
		let output = tmp.path().join("out.pdf");
		let line = format!(
			r#"{{"id":"7","method":"convert","params":{{"input":"{}","output":"{}","type":"html2pdf"}}}}"#,
			input.display(),
			output.display()
		);
		let resp = handle_json(&mut server, &line);
		assert!(resp.contains("ENGINE_UNAVAILABLE"));
		assert!(resp.contains("install_hint"));
	}

	#[test]
	fn extract_pdf_pages_succeeds() {
		let mut server = Server::new();
		let tmp = tempfile::TempDir::new().unwrap();
		let root = tmp.path().to_string_lossy().to_string();
		server.sandbox_mut().configure(&[root.clone()]).unwrap();
		let pdf = tmp.path().join("doc.pdf");
		engines::pdf_extract::write_fixture_pdf(&pdf, "Page one text").unwrap();
		let line = format!(
			r#"{{"id":"ep","method":"extract_pdf_pages","params":{{"source":"{}"}}}}"#,
			pdf.display()
		);
		let resp = handle_json(&mut server, &line);
		assert!(resp.contains(r#""success":true"#));
		assert!(resp.contains(r#""pages""#));
	}

	#[test]
	fn get_available_conversions_includes_aliases() {
		let mut server = Server::new();
		let resp = handle_json(
			&mut server,
			r#"{"id":"6","method":"get_available_conversions","params":{}}"#,
		);
		assert!(resp.contains("pdf2ocr_layer"));
		assert!(resp.contains(r#""pdf2ocr":"pdf2ocr_layer""#));
	}
}
