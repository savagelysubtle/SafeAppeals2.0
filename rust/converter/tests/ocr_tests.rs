// Copyright (c) Safe Appeals. All rights reserved.

//! OCR integration tests — tool spawn tests are `#[ignore]`.

use sa_converter::engines::ocr::{detect_ocr, OcrEngine};
use sa_converter::registry::{build_registry, EngineAvailability, OCR_KEYS};

#[test]
fn ocr_registry_unavailable_by_default() {
	for key in OCR_KEYS {
		assert!(
			!build_registry(EngineAvailability::default())
				.get(*key)
				.unwrap()
				.available
		);
	}
}

#[test]
fn ocr_registry_available_when_tools_present() {
	let reg = build_registry(EngineAvailability {
		ocr_tesseract: true,
		ocr_ocrmypdf: true,
		..EngineAvailability::default()
	});
	for key in OCR_KEYS {
		assert!(reg.get(*key).unwrap().available, "{key}");
	}
}

#[test]
fn ocr_image2text_requires_tesseract_only() {
	let reg = build_registry(EngineAvailability {
		ocr_tesseract: true,
		..EngineAvailability::default()
	});
	assert!(reg.get("image2text").unwrap().available);
	assert!(!reg.get("pdf2ocr_layer").unwrap().available);
}

#[test]
#[ignore = "requires system Tesseract"]
fn ocr_tesseract_detected() {
	let install = detect_ocr();
	assert!(install.has_tesseract());
}

#[test]
#[ignore = "requires system ocrmypdf"]
fn ocr_ocrmypdf_detected() {
	let install = detect_ocr();
	assert!(install.has_ocrmypdf());
}

#[test]
#[ignore = "requires system Tesseract"]
fn ocr_image2text_integration() {
	let mut engine = OcrEngine::new();
	engine.probe(Some(120_000));
	assert!(engine.has_tesseract());

	let tmp = tempfile::tempdir().unwrap();
	let png = tmp.path().join("label.png");
	let txt = tmp.path().join("out.txt");

	// Minimal 1x1 white PNG
	let png_bytes: [u8; 67] = [
		0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44,
		0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F,
		0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00,
		0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
		0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
	];
	std::fs::write(&png, png_bytes).unwrap();

	sa_converter::engines::ocr::convert(&engine, "image2text", &png, &txt).unwrap();
	assert!(txt.exists());
}
