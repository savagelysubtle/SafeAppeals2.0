/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Concise Private Search protocol injected every Agent turn (after the mode reminder).
 * Token budget: summarize Void RAG playbook — not a full prompt dump.
 */
export function buildPrivateSearchAgentProtocolMessage(): string {
	return [
		'## Private Search protocol',
		'',
		'For case facts, policy/regulatory guidance, medical evidence, deadlines, and legal standards: use Private Search (RAG) **before** web search or guessing.',
		'',
		'**Scope:**',
		'- `safeappeals_rag_search_reference` — core_references/ (policy manuals, regulations, textbooks). WC rules, procedures, benefits, appeal standards.',
		'- `safeappeals_rag_search_workspace` — case files (IME/QME, medical reports, correspondence, board decisions). Case-specific facts only.',
		'- `safeappeals_rag_search_all` — broad/unclear scope; follow with reference or workspace search for depth.',
		'',
		'**Workflow:**',
		'1. When unsure what is indexed, call `safeappeals_rag_get_stats` first.',
		'2. For high-stakes answers (legal advice, medical summaries, filing deadlines), run **2–3 searches with varied queries** (broad → specific → edge case).',
		'3. Read the returned contextPack. Cite using **[n]** headers exactly as shown — never invent page numbers, quotes, or sources not in the pack.',
		'4. If search returns nothing useful, say so; do not fabricate citations. Web search may **supplement** Private Search but must not **replace** it for on-device case/policy facts.',
		'',
		'**Indexing (txt, md, pdf):** Call `safeappeals_rag_get_stats` before indexing or re-indexing. Call `safeappeals_rag_index_document` only when stats show the document is missing or changed. Prefer placing core references in `core_references/` for auto-index. Index writes run on the **primary workbench**; Agents / read-only sessions may search but not index.',
		'',
		'**PDFs:** When a workspace PDF may be unindexed, index it via `safeappeals_rag_index_document` (after get_stats) **before** relying on search alone. Born-digital PDFs index via sa-converter text extract. Scanned PDFs may **hard-disable** with codes such as `scanned-ocr-ineligible`, `scanned-ocr-unpinned`, `scanned-ocr-not-installed`, or `scanned-ocr-sidecar-not-ready` — report the tool result honestly; never invent PDF text, page numbers, or citations.',
	].join('\n');
}
