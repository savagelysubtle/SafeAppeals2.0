// Copyright (c) Safe Appeals. All rights reserved.

//! Embedding backends (M2).
//!
//! - [`FakeEmbedder`] — deterministic vectors for unit tests / CI (no model download)
//! - [`FastEmbedEmbedder`] — BGE-small via fastembed+ort (feature `fastembed`, BYO weights)
//! - MiniLM light path is stubbed until a dedicated light pack lands

mod fake;
#[cfg(feature = "fastembed")]
mod fastembed_backend;

pub use fake::FakeEmbedder;

#[cfg(feature = "fastembed")]
pub use fastembed_backend::FastEmbedEmbedder;

use std::sync::{Arc, Mutex, OnceLock};

use thiserror::Error;

/// BGE-small-en-v1.5 embedding dimensionality.
pub const BGE_SMALL_DIMS: usize = 512;

/// Env var: directory with BYO ONNX + tokenizer files for BGE-small.
pub const EMBED_MODEL_DIR_ENV: &str = "SA_RAG_EMBED_MODEL_DIR";

#[derive(Debug, Error)]
pub enum EmbedError {
	#[error("embedding model is not loaded (set {EMBED_MODEL_DIR_ENV} or install Search pack)")]
	ModelMissing,
	#[error("embedding model '{0}' is not available yet (stub)")]
	StubModel(String),
	#[error("embedding failed: {0}")]
	Message(String),
	#[error("dimension mismatch: expected {expected}, got {got}")]
	DimMismatch { expected: usize, got: usize },
}

/// Which embedding model the host requested.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum EmbedModelKind {
	#[default]
	BgeSmallEnV15,
	/// Deferred light path — stub only in M2 (not loadable; see README/PREBUILDS).
	MiniLmL6V2Light,
}

impl EmbedModelKind {
	pub fn dims(self) -> usize {
		match self {
			Self::BgeSmallEnV15 => BGE_SMALL_DIMS,
			Self::MiniLmL6V2Light => 384,
		}
	}

	pub fn as_str(self) -> &'static str {
		match self {
			Self::BgeSmallEnV15 => "bge-small-en-v1.5",
			Self::MiniLmL6V2Light => "all-MiniLM-L6-v2-light",
		}
	}
}

/// Trait for batch embedding.
pub trait Embedder: Send + Sync {
	fn model_kind(&self) -> EmbedModelKind;
	fn dims(&self) -> usize;
	fn embed_batch(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, EmbedError>;
}

type SharedEmbedder = Arc<dyn Embedder>;

static EMBEDDER: OnceLock<Mutex<Option<SharedEmbedder>>> = OnceLock::new();

fn embedder_slot() -> &'static Mutex<Option<SharedEmbedder>> {
	EMBEDDER.get_or_init(|| Mutex::new(None))
}

/// Whether a real (or test) embedder is currently loaded.
pub fn is_loaded() -> bool {
	embedder_slot()
		.lock()
		.map(|g| g.is_some())
		.unwrap_or(false)
}

/// Configured BGE dims for capabilities (even when model not loaded).
pub fn configured_dims() -> u32 {
	BGE_SMALL_DIMS as u32
}

/// Install an embedder (tests / host after consent install).
pub fn set_embedder(embedder: SharedEmbedder) {
	if let Ok(mut guard) = embedder_slot().lock() {
		*guard = Some(embedder);
	}
}

/// Clear the process-global embedder.
pub fn clear_embedder() {
	if let Ok(mut guard) = embedder_slot().lock() {
		*guard = None;
	}
}

/// Try to load the default BGE embedder from `SA_RAG_EMBED_MODEL_DIR` (BYO).
///
/// Fail-soft: returns `Ok(false)` when the directory is unset/missing or the
/// `fastembed` feature is off. Never downloads weights.
pub fn try_load_default() -> Result<bool, EmbedError> {
	#[cfg(feature = "fastembed")]
	{
		let path = match std::env::var(EMBED_MODEL_DIR_ENV) {
			Ok(p) if !p.is_empty() => std::path::PathBuf::from(p),
			_ => return Ok(false),
		};
		if !path.is_dir() {
			return Ok(false);
		}
		let embedder = FastEmbedEmbedder::from_model_dir(&path, EmbedModelKind::BgeSmallEnV15)?;
		set_embedder(Arc::new(embedder));
		return Ok(true);
	}
	#[cfg(not(feature = "fastembed"))]
	{
		Ok(false)
	}
}

/// Embed a batch using the process-global embedder.
pub fn embed_batch(texts: &[String]) -> Result<Vec<Vec<f32>>, EmbedError> {
	let guard = embedder_slot()
		.lock()
		.map_err(|_| EmbedError::Message("embedder mutex poisoned".into()))?;
	let Some(embedder) = guard.as_ref() else {
		return Err(EmbedError::ModelMissing);
	};
	embedder.embed_batch(texts)
}

/// Install FakeEmbedder for tests (dim = BGE 512).
#[cfg(test)]
pub fn install_fake_for_tests() {
	set_embedder(Arc::new(FakeEmbedder::new(EmbedModelKind::BgeSmallEnV15)));
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn fake_embedder_dims_and_deterministic() {
		let fake = FakeEmbedder::new(EmbedModelKind::BgeSmallEnV15);
		assert_eq!(fake.dims(), 512);
		let a = fake.embed_batch(&["hello".into()]).unwrap();
		let b = fake.embed_batch(&["hello".into()]).unwrap();
		assert_eq!(a, b);
		assert_eq!(a[0].len(), 512);
		// L2-normalized
		let norm: f32 = a[0].iter().map(|x| x * x).sum::<f32>().sqrt();
		assert!((norm - 1.0).abs() < 1e-4);
	}

	#[test]
	fn minilm_stub_dims() {
		assert_eq!(EmbedModelKind::MiniLmL6V2Light.dims(), 384);
	}
}
