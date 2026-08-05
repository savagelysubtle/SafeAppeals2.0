// Copyright (c) Safe Appeals. All rights reserved.

//! LibreOffice integration tests — all LO spawn tests are `#[ignore]`.

#![cfg(feature = "libreoffice")]

use sa_converter::engines::libreoffice::{detect_soffice, LibreOfficeWorker};
use sa_converter::registry::{build_registry, EngineAvailability, LO_KEYS};

fn soffice_present() -> bool {
	detect_soffice().is_some()
}

#[test]
fn lo_registry_unavailable_without_worker() {
	for key in LO_KEYS {
		assert!(
			!build_registry(EngineAvailability::default())
				.get(*key)
				.unwrap()
				.available
		);
	}
}

#[test]
fn lo_registry_available_when_flagged_healthy() {
	let reg = build_registry(EngineAvailability {
		lo: true,
		..EngineAvailability::default()
	});
	for key in LO_KEYS {
		let spec = reg.get(*key).unwrap();
		assert!(spec.available, "{key}");
		assert_eq!(spec.engine, "libreoffice");
	}
}

#[test]
#[ignore = "requires system LibreOffice (soffice)"]
fn lo_detection_reports_binary_when_present() {
	let install = detect_soffice().expect("soffice not found");
	assert!(install.binary.is_file());
}

#[test]
#[ignore = "requires system LibreOffice (soffice)"]
fn lo_registry_flips_when_worker_healthy() {
	let mut worker = LibreOfficeWorker::new()
		.with_profile_dir(std::env::temp_dir().join("sa-lo-registry-test"));
	assert!(worker.probe_and_start(None));
	let reg = build_registry(EngineAvailability {
		lo: true,
		..EngineAvailability::default()
	});
	for key in LO_KEYS {
		let spec = reg.get(*key).unwrap();
		assert!(spec.available, "{key}");
		assert_eq!(spec.engine, "libreoffice");
	}
	worker.shutdown();
}

#[test]
#[ignore = "requires system LibreOffice (soffice)"]
fn lo_docx2pdf_integration() {
	if !soffice_present() {
		eprintln!("skipping: soffice not found");
		return;
	}

	let mut worker = LibreOfficeWorker::new()
		.with_profile_dir(std::env::temp_dir().join("sa-lo-integration-test"));
	assert!(worker.probe_and_start(Some(180_000)));

	let tmp = tempfile::tempdir().unwrap();
	let docx = tmp.path().join("sample.docx");
	let pdf = tmp.path().join("out.pdf");

	let doc = docx_rs::Docx::new().add_paragraph(
		docx_rs::Paragraph::new().add_run(docx_rs::Run::new().add_text("LO integration test")),
	);
	let mut file = std::fs::File::create(&docx).unwrap();
	doc.build().pack(&mut file).unwrap();

	sa_converter::engines::libreoffice::convert(&worker, "docx2pdf", &docx, &pdf).unwrap();
	assert!(pdf.exists());
	assert!(std::fs::metadata(&pdf).unwrap().len() > 100);

	worker.shutdown();
}
