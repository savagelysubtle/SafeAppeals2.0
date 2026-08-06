// Copyright (c) Safe Appeals. All rights reserved.

//! Citation-aware hierarchical chunker (M2).
//!
//! Multi-granularity: **child** (~300 tokens) for precise retrieval + **parent**
//! (≤ embed window − margin, default **480** for BGE-small 512-token window) for context.
//! Void used 800-token parents; that blows the BGE window — we bind to the embedder.

mod hierarchical;

pub use hierarchical::{
	chunk_document, ChunkDocumentInput, ChunkOutput, ChunkerConfig, Citation, EMBED_WINDOW_TOKENS,
	DEFAULT_CHILD_TOKENS, DEFAULT_OVERLAP_PERCENT, DEFAULT_PARENT_TOKENS, DEFAULT_WINDOW_MARGIN,
};

/// Rough token estimate (~4 chars/token), matching Void’s estimator.
pub fn estimate_tokens(text: &str) -> usize {
	text.chars().count().div_ceil(4).max(if text.is_empty() { 0 } else { 1 })
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn estimate_tokens_empty() {
		assert_eq!(estimate_tokens(""), 0);
	}

	#[test]
	fn estimate_tokens_short() {
		assert_eq!(estimate_tokens("abcd"), 1);
		assert_eq!(estimate_tokens("abcdefgh"), 2);
	}
}
