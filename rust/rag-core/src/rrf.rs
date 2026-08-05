// Copyright (c) Safe Appeals. All rights reserved.

//! Reciprocal Rank Fusion (RRF) for hybrid BM25 + vector retrieval (M3)
//! and multi-sub-query merge (M4).
//!
//! Void `ragHybridRetriever` semantics:
//! `score += 1 / (rrfK + rank + 1)` per list; fuse by chunk_id; sort desc; take top k.
//! Defaults: `rrfK = 20`.

use std::collections::HashMap;

/// RRF constant (Void default for medical/legal precision).
pub const RRF_K: u32 = 20;

/// Per-leg over-fetch multiplier relative to `finalK`.
///
/// Void uses `3×`; SafeAppeals uses **4×** so M5 cross-encoder rerank has a
/// larger candidate pool (aligns with Void `ragMainService` headroom).
///
/// M4 QP merge: each sub-query also over-fetches **4×** `finalK` hybrid hits,
/// then [`fuse_many_ranked_lists`] collapses those lists to `finalK`.
pub const OVERFETCH_MULTIPLIER: u32 = 4;

/// One fused hybrid hit before SQL hydration (BM25 + vector legs).
#[derive(Debug, Clone, PartialEq)]
pub struct FusedHit {
	pub chunk_id: String,
	pub fused_score: f64,
	pub bm25_rank: Option<u32>,
	pub vector_rank: Option<u32>,
}

/// Generic multi-list RRF hit (no per-leg rank metadata).
#[derive(Debug, Clone, PartialEq)]
pub struct RankedFusedHit {
	pub chunk_id: String,
	pub fused_score: f64,
}

/// Fuse two ranked lists (already sorted best-first) with Reciprocal Rank Fusion.
///
/// `rank` is 0-based position in each list. Ties on fused score keep first-seen order
/// after a stable sort by score descending.
pub fn fuse_rrf(
	bm25: &[String],
	vector: &[String],
	final_k: usize,
	rrf_k: u32,
) -> Vec<FusedHit> {
	let mut fused: HashMap<String, FusedHit> = HashMap::new();

	for (rank, chunk_id) in bm25.iter().enumerate() {
		let contrib = 1.0 / (f64::from(rrf_k) + rank as f64 + 1.0);
		fused
			.entry(chunk_id.clone())
			.and_modify(|h| {
				h.fused_score += contrib;
				h.bm25_rank = Some(rank as u32);
			})
			.or_insert(FusedHit {
				chunk_id: chunk_id.clone(),
				fused_score: contrib,
				bm25_rank: Some(rank as u32),
				vector_rank: None,
			});
	}

	for (rank, chunk_id) in vector.iter().enumerate() {
		let contrib = 1.0 / (f64::from(rrf_k) + rank as f64 + 1.0);
		fused
			.entry(chunk_id.clone())
			.and_modify(|h| {
				h.fused_score += contrib;
				h.vector_rank = Some(rank as u32);
			})
			.or_insert(FusedHit {
				chunk_id: chunk_id.clone(),
				fused_score: contrib,
				bm25_rank: None,
				vector_rank: Some(rank as u32),
			});
	}

	let mut out: Vec<FusedHit> = fused.into_values().collect();
	out.sort_by(|a, b| {
		b.fused_score
			.partial_cmp(&a.fused_score)
			.unwrap_or(std::cmp::Ordering::Equal)
	});
	if out.len() > final_k {
		out.truncate(final_k);
	}
	out
}

/// Fuse N ranked lists (e.g. M4 sub-query hybrid result lists) with RRF.
///
/// Each list is best-first. Chunks that appear in multiple lists accumulate score.
/// Returns at most `final_k` hits sorted by fused score descending.
pub fn fuse_many_ranked_lists(
	lists: &[Vec<String>],
	final_k: usize,
	rrf_k: u32,
) -> Vec<RankedFusedHit> {
	if final_k == 0 || lists.is_empty() {
		return Vec::new();
	}

	let mut fused: HashMap<String, f64> = HashMap::new();
	for list in lists {
		for (rank, chunk_id) in list.iter().enumerate() {
			let contrib = 1.0 / (f64::from(rrf_k) + rank as f64 + 1.0);
			*fused.entry(chunk_id.clone()).or_insert(0.0) += contrib;
		}
	}

	let mut out: Vec<RankedFusedHit> = fused
		.into_iter()
		.map(|(chunk_id, fused_score)| RankedFusedHit {
			chunk_id,
			fused_score,
		})
		.collect();
	out.sort_by(|a, b| {
		b.fused_score
			.partial_cmp(&a.fused_score)
			.unwrap_or(std::cmp::Ordering::Equal)
	});
	if out.len() > final_k {
		out.truncate(final_k);
	}
	out
}

/// Compute per-leg / per-sub-query retrieval depth: `final_k * OVERFETCH_MULTIPLIER`.
pub fn retrieval_k(final_k: usize) -> usize {
	if final_k == 0 {
		return 0;
	}
	final_k.saturating_mul(OVERFETCH_MULTIPLIER as usize)
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn rrf_prefers_overlap() {
		let bm25 = vec!["a".into(), "b".into(), "c".into()];
		let vector = vec!["c".into(), "a".into(), "d".into()];
		let fused = fuse_rrf(&bm25, &vector, 3, RRF_K);
		assert_eq!(fused.len(), 3);
		// "a" and "c" appear in both → highest fused scores
		assert!(fused[0].chunk_id == "a" || fused[0].chunk_id == "c");
		assert!(fused.iter().any(|h| h.chunk_id == "a" && h.bm25_rank.is_some() && h.vector_rank.is_some()));
	}

	#[test]
	fn overfetch_is_four_x() {
		assert_eq!(OVERFETCH_MULTIPLIER, 4);
		assert_eq!(retrieval_k(5), 20);
		assert_eq!(retrieval_k(0), 0);
	}

	#[test]
	fn fuse_many_prefers_chunks_in_multiple_lists() {
		let lists = vec![
			vec!["a".into(), "b".into(), "c".into()],
			vec!["c".into(), "a".into(), "d".into()],
			vec!["e".into(), "a".into()],
		];
		let fused = fuse_many_ranked_lists(&lists, 3, RRF_K);
		assert_eq!(fused.len(), 3);
		assert_eq!(fused[0].chunk_id, "a", "a appears in all three lists");
		assert!(fused.iter().any(|h| h.chunk_id == "c"));
	}

	#[test]
	fn fuse_many_empty_or_zero_k() {
		assert!(fuse_many_ranked_lists(&[], 5, RRF_K).is_empty());
		assert!(fuse_many_ranked_lists(&[vec!["a".into()]], 0, RRF_K).is_empty());
	}
}
