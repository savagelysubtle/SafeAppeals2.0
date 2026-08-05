// Copyright (c) Safe Appeals. All rights reserved.

use thiserror::Error;

pub type EngineResult<T> = Result<T, EngineError>;

#[derive(Debug, Error)]
pub enum EngineError {
	#[error("unsupported conversion: {0}")]
	UnsupportedConversion(String),
	#[error("io error: {0}")]
	Io(#[from] std::io::Error),
	#[error("conversion failed: {0}")]
	Conversion(String),
	#[error("invalid options: {0}")]
	InvalidOptions(String),
	#[error("internal error: {0}")]
	Internal(String),
}

impl EngineError {
	pub fn conversion(msg: impl Into<String>) -> Self {
		Self::Conversion(msg.into())
	}
}

impl From<zip::result::ZipError> for EngineError {
	fn from(e: zip::result::ZipError) -> Self {
		Self::conversion(format!("zip error: {e}"))
	}
}

impl From<csv::Error> for EngineError {
	fn from(e: csv::Error) -> Self {
		Self::conversion(format!("csv error: {e}"))
	}
}

impl From<rust_xlsxwriter::XlsxError> for EngineError {
	fn from(e: rust_xlsxwriter::XlsxError) -> Self {
		Self::conversion(format!("xlsx error: {e}"))
	}
}

impl From<lopdf::Error> for EngineError {
	fn from(e: lopdf::Error) -> Self {
		Self::conversion(format!("pdf error: {e}"))
	}
}

impl From<tempfile::PersistError> for EngineError {
	fn from(e: tempfile::PersistError) -> Self {
		Self::conversion(format!("tempfile error: {e}"))
	}
}

impl From<tempfile::PathPersistError> for EngineError {
	fn from(e: tempfile::PathPersistError) -> Self {
		Self::conversion(format!("tempfile error: {e}"))
	}
}

impl From<::image::ImageError> for EngineError {
	fn from(e: ::image::ImageError) -> Self {
		Self::conversion(format!("image error: {e}"))
	}
}

impl From<docx_rs::ReaderError> for EngineError {
	fn from(e: docx_rs::ReaderError) -> Self {
		Self::conversion(format!("docx read error: {e}"))
	}
}

impl From<printpdf::Error> for EngineError {
	fn from(e: printpdf::Error) -> Self {
		Self::conversion(format!("pdf write error: {e}"))
	}
}
