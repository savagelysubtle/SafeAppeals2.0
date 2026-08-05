// Copyright (c) Safe Appeals. All rights reserved.

//! Deterministic fake cross-encoder for unit tests (no ONNX / no downloads).

use std::collections::HashSet;

use super::{RerankDoc, RerankError, RerankedHit, Reranker};

/// Term-overlap scorer — stable, no model weights.
///
/// Higher scores prefer documents that contain more distinct query tokens
/// (whitespace-split, lowercased). Ties break by original hybrid score, then id.
#[derive(Debug, Clone, Default)]
pub struct FakeReranker;

impl FakeReranker {
	pub fn new() -> Self {
		Self
	}
}

impl Reranker for FakeReranker {
	fn rerank(
		&self,
		query: &str,
		documents: &[RerankDoc],
		top_n: usize,
	) -> Result<Vec<RerankedHit>, RerankError> {
		if top_n == 0 || documents.is_empty() {
			return Ok(Vec::new());
		}

		// Void short-circuit: skip when pool already fits.
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

		let q_terms = tokenize(query);
		let mut scored: Vec<RerankedHit> = documents
			.iter()
			.map(|d| {
				let relevance = overlap_score(&q_terms, &d.text);
				RerankedHit {
					id: d.id.clone(),
					text: d.text.clone(),
					relevance_score: relevance,
					original_score: d.score,
				}
			})
			.collect();

		scored.sort_by(|a, b| {
			b.relevance_score
				.partial_cmp(&a.relevance_score)
				.unwrap_or(std::cmp::Ordering::Equal)
				.then_with(|| {
					b.original_score
						.partial_cmp(&a.original_score)
						.unwrap_or(std::cmp::Ordering::Equal)
				})
				.then_with(|| a.id.cmp(&b.id))
		});
		if scored.len() > top_n {
			scored.truncate(top_n);
		}
		Ok(scored)
	}
}

fn tokenize(text: &str) -> HashSet<String> {
	text.split_whitespace()
		.map(|t| {
			t.chars()
				.filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
				.flat_map(|c| c.to_lowercase())
				.collect::<String>()
		})
		.filter(|t| !t.is_empty())
		.collect()
}

fn overlap_score(query_terms: &HashSet<String>, text: &str) -> f64 {
	if query_terms.is_empty() {
		return 0.0;
	}
	let doc_terms = tokenize(text);
	let hits = query_terms.iter().filter(|t| doc_terms.contains(*t)).count();
	// Normalize by query length; tiny id-independent bonus for denser overlap.
	(hits as f64) / (query_terms.len() as f64) + (hits as f64) * 0.01
}
