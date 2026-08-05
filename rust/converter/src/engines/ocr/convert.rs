// Copyright (c) Safe Appeals. All rights reserved.

//! OCR conversions via Tesseract and ocrmypdf.

use super::engine::OcrEngine;
use crate::engines::error::{EngineError, EngineResult};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

const DEFAULT_TIMEOUT_MS: u64 = 300_000;

pub fn image2text(engine: &OcrEngine, input: &Path, output: &Path) -> EngineResult<()> {
	let tesseract = engine
		.install()
		.tesseract
		.as_ref()
		.ok_or_else(|| EngineError::Conversion("Tesseract not installed".into()))?;

	let tmp = tempfile::tempdir().map_err(EngineError::Io)?;
	let out_base = tmp.path().join("ocr_out");

	let mut cmd = Command::new(tesseract);
	cmd.arg(input)
		.arg(&out_base)
		.stdout(Stdio::piped())
		.stderr(Stdio::piped());
	run_command(engine, cmd)?;

	let produced = tmp.path().join("ocr_out.txt");
	if !produced.exists() {
		return Err(EngineError::conversion(
			"Tesseract did not produce text output",
		));
	}
	copy_output(&produced, output)
}

pub fn pdf2ocr_layer(engine: &OcrEngine, input: &Path, output: &Path) -> EngineResult<()> {
	run_ocrmypdf(
		engine,
		input,
		output,
		&["--skip-text", "--output-type", "pdf"],
	)
}

pub fn pdf2editable(engine: &OcrEngine, input: &Path, output: &Path) -> EngineResult<()> {
	run_ocrmypdf(engine, input, output, &[])
}

fn run_ocrmypdf(
	engine: &OcrEngine,
	input: &Path,
	output: &Path,
	extra_args: &[&str],
) -> EngineResult<()> {
	let ocrmypdf = engine
		.install()
		.ocrmypdf
		.as_ref()
		.ok_or_else(|| EngineError::Conversion("ocrmypdf not installed".into()))?;

	if let Some(parent) = output.parent() {
		fs::create_dir_all(parent).map_err(EngineError::Io)?;
	}

	let mut cmd = Command::new(ocrmypdf);
	cmd.args(extra_args).arg(input).arg(output);
	cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

	run_command(engine, cmd)
}

fn run_command(engine: &OcrEngine, mut cmd: Command) -> EngineResult<()> {
	let timeout = engine
		.job_timeout()
		.unwrap_or(Duration::from_millis(DEFAULT_TIMEOUT_MS));

	let start = Instant::now();
	let mut child = cmd
		.spawn()
		.map_err(|e| EngineError::conversion(format!("OCR spawn: {e}")))?;

	loop {
		if let Some(status) = child
			.try_wait()
			.map_err(|e| EngineError::conversion(format!("OCR wait: {e}")))?
		{
			let output = child
				.wait_with_output()
				.map_err(|e| EngineError::conversion(format!("OCR output: {e}")))?;
			if !status.success() {
				let stderr = String::from_utf8_lossy(&output.stderr);
				return Err(EngineError::conversion(format!(
					"OCR exited with {status}: {stderr}"
				)));
			}
			return Ok(());
		}
		if start.elapsed() > timeout {
			let _ = child.kill();
			let _ = child.wait();
			return Err(EngineError::conversion(format!(
				"OCR job timed out after {}ms",
				timeout.as_millis()
			)));
		}
		std::thread::sleep(Duration::from_millis(100));
	}
}

fn copy_output(produced: &Path, output: &Path) -> EngineResult<()> {
	if let Some(parent) = output.parent() {
		fs::create_dir_all(parent).map_err(EngineError::Io)?;
	}
	fs::copy(produced, output).map_err(EngineError::Io)?;
	Ok(())
}

/// Derive tesseract sidecar path (for tests).
pub fn tesseract_output_path(base: &Path) -> PathBuf {
	base.with_extension("txt")
}
