import { URI } from '../../../../../base/common/uri.js';
import { RawMCPToolCall } from '../mcpServiceTypes.js';
import { builtinTools } from '../prompt/prompts.js';
import { RawToolParamsObj } from '../sendLLMMessageTypes.js';
import { EventCategory, TimelineEvent } from '../timeline/timelineTypes.js';



export type TerminalResolveReason = { type: 'timeout' } | { type: 'done', exitCode: number }

export type LintErrorItem = { code: string, message: string, startLineNumber: number, endLineNumber: number }

// Partial of IFileStat
export type ShallowDirectoryItem = {
	uri: URI;
	name: string;
	isDirectory: boolean;
	isSymbolicLink: boolean;
}


export const approvalTypeOfBuiltinToolName: Partial<{ [T in BuiltinToolName]?: 'edits' | 'terminal' | 'MCP tools' | 'RAG tools' }> = {
	'create_file_or_folder': 'edits',
	'delete_file_or_folder': 'edits',
	'rewrite_file': 'edits',
	'edit_file': 'edits',
	'edit_document': 'edits',
	'run_command': 'terminal',
	'run_persistent_command': 'terminal',
	'open_persistent_terminal': 'terminal',
	'kill_persistent_terminal': 'terminal',
	// RAG tools removed from approval requirement - they are read-only information gathering tools
	// 'rag_index_document': 'RAG tools',  // Commented out - no approval needed
	// 'rag_search_policy': 'RAG tools',   // Commented out - no approval needed
	// 'rag_search_workspace': 'RAG tools', // Commented out - no approval needed
	// 'rag_get_stats': 'RAG tools',       // Commented out - no approval needed
}


export type ToolApprovalType = NonNullable<(typeof approvalTypeOfBuiltinToolName)[keyof typeof approvalTypeOfBuiltinToolName]>;


export const toolApprovalTypes = new Set<ToolApprovalType>([
	...Object.values(approvalTypeOfBuiltinToolName),
	'MCP tools',
	'RAG tools',
])




// PARAMS OF TOOL CALL
export type BuiltinToolCallParams = {
	'read_file': { uri: URI, startLine: number | null, endLine: number | null, pageNumber: number },
	'ls_dir': { uri: URI, pageNumber: number },
	'get_dir_tree': { uri: URI },
	'search_pathnames_only': { query: string, includePattern: string | null, pageNumber: number },
	'search_for_files': { query: string, isRegex: boolean, searchInFolder: URI | null, pageNumber: number },
	'search_in_file': { uri: URI, query: string, isRegex: boolean },
	'read_lint_errors': { uri: URI },
	// ---
	'rewrite_file': { uri: URI, newContent: string },
	'edit_file': { uri: URI, searchReplaceBlocks: string },
	'create_file_or_folder': { uri: URI, isFolder: boolean },
	'delete_file_or_folder': { uri: URI, isRecursive: boolean, isFolder: boolean },
	'edit_document': { uri: URI, operations: Array<{ type: string;[key: string]: any }> },
	// ---
	'run_command': { command: string; cwd: string | null, terminalId: string },
	'open_persistent_terminal': { cwd: string | null },
	'run_persistent_command': { command: string; persistentTerminalId: string },
	'kill_persistent_terminal': { persistentTerminalId: string },
	// --- RAG tools
	'rag_index_document': { uri: URI, isPolicyManual: boolean },
	'rag_search_policy': { query: string, limit: number },
	'rag_search_workspace': { query: string, limit: number },
	'rag_search_all': { query: string, limit: number },
	'rag_get_stats': {},
	// --- Web Search tools
	'web_search': { query: string, count: number | null, offset: number | null },
	'multi_link_search': { queries: string[], count: number | null },
	// --- Timeline tools
	'timeline_add_event': { date: string, title: string, description: string | null, category: EventCategory, isDeadline: boolean, linkedDocuments: string[] },
	'timeline_update_event': { eventId: string, date: string | null, title: string | null, description: string | null, category: EventCategory | null, isDeadline: boolean | null, isComplete: boolean | null },
	'timeline_delete_event': { eventId: string },
	'timeline_get_events': { category: EventCategory | null, startDate: string | null, endDate: string | null, isDeadline: boolean | null, limit: number },
	'timeline_link_document': { eventId: string, documentUri: URI },
	'timeline_get_deadlines': { daysAhead: number },
}

// Web Search result types
export type WebSearchResult = {
	title: string;
	url: string;
	description: string;
	age?: string;
	published?: string;
}

export type MultiSearchResult = {
	query: string;
	results: WebSearchResult[];
	error?: string;
}

// RESULT OF TOOL CALL
export type BuiltinToolResultType = {
	'read_file': { fileContents: string, totalFileLen: number, totalNumLines: number, hasNextPage: boolean },
	'ls_dir': { children: ShallowDirectoryItem[] | null, hasNextPage: boolean, hasPrevPage: boolean, itemsRemaining: number },
	'get_dir_tree': { str: string, },
	'search_pathnames_only': { uris: URI[], hasNextPage: boolean },
	'search_for_files': { uris: URI[], hasNextPage: boolean },
	'search_in_file': { lines: number[]; },
	'read_lint_errors': { lintErrors: LintErrorItem[] | null },
	// ---
	'rewrite_file': Promise<{ lintErrors: LintErrorItem[] | null }>,
	'edit_file': Promise<{ lintErrors: LintErrorItem[] | null }>,
	'create_file_or_folder': {},
	'delete_file_or_folder': {},
	'edit_document': { success: boolean, error?: string, message?: string },
	// ---
	'run_command': { result: string; resolveReason: TerminalResolveReason; },
	'run_persistent_command': { result: string; resolveReason: TerminalResolveReason; },
	'open_persistent_terminal': { persistentTerminalId: string },
	'kill_persistent_terminal': {},
	// --- RAG tools
	'rag_index_document': { success: boolean, message: string },
	'rag_search_policy': { contextPack: string },
	'rag_search_workspace': { contextPack: string },
	'rag_search_all': { contextPack: string },
	'rag_get_stats': { stats: string },
	// --- Web Search tools
	'web_search': { results: WebSearchResult[], totalResults: number },
	'multi_link_search': { searchResults: MultiSearchResult[] },
	// --- Timeline tools
	'timeline_add_event': { event: TimelineEvent },
	'timeline_update_event': { success: boolean },
	'timeline_delete_event': { success: boolean },
	'timeline_get_events': { events: TimelineEvent[], totalCount: number },
	'timeline_link_document': { success: boolean },
	'timeline_get_deadlines': { upcoming: TimelineEvent[], overdue: TimelineEvent[] },
}


export type ToolCallParams<T extends BuiltinToolName | (string & {})> = T extends BuiltinToolName ? BuiltinToolCallParams[T] : RawToolParamsObj
export type ToolResult<T extends BuiltinToolName | (string & {})> = T extends BuiltinToolName ? BuiltinToolResultType[T] : RawMCPToolCall

export type BuiltinToolName = keyof BuiltinToolResultType

type BuiltinToolParamNameOfTool<T extends BuiltinToolName> = keyof (typeof builtinTools)[T]['params']
export type BuiltinToolParamName = { [T in BuiltinToolName]: BuiltinToolParamNameOfTool<T> }[BuiltinToolName]


export type ToolName = BuiltinToolName | (string & {})
export type ToolParamName<T extends ToolName> = T extends BuiltinToolName ? BuiltinToolParamNameOfTool<T> : string



