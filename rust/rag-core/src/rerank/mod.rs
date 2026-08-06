// Copyright (c) Safe Appeals. All rights reserved.

//! Cross-encoder rerank backends (M5).
//!
//! - [`FakeReranker`] — deterministic scores for unit tests / CI (no ONNX)
//! - [`OrtCrossEncoder`] — ms-marco MiniLM via ort (feature `cross-encoder`, BYO weights)
//! - BGE-reranker quality mode is deferred (not implemented)

mod fake;
#[cfg(feature = "cross-encoder")]
mod ort_backend;

pub use fake::FakeReranker;

#[cfg(feature = "cross-encoder")]
pub use ort_backend::OrtCrossEncoder;

use std::sync::{Arc, Mutex, OnceLock};

use thiserror::Error;

/// Env var: directory with BYO ONNX + tokenizer files for ms-marco MiniLM CE.
pub const CE_MODEL_DIR_ENV: &str = "SA_RAG_CE_MODEL_DIR";

/// Max sequence length for ms-marco MiniLM cross-encoder pairs.
pub const CE_MAX_LENGTH: usize = 512;

/// Batch size for CE inference (memory-bounded; matches Void's 10).
pub const CE_BATCH_SIZE: usize = 10;

#[derive(Debug, Error)]
pub enum RerankError {
	#[error("cross-encoder model is not loaded (set {CE_MODEL_DIR_ENV} or install Search pack)")]
	ModelMissing,
	#[error("rerank failed: {0}")]
	Message(String),
}

/// One candidate document for reranking.
#[derive(Debug, Clone)]
pub struct RerankDoc {
	pub id: String,
	pub text: String,
	/// Original hybrid/RRF score (kept for short-circuit / degrade paths).
	pub score: f64,
}

/// One reranked hit.
#[derive(Debug, Clone)]
pub struct RerankedHit {
	pub id: String,
	pub text: String,
	pub relevance_score: f64,
	pub original_score: f64,
}

/// Trait for query–document cross-encoder scoring.
pub trait Reranker: Send + Sync {
	/// Score `(query, doc)` pairs and return the top `top_n` by relevance descending.
	fn rerank(
		&self,
		query: &str,
		documents: &[RerankDoc],
		top_n: usize,
	) -> Result<Vec<RerankedHit>, RerankError>;
}

type SharedReranker = Arc<dyn Reranker>;

static RERANKER: OnceLock<Mutex<Option<SharedReranker>>> = OnceLock::new();

fn reranker_slot() -> &'static Mutex<Option<SharedReranker>> {
	RERANKER.get_or_init(|| Mutex::new(None))
}

/// Whether a real (or test) cross-encoder is currently loaded.
pub fn is_loaded() -> bool {
	reranker_slot()
		.lock()
		.map(|g| g.is_some())
		.unwrap_or(false)
}

/// Install a reranker (tests / host after consent install).
pub fn set_reranker(reranker: SharedReranker) {
	if let Ok(mut guard) = reranker_slot().lock() {
		*guard = Some(reranker);
	}
}

/// Clear the process-global reranker.
pub fn clear_reranker() {
	if let Ok(mut guard) = reranker_slot().lock() {
		*guard = None;
	}
}

/// Try to load ms-marco MiniLM CE from `SA_RAG_CE_MODEL_DIR` (BYO).
///
/// Fail-soft: returns `Ok(false)` when the directory is unset/missing or the
/// `cross-encoder` feature is off. Never downloads weights.
pub fn try_load_default() -> Result<bool, RerankError> {
	if is_loaded() {
		return Ok(true);
	}
	#[cfg(feature = "cross-encoder")]
	{
		let path = match std::env::var(CE_MODEL_DIR_ENV) {
			Ok(p) if !p.is_empty() => std::path::PathBuf::from(p),
			_ => return Ok(false),
		};
		if !path.is_dir() {
			return Ok(false);
		}
		let reranker = OrtCrossEncoder::from_model_dir(&path)?;
		set_reranker(Arc::new(reranker));
		return Ok(true);
	}
	#[cfg(not(feature = "cross-encoder"))]
	{
		Ok(false)
	}
}

/// Rerank with the process-global CE, or return `None` when unloaded.
///
/// Callers treat `None` as degrade-to-hybrid (no error).
pub fn try_rerank(
	query: &str,
	documents: &[RerankDoc],
	top_n: usize,
) -> Option<Result<Vec<RerankedHit>, RerankError>> {
	let guard = reranker_slot().lock().ok()?;
	let reranker = guard.as_ref()?;
	Some(reranker.rerank(query, documents, top_n))
}

/// Install [`FakeReranker`] for tests.
#[cfg(test)]
pub fn install_fake_for_tests() {
	set_reranker(Arc::new(FakeReranker::new()));
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn fake_reranker_orders_by_term_overlap() {
		let fake = FakeReranker::new();
		let docs = vec![
			RerankDoc {
				id: "a".into(),
				text: "unrelated fluff about weather".into(),
				score: 0.9,
			},
			RerankDoc {
				id: "b".into(),
				text: "rating reduction and flare-ups documented".into(),
				score: 0.1,
			},
		];
		// top_n < len so short-circuit does not skip scoring.
		let out = fake.rerank("rating reduction flare-ups", &docs, 1).unwrap();
		assert_eq!(out.len(), 1);
		assert_eq!(out[0].id, "b");
		assert!(out[0].relevance_score > 0.0);
	}

	#[test]
	fn fake_short_circuits_when_candidates_fit() {
		let fake = FakeReranker::new();
		let docs = vec![RerankDoc {
			id: "only".into(),
			text: "anything".into(),
			score: 0.42,
		}];
		let out = fake.rerank("q", &docs, 5).unwrap();
		assert_eq!(out.len(), 1);
		assert_eq!(out[0].relevance_score, 0.42);
	}
}
