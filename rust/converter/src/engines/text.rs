// Copyright (c) Safe Appeals. All rights reserved.

use crate::engines::error::{EngineError, EngineResult};
use printpdf::*;
use std::fs;
use std::path::Path;

const PAGE_WIDTH: f32 = 595.0;
const PAGE_HEIGHT: f32 = 842.0;
const MARGIN: f32 = 50.0;
const LINE_HEIGHT: f32 = 14.0;
const FONT_SIZE: f32 = 11.0;

pub fn txt2pdf(input: &Path, output: &Path) -> EngineResult<()> {
	let text = fs::read_to_string(input)?;
	write_text_pdf(&text, output)
}

pub fn write_text_pdf(text: &str, output: &Path) -> EngineResult<()> {
	let (doc, page1, layer1) =
		PdfDocument::new("SafeAppeals", Mm(PAGE_WIDTH / 72.0 * 25.4), Mm(PAGE_HEIGHT / 72.0 * 25.4), "Layer 1");
	let font = doc.add_builtin_font(BuiltinFont::Helvetica).map_err(|e| {
		EngineError::conversion(format!("font: {e}"))
	})?;
	let current_layer = doc.get_page(page1).get_layer(layer1);

	let max_chars = ((PAGE_WIDTH - 2.0 * MARGIN) / (FONT_SIZE * 0.5)) as usize;
	let mut y = PAGE_HEIGHT - MARGIN;
	for line in text.lines() {
		for chunk in wrap_line(line, max_chars.max(1)) {
			if y < MARGIN {
				y = PAGE_HEIGHT - MARGIN;
			}
			current_layer.use_text(&chunk, FONT_SIZE, Mm(MARGIN / 72.0 * 25.4), Mm(y / 72.0 * 25.4), &font);
			y -= LINE_HEIGHT;
		}
	}

	doc.save(&mut std::io::BufWriter::new(
		fs::File::create(output).map_err(EngineError::Io)?,
	))
	.map_err(|e| EngineError::conversion(format!("pdf save: {e}")))?;
	Ok(())
}

fn wrap_line(line: &str, max_chars: usize) -> Vec<String> {
	if line.is_empty() {
		return vec![String::new()];
	}
	if line.len() <= max_chars {
		return vec![line.to_string()];
	}
	line.split_whitespace()
		.fold(Vec::new(), |mut acc, word| {
			if let Some(last) = acc.last_mut() {
				if last.len() + 1 + word.len() <= max_chars {
					last.push(' ');
					last.push_str(word);
					return acc;
				}
			}
			acc.push(word.to_string());
			acc
		})
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn txt2pdf_creates_pdf() {
		let tmp = tempfile::tempdir().unwrap();
		let input = tmp.path().join("test.txt");
		let output = tmp.path().join("test.pdf");
		fs::write(&input, "Hello PDF world").unwrap();
		txt2pdf(&input, &output).unwrap();
		assert!(output.exists());
		assert!(fs::metadata(&output).unwrap().len() > 100);
	}
}
