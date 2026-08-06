// Copyright (c) Safe Appeals. All rights reserved.

use pdf_extract::extract_text_by_pages;
use serde::{Deserialize, Serialize};
use std::path::Path;
use thiserror::Error;

/// Minimum non-whitespace characters across selected pages to treat PDF as digital.
pub const SUBSTANTIAL_TEXT_THRESHOLD: usize = 40;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CitationAnchor {
	#[serde(rename = "sourceUri")]
	pub source_uri: String,
	#[serde(skip_serializing_if = "Option::is_none")]
	pub page: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParseResult {
	pub markdown: String,
	pub page_count: u32,
	pub anchors: Vec<CitationAnchor>,
}

#[derive(Debug, Error)]
pub enum PdfError {
	#[error("pdf extract failed: {0}")]
	Extract(String),
	#[error("io error: {0}")]
	Io(#[from] std::io::Error),
}

pub fn extract_pages_from_file(path: &Path) -> Result<Vec<String>, PdfError> {
	extract_text_by_pages(path)
		.map_err(|e| PdfError::Extract(e.to_string()))
}

pub fn slice_pages(pages: &[String], page_from: Option<u32>, page_to: Option<u32>) -> Vec<String> {
	if pages.is_empty() {
		return Vec::new();
	}
	let total = pages.len() as u32;
	let from = page_from.unwrap_or(1).max(1).min(total);
	let to = page_to.unwrap_or(total).max(from).min(total);
	pages[(from as usize - 1)..(to as usize)].to_vec()
}

pub fn has_substantial_text(pages: &[String]) -> bool {
	let chars: usize = pages
		.iter()
		.map(|p| p.chars().filter(|c| !c.is_whitespace()).count())
		.sum();
	chars >= SUBSTANTIAL_TEXT_THRESHOLD
}

pub fn pages_to_markdown(pages: &[String], source_uri: &str, page_offset: u32) -> ParseResult {
	let mut markdown_parts = Vec::with_capacity(pages.len());
	let mut anchors = Vec::with_capacity(pages.len());
	for (idx, page_text) in pages.iter().enumerate() {
		let page_num = page_offset + idx as u32;
		let trimmed = page_text.trim();
		if trimmed.is_empty() {
			continue;
		}
		markdown_parts.push(format!("## Page {page_num}\n\n{trimmed}"));
		anchors.push(CitationAnchor {
			source_uri: source_uri.to_string(),
			page: Some(page_num),
		});
	}
	let page_count = if pages.is_empty() { 1 } else { pages.len() as u32 };
	ParseResult {
		markdown: if markdown_parts.is_empty() {
			String::new()
		} else {
			markdown_parts.join("\n\n")
		},
		page_count,
		anchors,
	}
}

/// Create a minimal text PDF fixture using lopdf (tests and integration tests).
#[allow(dead_code)]
pub fn write_fixture_pdf(path: &Path, text: &str) -> Result<(), PdfError> {
	use lopdf::{dictionary, Document, Object, Stream};
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
	doc.save(path)
		.map_err(|e| PdfError::Extract(format!("pdf write: {e}")))?;
	Ok(())
}

fn escape_pdf_string(s: &str) -> String {
	s.replace('\\', "\\\\")
		.replace('(', "\\(")
		.replace(')', "\\)")
}

#[cfg(test)]
mod tests {
	use super::*;
	use tempfile::tempdir;

	#[test]
	fn substantial_text_detects_digital_pdf() {
		let pages = vec![
			"Introduction to workers compensation law in this jurisdiction.".into(),
		];
		assert!(has_substantial_text(&pages));
	}

	#[test]
	fn substantial_text_rejects_blank_scan() {
		let pages = vec!["   \n  ".into(), "".into()];
		assert!(!has_substantial_text(&pages));
	}

	#[test]
	fn digital_pdf_roundtrip() {
		let tmp = tempdir().unwrap();
		let pdf = tmp.path().join("sample.pdf");
		write_fixture_pdf(&pdf, "Hello DocParse digital path with enough text for substantial detection.").unwrap();
		let pages = extract_pages_from_file(&pdf).unwrap();
		assert!(!pages.is_empty());
		assert!(has_substantial_text(&pages));
		let result = pages_to_markdown(&pages, "file:///sample.pdf", 1);
		assert!(result.markdown.contains("Hello") || result.markdown.contains("DocParse"));
		assert_eq!(result.page_count, 1);
		assert_eq!(result.anchors.len(), 1);
	}

	#[test]
	fn page_slice_respects_range() {
		let pages = vec!["a".into(), "b".into(), "c".into()];
		let sliced = slice_pages(&pages, Some(2), Some(3));
		assert_eq!(sliced, vec!["b".to_string(), "c".to_string()]);
	}
}
