// Copyright (c) Safe Appeals. All rights reserved.

//! Deterministic fake embedder for unit tests (no ONNX / no downloads).

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

use super::{EmbedError, EmbedModelKind, Embedder};

/// Hash-seeded, L2-normalized vectors — stable across runs for the same text.
#[derive(Debug, Clone)]
pub struct FakeEmbedder {
	kind: EmbedModelKind,
}

impl FakeEmbedder {
	pub fn new(kind: EmbedModelKind) -> Self {
		Self { kind }
	}
}

impl Embedder for FakeEmbedder {
	fn model_kind(&self) -> EmbedModelKind {
		self.kind
	}

	fn dims(&self) -> usize {
		self.kind.dims()
	}

	fn embed_batch(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, EmbedError> {
		let dims = self.dims();
		Ok(texts.iter().map(|t| fake_vector(t, dims)).collect())
	}
}

fn fake_vector(text: &str, dims: usize) -> Vec<f32> {
	let mut hasher = DefaultHasher::new();
	text.hash(&mut hasher);
	let seed = hasher.finish();
	let mut v = Vec::with_capacity(dims);
	let mut state = seed;
	for i in 0..dims {
		state = state
			.wrapping_mul(6364136223846793005)
			.wrapping_add(i as u64 + 1);
		let bits = ((state >> 33) as u32) % 10_000;
		v.push((bits as f32 / 10_000.0) * 2.0 - 1.0);
	}
	let norm = v.iter().map(|x| x * x).sum::<f32>().sqrt().max(1e-12);
	for x in &mut v {
		*x /= norm;
	}
	v
}
