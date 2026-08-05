// Copyright (c) Safe Appeals. All rights reserved.

//! Process-global open workspace handle for the N-API surface.
//!
//! M1: single open workspace at a time.
//! M2: also opens `{root}/vectors.usearch` alongside the SQLCipher DB.
//! M3: also opens `{root}/text.tantivy` BM25 index.

use std::sync::Mutex;

use crate::embed::BGE_SMALL_DIMS;
use crate::text::TextIndex;
use crate::vector::VectorIndex;

use super::db::WorkspaceDb;
use super::error::StorageError;

/// Open workspace: encrypted chunk DB + usearch HNSW + tantivy BM25 work files.
pub struct WorkspaceSession {
	pub db: WorkspaceDb,
	pub vectors: VectorIndex,
	pub text: TextIndex,
}

static WORKSPACE: Mutex<Option<WorkspaceSession>> = Mutex::new(None);

/// Open encrypted storage + vector + text indexes at `root_dir` with a 32-byte DEK.
pub fn open_workspace(root_dir: &str, dek_bytes: &[u8]) -> Result<(), StorageError> {
	let mut guard = WORKSPACE
		.lock()
		.map_err(|_| StorageError::Message("workspace mutex poisoned".into()))?;
	if guard.is_some() {
		return Err(StorageError::AlreadyOpen);
	}
	let db = WorkspaceDb::open(root_dir, dek_bytes)?;
	let vectors = VectorIndex::open(db.root_dir(), BGE_SMALL_DIMS)
		.map_err(|e| StorageError::Message(e.to_string()))?;
	let text = TextIndex::open(db.root_dir())
		.map_err(|e| StorageError::Message(e.to_string()))?;
	*guard = Some(WorkspaceSession { db, vectors, text });
	Ok(())
}

/// Close the open workspace, persist vectors, commit text index, wipe DEK material.
pub fn close_workspace() -> Result<(), StorageError> {
	let mut guard = WORKSPACE
		.lock()
		.map_err(|_| StorageError::Message("workspace mutex poisoned".into()))?;
	let Some(mut session) = guard.take() else {
		return Err(StorageError::NotOpen);
	};
	session
		.vectors
		.save()
		.map_err(|e| StorageError::Message(format!("failed to save vectors.usearch: {e}")))?;
	// Ensure tantivy writer is committed (no-op if already clean).
	session
		.text
		.commit()
		.map_err(|e| StorageError::Message(format!("failed to commit text.tantivy: {e}")))?;
	Ok(())
}

/// Whether a workspace is currently open.
pub fn is_open() -> bool {
	WORKSPACE
		.lock()
		.map(|g| g.is_some())
		.unwrap_or(false)
}

/// Document / chunk counts for the open workspace.
pub fn workspace_counts() -> Result<(u64, u64), StorageError> {
	with_session(|s| Ok((s.db.count_documents()?, s.db.count_chunks()?)))
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
