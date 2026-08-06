// Copyright (c) Safe Appeals. All rights reserved.

//! `indexChunks` / `removeDoc` orchestration (SQLCipher + usearch + tantivy).

use crate::embed;
use crate::storage::{workspace, ChunkRow, DocumentRow, StorageError, IndexWriteRole};

fn assert_primary(session: &workspace::WorkspaceSession) -> Result<(), StorageError> {
	if session.role != IndexWriteRole::Primary {
		return Err(StorageError::Message("secondary session".into()));
	}
	Ok(())
}

/// Index (or replace) a document and its chunks; embed + upsert into usearch + tantivy.
///
/// Indexes **all** chunks passed (parents + children) — same as M2.
pub fn index_chunks(doc: &DocumentRow, chunks: &[ChunkRow]) -> Result<u32, StorageError> {
	workspace::with_session(|session| {
		assert_primary(session)?;
		// Collect stale vector keys before SQL CASCADE clears vector_keys.
		let old_ids: Vec<String> = session
			.db
			.get_chunks_for_doc(&doc.id)?
			.into_iter()
			.map(|c| c.chunk_id)
			.collect();
		let stale_keys = session.db.get_vector_keys_for_chunks(&old_ids)?;
		for (_id, key) in &stale_keys {
			let _ = session.vectors.remove(*key);
		}
		if !old_ids.is_empty() {
			session
				.text
				.remove_chunks(&old_ids)
				.map_err(|e| StorageError::Message(e.to_string()))?;
		}

		session.db.replace_document_with_chunks(doc, chunks)?;

		let texts: Vec<String> = chunks.iter().map(|c| c.text.clone()).collect();
		let embeddings =
			embed::embed_batch(&texts).map_err(|e| StorageError::Message(e.to_string()))?;
		if embeddings.len() != chunks.len() {
			return Err(StorageError::Message(format!(
				"embedBatch returned {} vectors for {} chunks",
				embeddings.len(),
				chunks.len()
			)));
		}

		for (chunk, vector) in chunks.iter().zip(embeddings.iter()) {
			let key = session.db.alloc_vector_key()?;
			session
				.vectors
				.upsert(key, vector)
				.map_err(|e| StorageError::Message(e.to_string()))?;
			session.db.set_vector_key(&chunk.chunk_id, key)?;
		}

		let text_rows: Vec<(String, String, String, String)> = chunks
			.iter()
			.map(|c| {
				(
					c.chunk_id.clone(),
					doc.id.clone(),
					doc.scope.clone(),
					c.text.clone(),
				)
			})
			.collect();
		session
			.text
			.upsert_chunks(&text_rows)
			.map_err(|e| StorageError::Message(e.to_string()))?;
		session
			.text
			.commit()
			.map_err(|e| StorageError::Message(e.to_string()))?;

		session
			.vectors
			.save()
			.map_err(|e| StorageError::Message(e.to_string()))?;

		Ok(chunks.len() as u32)
	})
}

/// Remove a document, its chunks, vectors, and BM25 docs.
pub fn remove_doc(doc_id: &str) -> Result<u32, StorageError> {
	workspace::with_session(|session| {
		assert_primary(session)?;
		let chunk_ids = session
			.db
			.get_chunks_for_doc(doc_id)?
			.into_iter()
			.map(|c| c.chunk_id)
			.collect::<Vec<_>>();
		let keys = session.db.get_vector_keys_for_chunks(&chunk_ids)?;
		for (_id, key) in &keys {
			let _ = session.vectors.remove(*key);
		}
		if !chunk_ids.is_empty() {
			session
				.text
				.remove_chunks(&chunk_ids)
				.map_err(|e| StorageError::Message(e.to_string()))?;
			session
				.text
				.commit()
				.map_err(|e| StorageError::Message(e.to_string()))?;
		}
		let removed = session.db.delete_document(doc_id)?;
		session
			.vectors
			.save()
			.map_err(|e| StorageError::Message(e.to_string()))?;
		Ok(removed.len() as u32)
	})
}
