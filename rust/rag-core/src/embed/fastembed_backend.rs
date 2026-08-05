// Copyright (c) Safe Appeals. All rights reserved.

//! FastEmbed + ort backend (feature `fastembed`). BYO model directory only.

use std::fs;
use std::path::Path;
use std::sync::Mutex;

use fastembed::{
	InitOptionsUserDefined, Pooling, TextEmbedding, TokenizerFiles, UserDefinedEmbeddingModel,
};

use super::{EmbedError, EmbedModelKind, Embedder, BGE_SMALL_DIMS};

/// BGE-small (or future MiniLM) loaded from a local directory — never downloads.
pub struct FastEmbedEmbedder {
	kind: EmbedModelKind,
	inner: Mutex<TextEmbedding>,
}

impl FastEmbedEmbedder {
	/// Load from a BYO directory.
	///
	/// Expected layout (HuggingFace-style export / fastembed cache extract):
	/// - `model.onnx` (or `onnx/model.onnx`)
	/// - `tokenizer.json`
	/// - `config.json`
	/// - `special_tokens_map.json`
	/// - `tokenizer_config.json`
	pub fn from_model_dir(dir: &Path, kind: EmbedModelKind) -> Result<Self, EmbedError> {
		if kind == EmbedModelKind::MiniLmL6V2Light {
			return Err(EmbedError::StubModel(kind.as_str().into()));
		}

		let onnx = read_first(
			dir,
			&["model.onnx", "onnx/model.onnx", "model_optimized.onnx"],
		)?;
		let tokenizer_file = read_required(dir, "tokenizer.json")?;
		let config_file = read_optional(dir, "config.json");
		let special_tokens_map_file = read_optional(dir, "special_tokens_map.json");
		let tokenizer_config_file = read_optional(dir, "tokenizer_config.json");

		let model = UserDefinedEmbeddingModel::new(
			onnx,
			TokenizerFiles {
				tokenizer_file,
				config_file,
				special_tokens_map_file,
				tokenizer_config_file,
			},
		)
		.with_pooling(Pooling::Cls);

		let options = InitOptionsUserDefined::new().with_max_length(512);
		let inner = TextEmbedding::try_new_from_user_defined(model, options).map_err(|e| {
			EmbedError::Message(format!("failed to load embedding model from {}: {e}", dir.display()))
		})?;

		Ok(Self {
			kind,
			inner: Mutex::new(inner),
		})
	}
}

impl Embedder for FastEmbedEmbedder {
	fn model_kind(&self) -> EmbedModelKind {
		self.kind
	}

	fn dims(&self) -> usize {
		self.kind.dims()
	}

	fn embed_batch(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, EmbedError> {
		let mut guard = self
			.inner
			.lock()
			.map_err(|_| EmbedError::Message("fastembed mutex poisoned".into()))?;
		let embeddings = guard
			.embed(texts, None)
			.map_err(|e| EmbedError::Message(format!("embed failed: {e}")))?;
		for emb in &embeddings {
			if emb.len() != BGE_SMALL_DIMS && self.kind == EmbedModelKind::BgeSmallEnV15 {
				return Err(EmbedError::DimMismatch {
					expected: BGE_SMALL_DIMS,
					got: emb.len(),
				});
			}
		}
		Ok(embeddings)
	}
}

fn read_required(dir: &Path, name: &str) -> Result<Vec<u8>, EmbedError> {
	let path = dir.join(name);
	fs::read(&path).map_err(|e| {
		EmbedError::Message(format!("missing required model file {}: {e}", path.display()))
	})
}

fn read_optional(dir: &Path, name: &str) -> Vec<u8> {
	fs::read(dir.join(name)).unwrap_or_default()
}

fn read_first(dir: &Path, names: &[&str]) -> Result<Vec<u8>, EmbedError> {
	for name in names {
		let path = dir.join(name);
		if path.is_file() {
			return fs::read(&path).map_err(|e| {
				EmbedError::Message(format!("failed to read {}: {e}", path.display()))
			});
		}
	}
	Err(EmbedError::Message(format!(
		"no ONNX model file found under {} (tried {})",
		dir.display(),
		names.join(", ")
	)))
}
