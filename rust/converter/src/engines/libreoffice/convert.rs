// Copyright (c) Safe Appeals. All rights reserved.

//! Office-fidelity conversions via warm LibreOffice worker.

use super::worker::LibreOfficeWorker;
use crate::engines::error::{EngineError, EngineResult};
use std::fs;
use std::path::{Path, PathBuf};

pub fn convert(
	worker: &LibreOfficeWorker,
	key: &str,
	input: &Path,
	output: &Path,
) -> EngineResult<()> {
	worker.with_job(|| dispatch(worker, key, input, output))
}

fn dispatch(
	worker: &LibreOfficeWorker,
	key: &str,
	input: &Path,
	output: &Path,
) -> EngineResult<()> {
	match key {
		"docx2pdf" | "xlsx2pdf" | "pptx2pdf" | "epub2pdf" => {
			convert_to_pdf(worker, input, output)
		}
		"pptx2images" => convert_pptx_to_images(worker, input, output),
		other => Err(EngineError::UnsupportedConversion(other.to_string())),
	}
}

fn convert_to_pdf(worker: &LibreOfficeWorker, input: &Path, output: &Path) -> EngineResult<()> {
	let out_dir = output
		.parent()
		.ok_or_else(|| EngineError::conversion("output path has no parent directory"))?;
	fs::create_dir_all(out_dir).map_err(EngineError::Io)?;

	let args = worker.build_convert_args("pdf", input, out_dir);
	worker.run_convert_command(&args)?;

	let produced = out_dir.join(format!(
		"{}.pdf",
		input.file_stem().and_then(|s| s.to_str()).unwrap_or("output")
	));
	if !produced.exists() {
		return Err(EngineError::conversion(format!(
			"LibreOffice did not produce expected output: {}",
			produced.display()
		)));
	}
	move_to_output(&produced, output)
}

fn convert_pptx_to_images(
	worker: &LibreOfficeWorker,
	input: &Path,
	output: &Path,
) -> EngineResult<()> {
	let out_dir = if output.extension().is_some() {
		output.parent().unwrap_or_else(|| Path::new(".")).to_path_buf()
	} else {
		fs::create_dir_all(output).map_err(EngineError::Io)?;
		output.to_path_buf()
	};

	let args = worker.build_convert_args("png", input, &out_dir);
	worker.run_convert_command(&args)?;

	let stem = input
		.file_stem()
		.and_then(|s| s.to_str())
		.unwrap_or("slide");

	let mut produced: Vec<PathBuf> = fs::read_dir(&out_dir)
		.map_err(EngineError::Io)?
		.filter_map(|e| e.ok())
		.map(|e| e.path())
		.filter(|p| {
			p.extension()
				.and_then(|e| e.to_str())
				.map(|e| e.eq_ignore_ascii_case("png"))
				.unwrap_or(false)
				&& p.file_name()
					.and_then(|n| n.to_str())
					.map(|n| n.starts_with(stem))
					.unwrap_or(false)
		})
		.collect();
	produced.sort();

	if produced.is_empty() {
		return Err(EngineError::conversion(
			"LibreOffice did not produce PNG slide exports",
		));
	}

	// When output is a single file path, use first slide; else leave all in out_dir.
	if output.extension().is_some() {
		move_to_output(&produced[0], output)?;
	}
	Ok(())
}

fn move_to_output(produced: &Path, output: &Path) -> EngineResult<()> {
	if produced == output {
		return Ok(());
	}
	if output.exists() {
		fs::remove_file(output).map_err(EngineError::Io)?;
	}
	if let Some(parent) = output.parent() {
		fs::create_dir_all(parent).map_err(EngineError::Io)?;
	}
	fs::rename(produced, output).map_err(|e| {
		EngineError::conversion(format!(
			"failed to move {} -> {}: {e}",
			produced.display(),
			output.display()
		))
	})
}
