// Copyright (c) Safe Appeals. All rights reserved.

//! Rule-based query classification, decomposition, and scope routing (M4).
//!
//! Port of Void `ragQueryProcessor.ts`. Llama-3.2-1B LLM decomposition is
//! **out of v1** — keep rule-based only.
//!
//! Void scope names map to SafeAppeals:
//! - `workspace_all` → [`RoutedScope::All`] (`all`)
//! - `core_references` → [`RoutedScope::CoreReference`] (`core_reference`)
//! - `case_index` → [`RoutedScope::CaseIndex`] (`case_index`)

use regex::Regex;
use std::sync::OnceLock;

/// Scope suggested by keyword routing (Void → SafeAppeals naming).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum RoutedScope {
	#[default]
	All,
	CoreReference,
	CaseIndex,
}

/// One sub-query after rule-based decomposition.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubQuery {
	pub id: String,
	pub query: String,
	pub scope: RoutedScope,
	pub priority: u32,
}

/// Result of [`process_query`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProcessedQuery {
	pub is_complex: bool,
	pub sub_queries: Vec<SubQuery>,
	pub suggested_scope: RoutedScope,
}

/// Analyze query complexity and decompose if needed.
pub fn process_query(query: &str) -> ProcessedQuery {
	let suggested_scope = route_query(query);
	let is_complex = is_complex_query(query);

	if is_complex {
		return ProcessedQuery {
			is_complex: true,
			sub_queries: decompose(query),
			suggested_scope,
		};
	}

	ProcessedQuery {
		is_complex: false,
		sub_queries: vec![SubQuery {
			id: "main".into(),
			query: query.to_string(),
			scope: suggested_scope,
			priority: 1,
		}],
		suggested_scope,
	}
}

/// Rule-based complexity indicators (Void patterns).
pub fn is_complex_query(query: &str) -> bool {
	static PATTERNS: OnceLock<Vec<Regex>> = OnceLock::new();
	let patterns = PATTERNS.get_or_init(|| {
		[
			r"(?i)\band\b.*\band\b",           // Multiple "and" conjunctions
			r"(?i)\bor\b.*\bor\b",             // Multiple "or" conjunctions
			r"\?.*\?",                         // Multiple question marks
			r"(?i)first.*then",                // Sequential queries
			r"(?i)what.*and.*how",             // Multiple question types
			r"\d+\.\s+.*\d+\.",                // Numbered lists (1. ... 2. ...)
			r"(?i)if\s+.+\s+then",             // Conditional logic
			r"(?i)misclassif",                 // Nested concepts (e.g., misclassification)
		]
		.into_iter()
		.map(|p| Regex::new(p).expect("static complexity regex"))
		.collect()
	});
	patterns.iter().any(|re| re.is_match(query))
}

/// Split a complex query on conjunctions into simpler sub-queries.
///
/// Parts shorter than 10 chars are dropped (Void minimum meaningful length).
/// If splitting yields ≤1 part, returns the original query as a single sub-query.
pub fn decompose(query: &str) -> Vec<SubQuery> {
	static SPLIT: OnceLock<Regex> = OnceLock::new();
	let split = SPLIT.get_or_init(|| Regex::new(r"(?i)\band\b|\bor\b").expect("static split regex"));

	let parts: Vec<String> = split
		.split(query)
		.map(str::trim)
		.filter(|part| part.len() > 10)
		.map(str::to_string)
		.collect();

	if parts.len() <= 1 {
		return vec![SubQuery {
			id: "main".into(),
			query: query.to_string(),
			scope: route_query(query),
			priority: 1,
		}];
	}

	parts
		.into_iter()
		.enumerate()
		.map(|(idx, part)| {
			let scope = route_query(&part);
			SubQuery {
				id: format!("sub_{idx}"),
				query: part,
				scope,
				priority: (idx as u32) + 1,
			}
		})
		.collect()
}

/// Route a query to a document scope via keyword matching.
///
/// Maps Void `core_references` / `workspace_all` onto our
/// [`RoutedScope::CoreReference`] / [`RoutedScope::All`].
pub fn route_query(query: &str) -> RoutedScope {
	let lower = query.to_lowercase();

	const POLICY_KEYWORDS: &[&str] = &[
		"policy",
		"rule",
		"regulation",
		"guideline",
		"procedure",
		"requirement",
		"compliance",
		"statute",
		"code",
		"law",
		"eligibility",
		"coverage",
		"benefit",
		"deadline",
		"timeframe",
	];

	const CASE_KEYWORDS: &[&str] = &[
		"client",
		"claimant",
		"case",
		"appeal",
		"injury",
		"medical",
		"treatment",
		"diagnosis",
		"report",
		"investigation",
		"claim",
		"incident",
		"accident",
		"worker",
		"employee",
	];

	let has_policy = POLICY_KEYWORDS.iter().any(|kw| lower.contains(kw));
	let has_case = CASE_KEYWORDS.iter().any(|kw| lower.contains(kw));

	if has_policy && !has_case {
		RoutedScope::CoreReference
	} else if has_case && !has_policy {
		RoutedScope::CaseIndex
	} else {
		RoutedScope::All
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn simple_query_not_complex() {
		assert!(!is_complex_query("rating reduction flare-ups"));
		let p = process_query("rating reduction flare-ups");
		assert!(!p.is_complex);
		assert_eq!(p.sub_queries.len(), 1);
		assert_eq!(p.sub_queries[0].id, "main");
		assert_eq!(p.sub_queries[0].query, "rating reduction flare-ups");
	}

	#[test]
	fn multi_and_is_complex_and_decomposes() {
		let q = "medical treatment history and rating reduction and flare-ups documented";
		assert!(is_complex_query(q));
		let p = process_query(q);
		assert!(p.is_complex);
		assert!(p.sub_queries.len() >= 2, "expected ≥2 parts, got {:?}", p.sub_queries);
		for sq in &p.sub_queries {
			assert!(sq.query.len() > 10);
			assert!(!sq.query.to_lowercase().contains(" and "));
		}
	}

	#[test]
	fn multi_or_is_complex() {
		assert!(is_complex_query("remand or reverse or vacate the decision"));
	}

	#[test]
	fn multi_question_marks_is_complex() {
		assert!(is_complex_query("What is the rating? How are flare-ups weighed?"));
	}

	#[test]
	fn first_then_is_complex() {
		assert!(is_complex_query("first find the rating then check flare-ups"));
	}

	#[test]
	fn what_and_how_is_complex() {
		assert!(is_complex_query("what evidence supports remand and how was it ignored"));
	}

	#[test]
	fn numbered_list_is_complex() {
		assert!(is_complex_query("1. Find medical evidence. 2. Check rating schedule."));
	}

	#[test]
	fn if_then_is_complex() {
		assert!(is_complex_query("if the evidence is in equipoise then remand"));
	}

	#[test]
	fn misclassif_is_complex() {
		assert!(is_complex_query("worker misclassification under the statute"));
	}

	#[test]
	fn route_policy_only_to_core_reference() {
		assert_eq!(
			route_query("eligibility requirements under the policy manual"),
			RoutedScope::CoreReference
		);
		assert_eq!(
			route_query("compliance deadline and statute of limitations"),
			RoutedScope::CoreReference
		);
	}

	#[test]
	fn route_case_only_to_case_index() {
		assert_eq!(
			route_query("claimant medical treatment and injury report"),
			RoutedScope::CaseIndex
		);
		assert_eq!(route_query("appeal investigation notes"), RoutedScope::CaseIndex);
	}

	#[test]
	fn route_ambiguous_or_empty_to_all() {
		assert_eq!(route_query("rating reduction flare-ups"), RoutedScope::All);
		assert_eq!(
			route_query("policy eligibility for claimant medical appeal"),
			RoutedScope::All
		);
	}

	#[test]
	fn void_scope_names_mapped_internally() {
		// Void used core_references / workspace_all; we expose core_reference / all.
		assert_eq!(
			route_query("regulation guideline procedure"),
			RoutedScope::CoreReference
		);
		assert_eq!(route_query("nothing matching keywords"), RoutedScope::All);
	}

	#[test]
	fn decompose_short_parts_filtered() {
		let parts = decompose("medical treatment history and rating reduction evidence");
		assert_eq!(parts.len(), 2);
		assert_eq!(parts[0].id, "sub_0");
		assert_eq!(parts[1].id, "sub_1");
	}

	#[test]
	fn decompose_fallback_when_cannot_split() {
		// Complex via misclassif, but no and/or split → single main.
		let parts = decompose("worker misclassification analysis");
		assert_eq!(parts.len(), 1);
		assert_eq!(parts[0].id, "main");
	}

	#[test]
	fn process_query_suggested_scope_matches_route() {
		let q = "claimant medical treatment history";
		let p = process_query(q);
		assert_eq!(p.suggested_scope, RoutedScope::CaseIndex);
		assert_eq!(p.sub_queries[0].scope, RoutedScope::CaseIndex);
	}
}
