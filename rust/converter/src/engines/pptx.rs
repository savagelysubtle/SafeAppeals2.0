// Copyright (c) Safe Appeals. All rights reserved.

use crate::engines::error::{EngineError, EngineResult};
use html_escape::encode_text as html_encode;
use quick_xml::events::Event;
use quick_xml::Reader;
use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

pub fn pptx2html(input: &Path, output: &Path) -> EngineResult<()> {
	let slides = extract_slide_texts(input)?;
	let mut html = String::from(
		"<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Presentation</title></head><body>",
	);
	for (i, slide) in slides.iter().enumerate() {
		html.push_str(&format!("<section><h2>Slide {}</h2>", i + 1));
		for line in slide {
			html.push_str(&format!("<p>{}</p>", html_encode(line)));
		}
		html.push_str("</section>");
	}
	html.push_str("</body></html>");
	std::fs::write(output, html)?;
	Ok(())
}

pub fn pptx2md(input: &Path, output: &Path) -> EngineResult<()> {
	let slides = extract_slide_texts(input)?;
	let mut md = String::new();
	for (i, slide) in slides.iter().enumerate() {
		md.push_str(&format!("## Slide {}\n\n", i + 1));
		for line in slide {
			md.push_str(line);
			md.push('\n');
		}
		md.push('\n');
	}
	std::fs::write(output, md)?;
	Ok(())
}

fn extract_slide_texts(input: &Path) -> EngineResult<Vec<Vec<String>>> {
	let file = File::open(input)?;
	let mut archive = zip::ZipArchive::new(file).map_err(|e| EngineError::conversion(format!("pptx zip: {e}")))?;
	let mut entries: Vec<(u32, Vec<String>)> = Vec::new();
	for i in 0..archive.len() {
		let mut entry = archive.by_index(i).map_err(|e| EngineError::conversion(format!("entry: {e}")))?;
		let name = entry.name().to_string();
		if name.starts_with("ppt/slides/slide") && name.ends_with(".xml") {
			let slide_num = name
				.trim_start_matches("ppt/slides/slide")
				.trim_end_matches(".xml")
				.parse::<u32>()
				.unwrap_or(i as u32);
			let mut xml = String::new();
			entry.read_to_string(&mut xml)?;
			entries.push((slide_num, parse_slide_xml(&xml)));
		}
	}
	entries.sort_by_key(|(n, _)| *n);
	let slides: Vec<Vec<String>> = entries.into_iter().map(|(_, t)| t).collect();
	if slides.is_empty() {
		return Err(EngineError::conversion("no slides found in pptx"));
	}
	Ok(slides)
}

fn parse_slide_xml(xml: &str) -> Vec<String> {
	let mut reader = Reader::from_str(xml);
	reader.config_mut().trim_text(true);
	let mut texts = Vec::new();
	let mut buf = Vec::new();
	let mut in_text = false;
	let mut current = String::new();
	loop {
		match reader.read_event_into(&mut buf) {
			Ok(Event::Start(e)) if e.name().as_ref() == b"a:t" => {
				in_text = true;
				current.clear();
			}
			Ok(Event::Text(e)) if in_text => {
				current.push_str(&e.unescape().unwrap_or_default());
			}
			Ok(Event::End(e)) if e.name().as_ref() == b"a:t" => {
				in_text = false;
				let trimmed = current.trim();
				if !trimmed.is_empty() {
					texts.push(trimmed.to_string());
				}
			}
			Ok(Event::Eof) => break,
			Ok(_) => {}
			Err(e) => return vec![format!("xml parse error: {e}")],
		}
		buf.clear();
	}
	texts
}

/// Build a minimal pptx fixture for tests.
pub fn write_fixture_pptx(path: &Path) -> EngineResult<()> {
	let slide_xml = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree>
    <p:sp><p:txBody><a:p><a:r><a:t>Hello Slide</a:t></a:r></a:p></p:txBody></p:sp>
  </p:spTree></p:cSld>
</p:sld>"#;
	let file = File::create(path)?;
	let mut zip = ZipWriter::new(file);
	let opts = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
	zip.start_file("[Content_Types].xml", opts)?;
	zip.write_all(b"<?xml version=\"1.0\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"xml\" ContentType=\"application/xml\"/></Types>")?;
	zip.start_file("ppt/slides/slide1.xml", opts)?;
	zip.write_all(slide_xml.as_bytes())?;
	zip.finish()?;
	Ok(())
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn pptx2md_extracts_text() {
		let tmp = tempfile::tempdir().unwrap();
		let pptx = tmp.path().join("test.pptx");
		let md = tmp.path().join("out.md");
		write_fixture_pptx(&pptx).unwrap();
		pptx2md(&pptx, &md).unwrap();
		let content = std::fs::read_to_string(&md).unwrap();
		assert!(content.contains("Hello Slide"));
	}
}
