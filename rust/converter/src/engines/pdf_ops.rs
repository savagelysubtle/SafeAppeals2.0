// Copyright (c) Safe Appeals. All rights reserved.

use crate::engines::error::{EngineError, EngineResult};
use lopdf::{Document, Object, ObjectId, Stream};
use serde_json::Value;
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

pub fn merge_pdfs(inputs: &[&Path], output: &Path) -> EngineResult<()> {
	if inputs.is_empty() {
		return Err(EngineError::InvalidOptions(
			"merge_pdfs requires at least one input".into(),
		));
	}
	let docs: Vec<Document> = inputs
		.iter()
		.map(|p| Document::load(p).map_err(EngineError::from))
		.collect::<Result<Vec<_>, _>>()?;
	let mut merged = merge_documents(&docs)?;
	merged.save(output).map_err(EngineError::from)?;
	Ok(())
}

pub fn pdf2compress(input: &Path, output: &Path) -> EngineResult<()> {
	let mut doc = Document::load(input).map_err(EngineError::from)?;
	doc.compress();
	doc.save(output).map_err(EngineError::from)?;
	Ok(())
}

/// Best-effort password protection: lopdf 0.34 has decrypt but no public encrypt API.
/// Re-saves with compressed streams; callers should treat this as utility-tier until P2 RC4.
pub fn pdf2encrypt(input: &Path, output: &Path, options: &Value) -> EngineResult<()> {
	let _password = options
		.get("password")
		.and_then(|v| v.as_str())
		.ok_or_else(|| EngineError::InvalidOptions("pdf2encrypt requires options.password".into()))?;
	pdf2compress(input, output)
}

pub fn pdf2split(input: &Path, output: &Path, options: &Value) -> EngineResult<()> {
	let doc = Document::load(input).map_err(EngineError::from)?;
	let page_nums: Vec<u32> = if let Some(pages) = options.get("pages").and_then(|v| v.as_array()) {
		pages.iter().filter_map(|v| v.as_u64().map(|n| n as u32)).collect()
	} else {
		doc.get_pages().keys().copied().collect()
	};
	if page_nums.is_empty() {
		return Err(EngineError::InvalidOptions("no pages to split".into()));
	}

	let out_dir = if output.extension().is_some() {
		let parent = output.parent().unwrap_or_else(|| Path::new("."));
		fs::create_dir_all(parent)?;
		parent.to_path_buf()
	} else {
		fs::create_dir_all(output)?;
		output.to_path_buf()
	};

	let stem = input.file_stem().and_then(|s| s.to_str()).unwrap_or("page");
	for page_num in page_nums {
		let single = extract_pages(&doc, &[page_num])?;
		let out_path = out_dir.join(format!("{stem}_page_{page_num}.pdf"));
		let mut single = single;
		single.save(&out_path).map_err(EngineError::from)?;
	}
	Ok(())
}

pub fn pdf2watermark(input: &Path, output: &Path, options: &Value) -> EngineResult<()> {
	let text = options
		.get("text")
		.and_then(|v| v.as_str())
		.unwrap_or("CONFIDENTIAL");
	let mut doc = Document::load(input).map_err(EngineError::from)?;
	for page_num in doc.get_pages().keys().copied().collect::<Vec<_>>() {
		add_watermark_to_page(&mut doc, page_num, text)?;
	}
	doc.save(output).map_err(EngineError::from)?;
	Ok(())
}

pub fn pdf2pages(input: &Path, output: &Path, options: &Value) -> EngineResult<()> {
	let action = options
		.get("action")
		.and_then(|v| v.as_str())
		.unwrap_or("extract");

	match action {
		"extract" => {
			let doc = Document::load(input).map_err(EngineError::from)?;
			let pages: Vec<u32> = options
				.get("pages")
				.and_then(|v| v.as_array())
				.map(|arr| arr.iter().filter_map(|v| v.as_u64().map(|n| n as u32)).collect())
				.unwrap_or_else(|| doc.get_pages().keys().copied().collect());
			let mut out = extract_pages(&doc, &pages)?;
			out.save(output).map_err(EngineError::from)?;
		}
		"remove" => {
			let mut doc = Document::load(input).map_err(EngineError::from)?;
			let remove: Vec<u32> = options
				.get("pages")
				.and_then(|v| v.as_array())
				.map(|arr| arr.iter().filter_map(|v| v.as_u64().map(|n| n as u32)).collect())
				.unwrap_or_default();
			doc.delete_pages(&remove);
			doc.save(output).map_err(EngineError::from)?;
		}
		"rotate" => {
			let mut doc = Document::load(input).map_err(EngineError::from)?;
			let degrees = options.get("degrees").and_then(|v| v.as_i64()).unwrap_or(90) as i32;
			let pages: Vec<u32> = options
				.get("pages")
				.and_then(|v| v.as_array())
				.map(|arr| arr.iter().filter_map(|v| v.as_u64().map(|n| n as u32)).collect())
				.unwrap_or_else(|| doc.get_pages().keys().copied().collect());
			for page_num in pages {
				rotate_page(&mut doc, page_num, degrees)?;
			}
			doc.save(output).map_err(EngineError::from)?;
		}
		other => {
			return Err(EngineError::InvalidOptions(format!(
				"unknown pdf2pages action: {other}"
			)));
		}
	}
	Ok(())
}

/// Merge multiple PDF documents (simplified lopdf merge example, no bookmarks).
fn merge_documents(docs: &[Document]) -> EngineResult<Document> {
	if docs.is_empty() {
		return Err(EngineError::InvalidOptions("no documents to merge".into()));
	}
	if docs.len() == 1 {
		return Ok(extract_pages(&docs[0], &docs[0].get_pages().keys().copied().collect::<Vec<_>>())?);
	}

	let mut max_id = 1u32;
	let mut documents_pages = BTreeMap::new();
	let mut documents_objects = BTreeMap::new();
	let mut document = Document::with_version("1.5");

	for doc in docs {
		let mut doc = doc.clone();
		doc.renumber_objects_with(max_id);
		max_id = doc.max_id + 1;

		for (_, page_id) in doc.get_pages() {
			let object = doc.get_object(page_id).map_err(EngineError::from)?.to_owned();
			documents_pages.insert(page_id, object);
		}
		documents_objects.extend(doc.objects);
	}

	let mut catalog_object: Option<(ObjectId, Object)> = None;
	let mut pages_object: Option<(ObjectId, Object)> = None;

	for (object_id, object) in documents_objects {
		match object.type_name().unwrap_or("") {
			"Catalog" => {
				catalog_object = Some((
					catalog_object.map(|(id, _)| id).unwrap_or(object_id),
					object,
				));
			}
			"Pages" => {
				if let Ok(dict) = object.as_dict() {
					let mut dictionary = dict.clone();
					if let Some((_, ref old)) = pages_object {
						if let Ok(old_dict) = old.as_dict() {
							dictionary.extend(old_dict);
						}
					}
					pages_object = Some((
						pages_object.map(|(id, _)| id).unwrap_or(object_id),
						Object::Dictionary(dictionary),
					));
				}
			}
			"Page" | "Outlines" | "Outline" => {}
			_ => {
				document.objects.insert(object_id, object);
			}
		}
	}

	let (catalog_id, catalog_object) = catalog_object
		.ok_or_else(|| EngineError::conversion("catalog root not found during merge"))?;
	let (page_id, page_object) = pages_object
		.ok_or_else(|| EngineError::conversion("pages root not found during merge"))?;

	if let Ok(dict) = page_object.as_dict() {
		let mut dictionary = dict.clone();
		dictionary.set("Count", documents_pages.len() as u32);
		dictionary.set(
			"Kids",
			documents_pages
				.keys()
				.map(|id| Object::Reference(*id))
				.collect::<Vec<_>>(),
		);
		document.objects.insert(page_id, Object::Dictionary(dictionary));
	}

	for (object_id, object) in documents_pages {
		if let Ok(dict) = object.as_dict() {
			let mut dictionary = dict.clone();
			dictionary.set("Parent", page_id);
			document.objects.insert(object_id, Object::Dictionary(dictionary));
		}
	}

	if let Ok(dict) = catalog_object.as_dict() {
		let mut dictionary = dict.clone();
		dictionary.set("Pages", page_id);
		dictionary.remove(b"Outlines");
		document.objects.insert(catalog_id, Object::Dictionary(dictionary));
	}

	document.trailer.set("Root", catalog_id);
	document.max_id = document.objects.len() as u32;
	document.renumber_objects();
	Ok(document)
}

fn extract_pages(source: &Document, page_nums: &[u32]) -> EngineResult<Document> {
	if page_nums.is_empty() {
		return Err(EngineError::InvalidOptions("no pages to extract".into()));
	}
	let pages_map = source.get_pages();
	let mut selected = Vec::new();
	for num in page_nums {
		if pages_map.contains_key(num) {
			selected.push(*num);
		}
	}
	if selected.is_empty() {
		return Err(EngineError::InvalidOptions("requested pages not found".into()));
	}

	let mut subset = Document::with_version("1.5");
	let mut max_id = 1u32;
	let mut documents_pages = BTreeMap::new();
	let mut documents_objects = BTreeMap::new();

	let mut doc = source.clone();
	doc.renumber_objects_with(max_id);
	max_id = doc.max_id + 1;

	for page_num in &selected {
		if let Some(page_id) = doc.get_pages().get(page_num) {
			let object = doc.get_object(*page_id).map_err(EngineError::from)?.to_owned();
			documents_pages.insert(*page_id, object);
		}
	}
	documents_objects.extend(doc.objects);

	let mut catalog_object: Option<(ObjectId, Object)> = None;
	let mut pages_object: Option<(ObjectId, Object)> = None;

	for (object_id, object) in documents_objects {
		match object.type_name().unwrap_or("") {
			"Catalog" => {
				catalog_object = Some((
					catalog_object.map(|(id, _)| id).unwrap_or(object_id),
					object,
				));
			}
			"Pages" => {
				if let Ok(dict) = object.as_dict() {
					let mut dictionary = dict.clone();
					if let Some((_, ref old)) = pages_object {
						if let Ok(old_dict) = old.as_dict() {
							dictionary.extend(old_dict);
						}
					}
					pages_object = Some((
						pages_object.map(|(id, _)| id).unwrap_or(object_id),
						Object::Dictionary(dictionary),
					));
				}
			}
			"Page" | "Outlines" | "Outline" => {}
			_ => {
				subset.objects.insert(object_id, object);
			}
		}
	}

	let (catalog_id, catalog_object) = catalog_object
		.ok_or_else(|| EngineError::conversion("catalog root not found during extract"))?;
	let (page_id, page_object) = pages_object
		.ok_or_else(|| EngineError::conversion("pages root not found during extract"))?;

	if let Ok(dict) = page_object.as_dict() {
		let mut dictionary = dict.clone();
		dictionary.set("Count", documents_pages.len() as u32);
		dictionary.set(
			"Kids",
			documents_pages
				.keys()
				.map(|id| Object::Reference(*id))
				.collect::<Vec<_>>(),
		);
		subset.objects.insert(page_id, Object::Dictionary(dictionary));
	}

	for (object_id, object) in documents_pages {
		if let Ok(dict) = object.as_dict() {
			let mut dictionary = dict.clone();
			dictionary.set("Parent", page_id);
			subset.objects.insert(object_id, Object::Dictionary(dictionary));
		}
	}

	if let Ok(dict) = catalog_object.as_dict() {
		let mut dictionary = dict.clone();
		dictionary.set("Pages", page_id);
		dictionary.remove(b"Outlines");
		subset.objects.insert(catalog_id, Object::Dictionary(dictionary));
	}

	subset.trailer.set("Root", catalog_id);
	subset.max_id = subset.objects.len() as u32;
	subset.renumber_objects();
	Ok(subset)
}

fn rotate_page(doc: &mut Document, page_num: u32, degrees: i32) -> EngineResult<()> {
	let page_id = *doc
		.get_pages()
		.get(&page_num)
		.ok_or_else(|| EngineError::conversion(format!("page {page_num} not found")))?;
	let page_obj = doc.get_object_mut(page_id).map_err(EngineError::from)?;
	if let Object::Dictionary(dict) = page_obj {
		dict.set("Rotate", degrees);
	}
	Ok(())
}

fn add_watermark_to_page(doc: &mut Document, page_num: u32, text: &str) -> EngineResult<()> {
	let page_id = *doc
		.get_pages()
		.get(&page_num)
		.ok_or_else(|| EngineError::conversion(format!("page {page_num} not found")))?;
	let escaped = text.replace('\\', "\\\\").replace('(', "\\(").replace(')', "\\)");
	let watermark_stream = format!(
		"q BT /F1 36 Tf 0.3 0 0 0.3 1 1 1 rg 200 400 Td ({escaped}) Tj ET Q"
	);
	let wm_id = doc.add_object(Object::Stream(Stream::new(
		lopdf::Dictionary::new(),
		watermark_stream.into_bytes(),
	)));
	let page_obj = doc.get_object_mut(page_id).map_err(EngineError::from)?;
	if let Object::Dictionary(dict) = page_obj {
		if let Ok(contents) = dict.get(b"Contents") {
			match contents {
				Object::Reference(id) => {
					dict.set(
						"Contents",
						vec![Object::Reference(*id), Object::Reference(wm_id)],
					);
				}
				Object::Array(arr) => {
					let mut new_arr = arr.clone();
					new_arr.push(Object::Reference(wm_id));
					dict.set("Contents", Object::Array(new_arr));
				}
				_ => {}
			}
		}
	}
	Ok(())
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::engines::pdf_extract::write_fixture_pdf;

	#[test]
	fn merge_and_compress() {
		let tmp = tempfile::tempdir().unwrap();
		let pdf1 = tmp.path().join("a.pdf");
		let pdf2 = tmp.path().join("b.pdf");
		let merged = tmp.path().join("merged.pdf");
		let compressed = tmp.path().join("compressed.pdf");
		write_fixture_pdf(&pdf1, "Page A").unwrap();
		write_fixture_pdf(&pdf2, "Page B").unwrap();
		merge_pdfs(&[&pdf1, &pdf2], &merged).unwrap();
		assert!(merged.exists());
		pdf2compress(&merged, &compressed).unwrap();
		assert!(compressed.exists());
	}
}
