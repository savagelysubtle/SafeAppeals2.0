// Copyright (c) Safe Appeals. All rights reserved.

//! LibreOffice detection, warm worker, and office-fidelity conversions.

#[cfg(feature = "libreoffice")]
mod convert;
#[cfg(feature = "libreoffice")]
mod detect;
#[cfg(feature = "libreoffice")]
mod worker;

#[cfg(feature = "libreoffice")]
pub use detect::{detect_soffice, SofficeInstall};
#[cfg(feature = "libreoffice")]
pub use worker::LibreOfficeWorker;

#[cfg(not(feature = "libreoffice"))]
pub use stub::*;

/// Conversion keys routed through the warm LibreOffice worker.
pub const LO_CONVERSION_KEYS: &[&str] = &[
	"docx2pdf",
	"xlsx2pdf",
	"pptx2pdf",
	"epub2pdf",
	"pptx2images",
];

pub fn is_lo_conversion(key: &str) -> bool {
	LO_CONVERSION_KEYS.contains(&key)
}

pub fn feature_enabled() -> bool {
	cfg!(feature = "libreoffice")
}

#[cfg(feature = "libreoffice")]
pub fn probe_install() -> Option<SofficeInstall> {
	detect_soffice()
}

#[cfg(not(feature = "libreoffice"))]
mod stub {
	/// Stub worker when `libreoffice` feature is disabled at compile time.
	#[derive(Debug, Default)]
	pub struct LibreOfficeWorker;

	impl LibreOfficeWorker {
		pub fn new() -> Self {
			Self
		}

		pub fn is_available(&self) -> bool {
			false
		}

		pub fn probe(&mut self, _timeout_ms: Option<u64>) -> bool {
			false
		}

		pub fn probe_and_start(&mut self, _timeout_ms: Option<u64>) -> bool {
			false
		}

		pub fn is_healthy(&self) -> bool {
			false
		}

		pub fn with_profile_dir(self, _dir: std::path::PathBuf) -> Self {
			self
		}

		pub fn shutdown(&mut self) {}
	}

	pub fn probe_install() -> Option<()> {
		None
	}

	pub fn convert(
		_worker: &LibreOfficeWorker,
		_key: &str,
		_input: &std::path::Path,
		_output: &std::path::Path,
	) -> crate::engines::error::EngineResult<()> {
		Err(crate::engines::error::EngineError::Conversion(
			"LibreOffice feature disabled".into(),
		))
	}
}

#[cfg(feature = "libreoffice")]
pub fn convert(
	worker: &LibreOfficeWorker,
	key: &str,
	input: &std::path::Path,
	output: &std::path::Path,
) -> crate::engines::error::EngineResult<()> {
	convert::convert(worker, key, input, output)
}
