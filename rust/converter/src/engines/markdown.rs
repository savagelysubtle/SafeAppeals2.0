// Copyright (c) Safe Appeals. All rights reserved.

use crate::engines::error::{EngineError, EngineResult};
use ammonia::Builder;
use comrak::{markdown_to_html, ComrakOptions};
use docx_rs::*;
use std::fs;
use std::path::Path;

pub fn md2html(input: &Path, output: &Path) -> EngineResult<()> {
	let md = fs::read_to_string(input)?;
	let mut options = ComrakOptions::default();
	options.extension.strikethrough = true;
	options.extension.table = true;
	options.extension.tasklist = true;
	let raw_html = markdown_to_html(&md, &options);
	let safe_html = Builder::default().clean(&raw_html);
	let document = format!(
		"<!DOCTYPE html>\n<html><head><meta charset=\"utf-8\"><title>{}</title></head><body>\n{}\n</body></html>",
		html_escape::encode_text(input.file_stem().and_then(|s| s.to_str()).unwrap_or("document")),
		safe_html
	);
	fs::write(output, document)?;
	Ok(())
}

pub fn md2docx(input: &Path, output: &Path) -> EngineResult<()> {
	let md = fs::read_to_string(input)?;
	let mut doc = Docx::new();
	for line in md.lines() {
		let trimmed = line.trim();
		if trimmed.is_empty() {
			continue;
		}
		if let Some(stripped) = trimmed.strip_prefix("# ") {
			doc = doc.add_paragraph(Paragraph::new().add_run(Run::new().add_text(stripped).bold()));
		} else if let Some(stripped) = trimmed.strip_prefix("## ") {
			doc = doc.add_paragraph(
				Paragraph::new().add_run(Run::new().add_text(stripped).bold().size(24)),
			);
		} else if let Some(stripped) = trimmed.strip_prefix("- ") {
			doc = doc.add_paragraph(Paragraph::new().add_run(Run::new().add_text(&format!("• {stripped}"))));
		} else {
			doc = doc.add_paragraph(Paragraph::new().add_run(Run::new().add_text(trimmed)));
		}
	}
	let mut file = fs::File::create(output)?;
	doc.build()
		.pack(&mut file)
		.map_err(|e| EngineError::conversion(format!("docx pack failed: {e}")))?;
	Ok(())
}

pub fn md2epub(input: &Path, output: &Path) -> EngineResult<()> {
	let tmp = tempfile::tempdir()?;
	let html_path = tmp.path().join("content.html");
	md2html(input, &html_path)?;
	let html = fs::read_to_string(&html_path)?;
	crate::engines::epub::build_epub_from_html(
		input.file_stem().and_then(|s| s.to_str()).unwrap_or("document"),
		&html,
		output,
	)
}

#[cfg(test)]
mod tests {
	use super::*;
	use std::io::Write;

	#[test]
	fn md2html_produces_html() {
		let tmp = tempfile::tempdir().unwrap();
		let input = tmp.path().join("test.md");
		let output = tmp.path().join("test.html");
		fs::write(&input, "# Hello\n\nWorld.").unwrap();
		md2html(&input, &output).unwrap();
		let html = fs::read_to_string(&output).unwrap();
		assert!(html.contains("<h1>"));
		assert!(html.contains("Hello"));
	}
}
