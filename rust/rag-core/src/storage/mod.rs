// Copyright (c) Safe Appeals. All rights reserved.

//! Encrypted chunk/document storage (SQLCipher). Owned solely by rag-core.

mod db;
mod error;
mod schema;
pub(crate) mod workspace;

pub use db::{
	assert_encrypted_on_disk, ChunkRow, DocumentRow, WorkspaceDb, DEK_LEN,
};
pub use error::StorageError;
pub use schema::{DB_FILENAME, SCHEMA_VERSION};
pub use workspace::{
	close_workspace, is_open, open_workspace, text_count, vector_count, with_session,
	workspace_counts, WorkspaceSession,
};
