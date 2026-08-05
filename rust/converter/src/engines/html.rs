// Copyright (c) Safe Appeals. All rights reserved.

use crate::engines::error::EngineResult;
use std::fs;
use std::path::Path;

pub fn html2epub(input: &Path, output: &Path) -> EngineResult<()> {
	let html = fs::read_to_string(input)?;
	let title = input
		.file_stem()
		.and_then(|s| s.to_str())
		.unwrap_or("document");
	crate::engines::epub::build_epub_from_html(title, &html, output)
}
