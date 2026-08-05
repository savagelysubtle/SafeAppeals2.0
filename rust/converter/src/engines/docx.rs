// Copyright (c) Safe Appeals. All rights reserved.

use crate::engines::error::{EngineError, EngineResult};
use docx_rs::{read_docx, Docx, DocumentChild, Paragraph, ParagraphChild, Run, RunChild};
use std::fs;
use std::path::Path;

pub fn docx2md(input: &Path, output: &Path) -> EngineResult<()> {
	let bytes = fs::read(input)?;
	let docx = read_docx(&bytes).map_err(|e| EngineError::conversion(format!("docx read: {e}")))?;
	let md = docx_to_md(&docx);
	fs::write(output, md.trim())?;
	Ok(())
}

pub fn docx2epub(input: &Path, output: &Path) -> EngineResult<()> {
	let tmp = tempfile::tempdir()?;
	let md_path = tmp.path().join("intermediate.md");
	docx2md(input, &md_path)?;
	crate::engines::markdown::md2epub(&md_path, output)
}

fn docx_to_md(docx: &Docx) -> String {
	let mut md = String::new();
	for child in &docx.document.children {
		if let DocumentChild::Paragraph(p) = child {
			let text = paragraph_text(p);
			if !text.is_empty() {
				md.push_str(&text);
				md.push('\n');
			}
		}
	}
	md
}

fn paragraph_text(p: &Paragraph) -> String {
	let mut text = String::new();
	for child in &p.children {
		if let ParagraphChild::Run(r) = child {
			for rc in &r.children {
				if let RunChild::Text(t) = rc {
					text.push_str(&t.text);
				}
			}
		}
	}
	text
}

#[cfg(test)]
mod tests {
	use super::*;
	use docx_rs::*;

	#[test]
	fn docx2md_extracts_text() {
		let tmp = tempfile::tempdir().unwrap();
		let docx_path = tmp.path().join("test.docx");
		let md_path = tmp.path().join("test.md");
		let doc = Docx::new().add_paragraph(
			Paragraph::new().add_run(Run::new().add_text("Hello from docx")),
		);
		let mut file = fs::File::create(&docx_path).unwrap();
		doc.build().pack(&mut file).unwrap();
		docx2md(&docx_path, &md_path).unwrap();
		let md = fs::read_to_string(&md_path).unwrap();
		assert!(md.contains("Hello from docx"));
	}
}
