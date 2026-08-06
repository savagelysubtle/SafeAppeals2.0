// Copyright (c) Safe Appeals. All rights reserved.

//! Tantivy text index with Void-aligned BM25 (k1=0.8, b=0.5).
//!
//! Upstream tantivy 0.22 hardcodes BM25 k1=1.2 / b=0.75 in its query scorers
//! (configurable params landed later on main). We therefore score ourselves
//! against postings + fieldnorms using the legal/medical defaults from Void
//! `ragHybridRetriever` (bm25K1=0.8, bm25B=0.5).

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use tantivy::directory::MmapDirectory;
use tantivy::schema::{
	Field, IndexRecordOption, Schema, TantivyDocument, Term, TextFieldIndexing, TextOptions,
	STORED, STRING, Value,
};
use tantivy::{
	DocAddress, DocSet, Index, IndexReader, IndexWriter, Postings, ReloadPolicy, Searcher,
	TantivyError, TERMINATED,
};
use thiserror::Error;

/// Directory name under the workspace root (plaintext work file until M6 seals).
pub const TEXT_INDEX_DIRNAME: &str = "text.tantivy";

/// BM25 term-frequency saturation (Void / legal-medical default).
pub const BM25_K1: f32 = 0.8;

/// BM25 document-length normalization (Void / legal-medical default).
pub const BM25_B: f32 = 0.5;

const WRITER_HEAP_BYTES: usize = 50_000_000;

#[derive(Debug, Error)]
pub enum TextError {
	#[error("tantivy error: {0}")]
	Tantivy(#[from] tantivy::TantivyError),
	#[error("I/O error: {0}")]
	Io(#[from] std::io::Error),
	#[error("{0}")]
	Message(String),
}

/// One BM25 hit (chunk_id + raw BM25 score before RRF).
#[derive(Debug, Clone, PartialEq)]
pub struct Bm25Hit {
	pub chunk_id: String,
	pub score: f32,
}

/// Tantivy BM25 index persisted at `{root}/text.tantivy`.
pub struct TextIndex {
	index: Index,
	writer: Option<IndexWriter>,
	reader: IndexReader,
	chunk_id_field: Field,
	doc_id_field: Field,
	scope_field: Field,
	body_field: Field,
	path: PathBuf,
	read_only: bool,
}

impl std::fmt::Debug for TextIndex {
	fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
		f.debug_struct("TextIndex")
			.field("path", &self.path)
			.field("read_only", &self.read_only)
			.field("has_writer", &self.writer.is_some())
			.finish_non_exhaustive()
	}
}

impl TextIndex {
	/// Open existing index or create empty at `{root_dir}/text.tantivy`.
	///
	/// Does **not** acquire an `IndexWriter` — use lazy `ensure_writer` on first
	/// upsert/remove/commit so multiple processes can open readers concurrently.
	pub fn open(root_dir: impl AsRef<Path>) -> Result<Self, TextError> {
		Self::open_inner(root_dir, false)
	}

	/// Open an existing index read-only (no writer, no create).
	pub fn open_read_only(root_dir: impl AsRef<Path>) -> Result<Self, TextError> {
		Self::open_inner(root_dir, true)
	}

	fn open_inner(root_dir: impl AsRef<Path>, read_only: bool) -> Result<Self, TextError> {
		let path = root_dir.as_ref().join(TEXT_INDEX_DIRNAME);
		let schema = build_schema();

		let index = if path.exists() {
			let dir = MmapDirectory::open(&path).map_err(|e| TextError::Message(e.to_string()))?;
			let exists = Index::exists(&dir).map_err(|e| TextError::Message(e.to_string()))?;
			if exists {
				Index::open_in_dir(&path)?
			} else if read_only {
				return Err(TextError::Message(
					"text index directory exists but index is missing (read-only)".into(),
				));
			} else {
				Index::create_in_dir(&path, schema)?
			}
		} else if read_only {
			return Err(TextError::Message(
				"text index does not exist (read-only)".into(),
			));
		} else {
			std::fs::create_dir_all(&path)?;
			Index::create_in_dir(&path, schema)?
		};

		let live = index.schema();
		let chunk_id_field = live
			.get_field("chunk_id")
			.map_err(|e| TextError::Message(format!("missing chunk_id field: {e}")))?;
		let doc_id_field = live
			.get_field("doc_id")
			.map_err(|e| TextError::Message(format!("missing doc_id field: {e}")))?;
		let scope_field = live
			.get_field("scope")
			.map_err(|e| TextError::Message(format!("missing scope field: {e}")))?;
		let body_field = live
			.get_field("body")
			.map_err(|e| TextError::Message(format!("missing body field: {e}")))?;

		let reader = index
			.reader_builder()
			.reload_policy(ReloadPolicy::Manual)
			.try_into()?;

		Ok(Self {
			index,
			writer: None,
			reader,
			chunk_id_field,
			doc_id_field,
			scope_field,
			body_field,
			path,
			read_only,
		})
	}

	pub fn path(&self) -> &Path {
		&self.path
	}

	pub fn is_read_only(&self) -> bool {
		self.read_only
	}

	/// True when this session may index (read-write mode; writer may be lazy).
	pub fn index_write_capable(&self) -> bool {
		!self.read_only
	}

	pub fn has_writer(&self) -> bool {
		self.writer.is_some()
	}

	/// Reload the searcher so secondary processes see primary commits.
	pub fn reload_reader(&self) -> Result<(), TextError> {
		self.reader.reload()?;
		Ok(())
	}

	fn ensure_writer(&mut self) -> Result<(), TextError> {
		if self.read_only {
			return Err(TextError::Message("read-only session".into()));
		}
		if self.writer.is_none() {
			self.writer = Some(
				self.index
					.writer(WRITER_HEAP_BYTES)
					.map_err(map_writer_error)?,
			);
		}
		Ok(())
	}

	/// Number of live documents in the searchable index (after last commit/reload).
	pub fn doc_count(&self) -> u64 {
		self.reader.searcher().num_docs()
	}

	/// Upsert chunks (delete-by-chunk_id then add). Caller should [`commit`](Self::commit).
	pub fn upsert_chunks(
		&mut self,
		chunks: &[(String, String, String, String)],
	) -> Result<(), TextError> {
		self.ensure_writer()?;
		let chunk_id_field = self.chunk_id_field;
		let doc_id_field = self.doc_id_field;
		let scope_field = self.scope_field;
		let body_field = self.body_field;
		let writer = self.writer.as_mut().expect("writer ensured");
		for (chunk_id, doc_id, scope, text) in chunks {
			writer.delete_term(Term::from_field_text(chunk_id_field, chunk_id));
			let mut doc = TantivyDocument::default();
			doc.add_text(chunk_id_field, chunk_id);
			doc.add_text(doc_id_field, doc_id);
			doc.add_text(scope_field, scope);
			doc.add_text(body_field, text);
			writer.add_document(doc)?;
		}
		Ok(())
	}

	/// Remove chunks by id. Caller should [`commit`](Self::commit).
	pub fn remove_chunks(&mut self, chunk_ids: &[String]) -> Result<(), TextError> {
		self.ensure_writer()?;
		let chunk_id_field = self.chunk_id_field;
		let writer = self.writer.as_mut().expect("writer ensured");
		for chunk_id in chunk_ids {
			writer.delete_term(Term::from_field_text(chunk_id_field, chunk_id));
		}
		Ok(())
	}

	/// Commit writer and reload the searcher. No-op when no writer was acquired.
	pub fn commit(&mut self) -> Result<(), TextError> {
		if let Some(writer) = self.writer.as_mut() {
			writer.commit()?;
			self.reader.reload()?;
		}
		Ok(())
	}

	/// BM25 search with k1=0.8, b=0.5. Optional exact `scope` filter
	/// (`core_reference` / `case_index`). Returns top `limit` by score desc.
	pub fn search(
		&self,
		query: &str,
		limit: usize,
		scope: Option<&str>,
	) -> Result<Vec<Bm25Hit>, TextError> {
		if limit == 0 || query.trim().is_empty() {
			return Ok(Vec::new());
		}
		self.reader.reload()?;
		let searcher = self.reader.searcher();
		let tokens = tokenize_query(&self.index, self.body_field, query)?;
		if tokens.is_empty() {
			return Ok(Vec::new());
		}

		let total_num_docs = searcher.num_docs().max(1);
		let avgdl = average_field_length(&searcher, self.body_field)?;

		let mut scores: HashMap<DocAddress, f32> = HashMap::new();

		for token in &tokens {
			let term = Term::from_field_text(self.body_field, token);
			let doc_freq = searcher.doc_freq(&term)?.max(1);
			let idf = idf(doc_freq, total_num_docs);

			for (seg_ord, segment_reader) in searcher.segment_readers().iter().enumerate() {
				if segment_reader.num_docs() == 0 {
					continue;
				}
				let inverted = segment_reader.inverted_index(self.body_field)?;
				let Some(mut postings) =
					inverted.read_postings(&term, IndexRecordOption::WithFreqs)?
				else {
					continue;
				};
				let fieldnorms = segment_reader.get_fieldnorms_reader(self.body_field)?;
				let mut doc = postings.doc();
				while doc != TERMINATED {
					if !segment_reader.is_deleted(doc) {
						let tf = postings.term_freq() as f32;
						let dl = fieldnorms.fieldnorm(doc) as f32;
						let s = bm25_tf_score(tf, dl, avgdl, idf, BM25_K1, BM25_B);
						let addr = DocAddress::new(seg_ord as u32, doc);
						*scores.entry(addr).or_insert(0.0) += s;
					}
					doc = postings.advance();
				}
			}
		}

		let mut hits: Vec<(f32, String)> = Vec::with_capacity(scores.len());
		for (addr, score) in scores {
			let retrieved: TantivyDocument = searcher.doc(addr)?;
			if let Some(want) = scope {
				let got = retrieved
					.get_first(self.scope_field)
					.and_then(|v| v.as_str())
					.unwrap_or("");
				if got != want {
					continue;
				}
			}
			let chunk_id = retrieved
				.get_first(self.chunk_id_field)
				.and_then(|v| v.as_str())
				.unwrap_or("")
				.to_string();
			if chunk_id.is_empty() {
				continue;
			}
			hits.push((score, chunk_id));
		}

		hits.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
		hits.truncate(limit);
		Ok(hits
			.into_iter()
			.map(|(score, chunk_id)| Bm25Hit { chunk_id, score })
			.collect())
	}
}

fn map_writer_error(e: TantivyError) -> TextError {
	if matches!(e, TantivyError::LockFailure(..)) {
		TextError::Message(format!("LockBusy: {e}"))
	} else {
		TextError::Tantivy(e)
	}
}

fn build_schema() -> Schema {
	let mut builder = Schema::builder();
	builder.add_text_field("chunk_id", STRING | STORED);
	builder.add_text_field("doc_id", STRING | STORED);
	builder.add_text_field("scope", STRING | STORED);
	let body_opts = TextOptions::default().set_indexing_options(
		TextFieldIndexing::default()
			.set_tokenizer("default")
			.set_index_option(IndexRecordOption::WithFreqsAndPositions),
	);
	builder.add_text_field("body", body_opts);
	builder.build()
}

fn tokenize_query(index: &Index, field: Field, query: &str) -> Result<Vec<String>, TextError> {
	let mut tokenizer = index
		.tokenizer_for_field(field)
		.map_err(|e| TextError::Message(e.to_string()))?;
	let mut stream = tokenizer.token_stream(query);
	let mut tokens = Vec::new();
	while let Some(token) = stream.next() {
		if !token.text.is_empty() {
			tokens.push(token.text.to_string());
		}
	}
	Ok(tokens)
}

fn average_field_length(searcher: &Searcher, field: Field) -> Result<f32, TextError> {
	let mut total_tokens = 0u64;
	for segment_reader in searcher.segment_readers() {
		let inverted = segment_reader.inverted_index(field)?;
		total_tokens += inverted.total_num_tokens();
	}
	let n = searcher.num_docs().max(1) as f32;
	Ok((total_tokens as f32 / n).max(1.0))
}

fn idf(doc_freq: u64, doc_count: u64) -> f32 {
	let x = ((doc_count as f32 - doc_freq as f32) + 0.5) / (doc_freq as f32 + 0.5);
	(1.0 + x).ln()
}

fn bm25_tf_score(tf: f32, doc_len: f32, avgdl: f32, idf: f32, k1: f32, b: f32) -> f32 {
	let norm = k1 * (1.0 - b + b * doc_len / avgdl.max(1.0));
	idf * (tf * (k1 + 1.0)) / (tf + norm)
}

#[cfg(test)]
mod tests {
	use super::*;
	use tempfile::tempdir;

	#[test]
	fn upsert_search_remove_round_trip() {
		let dir = tempdir().unwrap();
		let mut idx = TextIndex::open(dir.path()).unwrap();
		idx.upsert_chunks(&[
			(
				"c1".into(),
				"d1".into(),
				"case_index".into(),
				"The rating reduction ignored flare-ups.".into(),
			),
			(
				"c2".into(),
				"d1".into(),
				"case_index".into(),
				"Unrelated payroll spreadsheet totals.".into(),
			),
			(
				"c3".into(),
				"d2".into(),
				"core_reference".into(),
				"Board procedures for rating reduction appeals.".into(),
			),
		])
		.unwrap();
		idx.commit().unwrap();
		assert_eq!(idx.doc_count(), 3);

		let hits = idx.search("rating reduction flare-ups", 5, Some("case_index")).unwrap();
		assert!(!hits.is_empty());
		assert_eq!(hits[0].chunk_id, "c1");
		assert!(hits.iter().all(|h| h.chunk_id != "c3"), "scope filter");

		idx.remove_chunks(&["c1".into()]).unwrap();
		idx.commit().unwrap();
		assert_eq!(idx.doc_count(), 2);
		let after = idx.search("flare-ups", 5, None).unwrap();
		assert!(after.iter().all(|h| h.chunk_id != "c1"));
	}

	#[test]
	fn bm25_params_are_void_defaults() {
		assert!((BM25_K1 - 0.8).abs() < f32::EPSILON);
		assert!((BM25_B - 0.5).abs() < f32::EPSILON);
	}

	#[test]
	fn two_reader_opens_without_writer() {
		let dir = tempdir().unwrap();
		let mut primary = TextIndex::open(dir.path()).unwrap();
		primary
			.upsert_chunks(&[(
				"c1".into(),
				"d1".into(),
				"case_index".into(),
				"flare-ups and ratings".into(),
			)])
			.unwrap();
		primary.commit().unwrap();

		let reader_a = TextIndex::open(dir.path()).unwrap();
		let reader_b = TextIndex::open(dir.path()).unwrap();
		assert!(!reader_a.has_writer());
		assert!(!reader_b.has_writer());

		let hits = reader_a.search("flare-ups", 5, None).unwrap();
		assert_eq!(hits[0].chunk_id, "c1");
	}

	#[test]
	fn read_only_rejects_indexing() {
		let dir = tempdir().unwrap();
		let mut primary = TextIndex::open(dir.path()).unwrap();
		primary
			.upsert_chunks(&[(
				"c1".into(),
				"d1".into(),
				"case_index".into(),
				"indexed once".into(),
			)])
			.unwrap();
		primary.commit().unwrap();

		let mut ro = TextIndex::open_read_only(dir.path()).unwrap();
		let err = ro
			.upsert_chunks(&[(
				"c2".into(),
				"d2".into(),
				"case_index".into(),
				"should fail".into(),
			)])
			.unwrap_err();
		assert!(err.to_string().contains("read-only session"));
	}

	#[test]
	fn secondary_reader_sees_commit_after_reload() {
		let dir = tempdir().unwrap();
		let mut primary = TextIndex::open(dir.path()).unwrap();
		let secondary = TextIndex::open(dir.path()).unwrap();

		primary
			.upsert_chunks(&[(
				"c1".into(),
				"d1".into(),
				"case_index".into(),
				"post-commit visibility".into(),
			)])
			.unwrap();
		primary.commit().unwrap();

		let hits = secondary.search("visibility", 5, None).unwrap();
		assert_eq!(hits.len(), 1);
		assert_eq!(hits[0].chunk_id, "c1");
	}
}
