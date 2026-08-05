// Copyright (c) Safe Appeals. All rights reserved.

//! Tantivy BM25 text index (M3).
//!
//! On-disk path: `{workspace_root}/text.tantivy`.
//! Plaintext work file while the workspace is open; M6 seals when cold.

mod index;

pub use index::{
	TextError, TextIndex, TEXT_INDEX_DIRNAME, BM25_B, BM25_K1,
};
