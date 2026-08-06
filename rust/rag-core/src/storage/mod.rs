// Copyright (c) Safe Appeals. All rights reserved.

//! Encrypted chunk/document storage (SQLCipher). Owned solely by rag-core.

mod db;
mod error;
mod primary_lock;
mod schema;
pub(crate) mod workspace;

pub use db::{
	assert_encrypted_on_disk, ChunkRow, DocumentRow, WorkspaceDb, DEK_LEN,
};
pub use error::StorageError;
pub use schema::{DB_FILENAME, SCHEMA_VERSION};
pub use workspace::{
	close_workspace, get_document, is_open, open_workspace, session_index_write_capable,
	session_index_write_role, session_is_secondary, text_count, vector_count, with_session,
	workspace_counts, IndexWriteRole, WorkspaceSession,
};

#[cfg(test)]
pub(crate) mod test_lock {
	use std::sync::{Mutex, MutexGuard};

	static LOCK: Mutex<()> = Mutex::new(());

	/// Serialize tests that mutate the process-global workspace / embedder state.
	pub fn guard() -> MutexGuard<'static, ()> {
		LOCK.lock().unwrap_or_else(|e| e.into_inner())
	}
}
