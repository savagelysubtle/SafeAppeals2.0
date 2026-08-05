// Copyright (c) Safe Appeals. All rights reserved.

//! Browser-print integration tests — spawn tests are `#[ignore]`.

use sa_converter::engines::browser::{detect_chromium, BrowserEngine};
use sa_converter::registry::{build_registry, EngineAvailability, BROWSER_KEYS};

#[test]
fn browser_registry_unavailable_by_default() {
	for key in BROWSER_KEYS {
		assert!(
			!build_registry(EngineAvailability::default())
				.get(*key)
				.unwrap()
				.available
		);
	}
}

#[test]
fn browser_registry_available_when_detected() {
	let reg = build_registry(EngineAvailability {
		browser: true,
		..EngineAvailability::default()
	});
	for key in BROWSER_KEYS {
		let spec = reg.get(*key).unwrap();
		assert!(spec.available, "{key}");
	}
}

#[test]
#[ignore = "requires system Chrome/Chromium"]
fn browser_html2pdf_integration() {
	let mut engine = BrowserEngine::new();
	assert!(engine.probe(None, Some(120_000)));

	let tmp = tempfile::tempdir().unwrap();
	let html = tmp.path().join("page.html");
	let pdf = tmp.path().join("out.pdf");
	std::fs::write(
		&html,
		"<!DOCTYPE html><html><body><h1>Browser print test</h1></body></html>",
	)
	.unwrap();

	sa_converter::engines::browser::convert(&engine, "html2pdf", &html, &pdf).unwrap();
	assert!(pdf.exists());
	assert!(std::fs::metadata(&pdf).unwrap().len() > 100);
}

#[test]
#[ignore = "requires system Chrome/Chromium"]
fn browser_detection_reports_binary() {
	let install = detect_chromium(None).expect("browser not found");
	assert!(install.binary.is_file());
}
