// Copyright (c) Safe Appeals. All rights reserved.

//! usearch HNSW index wrapper with save/load under the workspace root.

use std::path::{Path, PathBuf};
use std::time::SystemTime;

use thiserror::Error;
use usearch::{Index, IndexOptions, MetricKind, ScalarKind};

/// Filename under the workspace root (plaintext work file until M6 seals).
pub const VECTOR_FILENAME: &str = "vectors.usearch";

#[derive(Debug, Error)]
pub enum VectorError {
	#[error("usearch error: {0}")]
	Usearch(String),
	#[error("vector dimension mismatch: expected {expected}, got {got}")]
	DimMismatch { expected: usize, got: usize },
	#[error("I/O error: {0}")]
	Io(#[from] std::io::Error),
	#[error("{0}")]
	Message(String),
}

/// HNSW vector index persisted at `{root}/vectors.usearch`.
pub struct VectorIndex {
	index: Index,
	path: PathBuf,
	dims: usize,
	loaded_mtime: Option<SystemTime>,
}

impl std::fmt::Debug for VectorIndex {
	fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
		f.debug_struct("VectorIndex")
			.field("path", &self.path)
			.field("dims", &self.dims)
			.field("size", &self.index.size())
			.finish_non_exhaustive()
	}
}

impl VectorIndex {
	/// Open existing index or create empty at `{root_dir}/vectors.usearch`.
	pub fn open(root_dir: impl AsRef<Path>, dims: usize) -> Result<Self, VectorError> {
		let path = root_dir.as_ref().join(VECTOR_FILENAME);
		if path.exists() {
			Self::restore_from_path(path, dims)
		} else {
			Self::create_empty(path, dims)
		}
	}

	/// Open an existing index read-only (restore only; never creates on disk).
	pub fn open_read_only(root_dir: impl AsRef<Path>, dims: usize) -> Result<Self, VectorError> {
		let path = root_dir.as_ref().join(VECTOR_FILENAME);
		if path.exists() {
			Self::restore_from_path(path, dims)
		} else {
			Err(VectorError::Message(
				"vector index does not exist (read-only)".into(),
			))
		}
	}

	fn restore_from_path(path: PathBuf, dims: usize) -> Result<Self, VectorError> {
		let index = Index::restore(path.to_str().ok_or_else(|| {
			VectorError::Message("vector index path is not valid UTF-8".into())
		})?)
		.map_err(|e| VectorError::Usearch(e.to_string()))?;
		let restored_dims = index.dimensions();
		if restored_dims != dims {
			return Err(VectorError::DimMismatch {
				expected: dims,
				got: restored_dims,
			});
		}
		Ok(Self {
			index,
			path: path.clone(),
			dims,
			loaded_mtime: file_mtime(&path),
		})
	}

	fn create_empty(path: PathBuf, dims: usize) -> Result<Self, VectorError> {
		let mut options = IndexOptions::default();
		options.dimensions = dims;
		options.metric = MetricKind::Cos;
		options.quantization = ScalarKind::F32;
		let index =
			Index::new(&options).map_err(|e| VectorError::Usearch(e.to_string()))?;
		index
			.reserve(256)
			.map_err(|e| VectorError::Usearch(e.to_string()))?;
		Ok(Self {
			index,
			path,
			dims,
			loaded_mtime: None,
		})
	}

	pub fn path(&self) -> &Path {
		&self.path
	}

	pub fn dims(&self) -> usize {
		self.dims
	}

	pub fn len(&self) -> usize {
		self.index.size()
	}

	pub fn is_empty(&self) -> bool {
		self.len() == 0
	}

	/// Add or replace a vector under `key`.
	pub fn upsert(&mut self, key: u64, vector: &[f32]) -> Result<(), VectorError> {
		if vector.len() != self.dims {
			return Err(VectorError::DimMismatch {
				expected: self.dims,
				got: vector.len(),
			});
		}
		if self.index.contains(key) {
			let _ = self.index.remove(key);
		}
		let need = self.index.size() + 1;
		if self.index.capacity() < need {
			self.index
				.reserve(need.max(256))
				.map_err(|e| VectorError::Usearch(e.to_string()))?;
		}
		self.index
			.add(key, vector)
			.map_err(|e| VectorError::Usearch(e.to_string()))?;
		Ok(())
	}

	pub fn remove(&mut self, key: u64) -> Result<usize, VectorError> {
		self.index
			.remove(key)
			.map_err(|e| VectorError::Usearch(e.to_string()))
	}

	/// Reload vectors from disk so secondary processes see primary saves.
	pub fn reload_from_disk(&mut self) -> Result<(), VectorError> {
		if !self.path.exists() {
			self.loaded_mtime = None;
			return Ok(());
		}
		let index = Index::restore(self.path.to_str().ok_or_else(|| {
			VectorError::Message("vector index path is not valid UTF-8".into())
		})?)
		.map_err(|e| VectorError::Usearch(e.to_string()))?;
		let restored_dims = index.dimensions();
		if restored_dims != self.dims {
			return Err(VectorError::DimMismatch {
				expected: self.dims,
				got: restored_dims,
			});
		}
		self.index = index;
		self.loaded_mtime = file_mtime(&self.path);
		Ok(())
	}

	/// Reload from disk when the on-disk file is newer than the in-memory copy.
	pub fn reload_if_stale(&mut self) -> Result<(), VectorError> {
		let disk_mtime = file_mtime(&self.path);
		if disk_mtime != self.loaded_mtime {
			self.reload_from_disk()?;
		}
		Ok(())
	}

	pub fn search(&self, query: &[f32], k: usize) -> Result<Vec<(u64, f32)>, VectorError> {
		if query.len() != self.dims {
			return Err(VectorError::DimMismatch {
				expected: self.dims,
				got: query.len(),
			});
		}
		let matches = self
			.index
			.search(query, k)
			.map_err(|e| VectorError::Usearch(e.to_string()))?;
		Ok(matches
			.keys
			.into_iter()
			.zip(matches.distances.into_iter())
			.collect())
	}

	/// Persist to `{root}/vectors.usearch` (atomic via temp + rename when possible).
	pub fn save(&self) -> Result<(), VectorError> {
		let path_str = self
			.path
			.to_str()
			.ok_or_else(|| VectorError::Message("vector index path is not valid UTF-8".into()))?;
		let tmp = self.path.with_extension("usearch.tmp");
		let tmp_str = tmp
			.to_str()
			.ok_or_else(|| VectorError::Message("temp vector path is not valid UTF-8".into()))?;
		self.index
			.save(tmp_str)
			.map_err(|e| VectorError::Usearch(e.to_string()))?;
		std::fs::rename(&tmp, &self.path).or_else(|_| {
			std::fs::copy(&tmp, &self.path)?;
			std::fs::remove_file(&tmp)?;
			Ok::<(), std::io::Error>(())
		})?;
		let _ = path_str;
		Ok(())
	}
}

fn file_mtime(path: &Path) -> Option<SystemTime> {
	std::fs::metadata(path).ok()?.modified().ok()
}

#[cfg(test)]
mod tests {
	use super::*;
	use tempfile::tempdir;

	#[test]
	fn save_load_round_trip() {
		let dir = tempdir().unwrap();
		let mut idx = VectorIndex::open(dir.path(), 8).unwrap();
		let v1 = vec![1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
		let v2 = vec![0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
		idx.upsert(1, &v1).unwrap();
		idx.upsert(2, &v2).unwrap();
		idx.save().unwrap();
		assert!(dir.path().join(VECTOR_FILENAME).exists());

		let idx2 = VectorIndex::open(dir.path(), 8).unwrap();
		assert_eq!(idx2.len(), 2);
		let hits = idx2.search(&v1, 1).unwrap();
		assert_eq!(hits[0].0, 1);
	}

	#[test]
	fn remove_key() {
		let dir = tempdir().unwrap();
		let mut idx = VectorIndex::open(dir.path(), 4).unwrap();
		idx.upsert(10, &[1.0, 0.0, 0.0, 0.0]).unwrap();
		assert_eq!(idx.remove(10).unwrap(), 1);
		assert_eq!(idx.len(), 0);
	}

	#[test]
	fn open_read_only_restore_only() {
		let dir = tempdir().unwrap();
		let mut idx = VectorIndex::open(dir.path(), 4).unwrap();
		idx.upsert(1, &[1.0, 0.0, 0.0, 0.0]).unwrap();
		idx.save().unwrap();

		let ro = VectorIndex::open_read_only(dir.path(), 4).unwrap();
		assert_eq!(ro.len(), 1);

		let missing = VectorIndex::open_read_only(tempdir().unwrap().path(), 4);
		assert!(missing.is_err());
	}
}
