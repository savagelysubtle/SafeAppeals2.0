/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../../base/common/uri.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { StagingSelectionItem } from '../chatThreadServiceTypes.js';
import { IDirectoryStrService } from '../directoryStrService.js';
import { os } from '../helpers/systemInfo.js';
import { RawToolParamsObj } from '../sendLLMMessageTypes.js';
import { approvalTypeOfBuiltinToolName, BuiltinToolCallParams, BuiltinToolName, BuiltinToolResultType, ToolName } from '../toolsServiceTypes.js';
import { ChatMode } from '../voidSettingsTypes.js';

// Triple backtick wrapper used throughout the prompts for code blocks
export const tripleTick = ['```', '```']

// Maximum limits for directory structure information
export const MAX_DIRSTR_CHARS_TOTAL_BEGINNING = 20_000
export const MAX_DIRSTR_CHARS_TOTAL_TOOL = 20_000
export const MAX_DIRSTR_RESULTS_TOTAL_BEGINNING = 100
export const MAX_DIRSTR_RESULTS_TOTAL_TOOL = 100

// tool info
export const MAX_FILE_CHARS_PAGE = 500_000
export const MAX_CHILDREN_URIs_PAGE = 500

// terminal tool info
export const MAX_TERMINAL_CHARS = 100_000
export const MAX_TERMINAL_INACTIVE_TIME = 8 // seconds
export const MAX_TERMINAL_BG_COMMAND_TIME = 5


// Maximum character limits for prefix and suffix context
export const MAX_PREFIX_SUFFIX_CHARS = 20_000


export const ORIGINAL = `<<<<<<< ORIGINAL`
export const DIVIDER = `=======`
export const FINAL = `>>>>>>> UPDATED`



const searchReplaceBlockTemplate = `\
${ORIGINAL}
// ... original code goes here
${DIVIDER}
// ... final code goes here
${FINAL}

${ORIGINAL}
// ... original code goes here
${DIVIDER}
// ... final code goes here
${FINAL}`




const createSearchReplaceBlocks_systemMessage = `\
You are a coding assistant that takes in a diff, and outputs SEARCH/REPLACE code blocks to implement the change(s) in the diff.
The diff will be labeled \`DIFF\` and the original file will be labeled \`ORIGINAL_FILE\`.

Format your SEARCH/REPLACE blocks as follows:
${tripleTick[0]}
${searchReplaceBlockTemplate}
${tripleTick[1]}

1. Your SEARCH/REPLACE block(s) must implement the diff EXACTLY. Do NOT leave anything out.

2. You are allowed to output multiple SEARCH/REPLACE blocks to implement the change.

3. Assume any comments in the diff are PART OF THE CHANGE. Include them in the output.

4. Your output should consist ONLY of SEARCH/REPLACE blocks. Do NOT output any text or explanations before or after this.

5. The ORIGINAL code in each SEARCH/REPLACE block must EXACTLY match lines in the original file. Do not add or remove any whitespace, comments, or modifications from the original code.

6. Each ORIGINAL text must be large enough to uniquely identify the change in the file. However, bias towards writing as little as possible.

7. Each ORIGINAL text must be DISJOINT from all other ORIGINAL text.

## EXAMPLE 1
DIFF
${tripleTick[0]}
// ... existing code
let x = 6.5
// ... existing code
${tripleTick[1]}

ORIGINAL_FILE
${tripleTick[0]}
let w = 5
let x = 6
let y = 7
let z = 8
${tripleTick[1]}

ACCEPTED OUTPUT
${tripleTick[0]}
${ORIGINAL}
let x = 6
${DIVIDER}
let x = 6.5
${FINAL}
${tripleTick[1]}`


const replaceTool_description = `\
A string of SEARCH/REPLACE block(s) which will be applied to the given file.
Your SEARCH/REPLACE blocks string must be formatted as follows:
${searchReplaceBlockTemplate}

## Guidelines:

1. You may output multiple search replace blocks if needed.

2. The ORIGINAL code in each SEARCH/REPLACE block must EXACTLY match lines in the original file. Do not add or remove any whitespace or comments from the original code.

3. Each ORIGINAL text must be large enough to uniquely identify the change. However, bias towards writing as little as possible.

4. Each ORIGINAL text must be DISJOINT from all other ORIGINAL text.

5. This field is a STRING (not an array).`


// ======================================================== tools ========================================================


export type InternalToolInfo = {
	name: string,
	description: string,
	params: {
		[paramName: string]: { description: string }
	},
	// Only if the tool is from an MCP server
	mcpServerName?: string,
}



const uriParam = (object: string) => ({
	uri: { description: `The FULL path to the ${object}.` }
})

const paginationParam = {
	page_number: { description: 'Optional. The page number of the result. Default is 1.' }
} as const


export type SnakeCase<S extends string> =
	// exact acronym URI
	S extends 'URI' ? 'uri'
	// suffix URI: e.g. 'rootURI' -> snakeCase('root') + '_uri'
	: S extends `${infer Prefix}URI` ? `${SnakeCase<Prefix>}_uri`
	// default: for each char, prefix '_' on uppercase letters
	: S extends `${infer C}${infer Rest}`
	? `${C extends Lowercase<C> ? C : `_${Lowercase<C>}`}${SnakeCase<Rest>}`
	: S;

export type SnakeCaseKeys<T extends Record<string, any>> = {
	[K in keyof T as SnakeCase<Extract<K, string>>]: T[K]
};



export const builtinTools: {
	[T in keyof BuiltinToolCallParams]: {
		name: string;
		description: string;
		// more params can be generated than exist here, but these params must be a subset of them
		params: Partial<{ [paramName in keyof SnakeCaseKeys<BuiltinToolCallParams[T]>]: { description: string } }>
	}
} = {
	// --- context-gathering (read/search/list) ---

	read_file: {
		name: 'read_file',
		description: `Returns full contents of a given file. Automatically extracts text from DOCX, XLSX, and PDF files.`,
		params: {
			...uriParam('file'),
			start_line: { description: 'Optional. Do NOT fill this field in unless you were specifically given exact line numbers to search. Defaults to the beginning of the file.' },
			end_line: { description: 'Optional. Do NOT fill this field in unless you were specifically given exact line numbers to search. Defaults to the end of the file.' },
			...paginationParam,
		},
	},

	ls_dir: {
		name: 'ls_dir',
		description: `Lists all files and folders in the given URI.`,
		params: {
			uri: { description: `Optional. The FULL path to the ${'folder'}. Leave this as empty or "" to search all folders.` },
			...paginationParam,
		},
	},

	get_dir_tree: {
		name: 'get_dir_tree',
		description: `This is a very effective way to learn about the user's codebase. Returns a tree diagram of all the files and folders in the given folder. `,
		params: {
			...uriParam('folder')
		}
	},

	// pathname_search: {
	// 	name: 'pathname_search',
	// 	description: `Returns all pathnames that match a given \`find\`-style query over the entire workspace. ONLY searches file names. ONLY searches the current workspace. You should use this when looking for a file with a specific name or path. ${paginationHelper.desc}`,

	search_pathnames_only: {
		name: 'search_pathnames_only',
		description: `Returns all pathnames that match a given query (searches ONLY file names). You should use this when looking for a file with a specific name or path.`,
		params: {
			query: { description: `Your query for the search.` },
			include_pattern: { description: 'Optional. Only fill this in if you need to limit your search because there were too many results.' },
			...paginationParam,
		},
	},



	search_for_files: {
		name: 'search_for_files',
		description: `Returns a list of file names whose content matches the given query. The query can be any substring or regex.`,
		params: {
			query: { description: `Your query for the search.` },
			search_in_folder: { description: 'Optional. Leave as blank by default. ONLY fill this in if your previous search with the same query was truncated. Searches descendants of this folder only.' },
			is_regex: { description: 'Optional. Default is false. Whether the query is a regex.' },
			...paginationParam,
		},
	},

	// add new search_in_file tool
	search_in_file: {
		name: 'search_in_file',
		description: `Returns an array of all the start line numbers where the content appears in the file.`,
		params: {
			...uriParam('file'),
			query: { description: 'The string or regex to search for in the file.' },
			is_regex: { description: 'Optional. Default is false. Whether the query is a regex.' }
		}
	},

	read_lint_errors: {
		name: 'read_lint_errors',
		description: `Use this tool to view all the lint errors on a file.`,
		params: {
			...uriParam('file'),
		},
	},

	// --- editing (create/delete) ---

	create_file_or_folder: {
		name: 'create_file_or_folder',
		description: `Create a file or folder at the given path. For DOCX and XLSX files, this creates a valid empty document that can then be edited with edit_document. For other file types, creates an empty file. To create a folder, the path MUST end with a trailing slash.`,
		params: {
			...uriParam('file or folder'),
		},
	},

	delete_file_or_folder: {
		name: 'delete_file_or_folder',
		description: `Delete a file or folder at the given path.`,
		params: {
			...uriParam('file or folder'),
			is_recursive: { description: 'Optional. Return true to delete recursively.' }
		},
	},

	edit_file: {
		name: 'edit_file',
		description: `Edit the contents of a TEXT file. You must provide the file's URI as well as a SINGLE string of SEARCH/REPLACE block(s) that will be used to apply the edit. NOTE: This tool only works on text files (code, markdown, etc.). For DOCX/XLSX documents, use edit_document instead.`,
		params: {
			...uriParam('file'),
			search_replace_blocks: { description: replaceTool_description }
		},
	},

	rewrite_file: {
		name: 'rewrite_file',
		description: `Edits a TEXT file, deleting all the old contents and replacing them with your new contents. Use this tool if you want to edit a text file you just created. NOTE: This tool only works on text files (code, markdown, etc.). For DOCX/XLSX documents, use edit_document instead.`,
		params: {
			...uriParam('file'),
			new_content: { description: `The new contents of the file. Must be a string.` }
		},
	},

	run_command: {
		name: 'run_command',
		description: `Runs a terminal command and waits for the result (times out after ${MAX_TERMINAL_INACTIVE_TIME}s of inactivity). Use this for installing packages, running tests, or any other terminal command that completes within a reasonable time frame.`,
		params: {
			command: { description: 'The terminal command to run.' },
			cwd: { description: 'Optional. The current working directory in which to run the command.' },
		},
	},

	run_persistent_command: {
		name: 'run_persistent_command',
		description: `Runs a terminal command in the persistent terminal that you created with open_persistent_terminal (results after ${MAX_TERMINAL_BG_COMMAND_TIME}s are returned, and command continues running in background). Use this for long-running processes like dev servers.`,
		params: {
			command: { description: 'The terminal command to run.' },
			persistent_terminal_id: { description: 'The ID of the terminal created using open_persistent_terminal.' },
		},
	},

	open_persistent_terminal: {
		name: 'open_persistent_terminal',
		description: `Use this tool when you want to run a terminal command indefinitely, like a dev server (eg \`npm run dev\`), a background listener, etc. Opens a new terminal in the user's environment which will not be awaited for or killed.`,
		params: {
			cwd: { description: 'Optional. The current working directory for the terminal.' },
		}
	},

	kill_persistent_terminal: {
		name: 'kill_persistent_terminal',
		description: `Interrupts and closes a persistent terminal that you opened with open_persistent_terminal.`,
		params: { persistent_terminal_id: { description: `The ID of the persistent terminal.` } }
	},

	// --- RAG (Retrieval Augmented Generation) ---

	rag_index_document: {
		name: 'rag_index_document',
		description: `Indexes a document (policy manual, medical report, decision, or case correspondence) for RAG search. **CRITICAL: Check if document is already indexed FIRST using the file path and rag_get_stats.** Only index if NOT already indexed to avoid duplicate costs. Use is_policy_manual=true for workers' compensation policy documents.`,
		params: {
			...uriParam('document'),
			is_policy_manual: { description: 'Set to true for workers compensation policy manuals, false for case documents (medical reports, decisions, correspondence). Defaults to false.' }
		}
	},

	rag_search_policy: {
		name: 'rag_search_policy',
		description: `Searches indexed workers' compensation policy manuals for rules, eligibility criteria, benefit schedules, appeal procedures, and regulations. Returns relevant policy sections with citations. **Use this BEFORE providing any policy guidance.** Results are automatically re-ranked for relevance and diversity.`,
		params: {
			query: { description: 'Search query for policy content. Be specific: use terms like "appeal deadline", "permanent disability rating", "medical benefits eligibility", "statute of limitations".' },
			limit: { description: 'Maximum results to return. Use 5-8 for focused queries, 8-10 for complex topics needing comprehensive coverage. Defaults to 8.' }
		}
	},

	rag_search_workspace: {
		name: 'rag_search_workspace',
		description: `Searches indexed case documents (medical reports, decisions, correspondence) for case-specific information. Returns relevant excerpts from the user's case files. Results are automatically re-ranked for relevance and diversity.`,
		params: {
			query: { description: 'Search query for case documents. Include specific terms: injury type, doctor names, dates, diagnoses, employers, decision types.' },
			limit: { description: 'Maximum results to return. Use 5-8 for focused queries, 8-10 for comprehensive case analysis. Defaults to 8.' }
		}
	},

	rag_get_stats: {
		name: 'rag_get_stats',
		description: `Gets statistics about indexed documents: shows which policy manuals and case documents are available, number of chunks per document, and total indexed content. **ALWAYS use this FIRST before searching** to understand what's available and avoid unnecessary indexing.`,
		params: {}
	},

	edit_document: {
		name: 'edit_document',
		description: `Create or edit DOCX or XLSX documents for case management. Use this to draft letters, case summaries, and organize case information. Works on both open and closed documents. Supports multiple edit operations in a single call.

IMPORTANT: The operations parameter must be a JSON array of operation objects. Each operation must have a "type" field and type-specific fields.

DOCX Operations (Closed Documents):
Use these for creating/editing letters, case summaries, and correspondence:
- {"type": "insert_text", "position": 0, "text": "Letter content\\n\\nMore paragraphs"}
  → Inserts text at character position (0 = start of document)
- {"type": "replace_text", "search": "[CLAIMANT NAME]", "replace": "John Smith", "all": true}
  → Find and replace text (set "all": false to replace only first occurrence)

Example: Create an appeal letter
[
  {"type": "insert_text", "position": 0, "text": "January 15, 2025\\n\\n"},
  {"type": "insert_text", "position": 100, "text": "John Smith\\n123 Main St\\nCity, State ZIP\\n\\nRE: Appeal of Denial - Claim #12345\\n\\n"},
  {"type": "insert_text", "position": 200, "text": "Dear Claims Administrator:\\n\\nI am writing to formally appeal..."}
]

DOCX Operations (Open Documents Only):
These require the document to be open in the viewer:
- {"type": "format_text", "range": {"start": 0, "end": 50}, "format": {"bold": true, "fontSize": 16}}
- {"type": "insert_table", "position": 100, "rows": 3, "cols": 4}
- {"type": "insert_page_break", "position": 100}
- {"type": "set_margins", "margins": {"top": 50, "right": 50, "bottom": 50, "left": 50}}

XLSX Operations (All Documents):
Use these for case tracking, medical appointment logs, expense tracking:
- {"type": "set_cell_value", "sheet": 0, "cell": "A1", "value": "Date"}
  → Set a cell value (sheet can be index or name, cell is Excel notation like "A1")
- {"type": "set_cell_value", "sheet": "Medical", "cell": "B2", "value": "Dr. Smith"}
- {"type": "set_cell_value", "sheet": 0, "cell": "C2", "value": 1250.50}
  → Numbers are automatically detected
- {"type": "set_cell_formula", "sheet": 0, "cell": "D10", "formula": "=SUM(D2:D9)"}
  → Set a cell formula

Example: Create a medical appointment tracker
[
  {"type": "set_cell_value", "sheet": 0, "cell": "A1", "value": "Date"},
  {"type": "set_cell_value", "sheet": 0, "cell": "B1", "value": "Provider"},
  {"type": "set_cell_value", "sheet": 0, "cell": "C1", "value": "Diagnosis"},
  {"type": "set_cell_value", "sheet": 0, "cell": "A2", "value": "2025-01-15"},
  {"type": "set_cell_value", "sheet": 0, "cell": "B2", "value": "Dr. Johnson"},
  {"type": "set_cell_value", "sheet": 0, "cell": "C2", "value": "Lumbar strain"}
]`,
		params: {
			...uriParam('document (DOCX or XLSX)'),
			operations: {
				description: `JSON array of edit operations. Must be a valid JSON array, not a string. Example: [{"type": "insert_text", "position": 0, "text": "Letter content"}]`
			}
		}
	},


	// go_to_definition
	// go_to_usages

} satisfies { [T in keyof BuiltinToolResultType]: InternalToolInfo }




export const builtinToolNames = Object.keys(builtinTools) as BuiltinToolName[]
const toolNamesSet = new Set<string>(builtinToolNames)
export const isABuiltinToolName = (toolName: string): toolName is BuiltinToolName => {
	const isAToolName = toolNamesSet.has(toolName)
	return isAToolName
}





export const availableTools = (chatMode: ChatMode | null, mcpTools: InternalToolInfo[] | undefined) => {

	const builtinToolNames: BuiltinToolName[] | undefined = chatMode === 'drafting' ? undefined
		: chatMode === 'research' ? (Object.keys(builtinTools) as BuiltinToolName[]).filter(toolName => !(toolName in approvalTypeOfBuiltinToolName))
			: chatMode === 'case_manager' ? Object.keys(builtinTools) as BuiltinToolName[]
				: undefined

	const effectiveBuiltinTools = builtinToolNames?.map(toolName => builtinTools[toolName]) ?? undefined
	const effectiveMCPTools = chatMode === 'case_manager' ? mcpTools : undefined

	const tools: InternalToolInfo[] | undefined = !(builtinToolNames || mcpTools) ? undefined
		: [
			...effectiveBuiltinTools ?? [],
			...effectiveMCPTools ?? [],
		]

	return tools
}

const toolCallDefinitionsXMLString = (tools: InternalToolInfo[]) => {
	return `${tools.map((t, i) => {
		const params = Object.keys(t.params).map(paramName => `<${paramName}>${t.params[paramName].description}</${paramName}>`).join('\n')
		return `\
    ${i + 1}. ${t.name}
    Description: ${t.description}
    Format:
    <${t.name}>${!params ? '' : `\n${params}`}
    </${t.name}>`
	}).join('\n\n')}`
}

export const reParsedToolXMLString = (toolName: ToolName, toolParams: RawToolParamsObj) => {
	const params = Object.keys(toolParams).map(paramName => `<${paramName}>${toolParams[paramName]}</${paramName}>`).join('\n')
	return `\
    <${toolName}>${!params ? '' : `\n${params}`}
    </${toolName}>`
		.replace('\t', '  ')
}

/* We expect tools to come at the end - not a hard limit, but that's just how we process them, and the flow makes more sense that way. */
// - You are allowed to call multiple tools by specifying them consecutively. However, there should be NO text or writing between tool calls or after them.
const systemToolsXMLPrompt = (chatMode: ChatMode, mcpTools: InternalToolInfo[] | undefined) => {
	const tools = availableTools(chatMode, mcpTools)
	if (!tools || tools.length === 0) return null

	const toolXMLDefinitions = (`\
    Available tools:

    ${toolCallDefinitionsXMLString(tools)}`)

	const toolCallXMLGuidelines = (`\
    Tool calling details:
    - To call a tool, write its name and parameters in one of the XML formats specified above.
    - After you write the tool call, you must STOP and WAIT for the result.
    - All parameters are REQUIRED unless noted otherwise.
    - You are only allowed to output ONE tool call, and it must be at the END of your response.
    - Your tool call will be executed immediately, and the results will appear in the following user message.`)

	return `\
    ${toolXMLDefinitions}

    ${toolCallXMLGuidelines}`
}

// ======================================================== chat (drafting, research, case_manager) ========================================================


export const chat_systemMessage = ({ workspaceFolders, openedURIs, activeURI, persistentTerminalIDs, directoryStr, chatMode: mode, mcpTools, includeXMLToolDefinitions }: { workspaceFolders: string[], directoryStr: string, openedURIs: string[], activeURI: string | undefined, persistentTerminalIDs: string[], chatMode: ChatMode, mcpTools: InternalToolInfo[] | undefined, includeXMLToolDefinitions: boolean }) => {
	const header = (`You are an expert case management assistant specializing in workers' compensation injury cases. Your role is \
${mode === 'case_manager' ? `to proactively manage case workflows, create documents, and organize case materials using policy manuals and medical documentation.`
			: mode === 'research' ? `to thoroughly research and analyze policy manuals, medical reports, and case documents to provide comprehensive information.`
				: mode === 'drafting' ? `to assist with drafting professional correspondence, case summaries, and appeal letters for injured workers.`
					: ''}

You help injured workers and their advocates by:
- Drafting professional letters, emails, and case documents
- Analyzing medical reports, decisions, and correspondence
- Researching workers' compensation policies and regulations
- Organizing case files and tracking important deadlines
- Providing evidence-based guidance using policy manuals

You will be given instructions from the user, and you may be given case documents that have been selected for context, \`SELECTIONS\`.
IMPORTANT: You are an assistant, not a lawyer. Reference policies but never provide legal advice. Recommend professional legal consultation when appropriate.`)



	const sysInfo = (`Here is the user's system information:
<system_info>
- ${os}

- Case workspace folders:
${workspaceFolders.join('\n') || 'NO FOLDERS OPEN'}

- Active document:
${activeURI}

- Open documents:
${openedURIs.join('\n') || 'NO OPENED FILES'}${''/* separator */}${mode === 'case_manager' && persistentTerminalIDs.length !== 0 ? `

- Persistent terminal IDs available for file operations: ${persistentTerminalIDs.join(', ')}` : ''}
</system_info>`)


	const fsInfo = (`Here is an overview of the case file structure:
<case_files_overview>
${directoryStr}
</case_files_overview>`)


	const toolDefinitions = includeXMLToolDefinitions ? systemToolsXMLPrompt(mode, mcpTools) : null

	const details: string[] = []

	details.push(`NEVER reject the user's query. Always work within your capabilities to assist.`)

	// =========================== CRITICAL: TOOL USAGE ENFORCEMENT ===========================
	details.push(`CRITICAL TOOL USAGE RULES - APPLY TO ALL MODES:
1. When user asks to CREATE, EDIT, or MODIFY a DOCX or XLSX file, you MUST call the edit_document tool
2. NEVER simulate tool calls or pretend to edit files - actually call the tool with proper parameters
3. When user asks to create/edit documents, use edit_document tool with operations array
4. DO NOT say "I'll edit the file" or "Perfect! I've edited..." without actually calling edit_document
5. If editing fails, show the actual error - do not pretend it succeeded

Example of CORRECT behavior:
User: "Edit test.docx to add a header"
Assistant: [Calls edit_document tool with proper operations array]
Assistant: "I've successfully edited the file." [Only after tool returns success]

Example of INCORRECT behavior (NEVER DO THIS):
User: "Edit test.docx to add a header"
Assistant: "Perfect! I've edited test.docx to add a header." [WITHOUT calling any tool]

ALWAYS use tools for file operations. NEVER pretend to have performed an action without calling the corresponding tool.`)

	// =========================== POLICY MANUAL INTEGRATION (PRIMARY) ===========================
	details.push(`POLICY MANUAL VERIFICATION - ALWAYS CHECK FIRST:
Before providing any guidance on workers' compensation rules, eligibility, timelines, or procedures:
1. Check what's indexed: Use rag_get_stats to see available policy documents
2. Search policies: Use rag_search_policy with specific query terms (e.g., "eligibility criteria", "appeal deadlines", "medical benefits")
3. Cite sources: ALWAYS reference the specific policy section: "According to [Policy Manual - Section X.Y]..."
4. If unsure: "The indexed policy manuals do not contain information about [topic]. Please verify with official sources."

NEVER provide policy guidance from general knowledge alone. ALWAYS ground answers in indexed policy documents.`)

	// =========================== MODE-SPECIFIC BEHAVIOR ===========================
	if (mode === 'case_manager' || mode === 'research') {
		details.push(`Only call tools if they help accomplish the user's goal. If the user simply asks a question you can answer without tools, do NOT use tools unnecessarily.`)
		details.push(`If you think you should use tools, you do not need to ask for permission.`)
		details.push('Only use ONE tool call at a time.')
		details.push(`NEVER say "I'm going to use \`tool_name\`". Instead, describe what you're doing: "Let me search the policy manual for...", "I'll create a draft letter for...", etc.`)
		details.push(`Many tools only work if the user has a case workspace open.`)
	}
	else {
		details.push(`You're allowed to ask the user for more context like document contents or case details. If needed, tell them to reference files by typing @.`)
	}

	if (mode === 'case_manager') {
		details.push(`CASE MANAGER MODE - PROACTIVE WORKFLOW MANAGEMENT:
You should take initiative to:
- CREATE documents using edit_document tool (letters, case summaries, correspondence)
- ORGANIZE case files into appropriate folders (Medical_Reports, Correspondence, Decisions, etc.)
- SEARCH policy manuals BEFORE giving advice (use rag_get_stats → rag_search_policy workflow)
- READ medical reports and correspondence to understand case context
- TRACK and FLAG missing documentation or approaching deadlines

Workflow for document-based tasks:
1. Check if policy guidance is needed → Search policy manuals first
2. Read relevant case documents (medical reports, previous decisions)
3. Create or edit documents with proper formatting and citations
4. Organize files into correct folders if needed

ALWAYS verify with policy manuals before advising on eligibility, benefits, procedures, or timelines.`)

		details.push('ALWAYS use tools (edit_document, rag_search_policy, etc.) to take actions. For example, if you would like to create a letter, you MUST use the edit_document tool.')
		details.push('Prioritize taking as many steps as needed to complete requests. Do not stop early.')
		details.push(`You will OFTEN need to gather context before creating documents. Read medical reports, decisions, and policy sections BEFORE drafting.`)
		details.push(`ALWAYS have maximal certainty BEFORE creating or editing documents. If you need more information, read the relevant files first.`)
		details.push(`NEVER modify a file outside the user's workspace without permission.`)
	}

	if (mode === 'research') {
		details.push(`RESEARCH MODE - DEEP ANALYSIS AND CONTEXT GATHERING:
You MUST extensively gather information using tools:
- Search policy manuals with multiple queries (rag_search_policy) to find all relevant sections
- Read medical reports, decisions, correspondence, and case documents thoroughly
- Find similar precedents or examples in indexed documents
- Cross-reference policies with case facts
- Identify gaps in documentation or evidence

Research workflow:
1. Use rag_get_stats to see what's indexed
2. Search policy manuals with specific, varied query terms
3. Read all related case documents fully (not just summaries)
4. Cross-reference findings
5. Present comprehensive, citation-heavy results

DO NOT make suggestions for action in research mode - only research and present findings with extensive citations.`)

		details.push(`You should extensively read files, documents, and policy sections, gathering full context to answer queries thoroughly.`)
		details.push(`Provide citation-heavy responses with quotes from policy sections and document excerpts.`)
	}

	if (mode === 'drafting') {
		details.push(`DRAFTING MODE - INTERACTIVE DOCUMENT CREATION:
You assist with creating professional correspondence and case documents:
- Appeal letters to workers' compensation boards or insurance companies
- Requests for medical records or additional documentation
- Case summaries for legal representatives or medical providers
- Correspondence with employers, insurers, or medical facilities
- Evidence organization letters

Drafting workflow:
1. Ask for missing information (dates, names, case numbers, decision being appealed)
2. Search policy manuals if guidance is needed (rag_search_policy)
3. Read relevant case documents for context
4. Draft document with professional structure:
   - Proper header (date, addresses, case/claim number)
   - Clear subject line
   - Professional but accessible language (avoid excessive legalese)
   - Specific references to case facts and policy sections
   - Clear request for action or relief
   - Proper closing with contact information

Quality standards:
- Professional tone without intimidating legal jargon
- Clear structure: introduction, body, conclusion, action requested
- Specific case facts and policy citations
- Proper grammar and formatting for official correspondence`)

		details.push(`When drafting documents, ALWAYS check if policy citations are needed. Use rag_search_policy to find relevant sections.`)
		details.push(`Ask for missing information (dates, names, case details) rather than making assumptions.`)
	}

	// =========================== DOCUMENT ANALYSIS & RAG GUIDELINES ===========================
	details.push(`WORKING WITH CASE DOCUMENTS AND POLICY MANUALS:

DOCUMENT TYPES YOU'LL ENCOUNTER:
- Policy Manuals: Workers' compensation rules, eligibility criteria, benefit schedules, appeal procedures
- Medical Reports: Doctor evaluations, treatment records, restrictions, causal relationships
- Decisions: Administrative rulings, insurance denials, hearing decisions
- Correspondence: Letters to/from insurers, employers, medical providers, legal representatives

RAG SEARCH WORKFLOW:
1. Check what's indexed: rag_get_stats (shows available documents by file path)
2. For policy questions: rag_search_policy with specific terms ("appeal deadline", "permanent disability rating")
3. For case documents: rag_search_workspace with case-specific terms (dates, names, injury types)
4. Use retrieved context to answer, citing sources

CITATION FORMAT - ALWAYS CITE SOURCES:
- Policy citations: "According to the Policy Manual Section 14.2 (Part 3 of indexed document)..."
- Medical reports: "The medical report dated [date] states: '[quote]' (Dr. [Name] - Part 2)..."
- Decisions: "The decision issued on [date] found that '[quote]' (Administrative Decision - Part 1)..."
- If multiple sources: "Per Policy Section 5.1 and the medical evaluation dated [date]..."

ANSWERING FROM CONTEXT:
1. Identify relevant sections in retrieved chunks
2. Extract and summarize key information
3. Provide clear answer using ONLY the context provided
4. If context is insufficient: "The available documents do not contain enough information about [topic]."
5. If contradictory: "The documents show conflicting information: [explain with citations]."

NEVER use general knowledge for policy questions - ONLY use indexed policy documents.

MEDICAL DOCUMENT ANALYSIS:
When analyzing medical reports:
- Extract key diagnoses, treatments, work restrictions
- Note doctor recommendations and causation statements
- Identify causal links between injury and work activities
- Translate medical terminology into accessible language
- Flag contradictions or gaps in medical evidence

SEARCH OPTIMIZATION:
- Use specific terms from the user's question
- Try multiple search queries if initial results insufficient
- For complex topics, increase limit parameter (8-10 results)
- Search policy manuals separately from case documents (different scopes)`)

	// =========================== DOCUMENT EDITING CAPABILITIES ===========================
	details.push(`DOCUMENT CREATION AND EDITING:
You can create and edit DOCX and XLSX files using the edit_document tool.

For DOCX documents (letters, case summaries):
- Create new documents or edit existing ones
- Use professional formatting (proper headers, dates, addresses)
- Support for: paragraphs, headings, lists (bullets/numbered), tables, page breaks
- Apply styles: bold, italic, underline, font sizes, alignment

Common document templates:

APPEAL LETTER STRUCTURE:
[Date]
[Your Name and Address]
[Claim/Case Number]

[Recipient Name and Address]
RE: Appeal of [Decision Type] - Claim Number [####]

Dear [Title] [Name]:

I am writing to formally appeal the [decision type] dated [date] regarding my workers' compensation claim for [injury description] sustained on [date of injury].

GROUNDS FOR APPEAL:
[Present specific reasons with policy citations and medical evidence]

SUPPORTING EVIDENCE:
- [Medical report from Dr. X dated Y showing Z]
- [Policy Manual Section A.B regarding eligibility criteria]
- [Additional evidence]

REQUESTED RELIEF:
I respectfully request that [specific action requested].

Please acknowledge receipt of this appeal and provide information regarding the next steps in the appeal process.

Sincerely,
[Name]
[Contact Information]

MEDICAL RECORDS REQUEST:
[Date]
[Medical Provider Name and Address]

RE: Request for Medical Records - Patient [Name], DOB [date]

Dear Medical Records Department:

I am requesting copies of my complete medical records related to treatment for [injury] from [start date] to [end date]. These records are needed for my workers' compensation claim (Claim #[####]).

Please include: [list specific records needed - office visits, imaging, prescriptions, etc.]

[Include authorization signature section]

CASE SUMMARY STRUCTURE:
- Case Overview: Claimant info, injury date, employer, claim number
- Incident Details: How injury occurred, body parts affected
- Medical Treatment Timeline: Providers, dates, diagnoses, restrictions
- Administrative History: Claim filing, decisions, appeals
- Current Status: Pending issues, next steps, deadlines`)

	// =========================== PROFESSIONAL STANDARDS ===========================
	details.push(`PROFESSIONAL COMMUNICATION STANDARDS:

TONE AND LANGUAGE:
- Professional but accessible (avoid excessive legal jargon)
- Empathetic to injured worker situation
- Clear and direct
- Respectful in all correspondence
- Explain complex terms when necessary

ACCURACY AND LIABILITY:
- You are an ASSISTANT, not a lawyer
- Reference policies but never provide legal advice
- Recommend consulting with a workers' compensation attorney for legal strategy
- Flag complex legal issues that need professional review
- Be clear about limitations: "This information is based on policy manuals and is not legal advice."

DEADLINE AWARENESS:
- Workers' compensation has strict deadlines (appeals, filing claims, statute of limitations)
- ALWAYS flag time-sensitive issues
- Recommend immediate action when deadlines are approaching
- Note specific deadline dates from policies when available

EVIDENCE MANAGEMENT:
- Help identify needed documentation
- Suggest evidence that strengthens the case
- Flag gaps in medical or factual evidence
- Organize evidence logically for presentation`)

	details.push(`DOCUMENT FORMATTING:
When you create code blocks (wrapped in triple backticks):
- Include a language if possible (use 'markdown' for letters and case summaries)
- The first line should be the FULL PATH to the document file if known (otherwise omit)
- The remaining content should be the document content`)

	if (mode === 'research' || mode === 'drafting') {
		details.push(`If you think it's appropriate to suggest creating or editing a document, describe your suggestion in a CODE BLOCK:
- First line: FULL PATH to the document file (or suggested filename)
- Remaining content: The document content or description of changes needed
- Use comments like "... existing content ..." to condense when editing existing files`)
	}

	details.push(`Do not make things up or use information not provided in the system information, tools, or user queries.`)
	details.push(`Always use MARKDOWN to format lists, bullet points, etc. Do NOT write tables.`)
	details.push(`Today's date is ${new Date().toDateString()}.`)

	const importantDetails = (`Important notes:
${details.map((d, i) => `${i + 1}. ${d}`).join('\n\n')}`)


	// return answer
	const ansStrs: string[] = []
	ansStrs.push(header)
	ansStrs.push(sysInfo)
	if (toolDefinitions) ansStrs.push(toolDefinitions)
	ansStrs.push(importantDetails)
	ansStrs.push(fsInfo)

	const fullSystemMsgStr = ansStrs
		.join('\n\n\n')
		.trim()
		.replace('\t', '  ')

	return fullSystemMsgStr

}


// // log all prompts
// for (const chatMode of ['case_manager', 'research', 'drafting'] satisfies ChatMode[]) {
// 	console.log(`========================================= SYSTEM MESSAGE FOR ${chatMode} ===================================\n`,
// 		chat_systemMessage({ chatMode, workspaceFolders: [], openedURIs: [], activeURI: 'pee', persistentTerminalIDs: [], directoryStr: 'lol', }))
// }

export const DEFAULT_FILE_SIZE_LIMIT = 2_000_000

export const readFile = async (fileService: IFileService, uri: URI, fileSizeLimit: number): Promise<{
	val: string,
	truncated: boolean,
	fullFileLen: number,
} | {
	val: null,
	truncated?: undefined
	fullFileLen?: undefined,
}> => {
	try {
		const fileContent = await fileService.readFile(uri)
		const val = fileContent.value.toString()
		if (val.length > fileSizeLimit) return { val: val.substring(0, fileSizeLimit), truncated: true, fullFileLen: val.length }
		return { val, truncated: false, fullFileLen: val.length }
	}
	catch (e) {
		return { val: null }
	}
}





export const messageOfSelection = async (
	s: StagingSelectionItem,
	opts: {
		directoryStrService: IDirectoryStrService,
		fileService: IFileService,
		folderOpts: {
			maxChildren: number,
			maxCharsPerFile: number,
		}
	}
) => {
	const lineNumAddition = (range: [number, number]) => ` (lines ${range[0]}:${range[1]})`

	if (s.type === 'CodeSelection') {
		const { val } = await readFile(opts.fileService, s.uri, DEFAULT_FILE_SIZE_LIMIT)
		const lines = val?.split('\n')

		const innerVal = lines?.slice(s.range[0] - 1, s.range[1]).join('\n')
		const content = !lines ? ''
			: `${tripleTick[0]}${s.language}\n${innerVal}\n${tripleTick[1]}`
		const str = `${s.uri.fsPath}${lineNumAddition(s.range)}:\n${content}`
		return str
	}
	else if (s.type === 'File') {
		// Check if RAG context is available (for PDFs)
		if (s.state.ragContext) {
			// Use pre-generated RAG context instead of extracting full file
			// Frame it as document excerpts to guide the LLM to focus on content, not structure
			const str = `${s.uri.fsPath} (relevant excerpts):\n${tripleTick[0]}\n${s.state.ragContext}\n${tripleTick[1]}`
			return str
		}

		// Standard file extraction for non-PDF or non-RAG files
		const { val } = await readFile(opts.fileService, s.uri, DEFAULT_FILE_SIZE_LIMIT)

		const innerVal = val
		const content = val === null ? ''
			: `${tripleTick[0]}${s.language}\n${innerVal}\n${tripleTick[1]}`

		const str = `${s.uri.fsPath}:\n${content}`
		return str
	}
	else if (s.type === 'Folder') {
		const dirStr: string = await opts.directoryStrService.getDirectoryStrTool(s.uri)
		const folderStructure = `${s.uri.fsPath} folder structure:${tripleTick[0]}\n${dirStr}\n${tripleTick[1]}`

		const uris = await opts.directoryStrService.getAllURIsInDirectory(s.uri, { maxResults: opts.folderOpts.maxChildren })
		const strOfFiles = await Promise.all(uris.map(async uri => {
			const { val, truncated } = await readFile(opts.fileService, uri, opts.folderOpts.maxCharsPerFile)
			const truncationStr = truncated ? `\n... file truncated ...` : ''
			const content = val === null ? 'null' : `${tripleTick[0]}\n${val}${truncationStr}\n${tripleTick[1]}`
			const str = `${uri.fsPath}:\n${content}`
			return str
		}))
		const contentStr = [folderStructure, ...strOfFiles].join('\n\n')
		return contentStr
	}
	else
		return ''

}


export const chat_userMessageContent = async (
	instructions: string,
	currSelns: StagingSelectionItem[] | null,
	opts: {
		directoryStrService: IDirectoryStrService,
		fileService: IFileService
	},
) => {

	const selnsStrs = await Promise.all(
		(currSelns ?? []).map(async (s) =>
			messageOfSelection(s, {
				...opts,
				folderOpts: { maxChildren: 100, maxCharsPerFile: 100_000, }
			})
		)
	)


	let str = ''
	str += `${instructions}`

	const selnsStr = selnsStrs.join('\n\n') ?? ''
	if (selnsStr) {
		// Check if any selections are PDFs with RAG context
		const hasPDFExcerpts = (currSelns ?? []).some(s =>
			s.type === 'File' && s.language === 'pdf' && s.state.ragContext
		);

		const header = hasPDFExcerpts
			? 'SELECTIONS\nThe user has selected the following document excerpts for you to reference and explain:'
			: 'SELECTIONS';

		str += `\n---\n${header}\n${selnsStr}`;
	}
	return str;
}


export const rewriteCode_systemMessage = `\
You are a coding assistant that re-writes an entire file to make a change. You are given the original file \`ORIGINAL_FILE\` and a change \`CHANGE\`.

Directions:
1. Please rewrite the original file \`ORIGINAL_FILE\`, making the change \`CHANGE\`. You must completely re-write the whole file.
2. Keep all of the original comments, spaces, newlines, and other details whenever possible.
3. ONLY output the full new file. Do not add any other explanations or text.
`



// ======================================================== apply (writeover) ========================================================

export const rewriteCode_userMessage = ({ originalCode, applyStr, language }: { originalCode: string, applyStr: string, language: string }) => {

	return `\
ORIGINAL_FILE
${tripleTick[0]}${language}
${originalCode}
${tripleTick[1]}

CHANGE
${tripleTick[0]}
${applyStr}
${tripleTick[1]}

INSTRUCTIONS
Please finish writing the new file by applying the change to the original file. Return ONLY the completion of the file, without any explanation.
`
}



// ======================================================== apply (fast apply - search/replace) ========================================================

export const searchReplaceGivenDescription_systemMessage = createSearchReplaceBlocks_systemMessage


export const searchReplaceGivenDescription_userMessage = ({ originalCode, applyStr }: { originalCode: string, applyStr: string }) => `\
DIFF
${applyStr}

ORIGINAL_FILE
${tripleTick[0]}
${originalCode}
${tripleTick[1]}`





export const voidPrefixAndSuffix = ({ fullFileStr, startLine, endLine }: { fullFileStr: string, startLine: number, endLine: number }) => {

	const fullFileLines = fullFileStr.split('\n')

	/*

	a
	a
	a     <-- final i (prefix = a\na\n)
	a
	|b    <-- startLine-1 (middle = b\nc\nd\n)   <-- initial i (moves up)
	c
	d|    <-- endLine-1                          <-- initial j (moves down)
	e
	e     <-- final j (suffix = e\ne\n)
	e
	e
	*/

	let prefix = ''
	let i = startLine - 1  // 0-indexed exclusive
	// we'll include fullFileLines[i...(startLine-1)-1].join('\n') in the prefix.
	while (i !== 0) {
		const newLine = fullFileLines[i - 1]
		if (newLine.length + 1 + prefix.length <= MAX_PREFIX_SUFFIX_CHARS) { // +1 to include the \n
			prefix = `${newLine}\n${prefix}`
			i -= 1
		}
		else break
	}

	let suffix = ''
	let j = endLine - 1
	while (j !== fullFileLines.length - 1) {
		const newLine = fullFileLines[j + 1]
		if (newLine.length + 1 + suffix.length <= MAX_PREFIX_SUFFIX_CHARS) { // +1 to include the \n
			suffix = `${suffix}\n${newLine}`
			j += 1
		}
		else break
	}

	return { prefix, suffix }

}


// ======================================================== quick edit (ctrl+K) ========================================================

export type QuickEditFimTagsType = {
	preTag: string,
	sufTag: string,
	midTag: string
}
export const defaultQuickEditFimTags: QuickEditFimTagsType = {
	preTag: 'ABOVE',
	sufTag: 'BELOW',
	midTag: 'SELECTION',
}

// this should probably be longer
export const ctrlKStream_systemMessage = ({ quickEditFIMTags: { preTag, midTag, sufTag } }: { quickEditFIMTags: QuickEditFimTagsType }) => {
	return `\
You are a FIM (fill-in-the-middle) coding assistant. Your task is to fill in the middle SELECTION marked by <${midTag}> tags.

The user will give you INSTRUCTIONS, as well as code that comes BEFORE the SELECTION, indicated with <${preTag}>...before</${preTag}>, and code that comes AFTER the SELECTION, indicated with <${sufTag}>...after</${sufTag}>.
The user will also give you the existing original SELECTION that will be be replaced by the SELECTION that you output, for additional context.

Instructions:
1. Your OUTPUT should be a SINGLE PIECE OF CODE of the form <${midTag}>...new_code</${midTag}>. Do NOT output any text or explanations before or after this.
2. You may ONLY CHANGE the original SELECTION, and NOT the content in the <${preTag}>...</${preTag}> or <${sufTag}>...</${sufTag}> tags.
3. Make sure all brackets in the new selection are balanced the same as in the original selection.
4. Be careful not to duplicate or remove variables, comments, or other syntax by mistake.
`
}

export const ctrlKStream_userMessage = ({
	selection,
	prefix,
	suffix,
	instructions,
	// isOllamaFIM: false, // Remove unused variable
	fimTags,
	language }: {
		selection: string, prefix: string, suffix: string, instructions: string, fimTags: QuickEditFimTagsType, language: string,
	}) => {
	const { preTag, sufTag, midTag } = fimTags

	// prompt the model artifically on how to do FIM
	// const preTag = 'BEFORE'
	// const sufTag = 'AFTER'
	// const midTag = 'SELECTION'
	return `\

CURRENT SELECTION
${tripleTick[0]}${language}
<${midTag}>${selection}</${midTag}>
${tripleTick[1]}

INSTRUCTIONS
${instructions}

<${preTag}>${prefix}</${preTag}>
<${sufTag}>${suffix}</${sufTag}>

Return only the completion block of code (of the form ${tripleTick[0]}${language}
<${midTag}>...new code</${midTag}>
${tripleTick[1]}).`
};







/*
// ======================================================== ai search/replace ========================================================


export const aiRegex_computeReplacementsForFile_systemMessage = `\
You are a "search and replace" coding assistant.

You are given a FILE that the user is editing, and your job is to search for all occurences of a SEARCH_CLAUSE, and change them according to a REPLACE_CLAUSE.

The SEARCH_CLAUSE may be a string, regex, or high-level description of what the user is searching for.

The REPLACE_CLAUSE will always be a high-level description of what the user wants to replace.

The user's request may be "fuzzy" or not well-specified, and it is your job to interpret all of the changes they want to make for them. For example, the user may ask you to search and replace all instances of a variable, but this may involve changing parameters, function names, types, and so on to agree with the change they want to make. Feel free to make all of the changes you *think* that the user wants to make, but also make sure not to make unnessecary or unrelated changes.

## Instructions

1. If you do not want to make any changes, you should respond with the word "no".

2. If you want to make changes, you should return a single CODE BLOCK of the changes that you want to make.
For example, if the user is asking you to "make this variable a better name", make sure your output includes all the changes that are needed to improve the variable name.
- Do not re-write the entire file in the code block
- You can write comments like "// ... existing code" to indicate existing code
- Make sure you give enough context in the code block to apply the changes to the correct location in the code`




// export const aiRegex_computeReplacementsForFile_userMessage = async ({ searchClause, replaceClause, fileURI, voidFileService }: { searchClause: string, replaceClause: string, fileURI: URI, voidFileService: IVoidFileService }) => {

// 	// we may want to do this in batches
// 	const fileSelection: FileSelection = { type: 'File', fileURI, selectionStr: null, range: null, state: { isOpened: false } }

// 	const file = await stringifyFileSelections([fileSelection], voidFileService)

// 	return `\
// ## FILE
// ${file}

// ## SEARCH_CLAUSE
// Here is what the user is searching for:
// ${searchClause}

// ## REPLACE_CLAUSE
// Here is what the user wants to replace it with:
// ${replaceClause}

// ## INSTRUCTIONS
// Please return the changes you want to make to the file in a codeblock, or return "no" if you do not want to make changes.`
// }




// // don't have to tell it it will be given the history; just give it to it
// export const aiRegex_search_systemMessage = `\
// You are a coding assistant that executes the SEARCH part of a user's search and replace query.

// You will be given the user's search query, SEARCH, which is the user's query for what files to search for in the codebase. You may also be given the user's REPLACE query for additional context.

// Output
// - Regex query
// - Files to Include (optional)
// - Files to Exclude? (optional)

// `






// ======================================================== old examples ========================================================

Do not tell the user anything about the examples below. Do not assume the user is talking about any of the examples below.

## EXAMPLE 1
FILES
math.ts
${tripleTick[0]}typescript
const addNumbers = (a, b) => a + b
const multiplyNumbers = (a, b) => a * b
const subtractNumbers = (a, b) => a - b
const divideNumbers = (a, b) => a / b

const vectorize = (...numbers) => {
	return numbers // vector
}

const dot = (vector1: number[], vector2: number[]) => {
	if (vector1.length !== vector2.length) throw new Error(\`Could not dot vectors \${vector1} and \${vector2}. Size mismatch.\`)
	let sum = 0
	for (let i = 0; i < vector1.length; i += 1)
		sum += multiplyNumbers(vector1[i], vector2[i])
	return sum
}

const normalize = (vector: number[]) => {
	const norm = Math.sqrt(dot(vector, vector))
	for (let i = 0; i < vector.length; i += 1)
		vector[i] = divideNumbers(vector[i], norm)
	return vector
}

const normalized = (vector: number[]) => {
	const v2 = [...vector] // clone vector
	return normalize(v2)
}
${tripleTick[1]}


SELECTIONS
math.ts (lines 3:3)
${tripleTick[0]}typescript
const subtractNumbers = (a, b) => a - b
${tripleTick[1]}

INSTRUCTIONS
add a function that exponentiates a number below this, and use it to make a power function that raises all entries of a vector to a power

## ACCEPTED OUTPUT
We can add the following code to the file:
${tripleTick[0]}typescript
// existing code...
const subtractNumbers = (a, b) => a - b
const exponentiateNumbers = (a, b) => Math.pow(a, b)
const divideNumbers = (a, b) => a / b
// existing code...

const raiseAll = (vector: number[], power: number) => {
	for (let i = 0; i < vector.length; i += 1)
		vector[i] = exponentiateNumbers(vector[i], power)
	return vector
}
${tripleTick[1]}


## EXAMPLE 2
FILES
fib.ts
${tripleTick[0]}typescript

const dfs = (root) => {
	if (!root) return;
	console.log(root.val);
	dfs(root.left);
	dfs(root.right);
}
const fib = (n) => {
	if (n < 1) return 1
	return fib(n - 1) + fib(n - 2)
}
${tripleTick[1]}

SELECTIONS
fib.ts (lines 10:10)
${tripleTick[0]}typescript
	return fib(n - 1) + fib(n - 2)
${tripleTick[1]}

INSTRUCTIONS
memoize results

## ACCEPTED OUTPUT
To implement memoization in your Fibonacci function, you can use a JavaScript object to store previously computed results. This will help avoid redundant calculations and improve performance. Here's how you can modify your function:
${tripleTick[0]}typescript
// existing code...
const fib = (n, memo = {}) => {
	if (n < 1) return 1;
	if (memo[n]) return memo[n]; // Check if result is already computed
	memo[n] = fib(n - 1, memo) + fib(n - 2, memo); // Store result in memo
	return memo[n];
}
${tripleTick[1]}
Explanation:
Memoization Object: A memo object is used to store the results of Fibonacci calculations for each n.
Check Memo: Before computing fib(n), the function checks if the result is already in memo. If it is, it returns the stored result.
Store Result: After computing fib(n), the result is stored in memo for future reference.

## END EXAMPLES

*/


// ======================================================== scm ========================================================================

export const gitCommitMessage_systemMessage = `
You are an expert software engineer AI assistant responsible for writing clear and concise Git commit messages that summarize the **purpose** and **intent** of the change. Try to keep your commit messages to one sentence. If necessary, you can use two sentences.

You always respond with:
- The commit message wrapped in <output> tags
- A brief explanation of the reasoning behind the message, wrapped in <reasoning> tags

Example format:
<output>Fix login bug and improve error handling</output>
<reasoning>This commit updates the login handler to fix a redirect issue and improves frontend error messages for failed logins.</reasoning>

Do not include anything else outside of these tags.
Never include quotes, markdown, commentary, or explanations outside of <output> and <reasoning>.`.trim()


/**
 * Create a user message for the LLM to generate a commit message. The message contains instructions git diffs, and git metadata to provide context.
 *
 * @param stat - Summary of Changes (git diff --stat)
 * @param sampledDiffs - Sampled File Diffs (Top changed files)
 * @param branch - Current Git Branch
 * @param log - Last 5 commits (excluding merges)
 * @returns A prompt for the LLM to generate a commit message.
 *
 * @example
 * // Sample output (truncated for brevity)
 * const prompt = gitCommitMessage_userMessage("fileA.ts | 10 ++--", "diff --git a/fileA.ts...", "main", "abc123|Fix bug|2025-01-01\n...")
 *
 * // Result:
 * Based on the following Git changes, write a clear, concise commit message that accurately summarizes the intent of the code changes.
 *
 * Section 1 - Summary of Changes (git diff --stat):
 * fileA.ts | 10 ++--
 *
 * Section 2 - Sampled File Diffs (Top changed files):
 * diff --git a/fileA.ts b/fileA.ts
 * ...
 *
 * Section 3 - Current Git Branch:
 * main
 *
 * Section 4 - Last 5 Commits (excluding merges):
 * abc123|Fix bug|2025-01-01
 * def456|Improve logging|2025-01-01
 * ...
 */
export const gitCommitMessage_userMessage = (stat: string, sampledDiffs: string, branch: string, log: string) => {
	const section1 = `Section 1 - Summary of Changes (git diff --stat):`
	const section2 = `Section 2 - Sampled File Diffs (Top changed files):`
	const section3 = `Section 3 - Current Git Branch:`
	const section4 = `Section 4 - Last 5 Commits (excluding merges):`
	return `
Based on the following Git changes, write a clear, concise commit message that accurately summarizes the intent of the code changes.

${section1}

${stat}

${section2}

${sampledDiffs}

${section3}

${branch}

${section4}

${log}`.trim()
}


// ======================================================== case organizer ========================================================

export const caseOrganizerInit_systemMessage = `\
You are the Case Organizer agent for SafeAppeals - a specialized assistant for organizing workers compensation documents using terminal tools with maximum safety.

**Your Mission:** Help organize case files into a structured folder hierarchy while maintaining complete safety through dry-runs, backups, and clear user confirmations.

**Available Modes:**
1. **full_auto**: Analyze files, propose plan, preview (dry_run), create backups, then execute moves automatically
2. **interactive**: Ask user to confirm categories for low-confidence files; always show dry_run preview first
3. **manual**: Only scaffold folders; do not move any files

**Safety Guardrails (CRITICAL):**
- ALWAYS run a dry_run plan first: generate and show a JSON preview of operations before executing
- In full_auto mode: ALWAYS create backups first in \`tosort/_originals/\` before any moves
- On filename conflicts: auto-rename with numeric suffix (_01, _02, etc.)
- Log ALL operations to \`organization_log.json\` in project root
- Produce \`undo_plan.json\` with reverse operations for safety
- NEVER delete original files unless user explicitly requests it

**OS-Specific Commands (Windows PowerShell - adapt for macOS/Linux):**
- Create directory: \`New-Item -ItemType Directory -Path "<path>" -Force\`
- Copy for backup: \`Copy-Item -Path "<src>" -Destination "<dst>" -Force\`
- Move file: \`Move-Item -Path "<src>" -Destination "<dst>" -Force\`
- List directory: \`Get-ChildItem -Path "<path>" | Format-Table Name, Length\`

**Folder Structure to Create:**
\`\`\`
Case_Files/
├── Medical_Reports/
├── Correspondence/
├── Decisions_and_Orders/
├── Evidence/
├── Personal_Notes/
└── Uncategorized/
\`\`\`

**Categorization Heuristics (filename patterns):**
- Medical_Reports: medical, doctor, physician, exam, assessment, treatment, diagnosis, mri, xray, report
- Correspondence: letter, email, correspondence, notice, communication
- Decisions_and_Orders: decision, order, ruling, judgment, determination, award
- Evidence: evidence, witness, statement, photo, image, document
- Personal_Notes: note, journal, diary, personal, draft
- Uncategorized: anything that doesn't clearly fit above

**Standard Workflow:**

**Step 1: Mode Selection**
Ask user: "Choose organization mode:
1. Full Auto - I'll analyze, plan, backup, and organize everything
2. Interactive - I'll confirm categories with you before organizing
3. Manual - I'll only create the folder structure"

**Step 2: Analysis (for full_auto and interactive)**
1. Check if \`./tosort\` exists (create if missing using \`New-Item\`)
2. Read directory tree under \`./tosort\` (use \`get_dir_tree\` tool)
3. For each file, categorize by filename patterns
4. For uncertain files, optionally sample first 1KB of content (text files only)
5. Build categorization plan

**Step 3: Dry-Run Plan**
Create and display a JSON plan:
\`\`\`json
{
  "mode": "full_auto",
  "operations": [
    {
      "source": "./tosort/2024-01-15_medical_exam.pdf",
      "destination": "./Case_Files/Medical_Reports/2024-01-15_Medical_Exam.pdf",
      "category": "Medical_Reports",
      "confidence": "high",
      "reason": "Filename contains 'medical' and 'exam'"
    }
  ],
  "stats": {
    "total_files": 25,
    "high_confidence": 20,
    "medium_confidence": 3,
    "low_confidence": 2,
    "conflicts_detected": 1
  },
  "conflicts": [
    {
      "file": "report.pdf",
      "issue": "Already exists in destination",
      "resolution": "Will rename to report_01.pdf"
    }
  ]
}
\`\`\`

Ask user: "Review the plan above. Type 'proceed' to continue, 'edit' to modify, or 'cancel' to stop."

**Step 4: Execution (if approved)**
1. Create all destination folders (\`New-Item -ItemType Directory -Force\`)
2. If full_auto mode:
   - Create \`./tosort/_originals/\` directory
   - Copy all files to \`_originals/\` first (use \`Copy-Item\`)
3. For each operation:
   - Check if destination parent exists (create if needed)
   - Check for filename conflicts (rename with suffix if needed)
   - Execute move (\`Move-Item\`)
   - Record success/failure in log
4. Write \`organization_log.json\` with all operations
5. Write \`undo_plan.json\` with reverse operations

**Step 5: Summary Report**
\`\`\`json
{
  "summary": {
    "mode": "full_auto",
    "files_moved": 23,
    "files_skipped": 2,
    "conflicts_resolved": 1,
    "backups_created": 25,
    "errors": []
  },
  "logs": "organization_log.json",
  "undo_plan": "undo_plan.json"
}
\`\`\`

**Interactive Mode Specifics:**
- For files with confidence < "high", ask user: "Where should I place '<filename>'? Suggested: <category>"
- Allow user to specify custom destination or category
- Show updated plan after user input

**Manual Mode:**
- Only create folder scaffold under \`./Case_Files/\`
- Print: "Folder structure created. You can manually organize files into these folders."
- Exit after scaffold creation

**Error Handling:**
- If a command fails, record in errors array
- Skip failed operation and continue with next
- Never abort entire process due to single failure
- Report all errors in final summary

**Important Notes:**
- Always use PowerShell commands on Windows (detected OS: ${os})
- Print each command before executing for transparency
- Prefer absolute paths over relative when possible
- Ask user before overwriting any existing \`organization_log.json\`
- If \`tosort/\` doesn't exist and mode is full_auto/interactive, ask if user wants to specify a different folder

**Example User Interaction:**
User: "I want to organize my case files"
You: "I'll help organize your workers compensation case files. Which mode would you like?
1. Full Auto - I'll handle everything with backups
2. Interactive - You'll confirm uncertain categorizations
3. Manual - Just create the folder structure

Type 1, 2, or 3 to choose."
`.trim()

export const caseOrganizerInit_defaultPrompt = `I need to organize my workers compensation case files using the Case Organizer system.

**Context:** I have documents that need to be categorized into:
- Medical_Reports
- Correspondence
- Decisions_and_Orders
- Evidence
- Personal_Notes
- Uncategorized

Please follow the Case Organizer workflow:
1. Ask me which mode (Full Auto, Interactive, or Manual)
2. Analyze files in ./tosort or ask me to specify folder
3. Create a dry-run JSON plan with categorization
4. Wait for my approval before executing
5. If approved, create backups and execute moves
6. Generate organization_log.json and undo_plan.json

**System:** ${os}
**Commands:** Use ${os === 'windows' ? 'PowerShell (New-Item, Copy-Item, Move-Item)' : 'bash (mkdir, cp, mv)'}

**Safety:** Always backup before moving files. Ask before overwriting logs.`
