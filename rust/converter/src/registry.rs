// Copyright (c) Safe Appeals. All rights reserved.

//! Conversion capability registry for sa-converter.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Fidelity profile advertised to the UI.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Fidelity {
	OfficeFidelity,
	BrowserPrint,
	Semantic,
	PreviewFast,
	PdfOps,
	Ocr,
}

/// Static specification for a conversion or service method.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversionSpec {
	pub key: String,
	pub fidelity: Fidelity,
	pub engine: String,
	pub available: bool,
	#[serde(skip_serializing_if = "Option::is_none")]
	pub install_hint: Option<String>,
}

/// Alias map: alternate key → canonical key.
pub fn alias_map() -> HashMap<&'static str, &'static str> {
	HashMap::from([("pdf2ocr", "pdf2ocr_layer")])
}

/// Resolve a conversion key, applying known aliases.
pub fn resolve_key(key: &str) -> String {
	alias_map()
		.get(key)
		.map(|canonical| (*canonical).to_string())
		.unwrap_or_else(|| key.to_string())
}

const LO_HINT: &str = "Install LibreOffice (soffice) for office-fidelity conversions.";

/// Office-fidelity keys served by the warm LibreOffice worker.
pub const LO_KEYS: &[&str] = &[
	"docx2pdf",
	"xlsx2pdf",
	"pptx2pdf",
	"epub2pdf",
	"pptx2images",
];

/// Browser-print keys served by headless Chrome/Chromium.
pub const BROWSER_KEYS: &[&str] = &["html2pdf", "md2pdf"];

/// OCR keys with external tool dependencies.
pub const OCR_KEYS: &[&str] = &["image2text", "pdf2ocr_layer", "pdf2editable"];
const CHROMIUM_HINT: &str =
	"Install Chromium or Google Chrome for browser-print HTML→PDF conversions.";
const OCR_HINT: &str =
	"Install Tesseract OCR and ocrmypdf (or equivalent) for OCR-dependent conversions.";

fn lo_spec(key: &str, available: bool) -> ConversionSpec {
	ConversionSpec {
		key: key.to_string(),
		fidelity: Fidelity::OfficeFidelity,
		engine: "libreoffice".to_string(),
		available,
		install_hint: if available {
			None
		} else {
			Some(LO_HINT.to_string())
		},
	}
}

fn browser_spec(key: &str, available: bool) -> ConversionSpec {
	ConversionSpec {
		key: key.to_string(),
		fidelity: Fidelity::BrowserPrint,
		engine: "chromium".to_string(),
		available,
		install_hint: if available {
			None
		} else {
			Some(CHROMIUM_HINT.to_string())
		},
	}
}

fn semantic_spec(key: &str, engine: &str) -> ConversionSpec {
	ConversionSpec {
		key: key.to_string(),
		fidelity: Fidelity::Semantic,
		engine: engine.to_string(),
		available: true,
		install_hint: None,
	}
}

fn preview_fast_spec(key: &str, engine: &str) -> ConversionSpec {
	ConversionSpec {
		key: key.to_string(),
		fidelity: Fidelity::PreviewFast,
		engine: engine.to_string(),
		available: true,
		install_hint: None,
	}
}

fn pdf_ops_spec(key: &str) -> ConversionSpec {
	ConversionSpec {
		key: key.to_string(),
		fidelity: Fidelity::PdfOps,
		engine: "lopdf".to_string(),
		available: true,
		install_hint: None,
	}
}

fn pdf_encrypt_spec() -> ConversionSpec {
	ConversionSpec {
		key: "pdf2encrypt".to_string(),
		fidelity: Fidelity::PdfOps,
		engine: "lopdf".to_string(),
		available: false,
		install_hint: Some("PDF encryption not yet implemented.".to_string()),
	}
}

fn ocr_spec(key: &str, engine: &str, available: bool) -> ConversionSpec {
	ConversionSpec {
		key: key.to_string(),
		fidelity: Fidelity::Ocr,
		engine: engine.to_string(),
		available,
		install_hint: if available {
			None
		} else {
			Some(OCR_HINT.to_string())
		},
	}
}

/// Runtime availability flags from configure probes.
#[derive(Debug, Clone, Copy, Default)]
pub struct EngineAvailability {
	pub lo: bool,
	pub browser: bool,
	pub ocr_tesseract: bool,
	pub ocr_ocrmypdf: bool,
}

impl EngineAvailability {
	pub fn ocr_key_available(&self, key: &str) -> bool {
		match key {
			"image2text" => self.ocr_tesseract,
			"pdf2ocr_layer" | "pdf2editable" => self.ocr_ocrmypdf,
			_ => false,
		}
	}
}

/// Build the full conversion matrix (38 pairs + services).
pub fn build_registry(avail: EngineAvailability) -> HashMap<String, ConversionSpec> {
	let mut registry = HashMap::new();

	// A. Office → PDF (office-fidelity, warm LO)
	for key in ["docx2pdf", "xlsx2pdf", "pptx2pdf", "epub2pdf"] {
		registry.insert(key.to_string(), lo_spec(key, avail.lo));
	}

	// B. HTML → PDF (browser-print)
	for key in BROWSER_KEYS {
		registry.insert(key.to_string(), browser_spec(key, avail.browser));
	}

	// C. Semantic / generate (pure Rust primary)
	let semantic_pairs: [(&str, &str); 22] = [
		("md2html", "comrak"),
		("md2docx", "docx-rs"),
		("md2epub", "epub-builder"),
		("docx2md", "docx-rs"),
		("docx2epub", "docx-rs"),
		("html2epub", "epub-builder"),
		("epub2html", "rbook"),
		("epub2md", "rbook"),
		("epub2docx", "docx-rs"),
		("txt2pdf", "printpipe"),
		("xlsx2csv", "calamine"),
		("xlsx2md", "calamine"),
		("xlsx2html", "calamine"),
		("csv2xlsx", "rust_xlsxwriter"),
		("csv2pdf", "printpipe"),
		("pptx2html", "pptx-extract"),
		("pptx2md", "pptx-extract"),
		("image2pdf", "image"),
		("image2image", "image"),
		("pdf2md", "pdf-extract"),
		("pdf2html", "pdf-extract"),
		("pdf2images", "pdf-extract"),
	];
	for (key, engine) in semantic_pairs {
		registry.insert(key.to_string(), semantic_spec(key, engine));
	}

	// md2pdf handled in browser-print block above

	// pptx2images: office-fidelity if LO-backed
	registry.insert("pptx2images".to_string(), lo_spec("pptx2images", avail.lo));

	// pdf2xlsx: preview-fast — not implemented until P3
	registry.insert(
		"pdf2xlsx".to_string(),
		ConversionSpec {
			key: "pdf2xlsx".to_string(),
			fidelity: Fidelity::PreviewFast,
			engine: "pdf-extract".to_string(),
			available: false,
			install_hint: None,
		},
	);

	// D. PDF ops
	for key in ["pdf2compress", "pdf2split", "pdf2watermark", "pdf2pages"] {
		registry.insert(key.to_string(), pdf_ops_spec(key));
	}
	registry.insert("pdf2encrypt".to_string(), pdf_encrypt_spec());

	// OCR-class PDF ops
	registry.insert(
		"pdf2ocr_layer".to_string(),
		ocr_spec("pdf2ocr_layer", "tesseract", avail.ocr_key_available("pdf2ocr_layer")),
	);
	registry.insert(
		"pdf2editable".to_string(),
		ocr_spec("pdf2editable", "ocrmypdf", avail.ocr_key_available("pdf2editable")),
	);

	// E. OCR text extraction
	registry.insert(
		"image2text".to_string(),
		ocr_spec("image2text", "tesseract", avail.ocr_key_available("image2text")),
	);

	// F. Services (first-class methods, also listed in conversions map)
	registry.insert(
		"merge_pdfs".to_string(),
		ConversionSpec {
			key: "merge_pdfs".to_string(),
			fidelity: Fidelity::PdfOps,
			engine: "lopdf".to_string(),
			available: true,
			install_hint: None,
		},
	);
	registry.insert(
		"batch_convert".to_string(),
		ConversionSpec {
			key: "batch_convert".to_string(),
			fidelity: Fidelity::Semantic,
			engine: "batch".to_string(),
			available: true,
			install_hint: None,
		},
	);
	registry.insert(
		"extract_pdf_pages".to_string(),
		ConversionSpec {
			key: "extract_pdf_pages".to_string(),
			fidelity: Fidelity::Semantic,
			engine: "pdf-extract".to_string(),
			available: true,
			install_hint: None,
		},
	);

	registry
}

/// Look up a conversion spec by key (with alias resolution).
pub fn lookup_with_availability(key: &str, avail: EngineAvailability) -> Option<ConversionSpec> {
	let canonical = resolve_key(key);
	build_registry(avail)
		.get(&canonical)
		.cloned()
}

/// Look up with LO-only flag (legacy tests).
pub fn lookup_with_lo(key: &str, lo_available: bool) -> Option<ConversionSpec> {
	lookup_with_availability(
		key,
		EngineAvailability {
			lo: lo_available,
			..EngineAvailability::default()
		},
	)
}

/// Look up with LO unavailable (static tests / default).
pub fn lookup(key: &str) -> Option<ConversionSpec> {
	lookup_with_lo(key, false)
}

/// Return all registered conversion keys (canonical only, no duplicate aliases).
pub fn all_keys() -> Vec<String> {
	let mut keys: Vec<String> = build_registry(EngineAvailability::default())
		.into_keys()
		.collect();
	keys.sort();
	keys
}

/// Return alias entries for inclusion in get_available_conversions output.
pub fn alias_entries() -> Vec<(String, String)> {
	alias_map()
		.into_iter()
		.map(|(alias, canonical)| (alias.to_string(), canonical.to_string()))
		.collect()
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn registry_has_41_keys() {
		assert_eq!(build_registry(EngineAvailability::default()).len(), 41);
	}

	#[test]
	fn lo_pairs_available_when_lo_healthy() {
		let reg = build_registry(EngineAvailability {
			lo: true,
			..EngineAvailability::default()
		});
		for key in LO_KEYS {
			let spec = reg.get(*key).unwrap();
			assert!(spec.available, "{key} should be available when LO healthy");
			assert!(spec.install_hint.is_none());
			assert_eq!(spec.fidelity, Fidelity::OfficeFidelity);
			assert_eq!(spec.engine, "libreoffice");
		}
	}

	#[test]
	fn all_expected_pair_keys_present() {
		let keys = all_keys();
		let expected_pairs = [
			"docx2pdf",
			"xlsx2pdf",
			"pptx2pdf",
			"epub2pdf",
			"html2pdf",
			"md2html",
			"md2docx",
			"md2pdf",
			"md2epub",
			"docx2md",
			"docx2epub",
			"html2epub",
			"epub2html",
			"epub2md",
			"epub2docx",
			"txt2pdf",
			"xlsx2csv",
			"xlsx2md",
			"xlsx2html",
			"csv2xlsx",
			"csv2pdf",
			"pptx2html",
			"pptx2md",
			"pptx2images",
			"image2pdf",
			"image2image",
			"pdf2md",
			"pdf2html",
			"pdf2images",
			"pdf2xlsx",
			"pdf2compress",
			"pdf2encrypt",
			"pdf2split",
			"pdf2watermark",
			"pdf2pages",
			"pdf2ocr_layer",
			"pdf2editable",
			"image2text",
		];
		for key in expected_pairs {
			assert!(keys.contains(&key.to_string()), "missing key: {key}");
		}
	}

	#[test]
	fn service_keys_present() {
		let keys = all_keys();
		assert!(keys.contains(&"merge_pdfs".to_string()));
		assert!(keys.contains(&"batch_convert".to_string()));
		assert!(keys.contains(&"extract_pdf_pages".to_string()));
	}

	#[test]
	fn pdf2ocr_alias_resolves() {
		assert_eq!(resolve_key("pdf2ocr"), "pdf2ocr_layer");
		let spec = lookup("pdf2ocr").expect("alias should resolve");
		assert_eq!(spec.key, "pdf2ocr_layer");
		assert_eq!(spec.fidelity, Fidelity::Ocr);
	}

	#[test]
	fn pdf2encrypt_unavailable_until_implemented() {
		let spec = lookup("pdf2encrypt").unwrap();
		assert!(!spec.available);
		assert!(spec.install_hint.is_some());
		assert!(spec
			.install_hint
			.as_ref()
			.unwrap()
			.contains("encryption"));
	}

	#[test]
	fn browser_pairs_available_when_detected() {
		let reg = build_registry(EngineAvailability {
			browser: true,
			..EngineAvailability::default()
		});
		for key in BROWSER_KEYS {
			let spec = reg.get(*key).unwrap();
			assert!(spec.available, "{key}");
			assert_eq!(spec.fidelity, Fidelity::BrowserPrint);
			assert_eq!(spec.engine, "chromium");
		}
	}

	#[test]
	fn browser_pairs_have_install_hint_when_missing() {
		for key in BROWSER_KEYS {
			let spec = lookup(key).unwrap();
			assert!(!spec.available);
			assert!(spec.install_hint.is_some());
		}
	}

	#[test]
	fn ocr_pairs_available_when_tools_present() {
		let reg = build_registry(EngineAvailability {
			ocr_tesseract: true,
			ocr_ocrmypdf: true,
			..EngineAvailability::default()
		});
		for key in OCR_KEYS {
			let spec = reg.get(*key).unwrap();
			assert!(spec.available, "{key}");
			assert_eq!(spec.fidelity, Fidelity::Ocr);
		}
	}

	#[test]
	fn lo_pairs_have_install_hint() {
		for key in ["docx2pdf", "xlsx2pdf", "pptx2pdf", "epub2pdf"] {
			let spec = lookup(key).unwrap();
			assert!(!spec.available);
			assert!(spec.install_hint.is_some());
			assert_eq!(spec.fidelity, Fidelity::OfficeFidelity);
		}
	}

	#[test]
	fn ocr_pairs_have_install_hint() {
		for key in ["image2text", "pdf2ocr_layer", "pdf2editable"] {
			let spec = lookup(key).unwrap();
			assert!(!spec.available);
			assert!(spec.install_hint.is_some());
			assert_eq!(spec.fidelity, Fidelity::Ocr);
		}
	}
}
