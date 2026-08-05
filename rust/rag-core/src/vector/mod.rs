// Copyright (c) Safe Appeals. All rights reserved.

//! usearch HNSW vector index persistence (M2).
//!
//! On-disk path: `{workspace_root}/vectors.usearch`.
//! M6 will seal this file when the workspace is cold; M2 writes a work file under root.

mod index;

pub use index::{VectorError, VectorIndex, VECTOR_FILENAME};
