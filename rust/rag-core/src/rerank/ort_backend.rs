// Copyright (c) Safe Appeals. All rights reserved.

//! ms-marco MiniLM cross-encoder via ort (feature `cross-encoder`). BYO model directory only.

use std::path::Path;
use std::sync::Mutex;

use ort::session::Session;
use ort::value::Tensor;
use tokenizers::Tokenizer;

use super::{
	RerankDoc, RerankError, RerankedHit, Reranker, CE_BATCH_SIZE, CE_MAX_LENGTH,
};

/// Cross-encoder loaded from a local directory — never downloads weights.
///
/// Expected layout (HuggingFace / Xenova-style export):
/// - `model.onnx` (or `onnx/model.onnx`)
/// - `tokenizer.json`
pub struct OrtCrossEncoder {
	session: Mutex<Session>,
	tokenizer: Tokenizer,
	/// Whether the ONNX graph expects `token_type_ids`.
	needs_token_type_ids: bool,
	/// Output logits: single score per row vs binary (take class 1).
	binary_logits: bool,
}

impl OrtCrossEncoder {
	/// Load from a BYO directory (`SA_RAG_CE_MODEL_DIR`).
	pub fn from_model_dir(dir: &Path) -> Result<Self, RerankError> {
		let onnx_path = find_onnx(dir)?;
		let tok_path = dir.join("tokenizer.json");
		if !tok_path.is_file() {
			return Err(RerankError::Message(format!(
				"missing tokenizer.json under {}",
				dir.display()
			)));
		}

		let session = Session::builder()
			.map_err(|e| RerankError::Message(format!("ort session builder: {e}")))?
			.commit_from_file(&onnx_path)
			.map_err(|e| {
				RerankError::Message(format!(
					"failed to load CE ONNX from {}: {e}",
					onnx_path.display()
				))
			})?;

		let tokenizer = Tokenizer::from_file(&tok_path).map_err(|e| {
			RerankError::Message(format!(
				"failed to load tokenizer from {}: {e}",
				tok_path.display()
			))
		})?;

		let needs_token_type_ids = session
			.inputs()
			.iter()
			.any(|i| i.name() == "token_type_ids");

		// ms-marco MiniLM CE typically emits a single relevance logit per row.
		// Binary (2-class) exports are detected at inference from the flat buffer length.
		let binary_logits = false;

		Ok(Self {
			session: Mutex::new(session),
			tokenizer,
			needs_token_type_ids,
			binary_logits,
		})
	}

	fn score_batch(&self, query: &str, texts: &[&str]) -> Result<Vec<f64>, RerankError> {
		if texts.is_empty() {
			return Ok(Vec::new());
		}

		let mut encodings = Vec::with_capacity(texts.len());
		for text in texts {
			let encoding = self
				.tokenizer
				.encode((query, *text), true)
				.map_err(|e| RerankError::Message(format!("tokenize failed: {e}")))?;
			encodings.push(encoding);
		}

		let batch = encodings.len();
		let max_len = encodings
			.iter()
			.map(|e| e.len().min(CE_MAX_LENGTH))
			.max()
			.unwrap_or(0);
		if max_len == 0 {
			return Ok(vec![0.0; batch]);
		}

		let mut input_ids = vec![0i64; batch * max_len];
		let mut attention_mask = vec![0i64; batch * max_len];
		let mut token_type_ids = vec![0i64; batch * max_len];

		for (i, enc) in encodings.iter().enumerate() {
			let ids = enc.get_ids();
			let type_ids = enc.get_type_ids();
			let len = ids.len().min(CE_MAX_LENGTH);
			for (j, &id) in ids.iter().take(len).enumerate() {
				input_ids[i * max_len + j] = id as i64;
				attention_mask[i * max_len + j] = 1;
				token_type_ids[i * max_len + j] = type_ids.get(j).copied().unwrap_or(0) as i64;
			}
		}

		let shape = vec![batch, max_len];
		let ids_tensor = Tensor::from_array((shape.clone(), input_ids))
			.map_err(|e| RerankError::Message(format!("input_ids tensor: {e}")))?;
		let mask_tensor = Tensor::from_array((shape.clone(), attention_mask))
			.map_err(|e| RerankError::Message(format!("attention_mask tensor: {e}")))?;

		let mut session = self
			.session
			.lock()
			.map_err(|_| RerankError::Message("CE session mutex poisoned".into()))?;

		let outputs = if self.needs_token_type_ids {
			let type_tensor = Tensor::from_array((shape, token_type_ids))
				.map_err(|e| RerankError::Message(format!("token_type_ids tensor: {e}")))?;
			session
				.run(ort::inputs![
					"input_ids" => ids_tensor,
					"attention_mask" => mask_tensor,
					"token_type_ids" => type_tensor,
				])
				.map_err(|e| RerankError::Message(format!("CE inference failed: {e}")))?
		} else {
			session
				.run(ort::inputs![
					"input_ids" => ids_tensor,
					"attention_mask" => mask_tensor,
				])
				.map_err(|e| RerankError::Message(format!("CE inference failed: {e}")))?
		};

		if outputs.len() == 0 {
			return Err(RerankError::Message("CE model produced no outputs".into()));
		}
		let (_shape, data) = outputs[0]
			.try_extract_tensor::<f32>()
			.map_err(|e| RerankError::Message(format!("extract logits: {e}")))?;

		let mut scores = Vec::with_capacity(batch);
		let binary = self.binary_logits || data.len() == batch * 2;
		if binary && data.len() >= batch * 2 {
			for i in 0..batch {
				scores.push(data[i * 2 + 1] as f64);
			}
		} else if data.len() >= batch {
			// Single logit per row (ms-marco MiniLM default) or flat [batch, C].
			let stride = data.len() / batch;
			for i in 0..batch {
				let idx = if stride > 1 {
					i * stride + (stride - 1)
				} else {
					i
				};
				scores.push(data.get(idx).copied().unwrap_or(0.0) as f64);
			}
		} else {
			return Err(RerankError::Message(format!(
				"unexpected logits length {} for batch {}",
				data.len(),
				batch
			)));
		}
		Ok(scores)
	}
}

impl Reranker for OrtCrossEncoder {
	fn rerank(
		&self,
		query: &str,
		documents: &[RerankDoc],
		top_n: usize,
	) -> Result<Vec<RerankedHit>, RerankError> {
		if top_n == 0 || documents.is_empty() {
			return Ok(Vec::new());
		}

		if documents.len() <= top_n {
			return Ok(documents
				.iter()
				.map(|d| RerankedHit {
					id: d.id.clone(),
					text: d.text.clone(),
					relevance_score: d.score,
					original_score: d.score,
				})
				.collect());
		}

		let mut scores = Vec::with_capacity(documents.len());
		let mut i = 0;
		while i < documents.len() {
			let end = (i + CE_BATCH_SIZE).min(documents.len());
			let texts: Vec<&str> = documents[i..end].iter().map(|d| d.text.as_str()).collect();
			let batch_scores = self.score_batch(query, &texts)?;
			scores.extend(batch_scores);
			i = end;
		}

		let mut ranked: Vec<RerankedHit> = documents
			.iter()
			.zip(scores.into_iter())
			.map(|(d, relevance_score)| RerankedHit {
				id: d.id.clone(),
				text: d.text.clone(),
				relevance_score,
				original_score: d.score,
			})
			.collect();

		ranked.sort_by(|a, b| {
			b.relevance_score
				.partial_cmp(&a.relevance_score)
				.unwrap_or(std::cmp::Ordering::Equal)
				.then_with(|| a.id.cmp(&b.id))
		});
		if ranked.len() > top_n {
			ranked.truncate(top_n);
		}
		Ok(ranked)
	}
}

fn find_onnx(dir: &Path) -> Result<std::path::PathBuf, RerankError> {
	for name in ["model.onnx", "onnx/model.onnx", "model_optimized.onnx"] {
		let path = dir.join(name);
		if path.is_file() {
			return Ok(path);
		}
	}
	Err(RerankError::Message(format!(
		"no ONNX model file found under {} (tried model.onnx, onnx/model.onnx, model_optimized.onnx)",
		dir.display()
	)))
}
