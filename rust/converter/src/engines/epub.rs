// Copyright (c) Safe Appeals. All rights reserved.

use crate::engines::error::{EngineError, EngineResult};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::Path;
use time::OffsetDateTime;
use zip::write::SimpleFileOptions;
use zip::{ZipArchive, ZipWriter};

pub fn html2epub(input: &Path, output: &Path) -> EngineResult<()> {
	let html = fs::read_to_string(input)?;
	let title = input
		.file_stem()
		.and_then(|s| s.to_str())
		.unwrap_or("document");
	build_epub_from_html(title, &html, output)
}

pub fn build_epub_from_html(title: &str, html: &str, output: &Path) -> EngineResult<()> {
	let body = extract_body(html);
	let xhtml = format!(
		r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>{title}</title></head>
<body>{body}</body>
</html>"#
	);
	let opf = format!(
		r#"<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>{title}</dc:title>
    <dc:language>en</dc:language>
    <dc:identifier id="uid">urn:uuid:safeappeals-{title}</dc:identifier>
    <meta property="dcterms:modified">{modified}</meta>
  </metadata>
  <manifest>
    <item id="content" href="content.xhtml" media-type="application/xhtml+xml"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
  </manifest>
  <spine>
    <itemref idref="content"/>
  </spine>
</package>"#,
		modified = OffsetDateTime::now_utc()
			.format(&time::format_description::well_known::Rfc3339)
			.unwrap_or_else(|_| "2026-01-01T00:00:00Z".to_string())
	);
	let nav = format!(
		r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Navigation</title></head>
<body>
  <nav epub:type="toc"><ol><li><a href="content.xhtml">{title}</a></li></ol></nav>
</body>
</html>"#
	);
	let container = r#"<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>"#;

	let file = File::create(output)?;
	let mut zip = ZipWriter::new(file);
	let opts = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

	zip.start_file("mimetype", SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored))?;
	zip.write_all(b"application/epub+zip")?;
	zip.start_file("META-INF/container.xml", opts)?;
	zip.write_all(container.as_bytes())?;
	zip.start_file("OEBPS/content.opf", opts)?;
	zip.write_all(opf.as_bytes())?;
	zip.start_file("OEBPS/content.xhtml", opts)?;
	zip.write_all(xhtml.as_bytes())?;
	zip.start_file("OEBPS/nav.xhtml", opts)?;
	zip.write_all(nav.as_bytes())?;
	zip.finish()?;
	Ok(())
}

pub fn epub2html(input: &Path, output: &Path) -> EngineResult<()> {
	let parts = read_epub_xhtml_parts(input)?;
	let combined = parts.join("\n<hr/>\n");
	let html = format!(
		"<!DOCTYPE html>\n<html><head><meta charset=\"utf-8\"></head><body>\n{combined}\n</body></html>"
	);
	fs::write(output, html)?;
	Ok(())
}

pub fn epub2md(input: &Path, output: &Path) -> EngineResult<()> {
	let tmp = tempfile::tempdir()?;
	let html_path = tmp.path().join("temp.html");
	epub2html(input, &html_path)?;
	let html = fs::read_to_string(&html_path)?;
	let md = html_to_plain_md(&html);
	fs::write(output, md)?;
	Ok(())
}

pub fn epub2docx(input: &Path, output: &Path) -> EngineResult<()> {
	let tmp = tempfile::tempdir()?;
	let md_path = tmp.path().join("temp.md");
	epub2md(input, &md_path)?;
	crate::engines::markdown::md2docx(&md_path, output)
}

fn read_epub_xhtml_parts(input: &Path) -> EngineResult<Vec<String>> {
	let file = File::open(input)?;
	let mut archive = ZipArchive::new(file).map_err(|e| EngineError::conversion(format!("epub zip: {e}")))?;
	let mut parts = Vec::new();
	for i in 0..archive.len() {
		let mut entry = archive.by_index(i).map_err(|e| EngineError::conversion(format!("epub entry: {e}")))?;
		let name = entry.name().to_string();
		if name.ends_with(".xhtml") || name.ends_with(".html") {
			if name.contains("nav") {
				continue;
			}
			let mut content = String::new();
			entry.read_to_string(&mut content)?;
			parts.push(extract_body(&content));
		}
	}
	if parts.is_empty() {
		return Err(EngineError::conversion("no xhtml content found in epub"));
	}
	Ok(parts)
}

fn extract_body(html: &str) -> String {
	if let Some(start) = html.find("<body") {
		if let Some(body_start) = html[start..].find('>') {
			let content_start = start + body_start + 1;
			if let Some(end) = html[content_start..].find("</body>") {
				return html[content_start..content_start + end].trim().to_string();
			}
		}
	}
	html.to_string()
}

fn html_to_plain_md(html: &str) -> String {
	let body = extract_body(html);
	body.replace("<hr/>", "\n---\n")
		.replace("<br>", "\n")
		.replace("<br/>", "\n")
		.replace("<br />", "\n")
		.replace("<p>", "\n")
		.replace("</p>", "\n")
		.replace("<h1>", "\n# ")
		.replace("</h1>", "\n")
		.replace("<h2>", "\n## ")
		.replace("</h2>", "\n")
		.replace("<li>", "\n- ")
		.replace("</li>", "")
		.lines()
		.map(str::trim)
		.filter(|l| !l.is_empty())
		.collect::<Vec<_>>()
		.join("\n")
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn epub_roundtrip() {
		let tmp = tempfile::tempdir().unwrap();
		let epub_path = tmp.path().join("test.epub");
		build_epub_from_html("Test Book", "<p>Chapter one.</p>", &epub_path).unwrap();
		let html_path = tmp.path().join("out.html");
		epub2html(&epub_path, &html_path).unwrap();
		let html = fs::read_to_string(&html_path).unwrap();
		assert!(html.contains("Chapter one"));
	}
}
