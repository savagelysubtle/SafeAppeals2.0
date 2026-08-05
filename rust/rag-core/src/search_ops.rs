// Copyright (c) Safe Appeals. All rights reserved.

//! Hybrid BM25 + vector search with in-process RRF (M3), rule-based QP (M4),
//! and optional ms-marco CE rerank (M5).
//!
//! Search path: **decompose → sequential sub-searches → merge/RRF → CE trim**.
//!
//! Sub-searches run **sequentially** in v1 because [`workspace::with_session`]
//! holds a mutex (true parallel sub-searches deferred).
//!
//! Candidate pool: hybrid/RRF fuse to [`rrf::retrieval_k`] (`finalK × 4`), then
//! CE (when loaded) trims to `finalK`. Missing CE → degrade to hybrid top-`finalK`
//! (no error). Missing embed → fail-closed.

use crate::embed;
use crate::query_processor::{self, RoutedScope};
use crate::rerank::{self, RerankDoc};
use crate::rrf::{self, FusedHit, OVERFETCH_MULTIPLIER, RRF_K};
use crate::storage::{workspace, ChunkRow, StorageError, WorkspaceSession};
use crate::text::{BM25_B, BM25_K1};

/// Search scope filter (DB `documents.scope` values). `all` = no filter.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum SearchScope {
	#[default]
	All,
	CoreReference,
	CaseIndex,
}

impl SearchScope {
	pub fn parse(s: Option<&str>) -> Result<Self, StorageError> {
		match s.map(str::trim).filter(|v| !v.is_empty()) {
			None | Some("all") => Ok(Self::All),
			Some("core_reference") => Ok(Self::CoreReference),
			Some("case_index") => Ok(Self::CaseIndex),
			Some(other) => Err(StorageError::Message(format!(
				"invalid search scope '{other}'; expected core_reference|case_index|all"
			))),
		}
	}

	fn as_db_filter(self) -> Option<&'static str> {
		match self {
			Self::All => None,
			Self::CoreReference => Some("core_reference"),
			Self::CaseIndex => Some("case_index"),
		}
	}

	/// True when the caller passed an explicit tool scope (`core_reference` or
	/// `case_index`). QP routing must not override these.
	pub fn is_explicit(self) -> bool {
		matches!(self, Self::CoreReference | Self::CaseIndex)
	}
}

impl From<RoutedScope> for SearchScope {
	fn from(r: RoutedScope) -> Self {
		match r {
			RoutedScope::All => Self::All,
			RoutedScope::CoreReference => Self::CoreReference,
			RoutedScope::CaseIndex => Self::CaseIndex,
		}
	}
}

/// Tool/caller **explicit** scope wins; QP routing only when scope is `all`/omitted.
pub fn effective_scope(caller: SearchScope, qp_scope: RoutedScope) -> SearchScope {
	if caller.is_explicit() {
		caller
	} else {
		SearchScope::from(qp_scope)
	}
}

/// One hydrated hybrid search result.
#[derive(Debug, Clone)]
pub struct SearchHit {
	pub chunk_id: String,
	pub doc_id: String,
	pub text: String,
	pub fused_score: f64,
	pub bm25_rank: Option<u32>,
	pub vector_rank: Option<u32>,
	pub source_uri: Option<String>,
	pub page: Option<i64>,
	pub heading: Option<String>,
	pub char_start: Option<i64>,
	pub char_end: Option<i64>,
	pub section_title: Option<String>,
	pub breadcrumb_path: Option<String>,
	pub chunk_type: Option<String>,
	pub scope: String,
}

/// Run hybrid search over the open workspace (M3 + M4 QP + M5 CE).
///
/// Fail-closed if the embed model is missing (both legs required).
/// Degrades (no error) when the cross-encoder is missing.
///
/// 1. Rule-based [`query_processor::process_query`]
/// 2. For each sub-query: hybrid BM25+vector+RRF (sequential; session mutex)
/// 3. If multiple sub-queries: over-fetch 4× each, then fuse to retrieval_k
/// 4. CE rerank → `final_k` when loaded; else truncate hybrid pool to `final_k`
pub fn search(query: &str, final_k: u32, scope: SearchScope) -> Result<Vec<SearchHit>, StorageError> {
	if !embed::is_loaded() {
		return Err(StorageError::Message(embed::EmbedError::ModelMissing.to_string()));
	}
	let final_k = final_k as usize;
	if final_k == 0 || query.trim().is_empty() {
		return Ok(Vec::new());
	}

	// Document constants for reviewers.
	let _ = (BM25_K1, BM25_B, RRF_K, OVERFETCH_MULTIPLIER);

	let processed = query_processor::process_query(query);
	let sub_queries = &processed.sub_queries;
	// Void pattern: CE candidate pool = 4× finalK.
	let pool_k = rrf::retrieval_k(final_k);

	let candidates = if sub_queries.len() <= 1 {
		let sq = sub_queries.first();
		let q = sq.map(|s| s.query.as_str()).unwrap_or(query);
		let qp_scope = sq.map(|s| s.scope).unwrap_or(processed.suggested_scope);
		let eff = effective_scope(scope, qp_scope);
		workspace::with_session(|session| hybrid_search_one(session, q, pool_k, eff))?
	} else {
		// Complex multi-part: sequential sub-searches, then multi-list RRF → pool_k.
		let mut ranked_lists: Vec<Vec<String>> = Vec::with_capacity(sub_queries.len());
		let mut hit_by_id: std::collections::HashMap<String, SearchHit> =
			std::collections::HashMap::new();

		for sq in sub_queries {
			let eff = effective_scope(scope, sq.scope);
			let hits = workspace::with_session(|session| {
				hybrid_search_one(session, &sq.query, pool_k, eff)
			})?;
			let mut ranked = Vec::with_capacity(hits.len());
			for hit in hits {
				ranked.push(hit.chunk_id.clone());
				hit_by_id
					.entry(hit.chunk_id.clone())
					.and_modify(|existing| {
						if hit.fused_score > existing.fused_score {
							*existing = hit.clone();
						}
					})
					.or_insert(hit);
			}
			ranked_lists.push(ranked);
		}

		let fused = rrf::fuse_many_ranked_lists(&ranked_lists, pool_k, RRF_K);
		let mut out = Vec::with_capacity(fused.len());
		for f in fused {
			let Some(mut hit) = hit_by_id.remove(&f.chunk_id) else {
				continue;
			};
			hit.fused_score = f.fused_score;
			out.push(hit);
		}
		out
	};

	Ok(maybe_rerank(query, candidates, final_k))
}

/// Apply CE when loaded; otherwise truncate hybrid results to `final_k` (degrade).
///
/// CE inference errors also degrade (hybrid pool kept) — capability-gate soft path.
fn maybe_rerank(query: &str, mut candidates: Vec<SearchHit>, final_k: usize) -> Vec<SearchHit> {
	if final_k == 0 {
		return Vec::new();
	}
	if candidates.len() > final_k {
		// Only attempt CE when there is headroom beyond finalK.
		let docs: Vec<RerankDoc> = candidates
			.iter()
			.map(|h| RerankDoc {
				id: h.chunk_id.clone(),
				text: h.text.clone(),
				score: h.fused_score,
			})
			.collect();

		match rerank::try_rerank(query, &docs, final_k) {
			Some(Ok(ranked)) => {
				let by_id: std::collections::HashMap<&str, &SearchHit> = candidates
					.iter()
					.map(|h| (h.chunk_id.as_str(), h))
					.collect();
				let mut out = Vec::with_capacity(ranked.len());
				for r in ranked {
					if let Some(orig) = by_id.get(r.id.as_str()) {
						let mut hit = (*orig).clone();
						hit.fused_score = r.relevance_score;
						out.push(hit);
					}
				}
				return out;
			}
			Some(Err(_)) | None => {
				// Degrade: CE missing or inference failed → hybrid top-finalK.
			}
		}
	}

	if candidates.len() > final_k {
		candidates.truncate(final_k);
	}
	candidates
}

/// Single-query hybrid BM25 + vector + RRF (M3 core), using an open session.
///
/// `pool_k` is both the per-leg fetch depth and the RRF fuse depth (typically
/// `retrieval_k(finalK)` = 4× finalK for the M5 CE candidate pool). Keeping leg
/// depth == pool depth preserves M3 top-`finalK` ordering when CE is absent
/// (fuse-to-pool then truncate ≡ fuse-to-finalK over the same leg lists).
fn hybrid_search_one(
	session: &mut WorkspaceSession,
	query: &str,
	pool_k: usize,
	scope: SearchScope,
) -> Result<Vec<SearchHit>, StorageError> {
	if pool_k == 0 || query.trim().is_empty() {
		return Ok(Vec::new());
	}
	let retrieval_k = pool_k;
	let scope_filter = scope.as_db_filter();

	// --- Vector leg ---
	let q_vecs = embed::embed_batch(&[query.to_string()])
		.map_err(|e| StorageError::Message(e.to_string()))?;
	let q = q_vecs
		.into_iter()
		.next()
		.ok_or_else(|| StorageError::Message("embedBatch returned empty for query".into()))?;

	// Over-fetch extra for scope filtering on the vector leg.
	let vector_fetch = if scope_filter.is_some() {
		retrieval_k.saturating_mul(3).max(retrieval_k)
	} else {
		retrieval_k
	};
	let vector_raw = session
		.vectors
		.search(&q, vector_fetch)
		.map_err(|e| StorageError::Message(e.to_string()))?;
	let keys: Vec<u64> = vector_raw.iter().map(|(k, _)| *k).collect();
	let key_to_chunk = session.db.get_chunk_ids_for_vector_keys(&keys)?;
	let mut key_map: std::collections::HashMap<u64, String> = key_to_chunk.into_iter().collect();

	let mut vector_ranked: Vec<String> = Vec::with_capacity(retrieval_k);
	for (key, _dist) in &vector_raw {
		let Some(chunk_id) = key_map.remove(key) else {
			continue;
		};
		if let Some(want) = scope_filter {
			let Some(got) = session.db.get_scope_for_chunk(&chunk_id)? else {
				continue;
			};
			if got != want {
				continue;
			}
		}
		vector_ranked.push(chunk_id);
		if vector_ranked.len() >= retrieval_k {
			break;
		}
	}

	// --- BM25 leg ---
	let bm25_hits = session
		.text
		.search(query, retrieval_k, scope_filter)
		.map_err(|e| StorageError::Message(e.to_string()))?;
	let bm25_ranked: Vec<String> = bm25_hits.into_iter().map(|h| h.chunk_id).collect();

	// --- RRF → pool_k (CE candidate pool; caller trims/reranks to finalK) ---
	let fused: Vec<FusedHit> = rrf::fuse_rrf(&bm25_ranked, &vector_ranked, pool_k, RRF_K);

	// --- Hydrate ---
	let ids: Vec<String> = fused.iter().map(|h| h.chunk_id.clone()).collect();
	let rows = session.db.get_chunks_by_ids(&ids)?;
	let mut by_id: std::collections::HashMap<String, ChunkRow> =
		rows.into_iter().map(|r| (r.chunk_id.clone(), r)).collect();
	let scopes = session.db.get_scopes_for_chunks(&ids)?;

	let mut out = Vec::with_capacity(fused.len());
	for hit in fused {
		let Some(row) = by_id.remove(&hit.chunk_id) else {
			continue;
		};
		let scope_val = scopes
			.get(&hit.chunk_id)
			.cloned()
			.unwrap_or_default();
		out.push(SearchHit {
			chunk_id: row.chunk_id,
			doc_id: row.doc_id,
			text: row.text,
			fused_score: hit.fused_score,
			bm25_rank: hit.bm25_rank,
			vector_rank: hit.vector_rank,
			source_uri: row.source_uri,
			page: row.page,
			heading: row.heading,
			char_start: row.char_start,
			char_end: row.char_end,
			section_title: row.section_title,
			breadcrumb_path: row.breadcrumb_path,
			chunk_type: row.chunk_type,
			scope: scope_val,
		});
	}
	Ok(out)
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn explicit_scope_overrides_qp_routing() {
		assert_eq!(
			effective_scope(SearchScope::CaseIndex, RoutedScope::CoreReference),
			SearchScope::CaseIndex
		);
		assert_eq!(
			effective_scope(SearchScope::CoreReference, RoutedScope::CaseIndex),
			SearchScope::CoreReference
		);
		assert_eq!(
			effective_scope(SearchScope::All, RoutedScope::CoreReference),
			SearchScope::CoreReference
		);
		assert_eq!(
			effective_scope(SearchScope::All, RoutedScope::CaseIndex),
			SearchScope::CaseIndex
		);
		assert_eq!(
			effective_scope(SearchScope::All, RoutedScope::All),
			SearchScope::All
		);
	}

	#[test]
	fn maybe_rerank_degrades_without_ce() {
		rerank::clear_reranker();
		let hits = vec![
			SearchHit {
				chunk_id: "a".into(),
				doc_id: "d".into(),
				text: "first".into(),
				fused_score: 0.5,
				bm25_rank: Some(0),
				vector_rank: None,
				source_uri: None,
				page: None,
				heading: None,
				char_start: None,
				char_end: None,
				section_title: None,
				breadcrumb_path: None,
				chunk_type: None,
				scope: "case_index".into(),
			},
			SearchHit {
				chunk_id: "b".into(),
				doc_id: "d".into(),
				text: "second".into(),
				fused_score: 0.4,
				bm25_rank: Some(1),
				vector_rank: None,
				source_uri: None,
				page: None,
				heading: None,
				char_start: None,
				char_end: None,
				section_title: None,
				breadcrumb_path: None,
				chunk_type: None,
				scope: "case_index".into(),
			},
			SearchHit {
				chunk_id: "c".into(),
				doc_id: "d".into(),
				text: "third".into(),
				fused_score: 0.3,
				bm25_rank: Some(2),
				vector_rank: None,
				source_uri: None,
				page: None,
				heading: None,
				char_start: None,
				char_end: None,
				section_title: None,
				breadcrumb_path: None,
				chunk_type: None,
				scope: "case_index".into(),
			},
		];
		let out = maybe_rerank("q", hits, 2);
		assert_eq!(out.len(), 2);
		assert_eq!(out[0].chunk_id, "a");
		assert_eq!(out[1].chunk_id, "b");
	}
}
