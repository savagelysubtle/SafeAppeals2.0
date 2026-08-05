// Copyright (c) Safe Appeals. All rights reserved.

//! Storage / SQLCipher error types.

use thiserror::Error;

/// Failures while opening or mutating the encrypted chunk DB.
#[derive(Debug, Error)]
pub enum StorageError {
	#[error("data-encryption key must be exactly 32 bytes (AES-256); got {0}")]
	InvalidDekLength(usize),

	#[error(
		"database at {0} is plaintext on disk; SQLCipher encryption is not active (fail-closed)"
	)]
	PlaintextDatabase(String),

	#[error("workspace root is not a directory: {0}")]
	NotADirectory(String),

	#[error("failed to create workspace directory {path}: {source}")]
	CreateDir {
		path: String,
		#[source]
		source: std::io::Error,
	},

	#[error("SQLCipher / SQLite error: {0}")]
	Sqlite(#[from] rusqlite::Error),

	#[error("I/O error: {0}")]
	Io(#[from] std::io::Error),

	#[error("workspace already open; call closeWorkspace() first")]
	AlreadyOpen,

	#[error("no workspace is open")]
	NotOpen,

	#[error("SQLCipher crypto unavailable or key rejected: {0}")]
	CryptoUnavailable(String),

	#[error("{0}")]
	Message(String),
}
