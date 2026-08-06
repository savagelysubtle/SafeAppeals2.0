// Copyright (c) Safe Appeals. All rights reserved.

//! Cross-process primary lock for RAG workspace indexing.
//!
//! Exactly one EH holds `{root}/.rag-primary.lock` (exclusive flock via fs2).
//! Drop unlocks automatically when the primary session closes.

use std::fs::OpenOptions;
use std::io;
use std::path::Path;

use fs2::FileExt;

use super::error::StorageError;

/// Lock file name under the workspace root.
pub const PRIMARY_LOCK_FILENAME: &str = ".rag-primary.lock";

/// Outcome of a non-blocking primary lock attempt.
pub enum PrimaryLockAttempt {
	/// This process holds the exclusive flock (primary EH).
	Acquired(PrimaryLock),
	/// Another process holds the flock (open as secondary).
	HeldByOther,
}

/// Exclusive flock on `.rag-primary.lock`. Released on [`Drop`].
pub struct PrimaryLock {
	_file: std::fs::File,
}

impl PrimaryLock {
	/// Try to acquire the primary lock without blocking.
	pub fn try_acquire(root_dir: &Path) -> Result<PrimaryLockAttempt, StorageError> {
		std::fs::create_dir_all(root_dir).map_err(|e| StorageError::CreateDir {
			path: root_dir.display().to_string(),
			source: e,
		})?;
		let path = root_dir.join(PRIMARY_LOCK_FILENAME);
		let file = OpenOptions::new()
			.create(true)
			.read(true)
			.write(true)
			.open(&path)
			.map_err(StorageError::Io)?;
		match file.try_lock_exclusive() {
			Ok(()) => Ok(PrimaryLockAttempt::Acquired(PrimaryLock { _file: file })),
			Err(e) if e.kind() == io::ErrorKind::WouldBlock => Ok(PrimaryLockAttempt::HeldByOther),
			Err(e) => Err(StorageError::Message(format!(
				"failed to acquire primary lock at {}: {e}",
				path.display()
			))),
		}
	}
}

impl Drop for PrimaryLock {
	fn drop(&mut self) {
		let _ = self._file.unlock();
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use tempfile::tempdir;

	#[test]
	fn primary_lock_exclusive_between_handles() {
		let dir = tempdir().unwrap();
		let first = PrimaryLock::try_acquire(dir.path()).expect("try_acquire");
		let PrimaryLockAttempt::Acquired(_lock) = first else {
			panic!("expected first acquire to succeed");
		};
		let second = PrimaryLock::try_acquire(dir.path()).expect("try_acquire");
		assert!(matches!(second, PrimaryLockAttempt::HeldByOther));
	}

	#[test]
	fn primary_lock_released_after_drop() {
		let dir = tempdir().unwrap();
		{
			let attempt = PrimaryLock::try_acquire(dir.path()).expect("try_acquire");
			assert!(matches!(attempt, PrimaryLockAttempt::Acquired(_)));
		}
		let again = PrimaryLock::try_acquire(dir.path()).expect("try_acquire");
		assert!(matches!(again, PrimaryLockAttempt::Acquired(_)));
	}
}
