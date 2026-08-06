// Copyright (c) Safe Appeals. All rights reserved.

//! Encrypted workspace database (SQLCipher 4 via rusqlite).

use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

use rusqlite::{Connection, OpenFlags, OptionalExtension};
use zeroize::Zeroize;

use super::error::StorageError;
use super::schema::{DB_FILENAME, SCHEMA_SQL, SCHEMA_VERSION};

/// SQLite plaintext file magic (`"SQLite format 3\0"`).
const SQLITE_PLAINTEXT_MAGIC: &[u8] = b"SQLite format 3\0";

/// AES-256 DEK length required from the host.
pub const DEK_LEN: usize = 32;

/// Document row for insert / read round-trips (M1 test + later ingest).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DocumentRow {
	pub id: String,
	pub path: String,
	pub filename: String,
	pub filetype: String,
	pub filesize: i64,
	pub checksum: String,
	pub scope: String,
	pub is_core_reference: bool,
	pub metadata_json: String,
	pub created_at: String,
	pub last_indexed_at: String,
}

/// Chunk row for insert / read round-trips.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChunkRow {
	pub chunk_id: String,
	pub doc_id: String,
	pub text: String,
	pub chunk_index: i64,
	pub token_count: Option<i64>,
	pub parent_chunk_id: Option<String>,
	pub chunk_type: Option<String>,
	pub section_id: Option<String>,
	pub section_number: Option<String>,
	pub section_title: Option<String>,
	pub breadcrumb_path: Option<String>,
	pub metadata_json: String,
	pub source_uri: Option<String>,
	pub page: Option<i64>,
	pub heading: Option<String>,
	pub char_start: Option<i64>,
	pub char_end: Option<i64>,
}

/// Open SQLCipher connection bound to a workspace root directory.
///
/// DEK bytes are applied via `PRAGMA key` and not retained on this struct.
pub struct WorkspaceDb {
	conn: Connection,
	root_dir: PathBuf,
	db_path: PathBuf,
}

impl std::fmt::Debug for WorkspaceDb {
	fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
		f.debug_struct("WorkspaceDb")
			.field("root_dir", &self.root_dir)
			.field("db_path", &self.db_path)
			.finish_non_exhaustive()
	}
}

impl WorkspaceDb {
	/// Open (or create) `chunks.db` under `root_dir` with the given 32-byte DEK.
	///
	/// Fail-closed:
	/// - DEK length ≠ 32
	/// - Existing file has plaintext SQLite magic
	/// - SQLCipher key rejected / crypto unavailable
	/// - After schema write, on-disk header is still plaintext (cipher missed)
	pub fn open(root_dir: impl AsRef<Path>, dek_bytes: &[u8]) -> Result<Self, StorageError> {
		if dek_bytes.len() != DEK_LEN {
			return Err(StorageError::InvalidDekLength(dek_bytes.len()));
		}

		let root_dir = root_dir.as_ref().to_path_buf();
		ensure_workspace_dir(&root_dir)?;

		let db_path = root_dir.join(DB_FILENAME);
		reject_plaintext_sqlite(&db_path)?;

		// DEK is consumed for PRAGMA key only — not stored on WorkspaceDb.
		let conn = open_encrypted(&db_path, dek_bytes)?;
		apply_schema(&conn)?;
		// Push WAL pages to the main file so the header check sees real content.
		let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
		assert_encrypted_on_disk(&db_path)?;

		Ok(Self {
			conn,
			root_dir,
			db_path,
		})
	}

	/// Open an existing encrypted `chunks.db` read-only (secondary EH / search-only).
	pub fn open_read_only(root_dir: impl AsRef<Path>, dek_bytes: &[u8]) -> Result<Self, StorageError> {
		if dek_bytes.len() != DEK_LEN {
			return Err(StorageError::InvalidDekLength(dek_bytes.len()));
		}

		let root_dir = root_dir.as_ref().to_path_buf();
		if !root_dir.is_dir() {
			return Err(StorageError::NotADirectory(root_dir.display().to_string()));
		}

		let db_path = root_dir.join(DB_FILENAME);
		if !db_path.exists() {
			return Err(StorageError::Message(
				"database does not exist (read-only open)".into(),
			));
		}
		reject_plaintext_sqlite(&db_path)?;

		let conn = open_encrypted_read_only(&db_path, dek_bytes)?;
		verify_schema(&conn)?;

		Ok(Self {
			conn,
			root_dir,
			db_path,
		})
	}

	pub fn root_dir(&self) -> &Path {
		&self.root_dir
	}

	pub fn db_path(&self) -> &Path {
		&self.db_path
	}

	pub fn connection(&self) -> &Connection {
		&self.conn
	}

	/// Insert a document inside a transaction (caller may batch with chunks).
	pub fn insert_document(&self, doc: &DocumentRow) -> Result<(), StorageError> {
		self.conn.execute(
			r#"
			INSERT INTO documents (
				id, path, filename, filetype, filesize, checksum, scope,
				is_core_reference, metadata_json, created_at, last_indexed_at
			) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
			"#,
			rusqlite::params![
				doc.id,
				doc.path,
				doc.filename,
				doc.filetype,
				doc.filesize,
				doc.checksum,
				doc.scope,
				if doc.is_core_reference { 1 } else { 0 },
				doc.metadata_json,
				doc.created_at,
				doc.last_indexed_at,
			],
		)?;
		Ok(())
	}

	pub fn insert_chunk(&self, chunk: &ChunkRow) -> Result<(), StorageError> {
		self.conn.execute(
			r#"
			INSERT INTO chunks (
				chunk_id, doc_id, text, chunk_index, token_count, parent_chunk_id,
				chunk_type, section_id, section_number, section_title, breadcrumb_path,
				metadata_json, source_uri, page, heading, char_start, char_end
			) VALUES (
				?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17
			)
			"#,
			rusqlite::params![
				chunk.chunk_id,
				chunk.doc_id,
				chunk.text,
				chunk.chunk_index,
				chunk.token_count,
				chunk.parent_chunk_id,
				chunk.chunk_type,
				chunk.section_id,
				chunk.section_number,
				chunk.section_title,
				chunk.breadcrumb_path,
				chunk.metadata_json,
				chunk.source_uri,
				chunk.page,
				chunk.heading,
				chunk.char_start,
				chunk.char_end,
			],
		)?;
		Ok(())
	}

	/// Atomically insert one document and its chunks.
	pub fn insert_document_with_chunks(
		&mut self,
		doc: &DocumentRow,
		chunks: &[ChunkRow],
	) -> Result<(), StorageError> {
		let tx = self.conn.transaction()?;
		tx.execute(
			r#"
			INSERT INTO documents (
				id, path, filename, filetype, filesize, checksum, scope,
				is_core_reference, metadata_json, created_at, last_indexed_at
			) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
			"#,
			rusqlite::params![
				doc.id,
				doc.path,
				doc.filename,
				doc.filetype,
				doc.filesize,
				doc.checksum,
				doc.scope,
				if doc.is_core_reference { 1 } else { 0 },
				doc.metadata_json,
				doc.created_at,
				doc.last_indexed_at,
			],
		)?;
		for chunk in chunks {
			tx.execute(
				r#"
				INSERT INTO chunks (
					chunk_id, doc_id, text, chunk_index, token_count, parent_chunk_id,
					chunk_type, section_id, section_number, section_title, breadcrumb_path,
					metadata_json, source_uri, page, heading, char_start, char_end
				) VALUES (
					?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17
				)
				"#,
				rusqlite::params![
					chunk.chunk_id,
					chunk.doc_id,
					chunk.text,
					chunk.chunk_index,
					chunk.token_count,
					chunk.parent_chunk_id,
					chunk.chunk_type,
					chunk.section_id,
					chunk.section_number,
					chunk.section_title,
					chunk.breadcrumb_path,
					chunk.metadata_json,
					chunk.source_uri,
					chunk.page,
					chunk.heading,
					chunk.char_start,
					chunk.char_end,
				],
			)?;
		}
		tx.commit()?;
		Ok(())
	}

	pub fn get_document(&self, id: &str) -> Result<Option<DocumentRow>, StorageError> {
		let mut stmt = self.conn.prepare(
			r#"
			SELECT id, path, filename, filetype, filesize, checksum, scope,
				is_core_reference, metadata_json, created_at, last_indexed_at
			FROM documents WHERE id = ?1
			"#,
		)?;
		let row = stmt
			.query_row(rusqlite::params![id], |r| {
				Ok(DocumentRow {
					id: r.get(0)?,
					path: r.get(1)?,
					filename: r.get(2)?,
					filetype: r.get(3)?,
					filesize: r.get(4)?,
					checksum: r.get(5)?,
					scope: r.get(6)?,
					is_core_reference: r.get::<_, i64>(7)? != 0,
					metadata_json: r.get(8)?,
					created_at: r.get(9)?,
					last_indexed_at: r.get(10)?,
				})
			})
			.optional()?;
		Ok(row)
	}

	pub fn get_chunks_for_doc(&self, doc_id: &str) -> Result<Vec<ChunkRow>, StorageError> {
		let mut stmt = self.conn.prepare(
			r#"
			SELECT chunk_id, doc_id, text, chunk_index, token_count, parent_chunk_id,
				chunk_type, section_id, section_number, section_title, breadcrumb_path,
				metadata_json, source_uri, page, heading, char_start, char_end
			FROM chunks WHERE doc_id = ?1 ORDER BY chunk_index ASC
			"#,
		)?;
		let rows = stmt.query_map(rusqlite::params![doc_id], |r| {
			Ok(ChunkRow {
				chunk_id: r.get(0)?,
				doc_id: r.get(1)?,
				text: r.get(2)?,
				chunk_index: r.get(3)?,
				token_count: r.get(4)?,
				parent_chunk_id: r.get(5)?,
				chunk_type: r.get(6)?,
				section_id: r.get(7)?,
				section_number: r.get(8)?,
				section_title: r.get(9)?,
				breadcrumb_path: r.get(10)?,
				metadata_json: r.get(11)?,
				source_uri: r.get(12)?,
				page: r.get(13)?,
				heading: r.get(14)?,
				char_start: r.get(15)?,
				char_end: r.get(16)?,
			})
		})?;
		let mut out = Vec::new();
		for row in rows {
			out.push(row?);
		}
		Ok(out)
	}

	pub fn count_documents(&self) -> Result<u64, StorageError> {
		let n: i64 = self
			.conn
			.query_row("SELECT COUNT(*) FROM documents", [], |r| r.get(0))?;
		Ok(n as u64)
	}

	pub fn count_chunks(&self) -> Result<u64, StorageError> {
		let n: i64 = self
			.conn
			.query_row("SELECT COUNT(*) FROM chunks", [], |r| r.get(0))?;
		Ok(n as u64)
	}

	/// Delete a document and its chunks (FK CASCADE). Returns chunk ids removed.
	pub fn delete_document(&mut self, doc_id: &str) -> Result<Vec<String>, StorageError> {
		let chunk_ids: Vec<String> = {
			let mut stmt = self
				.conn
				.prepare("SELECT chunk_id FROM chunks WHERE doc_id = ?1")?;
			let rows = stmt.query_map(rusqlite::params![doc_id], |r| r.get(0))?;
			let mut out = Vec::new();
			for row in rows {
				out.push(row?);
			}
			out
		};
		self.conn
			.execute("DELETE FROM documents WHERE id = ?1", rusqlite::params![doc_id])?;
		Ok(chunk_ids)
	}

	/// Upsert document: replace existing row + chunks for the same id.
	///
	/// Callers should remove usearch keys for the old chunks **before** this
	/// (CASCADE clears `vector_keys` on chunk delete).
	pub fn replace_document_with_chunks(
		&mut self,
		doc: &DocumentRow,
		chunks: &[ChunkRow],
	) -> Result<(), StorageError> {
		let _removed = self.delete_document(&doc.id)?;
		// Parents before children (FK parent_chunk_id)
		let mut ordered = chunks.to_vec();
		ordered.sort_by_key(|c| {
			if c.chunk_type.as_deref() == Some("parent") {
				0
			} else {
				1
			}
		});
		self.insert_document_with_chunks(doc, &ordered)?;
		Ok(())
	}

	/// Allocate a fresh usearch key (monotonic in meta).
	pub fn alloc_vector_key(&self) -> Result<u64, StorageError> {
		let current: i64 = self
			.conn
			.query_row(
				"SELECT CAST(value AS INTEGER) FROM meta WHERE key = 'next_vector_key'",
				[],
				|r| r.get(0),
			)
			.optional()?
			.unwrap_or(1);
		let next = current + 1;
		self.conn.execute(
			"INSERT INTO meta (key, value) VALUES ('next_vector_key', ?1)
			 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
			rusqlite::params![next.to_string()],
		)?;
		Ok(current as u64)
	}

	pub fn set_vector_key(&self, chunk_id: &str, key: u64) -> Result<(), StorageError> {
		self.conn.execute(
			"INSERT INTO vector_keys (chunk_id, vector_key) VALUES (?1, ?2)
			 ON CONFLICT(chunk_id) DO UPDATE SET vector_key = excluded.vector_key",
			rusqlite::params![chunk_id, key as i64],
		)?;
		Ok(())
	}

	pub fn get_vector_key(&self, chunk_id: &str) -> Result<Option<u64>, StorageError> {
		let key: Option<i64> = self
			.conn
			.query_row(
				"SELECT vector_key FROM vector_keys WHERE chunk_id = ?1",
				rusqlite::params![chunk_id],
				|r| r.get(0),
			)
			.optional()?;
		Ok(key.map(|k| k as u64))
	}

	pub fn get_vector_keys_for_chunks(
		&self,
		chunk_ids: &[String],
	) -> Result<Vec<(String, u64)>, StorageError> {
		let mut out = Vec::new();
		for id in chunk_ids {
			if let Some(key) = self.get_vector_key(id)? {
				out.push((id.clone(), key));
			}
		}
		Ok(out)
	}

	pub fn delete_vector_keys(&self, chunk_ids: &[String]) -> Result<(), StorageError> {
		for id in chunk_ids {
			self.conn.execute(
				"DELETE FROM vector_keys WHERE chunk_id = ?1",
				rusqlite::params![id],
			)?;
		}
		Ok(())
	}

	/// Reverse lookup: usearch key → chunk_id.
	pub fn get_chunk_ids_for_vector_keys(
		&self,
		keys: &[u64],
	) -> Result<Vec<(u64, String)>, StorageError> {
		let mut out = Vec::new();
		for key in keys {
			let chunk_id: Option<String> = self
				.conn
				.query_row(
					"SELECT chunk_id FROM vector_keys WHERE vector_key = ?1",
					rusqlite::params![*key as i64],
					|r| r.get(0),
				)
				.optional()?;
			if let Some(id) = chunk_id {
				out.push((*key, id));
			}
		}
		Ok(out)
	}

	/// Hydrate chunk rows by id (order not guaranteed — caller reorders).
	pub fn get_chunks_by_ids(&self, chunk_ids: &[String]) -> Result<Vec<ChunkRow>, StorageError> {
		let mut out = Vec::new();
		for id in chunk_ids {
			let mut stmt = self.conn.prepare(
				r#"
				SELECT chunk_id, doc_id, text, chunk_index, token_count, parent_chunk_id,
					chunk_type, section_id, section_number, section_title, breadcrumb_path,
					metadata_json, source_uri, page, heading, char_start, char_end
				FROM chunks WHERE chunk_id = ?1
				"#,
			)?;
			let row = stmt
				.query_row(rusqlite::params![id], |r| {
					Ok(ChunkRow {
						chunk_id: r.get(0)?,
						doc_id: r.get(1)?,
						text: r.get(2)?,
						chunk_index: r.get(3)?,
						token_count: r.get(4)?,
						parent_chunk_id: r.get(5)?,
						chunk_type: r.get(6)?,
						section_id: r.get(7)?,
						section_number: r.get(8)?,
						section_title: r.get(9)?,
						breadcrumb_path: r.get(10)?,
						metadata_json: r.get(11)?,
						source_uri: r.get(12)?,
						page: r.get(13)?,
						heading: r.get(14)?,
						char_start: r.get(15)?,
						char_end: r.get(16)?,
					})
				})
				.optional()?;
			if let Some(c) = row {
				out.push(c);
			}
		}
		Ok(out)
	}

	/// Document scope for a chunk (`core_reference` / `case_index`).
	pub fn get_scope_for_chunk(&self, chunk_id: &str) -> Result<Option<String>, StorageError> {
		let scope: Option<String> = self
			.conn
			.query_row(
				r#"
				SELECT d.scope FROM chunks c
				JOIN documents d ON d.id = c.doc_id
				WHERE c.chunk_id = ?1
				"#,
				rusqlite::params![chunk_id],
				|r| r.get(0),
			)
			.optional()?;
		Ok(scope)
	}

	/// Map chunk_id → document scope for a batch.
	pub fn get_scopes_for_chunks(
		&self,
		chunk_ids: &[String],
	) -> Result<std::collections::HashMap<String, String>, StorageError> {
		let mut out = std::collections::HashMap::new();
		for id in chunk_ids {
			if let Some(scope) = self.get_scope_for_chunk(id)? {
				out.insert(id.clone(), scope);
			}
		}
		Ok(out)
	}
}

fn ensure_workspace_dir(root_dir: &Path) -> Result<(), StorageError> {
	if root_dir.exists() {
		if !root_dir.is_dir() {
			return Err(StorageError::NotADirectory(root_dir.display().to_string()));
		}
	} else {
		fs::create_dir_all(root_dir).map_err(|source| StorageError::CreateDir {
			path: root_dir.display().to_string(),
			source,
		})?;
		#[cfg(unix)]
		{
			let _ = fs::set_permissions(root_dir, fs::Permissions::from_mode(0o700));
		}
	}
	Ok(())
}

/// Hard-fail if `path` looks like an unencrypted SQLite database (pre-open gate).
pub fn reject_plaintext_sqlite(path: &Path) -> Result<(), StorageError> {
	if !path.exists() {
		return Ok(());
	}
	assert_encrypted_on_disk(path)
}

/// Time-tracker parity: after open/create + schema write, refuse if the on-disk
/// header is still plaintext SQLite magic (cipher missed / wrong native).
pub fn assert_encrypted_on_disk(path: &Path) -> Result<(), StorageError> {
	let mut file = File::open(path)?;
	let mut magic = [0u8; 16];
	let n = file.read(&mut magic)?;
	if n >= SQLITE_PLAINTEXT_MAGIC.len() && magic.starts_with(SQLITE_PLAINTEXT_MAGIC) {
		return Err(StorageError::PlaintextDatabase(path.display().to_string()));
	}
	Ok(())
}

fn open_encrypted(db_path: &Path, dek: &[u8]) -> Result<Connection, StorageError> {
	let conn = Connection::open(db_path).map_err(|e| {
		StorageError::CryptoUnavailable(format!("failed to open database file: {e}"))
	})?;
	configure_encrypted_connection(&conn, dek)?;
	conn.busy_timeout(std::time::Duration::from_millis(5000))
		.map_err(|e| StorageError::Sqlite(e))?;

	#[cfg(unix)]
	{
		let _ = fs::set_permissions(db_path, fs::Permissions::from_mode(0o600));
	}

	Ok(conn)
}

fn open_encrypted_read_only(db_path: &Path, dek: &[u8]) -> Result<Connection, StorageError> {
	let conn = Connection::open_with_flags(db_path, OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(
		|e| StorageError::CryptoUnavailable(format!("failed to open database read-only: {e}")),
	)?;
	configure_encrypted_connection(&conn, dek)?;
	conn.pragma_update(None, "query_only", true)?;
	Ok(conn)
}

fn configure_encrypted_connection(conn: &Connection, dek: &[u8]) -> Result<(), StorageError> {
	// SQLCipher 4 defaults apply (page size / KDF). Raw 256-bit key via x'hex'.
	let mut key_hex = hex::encode(dek);
	let mut key_pragma = format!("x'{key_hex}'");
	let key_result = conn.pragma_update(None, "key", key_pragma.as_str());
	key_pragma.zeroize();
	key_hex.zeroize();
	key_result.map_err(|e| StorageError::CryptoUnavailable(format!("PRAGMA key failed: {e}")))?;

	match conn.query_row("SELECT count(*) FROM sqlite_master", [], |r| r.get::<_, i64>(0)) {
		Ok(_) => {}
		Err(e) => {
			return Err(StorageError::CryptoUnavailable(format!(
				"SQLCipher key rejected or crypto unavailable: {e}"
			)));
		}
	}

	let _ = conn.pragma_query_value(None, "cipher_version", |r| r.get::<_, String>(0));

	conn.pragma_update(None, "foreign_keys", true)?;
	conn.pragma_update(None, "journal_mode", "WAL")?;
	conn.pragma_update(None, "synchronous", "NORMAL")?;
	Ok(())
}

fn apply_schema(conn: &Connection) -> Result<(), StorageError> {
	conn.execute_batch(SCHEMA_SQL)?;
	let current: Option<String> = conn
		.query_row(
			"SELECT value FROM meta WHERE key = 'schema_version'",
			[],
			|r| r.get(0),
		)
		.optional()?;
	if current.is_none() {
		conn.execute(
			"INSERT INTO meta (key, value) VALUES ('schema_version', ?1)",
			rusqlite::params![SCHEMA_VERSION.to_string()],
		)?;
	}
	Ok(())
}

fn verify_schema(conn: &Connection) -> Result<(), StorageError> {
	let current: Option<String> = conn
		.query_row(
			"SELECT value FROM meta WHERE key = 'schema_version'",
			[],
			|r| r.get(0),
		)
		.optional()?;
	if current.is_none() {
		return Err(StorageError::Message(
			"database schema missing (read-only open)".into(),
		));
	}
	Ok(())
}

#[cfg(test)]
mod tests {
	use super::*;
	use tempfile::tempdir;

	fn test_dek() -> [u8; DEK_LEN] {
		[
			0x2d, 0xd2, 0x9c, 0xa8, 0x51, 0xe7, 0xb5, 0x6e, 0x46, 0x97, 0xb0, 0xaa, 0x61, 0xae,
			0xde, 0xba, 0x64, 0x7e, 0xcb, 0x11, 0xe9, 0x75, 0x71, 0x33, 0x7a, 0x11, 0x0b, 0x71,
			0x0e, 0x94, 0x7e, 0x4d,
		]
	}

	#[test]
	fn open_create_asserts_encrypted_on_disk() {
		let dir = tempdir().unwrap();
		let root = dir.path().join("case_index");
		let db = WorkspaceDb::open(&root, &test_dek()).expect("open encrypted");
		assert_encrypted_on_disk(db.db_path()).expect("header must not be plaintext");
		let mut magic = [0u8; 16];
		File::open(db.db_path())
			.unwrap()
			.read_exact(&mut magic)
			.unwrap();
		assert_ne!(&magic[..], SQLITE_PLAINTEXT_MAGIC);
	}

	#[test]
	fn open_encrypted_insert_read_round_trip() {
		let dir = tempdir().unwrap();
		let root = dir.path().join("case_index");
		let mut db = WorkspaceDb::open(&root, &test_dek()).expect("open encrypted");

		let doc = DocumentRow {
			id: "doc-1".into(),
			path: "/cases/a/brief.md".into(),
			filename: "brief.md".into(),
			filetype: "md".into(),
			filesize: 42,
			checksum: "abc123".into(),
			scope: "case_index".into(),
			is_core_reference: false,
			metadata_json: r#"{"lang":"en"}"#.into(),
			created_at: "2026-08-04T00:00:00Z".into(),
			last_indexed_at: "2026-08-04T00:00:00Z".into(),
		};
		let chunks = vec![ChunkRow {
			chunk_id: "chunk-1".into(),
			doc_id: "doc-1".into(),
			text: "Confidential case fact.".into(),
			chunk_index: 0,
			token_count: Some(4),
			parent_chunk_id: None,
			chunk_type: Some("child".into()),
			section_id: Some("s1".into()),
			section_number: Some("1".into()),
			section_title: Some("Facts".into()),
			breadcrumb_path: Some("Facts".into()),
			metadata_json: "{}".into(),
			source_uri: Some("file:///cases/a/brief.md".into()),
			page: Some(1),
			heading: Some("Facts".into()),
			char_start: Some(0),
			char_end: Some(24),
		}];

		db.insert_document_with_chunks(&doc, &chunks)
			.expect("atomic insert");

		let got = db.get_document("doc-1").unwrap().expect("doc present");
		assert_eq!(got, doc);
		let got_chunks = db.get_chunks_for_doc("doc-1").unwrap();
		assert_eq!(got_chunks, chunks);

		// Re-open with same key and read again.
		drop(db);
		let db2 = WorkspaceDb::open(&root, &test_dek()).expect("reopen");
		assert_eq!(db2.count_documents().unwrap(), 1);
		assert_eq!(db2.count_chunks().unwrap(), 1);
		assert_eq!(db2.get_document("doc-1").unwrap().unwrap().checksum, "abc123");

		// File must not be plaintext SQLite.
		let mut magic = [0u8; 16];
		File::open(root.join(DB_FILENAME))
			.unwrap()
			.read_exact(&mut magic)
			.unwrap();
		assert_ne!(&magic[..], SQLITE_PLAINTEXT_MAGIC);
	}

	#[test]
	fn reject_plaintext_sqlite_file() {
		let dir = tempdir().unwrap();
		let root = dir.path().join("case_index");
		fs::create_dir_all(&root).unwrap();
		let db_path = root.join(DB_FILENAME);
		// Write a real plaintext SQLite DB.
		{
			let conn = rusqlite::Connection::open(&db_path).unwrap();
			// Without SQLCipher key this is a normal SQLite file — but wait:
			// with bundled-sqlcipher, Connection::open still creates SQLCipher-capable
			// files. Unkeyed open of a new file leaves plaintext SQLite format until
			// a key is set and pages are written. Write a table without key → plaintext.
			conn.execute_batch("CREATE TABLE t (id INTEGER); INSERT INTO t VALUES (1);")
				.unwrap();
		}
		let mut magic = [0u8; 16];
		File::open(&db_path)
			.unwrap()
			.read_exact(&mut magic)
			.unwrap();
		assert_eq!(&magic[..], SQLITE_PLAINTEXT_MAGIC);

		let err = WorkspaceDb::open(&root, &test_dek()).unwrap_err();
		match err {
			StorageError::PlaintextDatabase(p) => {
				assert!(p.contains("chunks.db"));
			}
			other => panic!("expected PlaintextDatabase, got {other:?}"),
		}
	}

	#[test]
	fn reject_wrong_dek_length() {
		let dir = tempdir().unwrap();
		let err = WorkspaceDb::open(dir.path(), &[1, 2, 3]).unwrap_err();
		assert!(matches!(err, StorageError::InvalidDekLength(3)));
	}

	#[test]
	fn wrong_key_fails_closed() {
		let dir = tempdir().unwrap();
		let root = dir.path().join("core_references");
		let db = WorkspaceDb::open(&root, &test_dek()).unwrap();
		drop(db);

		let mut bad = test_dek();
		bad[0] ^= 0xff;
		let err = WorkspaceDb::open(&root, &bad).unwrap_err();
		assert!(
			matches!(err, StorageError::CryptoUnavailable(_)),
			"got {err:?}"
		);
	}
}
