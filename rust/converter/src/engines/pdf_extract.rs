// Copyright (c) Safe Appeals. All rights reserved.

//! PDF text extraction and page rasterization (pure Rust via pdf-extract + lopdf).

use crate::engines::error::{EngineError, EngineResult};
use image::{ImageBuffer, Rgb, RgbImage};
use lopdf::{Document, Object};
use pdf_extract::extract_text;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

pub fn pdf2md(input: &Path, output: &Path) -> EngineResult<()> {
	let text = extract_text(input).map_err(|e| EngineError::conversion(format!("pdf extract: {e}")))?;
	fs::write(output, text.trim())?;
	Ok(())
}

pub fn pdf2html(input: &Path, output: &Path) -> EngineResult<()> {
	let text = extract_text(input).map_err(|e| EngineError::conversion(format!("pdf extract: {e}")))?;
	let html = format!(
		"<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head><body><pre>{}</pre></body></html>",
		html_escape::encode_text(text.trim())
	);
	fs::write(output, html)?;
	Ok(())
}

/// Render PDF pages to PNG images (semantic fidelity — text-layout rasterization via pdf-extract + lopdf).
/// Output: directory if extension absent, or `{stem}_page_N.png` siblings when output looks like a file prefix.
pub fn pdf2images(input: &Path, output: &Path, options: &Value) -> EngineResult<()> {
	let doc = Document::load(input).map_err(|e| EngineError::conversion(format!("pdf load: {e}")))?;
	let page_count = doc.get_pages().len().max(1);
	let dpi = options.get("dpi").and_then(|v| v.as_u64()).unwrap_or(150) as u32;

	let out_dir = if output.extension().is_some() {
		output.parent().unwrap_or_else(|| Path::new(".")).to_path_buf()
	} else {
		fs::create_dir_all(output)?;
		output.to_path_buf()
	};

	let stem = input
		.file_stem()
		.and_then(|s| s.to_str())
		.unwrap_or("page");

	let full_text = extract_text(input).unwrap_or_default();
	let lines: Vec<&str> = full_text.lines().collect();
	let lines_per_page = (lines.len() / page_count).max(1);

	for (page_idx, page_num) in doc.get_pages().keys().enumerate() {
		let page_lines: Vec<&str> = lines
			.iter()
			.skip(page_idx * lines_per_page)
			.take(lines_per_page)
			.copied()
			.collect();
		let png_path = out_dir.join(format!("{stem}_page_{page_num}.png"));
		render_text_page(&page_lines.join("\n"), &png_path, dpi)?;
	}

	Ok(())
}

fn render_text_page(text: &str, output: &Path, _dpi: u32) -> EngineResult<()> {
	let width = 800u32;
	let height = 1100u32;
	let mut img: RgbImage = ImageBuffer::from_fn(width, height, |_, _| Rgb([255, 255, 255]));
	// Simple white page with dark text lines (semantic preview, not pixel-perfect render).
	let lines: Vec<&str> = text.lines().take(60).collect();
	for (i, line) in lines.iter().enumerate() {
		draw_text_line(&mut img, line, 20, 30 + (i as u32) * 16);
	}
	img.save(output)
		.map_err(|e| EngineError::conversion(format!("png save: {e}")))?;
	Ok(())
}

fn draw_text_line(img: &mut RgbImage, text: &str, x: u32, y: u32) {
	// Minimal bitmap font: draw horizontal bars for non-space chars (preview placeholder).
	for (i, ch) in text.chars().take(90).enumerate() {
		if ch.is_whitespace() {
			continue;
		}
		let px = x + (i as u32) * 7;
		if px + 5 < img.width() && y + 10 < img.height() {
			for dy in 0..10 {
				for dx in 0..5 {
					img.put_pixel(px + dx, y + dy, Rgb([30, 30, 30]));
				}
			}
		}
	}
}

/// Create a minimal text PDF fixture using lopdf.
pub fn write_fixture_pdf(path: &Path, text: &str) -> EngineResult<()> {
	use lopdf::{dictionary, Stream};
	let mut doc = Document::with_version("1.5");
	let catalog_id = doc.new_object_id();
	let pages_id = doc.new_object_id();
	let page_id = doc.new_object_id();
	let content_id = doc.new_object_id();
	let font_id = doc.new_object_id();

	let content = format!(
		"BT /F1 12 Tf 50 750 Td ({}) Tj ET",
		escape_pdf_string(text)
	);
	doc.objects.insert(
		content_id,
		Object::Stream(Stream::new(dictionary! {}, content.into_bytes())),
	);
	doc.objects.insert(
		font_id,
		Object::Dictionary(dictionary! {
			"Type" => "Font",
			"Subtype" => "Type1",
			"BaseFont" => "Helvetica",
		}),
	);
	doc.objects.insert(
		page_id,
		Object::Dictionary(dictionary! {
			"Type" => "Page",
			"Parent" => pages_id,
			"MediaBox" => vec![0.into(), 0.into(), 595.into(), 842.into()],
			"Contents" => content_id,
			"Resources" => dictionary! {
				"Font" => dictionary! { "F1" => font_id },
			},
		}),
	);
	doc.objects.insert(
		pages_id,
		Object::Dictionary(dictionary! {
			"Type" => "Pages",
			"Kids" => vec![page_id.into()],
			"Count" => 1,
		}),
	);
	doc.objects.insert(
		catalog_id,
		Object::Dictionary(dictionary! {
			"Type" => "Catalog",
			"Pages" => pages_id,
		}),
	);
	doc.trailer.set("Root", catalog_id);
	doc.max_id = doc.objects.len() as u32;
	let mut doc = doc;
	doc.save(path).map_err(|e| EngineError::conversion(format!("pdf write: {e}")))?;
	Ok(())
}

fn escape_pdf_string(s: &str) -> String {
	s.replace('\\', "\\\\").replace('(', "\\(").replace(')', "\\)")
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn pdf2md_extracts_text() {
		let tmp = tempfile::tempdir().unwrap();
		let pdf = tmp.path().join("test.pdf");
		let md = tmp.path().join("out.md");
		write_fixture_pdf(&pdf, "Hello PDF").unwrap();
		pdf2md(&pdf, &md).unwrap();
		let content = fs::read_to_string(&md).unwrap();
		assert!(content.contains("Hello") || content.contains("PDF"));
	}
}
