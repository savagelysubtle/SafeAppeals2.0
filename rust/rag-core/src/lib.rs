// Copyright (c) Safe Appeals. All rights reserved.

//! SafeAppeals RAG native core (N-API).
//!
//! M0: `ping`, `version`, stub `capabilities`.
//! M1: SQLCipher workspace storage — `openWorkspace` / `closeWorkspace` / `stats`.
//! M2: hierarchical chunker, embedBatch, usearch HNSW, `indexChunks` / `removeDoc`.
//! M3: tantivy BM25 + RRF hybrid `search`.
//! M4: rule-based QueryProcessor wired into `search` (decompose → sub-searches → merge).
//! M5: ms-marco MiniLM CE rerank after hybrid (capability-gate degrade when CE missing).

#![deny(clippy::all)]

use napi::bindgen_prelude::Buffer;
use napi_derive::napi;

pub mod chunker;
pub mod embed;
pub mod query_processor;
pub mod rerank;
pub mod rrf;
pub mod text;
pub mod vector;

#[cfg(any(feature = "sqlcipher", feature = "sqlcipher-vendored"))]
pub mod index_ops;
#[cfg(any(feature = "sqlcipher", feature = "sqlcipher-vendored"))]
pub mod search_ops;
#[cfg(any(feature = "sqlcipher", feature = "sqlcipher-vendored"))]
pub mod storage;

/// Crate version string exposed to the host.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Indexing role for the open workspace (primary holds flock; secondary is search-only).
#[napi(string_enum)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IndexWriteRoleNapi {
	#[napi(value = "primary")]
	Primary,
	#[napi(value = "secondary")]
	Secondary,
}

/// Capability flags reported to the extension host.
#[napi(object)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Capabilities {
	pub hybrid: bool,
	pub rerank: bool,
	#[napi(js_name = "queryProcessor")]
	pub query_processor: bool,
	#[napi(js_name = "modelsPresent")]
	pub models_present: bool,
	/// True when this build linked SQLCipher and can open encrypted workspace DBs.
	#[napi(js_name = "storageReady")]
	pub storage_ready: bool,
	/// Configured embedding dims (BGE-small = 384).
	pub dims: u32,
	/// Role when a workspace is open; unset when closed.
	#[napi(js_name = "indexWriteRole")]
	pub index_write_role: Option<IndexWriteRoleNapi>,
	/// True when the open session may index (`indexWriteRole == primary`).
	#[napi(js_name = "indexWriteCapable")]
	pub index_write_capable: bool,
}

/// Index statistics.
#[napi(object)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RagStats {
	pub documents: u32,
	pub chunks: u32,
	/// usearch vector count when a workspace is open.
	pub vectors: u32,
	/// tantivy live document count when a workspace is open.
	#[napi(js_name = "textDocs")]
	pub text_docs: u32,
}

/// Options for hybrid `search`.
#[napi(object)]
#[derive(Debug, Clone)]
pub struct SearchOptions {
	/// Final result count after CE (or hybrid degrade).
	/// Hybrid/RRF candidate pool = finalK × 4; CE trims to finalK when loaded.
	#[napi(js_name = "finalK")]
	pub final_k: u32,
	/// `core_reference` | `case_index` | `all` (default `all`).
	/// Explicit `core_reference` / `case_index` wins over QP routing for every sub-search.
	pub scope: Option<String>,
}

/// One hybrid search hit (hydrated citation fields).
#[napi(object)]
#[derive(Debug, Clone)]
pub struct SearchResultItem {
	#[napi(js_name = "chunkId")]
	pub chunk_id: String,
	#[napi(js_name = "docId")]
	pub doc_id: String,
	pub text: String,
	#[napi(js_name = "fusedScore")]
	pub fused_score: f64,
	#[napi(js_name = "bm25Rank")]
	pub bm25_rank: Option<u32>,
	#[napi(js_name = "vectorRank")]
	pub vector_rank: Option<u32>,
	#[napi(js_name = "sourceUri")]
	pub source_uri: Option<String>,
	pub page: Option<i64>,
	pub heading: Option<String>,
	#[napi(js_name = "charStart")]
	pub char_start: Option<i64>,
	#[napi(js_name = "charEnd")]
	pub char_end: Option<i64>,
	#[napi(js_name = "sectionTitle")]
	pub section_title: Option<String>,
	#[napi(js_name = "breadcrumbPath")]
	pub breadcrumb_path: Option<String>,
	#[napi(js_name = "chunkType")]
	pub chunk_type: Option<String>,
	pub scope: String,
}

/// Result of `search`.
#[napi(object)]
#[derive(Debug, Clone)]
pub struct SearchResult {
	pub ok: bool,
	pub error: Option<String>,
	pub results: Vec<SearchResultItem>,
}

/// Status object for mutating N-API calls (avoids `napi::Error` so `cargo test` can link).
#[napi(object)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OpResult {
	pub ok: bool,
	pub error: Option<String>,
	/// Optional count (chunks indexed / removed).
	pub count: Option<u32>,
}

impl OpResult {
	fn ok() -> Self {
		Self {
			ok: true,
			error: None,
			count: None,
		}
	}

	fn ok_count(count: u32) -> Self {
		Self {
			ok: true,
			error: None,
			count: Some(count),
		}
	}

	fn err(message: impl Into<String>) -> Self {
		Self {
			ok: false,
			error: Some(message.into()),
			count: None,
		}
	}
}

/// Result of `embedBatch`.
#[napi(object)]
#[derive(Debug, Clone)]
pub struct EmbedBatchResult {
	pub ok: bool,
	pub error: Option<String>,
	pub embeddings: Option<Vec<Vec<f64>>>,
	pub dims: u32,
}

/// Document metadata for `indexChunks`.
#[napi(object)]
#[derive(Debug, Clone)]
pub struct IndexDocumentInput {
	pub id: String,
	pub path: String,
	pub filename: String,
	pub filetype: String,
	pub filesize: i64,
	pub checksum: String,
	pub scope: String,
	#[napi(js_name = "isCoreReference")]
	pub is_core_reference: bool,
	#[napi(js_name = "metadataJson")]
	pub metadata_json: Option<String>,
	#[napi(js_name = "createdAt")]
	pub created_at: String,
	#[napi(js_name = "lastIndexedAt")]
	pub last_indexed_at: String,
}

/// Chunk row for `indexChunks`.
#[napi(object)]
#[derive(Debug, Clone)]
pub struct IndexChunkInput {
	#[napi(js_name = "chunkId")]
	pub chunk_id: String,
	pub text: String,
	#[napi(js_name = "chunkIndex")]
	pub chunk_index: i64,
	#[napi(js_name = "tokenCount")]
	pub token_count: Option<i64>,
	#[napi(js_name = "parentChunkId")]
	pub parent_chunk_id: Option<String>,
	#[napi(js_name = "chunkType")]
	pub chunk_type: Option<String>,
	#[napi(js_name = "sectionId")]
	pub section_id: Option<String>,
	#[napi(js_name = "sectionNumber")]
	pub section_number: Option<String>,
	#[napi(js_name = "sectionTitle")]
	pub section_title: Option<String>,
	#[napi(js_name = "breadcrumbPath")]
	pub breadcrumb_path: Option<String>,
	#[napi(js_name = "metadataJson")]
	pub metadata_json: Option<String>,
	#[napi(js_name = "sourceUri")]
	pub source_uri: Option<String>,
	pub page: Option<i64>,
	pub heading: Option<String>,
	#[napi(js_name = "charStart")]
	pub char_start: Option<i64>,
	#[napi(js_name = "charEnd")]
	pub char_end: Option<i64>,
}

/// Input for `chunkDocument` (hierarchical citation-aware chunker).
#[napi(object)]
#[derive(Debug, Clone)]
pub struct ChunkDocumentNapiInput {
	#[napi(js_name = "docId")]
	pub doc_id: String,
	pub text: String,
	#[napi(js_name = "sourceUri")]
	pub source_uri: String,
	pub page: Option<i64>,
}

/// One chunk from `chunkDocument`.
#[napi(object)]
#[derive(Debug, Clone)]
pub struct ChunkDocumentNapiOutput {
	#[napi(js_name = "chunkId")]
	pub chunk_id: String,
	#[napi(js_name = "docId")]
	pub doc_id: String,
	pub text: String,
	#[napi(js_name = "chunkIndex")]
	pub chunk_index: i64,
	#[napi(js_name = "tokenCount")]
	pub token_count: i64,
	#[napi(js_name = "parentChunkId")]
	pub parent_chunk_id: Option<String>,
	#[napi(js_name = "chunkType")]
	pub chunk_type: String,
	#[napi(js_name = "sectionId")]
	pub section_id: Option<String>,
	#[napi(js_name = "sectionNumber")]
	pub section_number: Option<String>,
	#[napi(js_name = "sectionTitle")]
	pub section_title: Option<String>,
	#[napi(js_name = "breadcrumbPath")]
	pub breadcrumb_path: Option<String>,
	#[napi(js_name = "sourceUri")]
	pub source_uri: String,
	pub page: Option<i64>,
	pub heading: Option<String>,
	#[napi(js_name = "charStart")]
	pub char_start: Option<i64>,
	#[napi(js_name = "charEnd")]
	pub char_end: Option<i64>,
}

/// Build capabilities for the current feature set + runtime embedder/CE state.
pub fn capabilities_for_build() -> Capabilities {
	let (index_write_role, index_write_capable) = {
		#[cfg(any(feature = "sqlcipher", feature = "sqlcipher-vendored"))]
		{
			use storage::IndexWriteRole;
			match storage::session_index_write_role() {
				Some(IndexWriteRole::Primary) => (Some(IndexWriteRoleNapi::Primary), true),
				Some(IndexWriteRole::Secondary) => (Some(IndexWriteRoleNapi::Secondary), false),
				None => (None, false),
			}
		}
		#[cfg(not(any(feature = "sqlcipher", feature = "sqlcipher-vendored")))]
		{
			let _ = ();
			(None, false)
		}
	};
	Capabilities {
		// M3: hybrid BM25+vector+RRF is live inside Rust `search()`.
		hybrid: cfg!(any(feature = "sqlcipher", feature = "sqlcipher-vendored")),
		// M5: true when ms-marco CE (or FakeReranker in tests) is loaded.
		rerank: rerank::is_loaded(),
		// M4: rule-based QueryProcessor wired into `search()` (SQLCipher builds).
		query_processor: cfg!(any(feature = "sqlcipher", feature = "sqlcipher-vendored")),
		models_present: embed::is_loaded(),
		storage_ready: cfg!(any(feature = "sqlcipher", feature = "sqlcipher-vendored")),
		dims: embed::configured_dims(),
		index_write_role,
		index_write_capable,
	}
}

/// Health check for the native addon.
#[napi]
pub fn ping() -> String {
	"pong".to_string()
}

/// Package / crate version.
#[napi]
pub fn version() -> String {
	VERSION.to_string()
}

/// Feature availability for hard-disable / BYO gates in the host.
#[napi]
pub fn capabilities() -> Capabilities {
	capabilities_for_build()
}

/// Result of `ensureEmbedderLoaded`.
#[napi(object)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EnsureEmbedderResult {
	pub ok: bool,
	pub error: Option<String>,
	pub loaded: bool,
}

/// Load BGE from `SA_RAG_EMBED_MODEL_DIR` when not already resident (MlResourceEngine lease path).
#[napi(js_name = "ensureEmbedderLoaded")]
pub fn ensure_embedder_loaded() -> EnsureEmbedderResult {
	match embed::try_load_default() {
		Ok(loaded) => EnsureEmbedderResult {
			ok: true,
			error: None,
			loaded,
		},
		Err(e) => EnsureEmbedderResult {
			ok: false,
			error: Some(e.to_string()),
			loaded: embed::is_loaded(),
		},
	}
}

/// Drop process-global embedder (and CE used with search) — MlResourceEngine unload path.
#[napi(js_name = "clearEmbedder")]
pub fn clear_embedder_napi() -> OpResult {
	embed::clear_embedder();
	rerank::clear_reranker();
	OpResult::ok()
}

/// Drop process-global cross-encoder only.
#[napi(js_name = "clearReranker")]
pub fn clear_reranker_napi() -> OpResult {
	rerank::clear_reranker();
	OpResult::ok()
}

/// Open encrypted chunk DB + usearch index under `root_dir`.
///
/// `prefer_secondary`: soft host hint (e.g. Agents window); flock always decides role.
#[napi(js_name = "openWorkspace")]
pub fn open_workspace(
	root_dir: String,
	dek_bytes: Buffer,
	prefer_secondary: Option<bool>,
) -> OpResult {
	#[cfg(any(feature = "sqlcipher", feature = "sqlcipher-vendored"))]
	{
		match storage::open_workspace(
			&root_dir,
			dek_bytes.as_ref(),
			prefer_secondary.unwrap_or(false),
		) {
			Ok(_role) => OpResult::ok(),
			Err(e) => OpResult::err(e.to_string()),
		}
	}
	#[cfg(not(any(feature = "sqlcipher", feature = "sqlcipher-vendored")))]
	{
		let _ = (root_dir, dek_bytes, prefer_secondary);
		OpResult::err("rag-core built without SQLCipher; storage is unavailable (fail-closed)")
	}
}

/// Close the open workspace, persist `vectors.usearch`, drop key material.
#[napi(js_name = "closeWorkspace")]
pub fn close_workspace() -> OpResult {
	#[cfg(any(feature = "sqlcipher", feature = "sqlcipher-vendored"))]
	{
		match storage::close_workspace() {
			Ok(()) => OpResult::ok(),
			Err(e) => OpResult::err(e.to_string()),
		}
	}
	#[cfg(not(any(feature = "sqlcipher", feature = "sqlcipher-vendored")))]
	{
		OpResult::err("rag-core built without SQLCipher; storage is unavailable (fail-closed)")
	}
}

fn document_row_to_napi(row: storage::DocumentRow) -> IndexDocumentInput {
	IndexDocumentInput {
		id: row.id,
		path: row.path,
		filename: row.filename,
		filetype: row.filetype,
		filesize: row.filesize,
		checksum: row.checksum,
		scope: row.scope,
		is_core_reference: row.is_core_reference,
		metadata_json: Some(row.metadata_json),
		created_at: row.created_at,
		last_indexed_at: row.last_indexed_at,
	}
}

/// Lookup indexed document metadata by id (`null` when missing or workspace closed).
#[napi(js_name = "getDocument")]
pub fn get_document_napi(doc_id: String) -> Option<IndexDocumentInput> {
	#[cfg(any(feature = "sqlcipher", feature = "sqlcipher-vendored"))]
	{
		if !storage::is_open() {
			return None;
		}
		match storage::get_document(&doc_id) {
			Ok(Some(row)) => Some(document_row_to_napi(row)),
			Ok(None) => None,
			Err(_) => None,
		}
	}
	#[cfg(not(any(feature = "sqlcipher", feature = "sqlcipher-vendored")))]
	{
		let _ = doc_id;
		None
	}
}

/// Workspace index stats.
#[napi]
pub fn stats() -> RagStats {
	#[cfg(any(feature = "sqlcipher", feature = "sqlcipher-vendored"))]
	{
		if !storage::is_open() {
			return RagStats {
				documents: 0,
				chunks: 0,
				vectors: 0,
				text_docs: 0,
			};
		}
		match storage::workspace_counts() {
			Ok((documents, chunks)) => {
				let vectors = storage::vector_count().unwrap_or(0);
				let text_docs = storage::text_count().unwrap_or(0);
				RagStats {
					documents: u32::try_from(documents).unwrap_or(u32::MAX),
					chunks: u32::try_from(chunks).unwrap_or(u32::MAX),
					vectors: u32::try_from(vectors).unwrap_or(u32::MAX),
					text_docs: u32::try_from(text_docs).unwrap_or(u32::MAX),
				}
			}
			Err(_) => RagStats {
				documents: 0,
				chunks: 0,
				vectors: 0,
				text_docs: 0,
			},
		}
	}
	#[cfg(not(any(feature = "sqlcipher", feature = "sqlcipher-vendored")))]
	{
		RagStats {
			documents: 0,
			chunks: 0,
			vectors: 0,
			text_docs: 0,
		}
	}
}

/// Citation-aware hierarchical chunker for the host ingest path.
#[napi(js_name = "chunkDocument")]
pub fn chunk_document_napi(input: ChunkDocumentNapiInput) -> Vec<ChunkDocumentNapiOutput> {
	let chunks = chunker::chunk_document(&chunker::ChunkDocumentInput {
		doc_id: input.doc_id,
		text: input.text,
		source_uri: input.source_uri,
		page: input.page,
		config: chunker::ChunkerConfig::default(),
	});
	chunks
		.into_iter()
		.map(|c| ChunkDocumentNapiOutput {
			chunk_id: c.chunk_id,
			doc_id: c.doc_id,
			text: c.text,
			chunk_index: c.chunk_index,
			token_count: c.token_count,
			parent_chunk_id: c.parent_chunk_id,
			chunk_type: c.chunk_type,
			section_id: c.section_id,
			section_number: c.section_number,
			section_title: c.section_title,
			breadcrumb_path: c.breadcrumb_path,
			source_uri: c.citation.source_uri,
			page: c.citation.page,
			heading: c.citation.heading,
			char_start: c.citation.char_start,
			char_end: c.citation.char_end,
		})
		.collect()
}

/// Embed a batch of texts (BGE-small when loaded via `ensureEmbedderLoaded`).
#[napi(js_name = "embedBatch")]
pub fn embed_batch(texts: Vec<String>) -> EmbedBatchResult {
	if !embed::is_loaded() {
		return EmbedBatchResult {
			ok: false,
			error: Some(format!(
				"{} Call ensureEmbedderLoaded before embedBatch.",
				embed::EmbedError::ModelMissing
			)),
			embeddings: None,
			dims: embed::configured_dims(),
		};
	}
	match embed::embed_batch(&texts) {
		Ok(vectors) => {
			let dims = vectors.first().map(|v| v.len() as u32).unwrap_or(embed::configured_dims());
			let embeddings = vectors
				.into_iter()
				.map(|v| v.into_iter().map(|f| f as f64).collect())
				.collect();
			EmbedBatchResult {
				ok: true,
				error: None,
				embeddings: Some(embeddings),
				dims,
			}
		}
		Err(e) => EmbedBatchResult {
			ok: false,
			error: Some(e.to_string()),
			embeddings: None,
			dims: embed::configured_dims(),
		},
	}
}

/// Index document chunks into SQLCipher + usearch.
#[napi(js_name = "indexChunks")]
pub fn index_chunks(doc: IndexDocumentInput, chunks: Vec<IndexChunkInput>) -> OpResult {
	#[cfg(any(feature = "sqlcipher", feature = "sqlcipher-vendored"))]
	{
		use storage::{ChunkRow, DocumentRow};

		if !embed::is_loaded() {
			return OpResult::err(format!(
				"{} Call ensureEmbedderLoaded before indexChunks.",
				embed::EmbedError::ModelMissing
			));
		}
		let doc_row = DocumentRow {
			id: doc.id,
			path: doc.path,
			filename: doc.filename,
			filetype: doc.filetype,
			filesize: doc.filesize,
			checksum: doc.checksum,
			scope: doc.scope,
			is_core_reference: doc.is_core_reference,
			metadata_json: doc.metadata_json.unwrap_or_else(|| "{}".into()),
			created_at: doc.created_at,
			last_indexed_at: doc.last_indexed_at,
		};
		let chunk_rows: Vec<ChunkRow> = chunks
			.into_iter()
			.map(|c| ChunkRow {
				chunk_id: c.chunk_id,
				doc_id: doc_row.id.clone(),
				text: c.text,
				chunk_index: c.chunk_index,
				token_count: c.token_count,
				parent_chunk_id: c.parent_chunk_id,
				chunk_type: c.chunk_type,
				section_id: c.section_id,
				section_number: c.section_number,
				section_title: c.section_title,
				breadcrumb_path: c.breadcrumb_path,
				metadata_json: c.metadata_json.unwrap_or_else(|| "{}".into()),
				source_uri: c.source_uri,
				page: c.page,
				heading: c.heading,
				char_start: c.char_start,
				char_end: c.char_end,
			})
			.collect();
		match index_ops::index_chunks(&doc_row, &chunk_rows) {
			Ok(n) => OpResult::ok_count(n),
			Err(e) => OpResult::err(e.to_string()),
		}
	}
	#[cfg(not(any(feature = "sqlcipher", feature = "sqlcipher-vendored")))]
	{
		let _ = (doc, chunks);
		OpResult::err("rag-core built without SQLCipher; storage is unavailable (fail-closed)")
	}
}

/// Remove a document and its vectors from the open workspace.
#[napi(js_name = "removeDoc")]
pub fn remove_doc(doc_id: String) -> OpResult {
	#[cfg(any(feature = "sqlcipher", feature = "sqlcipher-vendored"))]
	{
		match index_ops::remove_doc(&doc_id) {
			Ok(n) => OpResult::ok_count(n),
			Err(e) => OpResult::err(e.to_string()),
		}
	}
	#[cfg(not(any(feature = "sqlcipher", feature = "sqlcipher-vendored")))]
	{
		let _ = doc_id;
		OpResult::err("rag-core built without SQLCipher; storage is unavailable (fail-closed)")
	}
}

/// Hybrid BM25 + vector search with RRF fusion (k=20) and optional CE rerank.
///
/// Fail-closed when the embed model is missing (same as `indexChunks`).
/// Degrades to hybrid+QP top-`finalK` when the cross-encoder is missing.
#[napi]
pub fn search(query: String, opts: SearchOptions) -> SearchResult {
	#[cfg(any(feature = "sqlcipher", feature = "sqlcipher-vendored"))]
	{
		if !embed::is_loaded() {
			return SearchResult {
				ok: false,
				error: Some(format!(
					"{} Call ensureEmbedderLoaded before search.",
					embed::EmbedError::ModelMissing
				)),
				results: vec![],
			};
		}
		let _ = rerank::try_load_default();
		let scope = match search_ops::SearchScope::parse(opts.scope.as_deref()) {
			Ok(s) => s,
			Err(e) => {
				return SearchResult {
					ok: false,
					error: Some(e.to_string()),
					results: vec![],
				};
			}
		};
		match search_ops::search(&query, opts.final_k, scope) {
			Ok(hits) => SearchResult {
				ok: true,
				error: None,
				results: hits
					.into_iter()
					.map(|h| SearchResultItem {
						chunk_id: h.chunk_id,
						doc_id: h.doc_id,
						text: h.text,
						fused_score: h.fused_score,
						bm25_rank: h.bm25_rank,
						vector_rank: h.vector_rank,
						source_uri: h.source_uri,
						page: h.page,
						heading: h.heading,
						char_start: h.char_start,
						char_end: h.char_end,
						section_title: h.section_title,
						breadcrumb_path: h.breadcrumb_path,
						chunk_type: h.chunk_type,
						scope: h.scope,
					})
					.collect(),
			},
			Err(e) => SearchResult {
				ok: false,
				error: Some(e.to_string()),
				results: vec![],
			},
		}
	}
	#[cfg(not(any(feature = "sqlcipher", feature = "sqlcipher-vendored")))]
	{
		let _ = (query, opts);
		SearchResult {
			ok: false,
			error: Some(
				"rag-core built without SQLCipher; storage is unavailable (fail-closed)".into(),
			),
			results: vec![],
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	/// Serialize tests that mutate process-global embedder / CE / workspace state.
	fn with_globals_lock<F, T>(f: F) -> T
	where
		F: FnOnce() -> T,
	{
		let _g = storage::test_lock::guard();
		#[cfg(any(feature = "sqlcipher", feature = "sqlcipher-vendored"))]
		{
			let _ = storage::close_workspace();
		}
		embed::clear_embedder();
		rerank::clear_reranker();
		let out = f();
		#[cfg(any(feature = "sqlcipher", feature = "sqlcipher-vendored"))]
		{
			let _ = storage::close_workspace();
		}
		embed::clear_embedder();
		rerank::clear_reranker();
		out
	}

	#[test]
	fn ping_returns_pong() {
		assert_eq!(ping(), "pong");
	}

	#[test]
	fn version_matches_cargo_pkg() {
		assert_eq!(version(), env!("CARGO_PKG_VERSION"));
		assert!(!version().is_empty());
	}

	#[test]
	fn capabilities_bge_dims_hybrid_live() {
		with_globals_lock(|| {
			let caps = capabilities_for_build();
			assert!(caps.hybrid, "M3 sets hybrid=true when SQLCipher build is live");
			assert!(!caps.rerank, "rerank=false until CE / FakeReranker loaded");
			assert!(
				caps.query_processor,
				"M4 sets queryProcessor=true when SQLCipher build is live"
			);
			assert_eq!(caps.dims, 384);
			assert!(caps.storage_ready);
			assert!(!caps.models_present);
		});
	}

	#[test]
	fn capabilities_models_present_with_fake() {
		with_globals_lock(|| {
			embed::install_fake_for_tests();
			let caps = capabilities_for_build();
			assert!(caps.models_present);
			assert!(!caps.rerank);
			assert_eq!(caps.dims, 384);
		});
	}

	#[test]
	fn capabilities_rerank_with_fake_ce() {
		with_globals_lock(|| {
			rerank::install_fake_for_tests();
			let caps = capabilities_for_build();
			assert!(caps.rerank);
		});
	}

	#[test]
	fn embed_batch_fail_soft_without_model() {
		with_globals_lock(|| {
			let result = embed_batch(vec!["hello".into()]);
			assert!(!result.ok);
			let err = result.error.unwrap_or_default();
			assert!(err.contains("embedding model is not loaded"));
			assert!(err.contains("ensureEmbedderLoaded"));
			assert_eq!(result.dims, 384);
		});
	}

	#[cfg(any(feature = "sqlcipher", feature = "sqlcipher-vendored"))]
	#[test]
	fn search_fail_closed_without_embedder() {
		use storage::DEK_LEN;
		use tempfile::tempdir;

		with_globals_lock(|| {
			let dir = tempdir().unwrap();
			let root = dir.path().join("case_index");
			let dek = [4u8; DEK_LEN];
			storage::open_workspace(root.to_str().unwrap(), &dek, false).unwrap();

			let result = search(
				"hello".into(),
				SearchOptions {
					final_k: 4,
					scope: Some("all".into()),
				},
			);
			assert!(!result.ok);
			let err = result.error.unwrap_or_default();
			assert!(err.contains("embedding model is not loaded"));
			assert!(err.contains("ensureEmbedderLoaded"));

			storage::close_workspace().unwrap();
		});
	}

	#[test]
	fn ensure_embedder_loaded_idempotent_with_fake() {
		with_globals_lock(|| {
			embed::install_fake_for_tests();
			let first = ensure_embedder_loaded();
			assert!(first.ok);
			assert!(first.loaded);
			assert!(embed::is_loaded());
			let second = ensure_embedder_loaded();
			assert!(second.ok);
			assert!(second.loaded);
		});
	}

	#[test]
	fn clear_embedder_clears_reranker_too() {
		with_globals_lock(|| {
			embed::install_fake_for_tests();
			rerank::install_fake_for_tests();
			assert!(capabilities_for_build().models_present);
			assert!(capabilities_for_build().rerank);
			let cleared = clear_embedder_napi();
			assert!(cleared.ok);
			assert!(!embed::is_loaded());
			assert!(!rerank::is_loaded());
			let caps = capabilities_for_build();
			assert!(!caps.models_present);
			assert!(!caps.rerank);
		});
	}

	#[cfg(any(feature = "sqlcipher", feature = "sqlcipher-vendored"))]
	#[test]
	fn open_close_stats_round_trip() {
		use storage::{ChunkRow, DocumentRow, DEK_LEN};
		use tempfile::tempdir;

		with_globals_lock(|| {
			embed::install_fake_for_tests();
			let dir = tempdir().unwrap();
			let root = dir.path().join("case_index");
			let dek = [7u8; DEK_LEN];

			storage::open_workspace(root.to_str().unwrap(), &dek, false).expect("open_workspace");

			let s0 = stats();
			assert_eq!(
				s0,
				RagStats {
					documents: 0,
					chunks: 0,
					vectors: 0,
					text_docs: 0,
				}
			);

			storage::workspace::with_open_db(|db| {
				db.insert_document_with_chunks(
					&DocumentRow {
						id: "d1".into(),
						path: "/a.txt".into(),
						filename: "a.txt".into(),
						filetype: "txt".into(),
						filesize: 1,
						checksum: "c".into(),
						scope: "case_index".into(),
						is_core_reference: false,
						metadata_json: "{}".into(),
						created_at: "t".into(),
						last_indexed_at: "t".into(),
					},
					&[ChunkRow {
						chunk_id: "c1".into(),
						doc_id: "d1".into(),
						text: "hello".into(),
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
					}],
				)
			})
			.unwrap();

			let s1 = stats();
			assert_eq!(s1.documents, 1);
			assert_eq!(s1.chunks, 1);

			storage::close_workspace().unwrap();
			assert_eq!(
				stats(),
				RagStats {
					documents: 0,
					chunks: 0,
					vectors: 0,
					text_docs: 0,
				}
			);
		});
	}

	#[cfg(any(feature = "sqlcipher", feature = "sqlcipher-vendored"))]
	#[test]
	fn index_chunks_and_remove_doc_with_fake_embedder() {
		use storage::DEK_LEN;
		use tempfile::tempdir;

		with_globals_lock(|| {
			embed::install_fake_for_tests();
			let dir = tempdir().unwrap();
			let root = dir.path().join("case_index");
			let dek = [9u8; DEK_LEN];
			storage::open_workspace(root.to_str().unwrap(), &dek, false).unwrap();

			let doc = IndexDocumentInput {
				id: "doc-x".into(),
				path: "/x.md".into(),
				filename: "x.md".into(),
				filetype: "md".into(),
				filesize: 10,
				checksum: "sum".into(),
				scope: "case_index".into(),
				is_core_reference: false,
				metadata_json: None,
				created_at: "t".into(),
				last_indexed_at: "t".into(),
			};
			let chunks = vec![IndexChunkInput {
				chunk_id: "doc-x_chunk_0".into(),
				text: "Confidential fact one.".into(),
				chunk_index: 0,
				token_count: Some(3),
				parent_chunk_id: None,
				chunk_type: Some("child".into()),
				section_id: Some("s1".into()),
				section_number: Some("1".into()),
				section_title: Some("Facts".into()),
				breadcrumb_path: Some("Facts".into()),
				metadata_json: None,
				source_uri: Some("file:///x.md".into()),
				page: Some(1),
				heading: Some("Facts".into()),
				char_start: Some(0),
				char_end: Some(22),
			}];

			let r = index_chunks(doc, chunks);
			assert!(r.ok, "{:?}", r.error);
			assert_eq!(r.count, Some(1));

			let s = stats();
			assert_eq!(s.documents, 1);
			assert_eq!(s.chunks, 1);
			assert_eq!(s.vectors, 1);
			assert_eq!(s.text_docs, 1);
			assert!(root.join(vector::VECTOR_FILENAME).exists());
			assert!(root.join(text::TEXT_INDEX_DIRNAME).exists());

			let rm = remove_doc("doc-x".into());
			assert!(rm.ok, "{:?}", rm.error);
			assert_eq!(stats().documents, 0);
			assert_eq!(stats().chunks, 0);
			assert_eq!(stats().vectors, 0);
			assert_eq!(stats().text_docs, 0);

			storage::close_workspace().unwrap();
		});
	}

	#[cfg(any(feature = "sqlcipher", feature = "sqlcipher-vendored"))]
	#[test]
	fn golden_chunk_index_hybrid_search_fake_embedder() {
		use storage::DEK_LEN;
		use tempfile::tempdir;

		with_globals_lock(|| {
			embed::install_fake_for_tests();
			let dir = tempdir().unwrap();
			let root = dir.path().join("case_index");
			let dek = [11u8; DEK_LEN];
			storage::open_workspace(root.to_str().unwrap(), &dek, false).unwrap();

			let text = include_str!("../fixtures/golden_brief.md");
			let chunks = chunker::chunk_document(&chunker::ChunkDocumentInput {
				doc_id: "golden".into(),
				text: text.into(),
				source_uri: "file:///fixtures/golden_brief.md".into(),
				page: Some(1),
				config: chunker::ChunkerConfig::default(),
			});
			assert!(!chunks.is_empty());

			let doc = IndexDocumentInput {
				id: "golden".into(),
				path: "/fixtures/golden_brief.md".into(),
				filename: "golden_brief.md".into(),
				filetype: "md".into(),
				filesize: text.len() as i64,
				checksum: "golden".into(),
				scope: "case_index".into(),
				is_core_reference: false,
				metadata_json: None,
				created_at: "t".into(),
				last_indexed_at: "t".into(),
			};
			let index_chunks_in: Vec<IndexChunkInput> = chunks
				.iter()
				.map(|c| IndexChunkInput {
					chunk_id: c.chunk_id.clone(),
					text: c.text.clone(),
					chunk_index: c.chunk_index,
					token_count: Some(c.token_count),
					parent_chunk_id: c.parent_chunk_id.clone(),
					chunk_type: Some(c.chunk_type.clone()),
					section_id: c.section_id.clone(),
					section_number: c.section_number.clone(),
					section_title: c.section_title.clone(),
					breadcrumb_path: c.breadcrumb_path.clone(),
					metadata_json: None,
					source_uri: Some(c.citation.source_uri.clone()),
					page: c.citation.page,
					heading: c.citation.heading.clone(),
					char_start: c.citation.char_start,
					char_end: c.citation.char_end,
				})
				.collect();

			let indexed = index_chunks(doc, index_chunks_in);
			assert!(indexed.ok, "{:?}", indexed.error);
			assert!(indexed.count.unwrap_or(0) > 0);
			assert_eq!(stats().text_docs, stats().chunks);

			// Distinctive phrase from the golden fixture (BM25 leg).
			let result = search(
				"rating reduction flare-ups".into(),
				SearchOptions {
					final_k: 5,
					scope: Some("case_index".into()),
				},
			);
			assert!(result.ok, "{:?}", result.error);
			assert!(
				!result.results.is_empty(),
				"expected hybrid hits for distinctive golden phrase"
			);
			let top = &result.results[0];
			assert_eq!(top.scope, "case_index");
			assert!(top.fused_score > 0.0);
			assert!(
				top.text.to_lowercase().contains("rating")
					|| top.text.to_lowercase().contains("flare")
					|| result.results.iter().any(|r| {
						r.text.to_lowercase().contains("rating")
							|| r.text.to_lowercase().contains("flare")
					}),
				"top results should relate to query terms; got {:?}",
				result.results.iter().map(|r| &r.chunk_id).collect::<Vec<_>>()
			);
			// With a small golden corpus, 4× over-fetch covers both legs → overlap.
			assert!(
				result
					.results
					.iter()
					.any(|r| r.bm25_rank.is_some() && r.vector_rank.is_some()),
				"expected at least one fused hit with both bm25Rank and vectorRank; got {:?}",
				result
					.results
					.iter()
					.map(|r| (&r.chunk_id, r.bm25_rank, r.vector_rank))
					.collect::<Vec<_>>()
			);
			assert!(
				result.results.iter().any(|r| r.bm25_rank.is_some()),
				"expected non-null bm25Rank on some hit"
			);
			assert!(
				result.results.iter().any(|r| r.vector_rank.is_some()),
				"expected non-null vectorRank on some hit"
			);

			// Scope filter: core_reference should yield nothing in this workspace root.
			let empty = search(
				"rating reduction".into(),
				SearchOptions {
					final_k: 5,
					scope: Some("core_reference".into()),
				},
			);
			assert!(empty.ok, "{:?}", empty.error);
			assert!(empty.results.is_empty());

			// Fail-closed without model.
			embed::clear_embedder();
			let no_model = search(
				"anything".into(),
				SearchOptions {
					final_k: 3,
					scope: None,
				},
			);
			assert!(!no_model.ok);
			assert!(no_model.error.unwrap_or_default().contains("embedding model"));

			storage::close_workspace().unwrap();
		});
	}

	#[cfg(any(feature = "sqlcipher", feature = "sqlcipher-vendored"))]
	#[test]
	fn golden_chunk_index_hybrid_rerank_fake_ce() {
		use storage::DEK_LEN;
		use tempfile::tempdir;

		with_globals_lock(|| {
			embed::install_fake_for_tests();
			rerank::install_fake_for_tests();
			assert!(capabilities_for_build().rerank);

			let dir = tempdir().unwrap();
			let root = dir.path().join("case_index");
			let dek = [17u8; DEK_LEN];
			storage::open_workspace(root.to_str().unwrap(), &dek, false).unwrap();

			let text = include_str!("../fixtures/golden_brief.md");
			let chunks = chunker::chunk_document(&chunker::ChunkDocumentInput {
				doc_id: "golden".into(),
				text: text.into(),
				source_uri: "file:///fixtures/golden_brief.md".into(),
				page: Some(1),
				config: chunker::ChunkerConfig::default(),
			});
			assert!(
				chunks.len() > 5,
				"golden corpus must exceed finalK so CE short-circuit does not skip"
			);

			let doc = IndexDocumentInput {
				id: "golden".into(),
				path: "/fixtures/golden_brief.md".into(),
				filename: "golden_brief.md".into(),
				filetype: "md".into(),
				filesize: text.len() as i64,
				checksum: "golden-m5".into(),
				scope: "case_index".into(),
				is_core_reference: false,
				metadata_json: None,
				created_at: "t".into(),
				last_indexed_at: "t".into(),
			};
			let index_chunks_in: Vec<IndexChunkInput> = chunks
				.iter()
				.map(|c| IndexChunkInput {
					chunk_id: c.chunk_id.clone(),
					text: c.text.clone(),
					chunk_index: c.chunk_index,
					token_count: Some(c.token_count),
					parent_chunk_id: c.parent_chunk_id.clone(),
					chunk_type: Some(c.chunk_type.clone()),
					section_id: c.section_id.clone(),
					section_number: c.section_number.clone(),
					section_title: c.section_title.clone(),
					breadcrumb_path: c.breadcrumb_path.clone(),
					metadata_json: None,
					source_uri: Some(c.citation.source_uri.clone()),
					page: c.citation.page,
					heading: c.citation.heading.clone(),
					char_start: c.citation.char_start,
					char_end: c.citation.char_end,
				})
				.collect();
			let indexed = index_chunks(doc, index_chunks_in);
			assert!(indexed.ok, "{:?}", indexed.error);

			let query = "rating reduction flare-ups";
			let final_k = 5u32;
			let result = search(
				query.into(),
				SearchOptions {
					final_k,
					scope: Some("case_index".into()),
				},
			);
			assert!(result.ok, "{:?}", result.error);
			assert!(
				!result.results.is_empty() && result.results.len() as u32 <= final_k,
				"expected ≤ finalK reranked hits; got {}",
				result.results.len()
			);

			// FakeReranker orders by query-term overlap — top hit should mention query terms.
			let top = &result.results[0];
			let lower = top.text.to_lowercase();
			assert!(
				lower.contains("rating") || lower.contains("reduction") || lower.contains("flare"),
				"FakeReranker top hit should overlap query terms; got chunk {}",
				top.chunk_id
			);

			// Degrade path: clear CE → hybrid still succeeds; capabilities.rerank flips off.
			rerank::clear_reranker();
			assert!(!capabilities_for_build().rerank);
			let degraded = search(
				query.into(),
				SearchOptions {
					final_k,
					scope: Some("case_index".into()),
				},
			);
			assert!(degraded.ok, "missing CE must degrade, not error: {:?}", degraded.error);
			assert!(!degraded.results.is_empty());

			// Embed missing still fails closed.
			embed::clear_embedder();
			let no_embed = search(
				query.into(),
				SearchOptions {
					final_k: 3,
					scope: None,
				},
			);
			assert!(!no_embed.ok);
			assert!(no_embed.error.unwrap_or_default().contains("embedding model"));

			storage::close_workspace().unwrap();
		});
	}

	#[cfg(any(feature = "sqlcipher", feature = "sqlcipher-vendored"))]
	#[test]
	fn complex_query_qp_decompose_and_explicit_scope_override() {
		use storage::DEK_LEN;
		use tempfile::tempdir;

		with_globals_lock(|| {
			embed::install_fake_for_tests();
			let dir = tempdir().unwrap();
			let root = dir.path().join("case_index");
			let dek = [13u8; DEK_LEN];
			storage::open_workspace(root.to_str().unwrap(), &dek, false).unwrap();

			let text = include_str!("../fixtures/golden_brief.md");
			let chunks = chunker::chunk_document(&chunker::ChunkDocumentInput {
				doc_id: "golden".into(),
				text: text.into(),
				source_uri: "file:///fixtures/golden_brief.md".into(),
				page: Some(1),
				config: chunker::ChunkerConfig::default(),
			});

			let doc = IndexDocumentInput {
				id: "golden".into(),
				path: "/fixtures/golden_brief.md".into(),
				filename: "golden_brief.md".into(),
				filetype: "md".into(),
				filesize: text.len() as i64,
				checksum: "golden-m4".into(),
				scope: "case_index".into(),
				is_core_reference: false,
				metadata_json: None,
				created_at: "t".into(),
				last_indexed_at: "t".into(),
			};
			let index_chunks_in: Vec<IndexChunkInput> = chunks
				.iter()
				.map(|c| IndexChunkInput {
					chunk_id: c.chunk_id.clone(),
					text: c.text.clone(),
					chunk_index: c.chunk_index,
					token_count: Some(c.token_count),
					parent_chunk_id: c.parent_chunk_id.clone(),
					chunk_type: Some(c.chunk_type.clone()),
					section_id: c.section_id.clone(),
					section_number: c.section_number.clone(),
					section_title: c.section_title.clone(),
					breadcrumb_path: c.breadcrumb_path.clone(),
					metadata_json: None,
					source_uri: Some(c.citation.source_uri.clone()),
					page: c.citation.page,
					heading: c.citation.heading.clone(),
					char_start: c.citation.char_start,
					char_end: c.citation.char_end,
				})
				.collect();
			let indexed = index_chunks(doc, index_chunks_in);
			assert!(indexed.ok, "{:?}", indexed.error);

			// Multi-"and" → complex; QP would route case keywords to case_index.
			let complex = "medical treatment history and rating reduction and flare-ups documented";
			assert!(
				query_processor::is_complex_query(complex),
				"fixture query must be complex for M4 path"
			);
			let processed = query_processor::process_query(complex);
			assert!(processed.is_complex);
			assert!(
				processed.sub_queries.len() >= 2,
				"expected decomposition, got {:?}",
				processed.sub_queries
			);

			// Explicit case_index: hits expected from golden case corpus.
			let with_case = search(
				complex.into(),
				SearchOptions {
					final_k: 5,
					scope: Some("case_index".into()),
				},
			);
			assert!(with_case.ok, "{:?}", with_case.error);
			assert!(
				!with_case.results.is_empty(),
				"explicit case_index should return hybrid hits for complex query"
			);
			assert!(
				with_case.results.iter().all(|r| r.scope == "case_index"),
				"all hits must be case_index under explicit scope"
			);

			// Explicit core_reference overrides QP case routing → empty in this workspace.
			let with_core = search(
				complex.into(),
				SearchOptions {
					final_k: 5,
					scope: Some("core_reference".into()),
				},
			);
			assert!(with_core.ok, "{:?}", with_core.error);
			assert!(
				with_core.results.is_empty(),
				"explicit core_reference must override QP and yield no case_index hits; got {:?}",
				with_core
					.results
					.iter()
					.map(|r| (&r.chunk_id, &r.scope))
					.collect::<Vec<_>>()
			);

			// scope=all / omitted: QP routing may narrow, but golden is case_index so
			// case-routed sub-queries still hit; at least one sub should match.
			let with_all = search(
				complex.into(),
				SearchOptions {
					final_k: 5,
					scope: None,
				},
			);
			assert!(with_all.ok, "{:?}", with_all.error);
			assert!(
				!with_all.results.is_empty(),
				"all/omitted scope should still find case content via QP or all"
			);

			storage::close_workspace().unwrap();
		});
	}

	#[test]
	fn golden_fixture_chunker() {
		let text = include_str!("../fixtures/golden_brief.md");
		let chunks = chunker::chunk_document(&chunker::ChunkDocumentInput {
			doc_id: "golden".into(),
			text: text.into(),
			source_uri: "file:///fixtures/golden_brief.md".into(),
			page: Some(1),
			config: chunker::ChunkerConfig::default(),
		});
		assert!(!chunks.is_empty());
		let parents: Vec<_> = chunks.iter().filter(|c| c.chunk_type == "parent").collect();
		let children: Vec<_> = chunks.iter().filter(|c| c.chunk_type == "child").collect();
		assert!(
			!parents.is_empty() && !children.is_empty(),
			"expected parents+children, got {} parents / {} children",
			parents.len(),
			children.len()
		);
		for child in &children {
			assert!(
				child.parent_chunk_id.is_some(),
				"child {} missing parent link",
				child.chunk_id
			);
			assert!(
				parents.iter().any(|p| Some(&p.chunk_id) == child.parent_chunk_id.as_ref()),
				"child {} parent_chunk_id not in parents",
				child.chunk_id
			);
		}
		for c in &chunks {
			assert!(
				(c.token_count as usize) <= chunker::DEFAULT_PARENT_TOKENS,
				"{} has {} tokens",
				c.chunk_id,
				c.token_count
			);
			assert_eq!(c.citation.source_uri, "file:///fixtures/golden_brief.md");
			assert_eq!(c.citation.page, Some(1));
			assert!(c.citation.heading.is_some());
			assert!(c.citation.char_start.is_some());
			assert!(c.citation.char_end.is_some());
		}

		// N-API wrapper shape
		let napi_chunks = chunk_document_napi(ChunkDocumentNapiInput {
			doc_id: "golden".into(),
			text: include_str!("../fixtures/golden_brief.md").into(),
			source_uri: "file:///fixtures/golden_brief.md".into(),
			page: Some(1),
		});
		assert_eq!(napi_chunks.len(), chunks.len());
	}

	#[cfg(any(feature = "sqlcipher", feature = "sqlcipher-vendored"))]
	#[test]
	fn index_chunks_fails_closed_without_model() {
		use storage::DEK_LEN;
		use tempfile::tempdir;

		with_globals_lock(|| {
			// embedder intentionally cleared by with_globals_lock
			let dir = tempdir().unwrap();
			let root = dir.path().join("case_index");
			let dek = [3u8; DEK_LEN];
			storage::open_workspace(root.to_str().unwrap(), &dek, false).unwrap();

			let doc = IndexDocumentInput {
				id: "no-model".into(),
				path: "/n.md".into(),
				filename: "n.md".into(),
				filetype: "md".into(),
				filesize: 1,
				checksum: "x".into(),
				scope: "case_index".into(),
				is_core_reference: false,
				metadata_json: None,
				created_at: "t".into(),
				last_indexed_at: "t".into(),
			};
			let chunks = vec![IndexChunkInput {
				chunk_id: "no-model_0".into(),
				text: "hello".into(),
				chunk_index: 0,
				token_count: Some(1),
				parent_chunk_id: None,
				chunk_type: Some("child".into()),
				section_id: None,
				section_number: None,
				section_title: None,
				breadcrumb_path: None,
				metadata_json: None,
				source_uri: None,
				page: None,
				heading: None,
				char_start: None,
				char_end: None,
			}];
			let r = index_chunks(doc, chunks);
			assert!(!r.ok);
			let err = r.error.unwrap_or_default();
			assert!(
				err.contains("embedding model is not loaded") && err.contains("ensureEmbedderLoaded"),
				"unexpected error: {err}"
			);
			assert_eq!(stats().documents, 0);
			storage::close_workspace().unwrap();
		});
	}
}
