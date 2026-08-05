// Copyright (c) Safe Appeals. All rights reserved.

//! Headless Chrome print-to-PDF for local HTML files.

use super::engine::BrowserEngine;
use crate::engines::error::{EngineError, EngineResult};
use crate::engines::markdown;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

const DEFAULT_TIMEOUT_MS: u64 = 120_000;

pub fn html2pdf(engine: &BrowserEngine, input: &Path, output: &Path) -> EngineResult<()> {
	ensure_local_html(input)?;
	let file_url = local_file_url(input)?;
	let args = build_print_args(&file_url, output);
	run_browser(engine, &args)
}

pub fn md2pdf(engine: &BrowserEngine, input: &Path, output: &Path) -> EngineResult<()> {
	let tmp = tempfile::tempdir().map_err(EngineError::Io)?;
	let html_path = tmp.path().join("md-print.html");
	markdown::md2html(input, &html_path)?;
	html2pdf(engine, &html_path, output)
}

fn ensure_local_html(input: &Path) -> EngineResult<()> {
	let ext = input
		.extension()
		.and_then(|e| e.to_str())
		.unwrap_or("");
	if !ext.eq_ignore_ascii_case("html") && !ext.eq_ignore_ascii_case("htm") {
		return Err(EngineError::InvalidOptions(
			"html2pdf input must be a local .html or .htm file".into(),
		));
	}
	if !input.is_file() {
		return Err(EngineError::Io(std::io::Error::new(
			std::io::ErrorKind::NotFound,
			format!("input not found: {}", input.display()),
		)));
	}
	Ok(())
}

fn local_file_url(path: &Path) -> EngineResult<String> {
	let abs = path
		.canonicalize()
		.map_err(EngineError::Io)?;
	let path_str = abs.to_string_lossy().replace('\\', "/");
	if path_str.starts_with("http://") || path_str.starts_with("https://") {
		return Err(EngineError::InvalidOptions(
			"remote URLs are not allowed for browser-print".into(),
		));
	}
	Ok(format!("file://{path_str}"))
}

fn build_print_args(file_url: &str, output: &Path) -> Vec<String> {
	if file_url.starts_with("http://") || file_url.starts_with("https://") {
		// Defense in depth — caller should reject before reaching here.
		return Vec::new();
	}

	if let Some(parent) = output.parent() {
		let _ = fs::create_dir_all(parent);
	}

	let out_abs = output
		.canonicalize()
		.unwrap_or_else(|_| output.to_path_buf());

	vec![
		"--headless=new".into(),
		"--disable-gpu".into(),
		"--no-first-run".into(),
		"--no-default-browser-check".into(),
		"--allow-file-access-from-files".into(),
		"--disable-dev-shm-usage".into(),
		"--run-all-compositor-stages-before-draw".into(),
		"--virtual-time-budget=10000".into(),
		format!("--print-to-pdf={}", out_abs.to_string_lossy()),
		file_url.to_string(),
	]
}

fn run_browser(engine: &BrowserEngine, args: &[String]) -> EngineResult<()> {
	let install = engine
		.install()
		.ok_or_else(|| EngineError::Conversion("Chromium/Chrome not installed".into()))?;

	if args.is_empty() {
		return Err(EngineError::InvalidOptions(
			"remote URLs are not allowed for browser-print".into(),
		));
	}

	let timeout = engine.job_timeout().unwrap_or(Duration::from_millis(DEFAULT_TIMEOUT_MS));

	let mut cmd = Command::new(&install.binary);
	cmd.args(args);
	cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

	let start = Instant::now();
	let mut child = cmd
		.spawn()
		.map_err(|e| EngineError::conversion(format!("browser spawn: {e}")))?;

	loop {
		if let Some(status) = child
			.try_wait()
			.map_err(|e| EngineError::conversion(format!("browser wait: {e}")))?
		{
			let output = child
				.wait_with_output()
				.map_err(|e| EngineError::conversion(format!("browser output: {e}")))?;
			if !status.success() {
				let stderr = String::from_utf8_lossy(&output.stderr);
				return Err(EngineError::conversion(format!(
					"browser exited with {status}: {stderr}"
				)));
			}
			break;
		}
		if start.elapsed() > timeout {
			let _ = child.kill();
			let _ = child.wait();
			return Err(EngineError::conversion(format!(
				"browser print timed out after {}ms",
				timeout.as_millis()
			)));
		}
		std::thread::sleep(Duration::from_millis(100));
	}

	Ok(())
}

/// Resolve print output path from args (for tests).
pub fn print_output_from_args(args: &[String]) -> Option<PathBuf> {
	args.iter()
		.find_map(|a| a.strip_prefix("--print-to-pdf=").map(PathBuf::from))
}
