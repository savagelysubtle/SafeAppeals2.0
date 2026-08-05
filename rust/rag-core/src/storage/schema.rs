// Copyright (c) Safe Appeals. All rights reserved.

//! Chunk / document schema for the SQLCipher workspace DB.
//!
//! Inspired by void-reference `ragIndexService` tables, rewritten for SafeAppeals:
//! scope flags, citation anchor columns, and parent links for later hierarchical chunking.
//! FTS5 / BM25 live in tantivy (M3) — not in this DB.

/// Current schema version stored in `meta`.
pub const SCHEMA_VERSION: u32 = 1;

/// Database file name under a workspace root (`core_references` or `case_index`).
pub const DB_FILENAME: &str = "chunks.db";

/// DDL applied on first open (transactionally).
pub const SCHEMA_SQL: &str = r#"
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
	key TEXT PRIMARY KEY NOT NULL,
	value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
	id TEXT PRIMARY KEY NOT NULL,
	path TEXT NOT NULL,
	filename TEXT NOT NULL,
	filetype TEXT NOT NULL DEFAULT '',
	filesize INTEGER NOT NULL DEFAULT 0,
	checksum TEXT NOT NULL,
	scope TEXT NOT NULL CHECK (scope IN ('core_reference', 'case_index')),
	is_core_reference INTEGER NOT NULL DEFAULT 0,
	metadata_json TEXT NOT NULL DEFAULT '{}',
	created_at TEXT NOT NULL,
	last_indexed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chunks (
	chunk_id TEXT PRIMARY KEY NOT NULL,
	doc_id TEXT NOT NULL,
	text TEXT NOT NULL,
	chunk_index INTEGER NOT NULL,
	token_count INTEGER,
	parent_chunk_id TEXT,
	chunk_type TEXT CHECK (chunk_type IS NULL OR chunk_type IN ('child', 'parent')),
	section_id TEXT,
	section_number TEXT,
	section_title TEXT,
	breadcrumb_path TEXT,
	metadata_json TEXT NOT NULL DEFAULT '{}',
	source_uri TEXT,
	page INTEGER,
	heading TEXT,
	char_start INTEGER,
	char_end INTEGER,
	FOREIGN KEY (doc_id) REFERENCES documents (id) ON DELETE CASCADE,
	FOREIGN KEY (parent_chunk_id) REFERENCES chunks (chunk_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_scope ON documents (scope);
CREATE INDEX IF NOT EXISTS idx_documents_checksum ON documents (checksum);
CREATE INDEX IF NOT EXISTS idx_documents_path ON documents (path);
CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks (doc_id);
CREATE INDEX IF NOT EXISTS idx_chunks_parent ON chunks (parent_chunk_id);
CREATE INDEX IF NOT EXISTS idx_chunks_type ON chunks (chunk_type);
CREATE INDEX IF NOT EXISTS idx_chunks_section ON chunks (section_id);

-- M2: map chunk_id ↔ usearch u64 key (CASCADE with chunk delete)
CREATE TABLE IF NOT EXISTS vector_keys (
	chunk_id TEXT PRIMARY KEY NOT NULL,
	vector_key INTEGER NOT NULL UNIQUE,
	FOREIGN KEY (chunk_id) REFERENCES chunks (chunk_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vector_keys_key ON vector_keys (vector_key);
"#;
