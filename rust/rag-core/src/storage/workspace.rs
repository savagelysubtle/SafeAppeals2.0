// Copyright (c) Safe Appeals. All rights reserved.

//! Process-global open workspace handle for the N-API surface.
//!
//! Primary/secondary roles are decided by `{root}/.rag-primary.lock` (fs2 flock).
//! Exactly one EH holds the lock as **primary** (index + search); others open **secondary**
//! (search-only, SQLCipher read-only, no mutations).

use std::path::Path;
use std::sync::Mutex;

use crate::embed::BGE_SMALL_DIMS;
use crate::text::TextIndex;
use crate::vector::VectorIndex;

use super::db::WorkspaceDb;
use super::error::StorageError;
use super::primary_lock::{PrimaryLock, PrimaryLockAttempt};

/// Indexing role for the open workspace session.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IndexWriteRole {
	/// Holds `.rag-primary.lock`; may index and search.
	Primary,
	/// Another EH holds the lock; search-only.
	Secondary,
}

impl IndexWriteRole {
	pub fn is_primary(self) -> bool {
		matches!(self, Self::Primary)
	}
}

/// Open workspace: encrypted chunk DB + usearch HNSW + tantivy BM25 work files.
pub struct WorkspaceSession {
	pub db: WorkspaceDb,
	pub vectors: VectorIndex,
	pub text: TextIndex,
	pub role: IndexWriteRole,
	/// Held only while `role == Primary`; Drop releases the flock.
	primary_lock: Option<PrimaryLock>,
}

static WORKSPACE: Mutex<Option<WorkspaceSession>> = Mutex::new(None);

/// Resolve role from flock, then open storage + indexes.
///
/// Always attempts a non-blocking flock: acquired → primary, held by another EH → secondary.
/// `prefer_secondary` is a soft host hint (e.g. Agents window) and does **not** skip flock.
pub fn open_workspace(
	root_dir: &str,
	dek_bytes: &[u8],
	_prefer_secondary: bool,
) -> Result<IndexWriteRole, StorageError> {
	let mut guard = WORKSPACE
		.lock()
		.map_err(|_| StorageError::Message("workspace mutex poisoned".into()))?;
	if guard.is_some() {
		return Err(StorageError::AlreadyOpen);
	}

	let root = Path::new(root_dir);
	let (role, primary_lock) = match PrimaryLock::try_acquire(root)? {
		PrimaryLockAttempt::Acquired(lock) => (IndexWriteRole::Primary, Some(lock)),
		PrimaryLockAttempt::HeldByOther => (IndexWriteRole::Secondary, None),
	};

	let (db, vectors, text) = match role {
		IndexWriteRole::Primary => {
			let db = WorkspaceDb::open(root_dir, dek_bytes)?;
			let vectors = VectorIndex::open(db.root_dir(), BGE_SMALL_DIMS)
				.map_err(|e| StorageError::Message(e.to_string()))?;
			let text = TextIndex::open(db.root_dir())
				.map_err(|e| StorageError::Message(e.to_string()))?;
			(db, vectors, text)
		}
		IndexWriteRole::Secondary => {
			let db = WorkspaceDb::open_read_only(root_dir, dek_bytes)?;
			let vectors = VectorIndex::open_read_only(db.root_dir(), BGE_SMALL_DIMS)
				.map_err(|e| StorageError::Message(e.to_string()))?;
			let text = TextIndex::open_read_only(db.root_dir())
				.map_err(|e| StorageError::Message(e.to_string()))?;
			(db, vectors, text)
		}
	};

	*guard = Some(WorkspaceSession {
		db,
		vectors,
		text,
		role,
		primary_lock,
	});
	Ok(role)
}

/// Close the open workspace, persist vectors, commit text index, release primary flock.
pub fn close_workspace() -> Result<(), StorageError> {
	let mut guard = WORKSPACE
		.lock()
		.map_err(|_| StorageError::Message("workspace mutex poisoned".into()))?;
	let Some(mut session) = guard.take() else {
		return Err(StorageError::NotOpen);
	};
	if session.role == IndexWriteRole::Primary {
		session
			.vectors
			.save()
			.map_err(|e| StorageError::Message(format!("failed to save vectors.usearch: {e}")))?;
		session
			.text
			.commit()
			.map_err(|e| StorageError::Message(format!("failed to commit text.tantivy: {e}")))?;
	}
	// primary_lock Drop releases flock.
	session.primary_lock = None;
	Ok(())
}

/// Whether a workspace is currently open.
pub fn is_open() -> bool {
	WORKSPACE
		.lock()
		.map(|g| g.is_some())
		.unwrap_or(false)
}

/// Role of the open session, if any.
pub fn session_index_write_role() -> Option<IndexWriteRole> {
	WORKSPACE
		.lock()
		.ok()
		.and_then(|g| g.as_ref().map(|s| s.role))
}

/// True when the open session is secondary (search-only).
pub fn session_is_secondary() -> bool {
	matches!(
		session_index_write_role(),
		Some(IndexWriteRole::Secondary)
	)
}

/// True when indexing may run on the open session.
pub fn session_index_write_capable() -> bool {
	matches!(session_index_write_role(), Some(IndexWriteRole::Primary))
}

/// Document / chunk counts for the open workspace.
pub fn workspace_counts() -> Result<(u64, u64), StorageError> {
	with_session(|s| Ok((s.db.count_documents()?, s.db.count_chunks()?)))
}

/// Lookup document metadata by id in the open workspace (read-only; secondary OK).
pub fn get_document(doc_id: &str) -> Result<Option<super::db::DocumentRow>, StorageError> {
	with_session(|s| s.db.get_document(doc_id))
}

/// Vector count from the in-memory usearch index.
pub fn vector_count() -> Result<u64, StorageError> {
	with_session(|s| Ok(s.vectors.len() as u64))
}

/// Tantivy live document count (text index).
pub fn text_count() -> Result<u64, StorageError> {
	with_session(|s| Ok(s.text.doc_count()))
}

/// Access the open session.
pub fn with_session<F, T>(f: F) -> Result<T, StorageError>
where
	F: FnOnce(&mut WorkspaceSession) -> Result<T, StorageError>,
{
	let mut guard = WORKSPACE
		.lock()
		.map_err(|_| StorageError::Message("workspace mutex poisoned".into()))?;
	match guard.as_mut() {
		Some(session) => f(session),
		None => Err(StorageError::NotOpen),
	}
}

/// Test-only access to the open DB (legacy helper).
#[cfg(test)]
pub fn with_open_db<F, T>(f: F) -> Result<T, StorageError>
where
	F: FnOnce(&mut WorkspaceDb) -> Result<T, StorageError>,
{
	with_session(|s| f(&mut s.db))
}

#[cfg(test)]
mod tests {
	use super::*;
	use super::super::db::DEK_LEN;
	use super::super::primary_lock::{PrimaryLock, PrimaryLockAttempt};
	use super::super::test_lock;
	use tempfile::tempdir;

	fn with_workspace_test_lock<F, T>(f: F) -> T
	where
		F: FnOnce() -> T,
	{
		let _g = test_lock::guard();
		let _ = close_workspace();
		let out = f();
		let _ = close_workspace();
		out
	}

	fn test_dek() -> [u8; DEK_LEN] {
		[0x11u8; DEK_LEN]
	}

	#[test]
	fn flock_primary_then_secondary_open() {
		with_workspace_test_lock(|| {
			let dir = tempdir().unwrap();
			let root = dir.path().to_str().unwrap();
			let dek = test_dek();

			let role1 = open_workspace(root, &dek, false).expect("primary open");
			assert_eq!(role1, IndexWriteRole::Primary);
			assert!(session_index_write_capable());

			let attempt = PrimaryLock::try_acquire(dir.path()).unwrap();
			assert!(matches!(attempt, PrimaryLockAttempt::HeldByOther));
		});
	}

	#[test]
	fn prefer_secondary_becomes_primary_when_lock_free() {
		with_workspace_test_lock(|| {
			let dir = tempdir().unwrap();
			let root = dir.path().to_str().unwrap();
			let dek = test_dek();

			let role = open_workspace(root, &dek, true).expect("prefer_secondary open");
			assert_eq!(role, IndexWriteRole::Primary);
			assert!(session_index_write_capable());

			let attempt = PrimaryLock::try_acquire(dir.path()).unwrap();
			assert!(matches!(attempt, PrimaryLockAttempt::HeldByOther));
		});
	}

	#[test]
	fn prefer_secondary_opens_secondary_when_lock_held() {
		with_workspace_test_lock(|| {
			let dir = tempdir().unwrap();
			let root = dir.path().to_str().unwrap();
			let dek = test_dek();

			// Bootstrap encrypted store + indexes as primary.
			let primary = open_workspace(root, &dek, false).expect("bootstrap primary");
			assert_eq!(primary, IndexWriteRole::Primary);
			close_workspace().expect("close bootstrap");

			let external = PrimaryLock::try_acquire(dir.path()).unwrap();
			let PrimaryLockAttempt::Acquired(_held) = external else {
				panic!("expected external lock acquire");
			};

			let role = open_workspace(root, &dek, true).expect("secondary open");
			assert_eq!(role, IndexWriteRole::Secondary);
			assert!(!session_index_write_capable());
		});
	}

	#[test]
	fn secondary_session_rejects_index_and_remove() {
		use crate::embed;
		use crate::index_ops;
		use super::super::db::{ChunkRow, DocumentRow};

		with_workspace_test_lock(|| {
			embed::install_fake_for_tests();
			let dir = tempdir().unwrap();
			let root = dir.path().to_str().unwrap();
			let dek = test_dek();

			open_workspace(root, &dek, false).expect("bootstrap primary");
			close_workspace().expect("close bootstrap");

			let external = PrimaryLock::try_acquire(dir.path()).unwrap();
			let PrimaryLockAttempt::Acquired(_held) = external else {
				panic!("expected external lock acquire");
			};

			let role = open_workspace(root, &dek, false).expect("secondary open");
			assert_eq!(role, IndexWriteRole::Secondary);

			let doc = DocumentRow {
				id: "sec-doc".into(),
				path: "/s.md".into(),
				filename: "s.md".into(),
				filetype: "md".into(),
				filesize: 1,
				checksum: "x".into(),
				scope: "case_index".into(),
				is_core_reference: false,
				metadata_json: "{}".into(),
				created_at: "t".into(),
				last_indexed_at: "t".into(),
			};
			let chunks = vec![ChunkRow {
				chunk_id: "sec-doc_chunk_0".into(),
				doc_id: "sec-doc".into(),
				text: "blocked".into(),
				chunk_index: 0,
				token_count: Some(1),
				parent_chunk_id: None,
				chunk_type: None,
				section_id: None,
				section_number: None,
				section_title: None,
				breadcrumb_path: None,
				metadata_json: "{}".into(),
				source_uri: None,
				page: None,
				heading: None,
				char_start: None,
				char_end: None,
			}];

			let index_err = index_ops::index_chunks(&doc, &chunks).unwrap_err();
			assert!(
				index_err.to_string().contains("secondary session"),
				"unexpected index error: {index_err}"
			);

			let remove_err = index_ops::remove_doc("sec-doc").unwrap_err();
			assert!(
				remove_err.to_string().contains("secondary session"),
				"unexpected remove error: {remove_err}"
			);
		});
	}
}
