// Copyright (c) Safe Appeals. All rights reserved.

//! Hierarchical section → parent/child chunking with citation anchors.
//!
//! Budgets and truncation use **Unicode scalar (char) counts**, matching
//! [`estimate_tokens`](super::estimate_tokens) (~4 chars/token). Never slice
//! with raw byte indices.

use regex::Regex;

use super::estimate_tokens;

/// BGE-small-en-v1.5 max sequence length.
pub const EMBED_WINDOW_TOKENS: usize = 512;
/// Margin reserved so chunks never sit on the hard window edge.
pub const DEFAULT_WINDOW_MARGIN: usize = 32;
/// Child chunk target (precise retrieval).
pub const DEFAULT_CHILD_TOKENS: usize = 300;
/// Parent chunk target — must be ≤ embed window − margin (~480).
pub const DEFAULT_PARENT_TOKENS: usize = 480;
/// Sentence-window overlap percent for child chunks.
pub const DEFAULT_OVERLAP_PERCENT: usize = 15;

/// Chunker knobs (all token budgets are hard-capped to the embed window).
#[derive(Debug, Clone)]
pub struct ChunkerConfig {
	pub child_tokens: usize,
	pub parent_tokens: usize,
	pub overlap_percent: usize,
	pub embed_window: usize,
	pub window_margin: usize,
}

impl Default for ChunkerConfig {
	fn default() -> Self {
		Self {
			child_tokens: DEFAULT_CHILD_TOKENS,
			parent_tokens: DEFAULT_PARENT_TOKENS,
			overlap_percent: DEFAULT_OVERLAP_PERCENT,
			embed_window: EMBED_WINDOW_TOKENS,
			window_margin: DEFAULT_WINDOW_MARGIN,
		}
	}
}

impl ChunkerConfig {
	fn max_embed_tokens(&self) -> usize {
		self.embed_window.saturating_sub(self.window_margin)
	}

	fn capped_parent_tokens(&self) -> usize {
		self.parent_tokens.min(self.max_embed_tokens())
	}

	fn capped_child_tokens(&self) -> usize {
		self.child_tokens.min(self.max_embed_tokens())
	}

	/// Char budget for a token budget (`estimate_tokens` ≈ chars/4).
	fn chars_for_tokens(tokens: usize) -> usize {
		tokens.saturating_mul(4)
	}
}

/// Citation contract for every chunk / contextPack item.
///
/// `char_start` / `char_end` are Unicode scalar offsets into the source text.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Citation {
	pub source_uri: String,
	pub page: Option<i64>,
	pub heading: Option<String>,
	pub char_start: Option<i64>,
	pub char_end: Option<i64>,
}

/// Input for hierarchical chunking.
#[derive(Debug, Clone)]
pub struct ChunkDocumentInput {
	pub doc_id: String,
	pub text: String,
	pub source_uri: String,
	/// Optional page number for the whole document (PDF).
	pub page: Option<i64>,
	pub config: ChunkerConfig,
}

/// One produced chunk (parent or child).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChunkOutput {
	pub chunk_id: String,
	pub doc_id: String,
	pub text: String,
	pub chunk_index: i64,
	pub token_count: i64,
	pub parent_chunk_id: Option<String>,
	pub chunk_type: String,
	pub section_id: Option<String>,
	pub section_number: Option<String>,
	pub section_title: Option<String>,
	pub breadcrumb_path: Option<String>,
	pub citation: Citation,
}

#[derive(Debug, Clone)]
struct Section {
	id: String,
	number: String,
	title: String,
	level: usize,
	/// Byte offset in the source (regex match); converted to char offsets on emit.
	start_byte: usize,
	end_byte: usize,
	text: String,
	parent_id: Option<String>,
}

/// Chunk `input.text` into parent/child chunks with citation anchors.
///
/// Parent token budget is clamped to `embed_window − margin` (never 800 for BGE).
pub fn chunk_document(input: &ChunkDocumentInput) -> Vec<ChunkOutput> {
	let cfg = &input.config;
	let sections = parse_sections(&input.text, &input.doc_id);
	if sections.is_empty() {
		return chunk_flat(
			&input.text,
			&input.doc_id,
			&input.source_uri,
			input.page,
			cfg,
		);
	}

	let breadcrumbs = build_breadcrumbs(&sections);
	let mut all = Vec::new();
	let mut counter: usize = 0;

	for section in &sections {
		let crumb = breadcrumbs
			.get(&section.id)
			.cloned()
			.unwrap_or_else(|| section.title.clone());
		let abs_char_base = byte_to_char_offset(&input.text, section.start_byte);

		let mut children = create_child_chunks(
			&section.text,
			&input.doc_id,
			section,
			&crumb,
			&input.source_uri,
			input.page,
			cfg,
			counter,
			abs_char_base,
		);
		counter += children.len();

		if let Some(parent) = create_parent_chunk(
			&section.text,
			&input.doc_id,
			section,
			&crumb,
			&input.source_uri,
			input.page,
			cfg,
			counter,
			abs_char_base,
		) {
			let parent_id = parent.chunk_id.clone();
			all.push(parent);
			counter += 1;
			for child in &mut children {
				child.parent_chunk_id = Some(parent_id.clone());
			}
		}

		all.extend(children);
	}

	for (i, chunk) in all.iter_mut().enumerate() {
		chunk.chunk_index = i as i64;
	}
	all
}

/// Prefix of `text` with at most `max_chars` Unicode scalars (never mid-codepoint).
fn truncate_to_chars(text: &str, max_chars: usize) -> &str {
	if max_chars == 0 {
		return "";
	}
	match text.char_indices().nth(max_chars) {
		Some((byte_idx, _)) => &text[..byte_idx],
		None => text,
	}
}

/// Character (Unicode scalar) count.
fn char_len(text: &str) -> usize {
	text.chars().count()
}

/// Convert a byte offset (on a char boundary) into a char offset.
fn byte_to_char_offset(text: &str, byte_idx: usize) -> usize {
	let byte_idx = byte_idx.min(text.len());
	let boundary = text.floor_char_boundary(byte_idx);
	text[..boundary].chars().count()
}

/// Last `overlap_chars` Unicode scalars of `text`.
fn overlap_text(text: &str, overlap_chars: usize) -> String {
	let total = char_len(text);
	if total <= overlap_chars {
		return text.to_string();
	}
	text.chars().skip(total - overlap_chars).collect()
}

fn parse_sections(text: &str, doc_id: &str) -> Vec<Section> {
	let patterns: Vec<(Regex, &str)> = [
		(r"(?m)^((?:\d+\.?)+)\s+([A-Z][^\n]+)", "numbered"),
		(r"(?m)^([A-Z]\.)\s+([A-Z][^\n]+)", "lettered"),
		(r"(?mi)^\s*Chapter\s+(\d+)[:\s]+([^\n]+)", "chapter"),
		(r"(?mi)^\s*Section\s+([\d.]+)[:\s]+([^\n]+)", "section"),
		(r"(?mi)^\s*Article\s+([IVX\d]+)[:\s]+([^\n]+)", "article"),
		(r"(?mi)^\s*Rule\s+(\d+)[:\s]+([^\n]+)", "rule"),
		(r"(?mi)^\s*Appendix\s+([A-Z\d]+)[:\s]*([^\n]*)", "appendix"),
		(r"(?m)^(#{1,6})\s+(.+)$", "markdown"),
	]
	.into_iter()
	.filter_map(|(pat, kind)| Regex::new(pat).ok().map(|re| (re, kind)))
	.collect();

	let mut sections = Vec::new();
	for (re, kind) in &patterns {
		for caps in re.captures_iter(text) {
			let full = caps.get(0).unwrap();
			let (number, title, level) = if *kind == "markdown" {
				let hashes = caps.get(1).map(|m| m.as_str()).unwrap_or("#");
				let title = caps
					.get(2)
					.map(|m| m.as_str().trim().to_string())
					.unwrap_or_else(|| "Untitled".into());
				(hashes.to_string(), title, hashes.len())
			} else {
				let number = caps
					.get(1)
					.map(|m| m.as_str().trim().to_string())
					.unwrap_or_default();
				let title = caps
					.get(2)
					.map(|m| m.as_str().trim().to_string())
					.filter(|s| !s.is_empty())
					.unwrap_or_else(|| "Untitled".into());
				let level = if *kind == "numbered" {
					number.split('.').filter(|n| !n.is_empty()).count().max(1)
				} else {
					1
				};
				(number, title, level)
			};

			let id = format!(
				"{doc_id}_{kind}_{}",
				number.replace('.', "_").replace('#', "h")
			);
			sections.push(Section {
				id,
				number,
				title,
				level,
				start_byte: full.start(),
				end_byte: 0,
				text: String::new(),
				parent_id: None,
			});
		}
	}

	sections.sort_by_key(|s| s.start_byte);
	sections.dedup_by(|a, b| a.start_byte == b.start_byte);

	let n = sections.len();
	for i in 0..n {
		let end = if i + 1 < n {
			sections[i + 1].start_byte
		} else {
			text.len()
		};
		sections[i].end_byte = end;
		// Regex match starts/ends are on char boundaries.
		sections[i].text = text[sections[i].start_byte..end].trim().to_string();

		for j in (0..i).rev() {
			if sections[j].level < sections[i].level {
				sections[i].parent_id = Some(sections[j].id.clone());
				break;
			}
		}
	}

	sections.retain(|s| !s.text.is_empty());
	sections
}

fn build_breadcrumbs(sections: &[Section]) -> std::collections::HashMap<String, String> {
	let by_id: std::collections::HashMap<&str, &Section> =
		sections.iter().map(|s| (s.id.as_str(), s)).collect();
	let mut out = std::collections::HashMap::new();
	for section in sections {
		let mut path = Vec::new();
		let mut current = Some(section);
		while let Some(s) = current {
			path.push(s.title.as_str());
			current = s
				.parent_id
				.as_deref()
				.and_then(|id| by_id.get(id).copied());
		}
		path.reverse();
		out.insert(section.id.clone(), path.join(" > "));
	}
	out
}

fn create_child_chunks(
	text: &str,
	doc_id: &str,
	section: &Section,
	breadcrumb: &str,
	source_uri: &str,
	page: Option<i64>,
	cfg: &ChunkerConfig,
	starting_index: usize,
	abs_char_base: usize,
) -> Vec<ChunkOutput> {
	let target_chars = ChunkerConfig::chars_for_tokens(cfg.capped_child_tokens());
	let overlap_chars = target_chars * cfg.overlap_percent / 100;
	let sentences = split_sentences(text);
	let mut chunks = Vec::new();
	let mut current = String::new();
	let mut current_char_start = 0usize;
	let mut cursor_byte = 0usize;
	let mut chunk_i = 0usize;

	for sentence in sentences {
		let sentence_byte_start = text[cursor_byte..]
			.find(sentence.as_str())
			.map(|o| cursor_byte + o)
			.unwrap_or(cursor_byte);
		cursor_byte = sentence_byte_start + sentence.len();
		let sentence_char_start = byte_to_char_offset(text, sentence_byte_start);

		let next_len = if current.is_empty() {
			char_len(&sentence)
		} else {
			char_len(&current) + 1 + char_len(&sentence)
		};

		if !current.is_empty() && next_len > target_chars {
			let trimmed = current.trim();
			let abs_start = abs_char_base + current_char_start;
			let abs_end = abs_start + char_len(trimmed);
			chunks.push(make_chunk(
				doc_id,
				starting_index + chunk_i,
				trimmed,
				"child",
				None,
				section,
				breadcrumb,
				source_uri,
				page,
				Some(abs_start as i64),
				Some(abs_end as i64),
			));
			chunk_i += 1;
			let overlap = overlap_text(&current, overlap_chars);
			let overlap_n = char_len(&overlap);
			current_char_start = (abs_end - abs_char_base).saturating_sub(overlap_n);
			current = if overlap.is_empty() {
				sentence
			} else {
				format!("{overlap} {sentence}")
			};
		} else {
			if current.is_empty() {
				current_char_start = sentence_char_start;
			}
			if current.is_empty() {
				current = sentence;
			} else {
				current.push(' ');
				current.push_str(&sentence);
			}
		}
	}

	if !current.trim().is_empty() {
		let trimmed = current.trim();
		let abs_start = abs_char_base + current_char_start;
		let abs_end = abs_start + char_len(trimmed);
		chunks.push(make_chunk(
			doc_id,
			starting_index + chunk_i,
			trimmed,
			"child",
			None,
			section,
			breadcrumb,
			source_uri,
			page,
			Some(abs_start as i64),
			Some(abs_end as i64),
		));
	}

	for chunk in &mut chunks {
		enforce_token_cap(chunk, cfg.max_embed_tokens());
	}
	chunks
}

fn create_parent_chunk(
	text: &str,
	doc_id: &str,
	section: &Section,
	breadcrumb: &str,
	source_uri: &str,
	page: Option<i64>,
	cfg: &ChunkerConfig,
	global_index: usize,
	abs_char_base: usize,
) -> Option<ChunkOutput> {
	let parent_tokens = cfg.capped_parent_tokens();
	let target_chars = ChunkerConfig::chars_for_tokens(parent_tokens);
	let text_chars = char_len(text);
	if text_chars < target_chars / 2 {
		return None;
	}
	// Leave room for ellipsis so estimate_tokens stays ≤ parent_tokens.
	let truncated = if text_chars > target_chars {
		let keep = target_chars.saturating_sub(3);
		format!("{}...", truncate_to_chars(text, keep))
	} else {
		text.to_string()
	};
	let trimmed = truncated.trim();
	let mut chunk = make_chunk(
		doc_id,
		global_index,
		trimmed,
		"parent",
		None,
		section,
		breadcrumb,
		source_uri,
		page,
		Some(abs_char_base as i64),
		Some((abs_char_base + char_len(trimmed)) as i64),
	);
	enforce_token_cap(&mut chunk, parent_tokens);
	Some(chunk)
}

fn chunk_flat(
	text: &str,
	doc_id: &str,
	source_uri: &str,
	page: Option<i64>,
	cfg: &ChunkerConfig,
) -> Vec<ChunkOutput> {
	let synthetic = Section {
		id: format!("{doc_id}_body"),
		number: String::new(),
		title: "Body".into(),
		level: 1,
		start_byte: 0,
		end_byte: text.len(),
		text: text.to_string(),
		parent_id: None,
	};
	let mut children = create_child_chunks(
		text,
		doc_id,
		&synthetic,
		"Body",
		source_uri,
		page,
		cfg,
		0,
		0,
	);
	let mut counter = children.len();
	let mut all = Vec::new();
	if let Some(parent) = create_parent_chunk(
		text,
		doc_id,
		&synthetic,
		"Body",
		source_uri,
		page,
		cfg,
		counter,
		0,
	) {
		let pid = parent.chunk_id.clone();
		all.push(parent);
		counter += 1;
		let _ = counter;
		for c in &mut children {
			c.parent_chunk_id = Some(pid.clone());
		}
	}
	all.extend(children);
	for (i, chunk) in all.iter_mut().enumerate() {
		chunk.chunk_index = i as i64;
	}
	all
}

fn make_chunk(
	doc_id: &str,
	index: usize,
	text: &str,
	chunk_type: &str,
	parent_chunk_id: Option<String>,
	section: &Section,
	breadcrumb: &str,
	source_uri: &str,
	page: Option<i64>,
	char_start: Option<i64>,
	char_end: Option<i64>,
) -> ChunkOutput {
	ChunkOutput {
		chunk_id: format!("{doc_id}_chunk_{index}"),
		doc_id: doc_id.to_string(),
		text: text.to_string(),
		chunk_index: 0,
		token_count: estimate_tokens(text) as i64,
		parent_chunk_id,
		chunk_type: chunk_type.to_string(),
		section_id: Some(section.id.clone()),
		section_number: if section.number.is_empty() {
			None
		} else {
			Some(section.number.clone())
		},
		section_title: Some(section.title.clone()),
		breadcrumb_path: Some(breadcrumb.to_string()),
		citation: Citation {
			source_uri: source_uri.to_string(),
			page,
			heading: Some(section.title.clone()),
			char_start,
			char_end,
		},
	}
}

fn enforce_token_cap(chunk: &mut ChunkOutput, max_tokens: usize) {
	if estimate_tokens(&chunk.text) <= max_tokens {
		return;
	}
	let max_chars = ChunkerConfig::chars_for_tokens(max_tokens);
	if char_len(&chunk.text) > max_chars {
		let keep = max_chars.saturating_sub(3);
		chunk.text = format!("{}...", truncate_to_chars(&chunk.text, keep));
		chunk.token_count = estimate_tokens(&chunk.text) as i64;
		if let Some(start) = chunk.citation.char_start {
			chunk.citation.char_end = Some(start + char_len(&chunk.text) as i64);
		}
	}
}

fn split_sentences(text: &str) -> Vec<String> {
	let re = Regex::new(r"[^.!?]+[.!?]+|\S[^.!?]*$").unwrap();
	let mut out: Vec<String> = re
		.find_iter(text)
		.map(|m| m.as_str().trim().to_string())
		.filter(|s| !s.is_empty())
		.collect();
	if out.is_empty() && !text.trim().is_empty() {
		out.push(text.trim().to_string());
	}
	out
}

#[cfg(test)]
mod tests {
	use super::*;

	fn sample_legal() -> String {
		[
			"1. Facts",
			"The claimant filed an appeal on January 1. The board issued a notice.",
			"Evidence includes medical records spanning three years of treatment history and wage statements.",
			"2. Argument",
			"Counsel argues the decision ignored material evidence. The record shows ongoing disability.",
			"Additional facts support a remand for further development of the vocational evidence.",
		]
		.join("\n")
	}

	#[test]
	fn parent_tokens_never_exceed_embed_window_minus_margin() {
		let cfg = ChunkerConfig {
			parent_tokens: 800,
			..Default::default()
		};
		assert_eq!(cfg.capped_parent_tokens(), 480);
		assert!(cfg.capped_parent_tokens() <= EMBED_WINDOW_TOKENS - DEFAULT_WINDOW_MARGIN);
	}

	#[test]
	fn hierarchical_chunks_have_citations_and_types() {
		let text = sample_legal();
		let text = format!(
			"{}\n{}",
			text,
			"Additional supporting narrative. ".repeat(40)
		);
		let chunks = chunk_document(&ChunkDocumentInput {
			doc_id: "doc1".into(),
			text,
			source_uri: "file:///cases/a/brief.md".into(),
			page: Some(1),
			config: ChunkerConfig::default(),
		});
		assert!(!chunks.is_empty());
		assert!(chunks.iter().any(|c| c.chunk_type == "child"));
		for c in &chunks {
			assert_eq!(c.citation.source_uri, "file:///cases/a/brief.md");
			assert_eq!(c.citation.page, Some(1));
			assert!(c.citation.heading.is_some());
			assert!(c.token_count as usize <= EMBED_WINDOW_TOKENS - DEFAULT_WINDOW_MARGIN);
		}
	}

	#[test]
	fn markdown_headings_parse() {
		let text = "# Introduction\n\nHello world. More text here for the section body.\n\n## Details\n\nNested content with several sentences. Another sentence follows.";
		let chunks = chunk_document(&ChunkDocumentInput {
			doc_id: "md1".into(),
			text: text.into(),
			source_uri: "file:///doc.md".into(),
			page: None,
			config: ChunkerConfig::default(),
		});
		assert!(chunks.iter().any(|c| {
			c.section_title
				.as_deref()
				.is_some_and(|t| t == "Introduction" || t == "Details")
		}));
	}

	#[test]
	fn golden_flat_fallback_respects_cap() {
		let long = "Word ".repeat(2000);
		let chunks = chunk_document(&ChunkDocumentInput {
			doc_id: "flat".into(),
			text: long,
			source_uri: "file:///flat.txt".into(),
			page: None,
			config: ChunkerConfig::default(),
		});
		assert!(chunks.len() >= 2);
		for c in &chunks {
			assert!(
				c.token_count as usize <= DEFAULT_PARENT_TOKENS,
				"chunk {} has {} tokens",
				c.chunk_id,
				c.token_count
			);
		}
	}

	/// Multi-byte UTF-8 that would panic on byte-index truncation (`&text[..keep]`).
	#[test]
	fn non_ascii_truncate_does_not_panic() {
		// "é" is 2 bytes; "字" is 3 bytes. Force truncation mid-budget.
		let body = "é字".repeat(600); // 1200 chars → well over parent/child caps
		let text = format!("1. Título\n{body}\n\n2. Argumento\n{body}");
		let chunks = chunk_document(&ChunkDocumentInput {
			doc_id: "utf8".into(),
			text,
			source_uri: "file:///utf8.md".into(),
			page: Some(1),
			config: ChunkerConfig::default(),
		});
		assert!(!chunks.is_empty());
		for c in &chunks {
			assert!(c.token_count as usize <= DEFAULT_PARENT_TOKENS);
			// Round-trip: text is valid UTF-8 and citation ranges are coherent
			assert!(c.citation.char_start.is_some());
			assert!(c.citation.char_end.is_some());
			let start = c.citation.char_start.unwrap() as usize;
			let end = c.citation.char_end.unwrap() as usize;
			assert!(end >= start);
		}
	}

	#[test]
	fn truncate_to_chars_respects_boundaries() {
		let s = "aé字b"; // chars: a, é, 字, b — bytes longer than 4
		assert_eq!(truncate_to_chars(s, 2), "aé");
		assert_eq!(truncate_to_chars(s, 3), "aé字");
		assert_eq!(char_len(truncate_to_chars(s, 3)), 3);
	}
}
