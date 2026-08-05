/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';

export const SAFEAPPEALS_READ_FILE_TOOL = 'safeappeals_readFile';
export const SAFEAPPEALS_LIST_DIR_TOOL = 'safeappeals_listDir';
export const SAFEAPPEALS_EDIT_FILE_TOOL = 'safeappeals_editFile';
export const SAFEAPPEALS_CREATE_FILE_TOOL = 'safeappeals_createFile';
export const SAFEAPPEALS_CREATE_DIRECTORY_TOOL = 'safeappeals_createDirectory';
export const SAFEAPPEALS_FIND_FILES_TOOL = 'safeappeals_findFiles';
export const SAFEAPPEALS_FIND_TEXT_IN_FILES_TOOL = 'safeappeals_findTextInFiles';
export const SAFEAPPEALS_SEARCH_WORKSPACE_SYMBOLS_TOOL = 'safeappeals_searchWorkspaceSymbols';
export const SAFEAPPEALS_GET_ERRORS_TOOL = 'safeappeals_getErrors';
export const SAFEAPPEALS_GET_CHANGED_FILES_TOOL = 'safeappeals_getChangedFiles';
export const SAFEAPPEALS_SEARCH_CODEBASE_TOOL = 'safeappeals_searchCodebase';
export const SAFEAPPEALS_REPLACE_STRING_TOOL = 'safeappeals_replaceString';
export const SAFEAPPEALS_MULTI_REPLACE_STRING_TOOL = 'safeappeals_multiReplaceString';
export const SAFEAPPEALS_APPLY_PATCH_TOOL = 'safeappeals_applyPatch';
export const SAFEAPPEALS_RUN_VSCODE_COMMAND_TOOL = 'safeappeals_runVscodeCommand';
export const SAFEAPPEALS_FETCH_WEB_PAGE_TOOL = 'safeappeals_fetchWebPage';
export const SAFEAPPEALS_WEB_SEARCH_TOOL = 'safeappeals_webSearch';
export const SAFEAPPEALS_MULTI_WEB_SEARCH_TOOL = 'safeappeals_multiWebSearch';
export const SAFEAPPEALS_SWITCH_MODE_TOOL = 'safeappeals_switchMode';

/** Registered core edit tool id (extension API may also surface the legacy alias). */
export const VSCODE_EDIT_FILE_TOOL = 'vscode_editFile_internal';

/** Legacy / extension-facing edit id — invoke remaps to {@link VSCODE_EDIT_FILE_TOOL}. */
export const VSCODE_EDIT_FILE_TOOL_ALIAS = 'vscode_editFile';

/** Core host fetch tool id (electron built-in). */
export const VSCODE_FETCH_WEB_PAGE_TOOL = 'vscode_fetchWebPage_internal';

/** Plain tool shape for `sendRequest` (avoids spreading LanguageModelToolInformation class instances). */
export interface AgentChatToolDescriptor {
	readonly name: string;
	readonly description: string;
	readonly inputSchema?: object;
}

/**
 * Allowlisted host tools (present when core/extension registered them).
 * Includes terminal/todo, edit, fetch, and known browser tool ids.
 */
export const CORE_AGENT_TOOL_NAMES: readonly string[] = [
	VSCODE_EDIT_FILE_TOOL,
	VSCODE_FETCH_WEB_PAGE_TOOL,
	'run_in_terminal',
	'manage_todo_list',
	'browserTool',
	'open_browser_page',
	'click_element',
	'screenshot_page',
	'navigate_page',
	'read_page',
	'hover_element',
	'drag_element',
	'type_in_page',
	'handle_dialog',
	'run_playwright_code',
	// SafeAppeals Timeline (void-compatible names; not safeappeals_*-prefixed)
	'timeline_add_event',
	'timeline_update_event',
	'timeline_delete_event',
	'timeline_get_events',
	'timeline_link_document',
	'timeline_get_deadlines',
];

/**
 * Tools force-added unless the picker explicitly disabled them (or a mapped Copilot alias).
 * Terminal / todo are never force-added — picker opt-out wins.
 */
export const ENSURED_AGENT_TOOL_NAMES: readonly string[] = [
	SAFEAPPEALS_READ_FILE_TOOL,
	SAFEAPPEALS_LIST_DIR_TOOL,
	SAFEAPPEALS_EDIT_FILE_TOOL,
	SAFEAPPEALS_CREATE_FILE_TOOL,
	SAFEAPPEALS_CREATE_DIRECTORY_TOOL,
	SAFEAPPEALS_FIND_FILES_TOOL,
	SAFEAPPEALS_FIND_TEXT_IN_FILES_TOOL,
	SAFEAPPEALS_SEARCH_WORKSPACE_SYMBOLS_TOOL,
	SAFEAPPEALS_GET_ERRORS_TOOL,
	SAFEAPPEALS_GET_CHANGED_FILES_TOOL,
	SAFEAPPEALS_SEARCH_CODEBASE_TOOL,
	SAFEAPPEALS_REPLACE_STRING_TOOL,
	SAFEAPPEALS_MULTI_REPLACE_STRING_TOOL,
	SAFEAPPEALS_APPLY_PATCH_TOOL,
	SAFEAPPEALS_RUN_VSCODE_COMMAND_TOOL,
	SAFEAPPEALS_FETCH_WEB_PAGE_TOOL,
	SAFEAPPEALS_WEB_SEARCH_TOOL,
	SAFEAPPEALS_MULTI_WEB_SEARCH_TOOL,
	SAFEAPPEALS_SWITCH_MODE_TOOL,
];

const SWITCH_MODE_MODEL_DESCRIPTION =
	'Switch the current chat between Plan and Agent modes. Call this tool yourself — NEVER ask the user which mode to use.\n\n' +
	'Your current mode is stated in the mode reminder earlier in this turn. Use that; do not ask.\n\n' +
	'In Ask mode (or any mode without tools for the work), call this tool to leave Ask for Agent or Plan — never ask the user.\n\n' +
	'SWITCH TO PLAN when ANY of these apply:\n' +
	'1. Adding new functionality - where should it go? What patterns to follow?\n' +
	'2. Multiple valid approaches exist - choosing between technologies, patterns, or strategies\n' +
	'3. Modifying existing behavior - unclear what should change or what side effects exist\n' +
	'4. Architectural decisions required - choosing between design patterns or integration approaches\n' +
	'5. Changes span multiple files - refactoring, migrations, or cross-cutting concerns\n' +
	'6. Requirements are underspecified - need to explore before understanding scope\n\n' +
	'SWITCH TO AGENT when planning is done and you should implement, edit files, or execute the agreed plan.\n\n' +
	'Do NOT switch to Plan when the user already attached a detailed spec, you already started editing, ' +
	'the change is a single obvious fix, or the user gave explicit step-by-step instructions.';

const WEB_SEARCH_MODEL_DESCRIPTION =
	'Search the web via SafeAppeals Cloud (Brave Search). Returns ranked titles, URLs, snippets, and optional metadata ' +
	'(Published/Domain/extra snippets) for YOU the agent to read — there is no AI summary. Ideal for general queries, news, articles, and recent events. ' +
	'Optional filters: safesearch, freshness (pd|pw|pm|py or past_day|…), country, search_lang, ui_lang, site. ' +
	'Optional autoFetch (1–5) fetches raw full page text for the top N result URLs. Credits apply (~250 per search). ' +
	'Maximum 20 results; use offset for pagination.';

const MULTI_WEB_SEARCH_MODEL_DESCRIPTION =
	'Run multiple sequential web searches via SafeAppeals Cloud (Brave Search). Returns ranked titles, URLs, and snippets ' +
	'for YOU the agent to read — there is no AI summary. Ideal for batch information gathering. ' +
	'Optional filters apply to every query: safesearch, freshness, country, search_lang, ui_lang, site. ' +
	'Credits apply (~250 per query). Maximum 10 queries, 20 results per query.';

const EDIT_FILE_MODEL_DESCRIPTION =
	'Insert new code into an existing file in the workspace. Use this tool once per file that needs to be modified, even if there are multiple changes for a file. Generate the "explanation" property first.\n' +
	'The system is very smart and can understand how to apply your edits to the files, you just need to provide minimal hints.\n' +
	'Avoid repeating existing code, instead use comments to represent regions of unchanged code. Be as concise as possible. For example:\n' +
	'// ...existing code...\n{ changed code }\n// ...existing code...\n{ changed code }\n// ...existing code...\n\n' +
	'Here is an example of how you should use format an edit to an existing Person class:\n' +
	'class Person {\n\t// ...existing code...\n\tage: number;\n\t// ...existing code...\n\tgetAge() {\n\treturn this.age;\n\t}\n}';

const EDIT_FILE_CODE_DESCRIPTION =
	'The code change to apply to the file.\n' +
	'The system is very smart and can understand how to apply your edits to the files, you just need to provide minimal hints.\n' +
	'Avoid repeating existing code, instead use comments to represent regions of unchanged code. Be as concise as possible. For example:\n' +
	'// ...existing code...\n{ changed code }\n// ...existing code...\n{ changed code }\n// ...existing code...\n\n' +
	'Here is an example of how you should use format an edit to an existing Person class:\n' +
	'class Person {\n\t// ...existing code...\n\tage: number;\n\t// ...existing code...\n\tgetAge() {\n\t\treturn this.age;\n\t}\n}';

/**
 * Hardcoded descriptors matching `package.json` languageModelTools (used when absent from `lm.tools`).
 */
export const ENSURED_AGENT_TOOL_DESCRIPTORS: Readonly<Record<string, AgentChatToolDescriptor>> = {
	[SAFEAPPEALS_READ_FILE_TOOL]: {
		name: SAFEAPPEALS_READ_FILE_TOOL,
		description: 'Read the contents of a file in the workspace. Prefer this when you need file text before editing.',
		inputSchema: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description: 'Workspace-relative or absolute path to the file to read.',
				},
			},
			required: ['path'],
		},
	},
	[SAFEAPPEALS_LIST_DIR_TOOL]: {
		name: SAFEAPPEALS_LIST_DIR_TOOL,
		description: 'List files and folders in a workspace directory.',
		inputSchema: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description: 'Workspace-relative or absolute directory path. Defaults to the workspace root.',
				},
			},
		},
	},
	[SAFEAPPEALS_EDIT_FILE_TOOL]: {
		name: SAFEAPPEALS_EDIT_FILE_TOOL,
		description: EDIT_FILE_MODEL_DESCRIPTION,
		inputSchema: {
			type: 'object',
			properties: {
				explanation: {
					type: 'string',
					description: 'A short explanation of the edit being made.',
				},
				filePath: {
					type: 'string',
					description: 'An absolute path to the file to edit.',
				},
				code: {
					type: 'string',
					description: EDIT_FILE_CODE_DESCRIPTION,
				},
			},
			required: ['explanation', 'filePath', 'code'],
		},
	},
	[SAFEAPPEALS_CREATE_FILE_TOOL]: {
		name: SAFEAPPEALS_CREATE_FILE_TOOL,
		description: 'This is a tool for creating a new file in the workspace. The file will be created with the specified content. The directory will be created if it does not already exist. Never use this tool to edit a file that already exists.',
		inputSchema: {
			type: 'object',
			properties: {
				filePath: {
					type: 'string',
					description: 'The absolute path to the file to create.',
				},
				content: {
					type: 'string',
					description: 'The content to write to the file.',
				},
			},
			required: ['filePath', 'content'],
		},
	},
	[SAFEAPPEALS_CREATE_DIRECTORY_TOOL]: {
		name: SAFEAPPEALS_CREATE_DIRECTORY_TOOL,
		description: 'Create a new directory structure in the workspace. Will recursively create all directories in the path, like mkdir -p. You do not need to use this tool before using create_file, that tool will automatically create the needed directories.',
		inputSchema: {
			type: 'object',
			properties: {
				dirPath: {
					type: 'string',
					description: 'The absolute path to the directory to create.',
				},
			},
			required: ['dirPath'],
		},
	},
	[SAFEAPPEALS_FIND_FILES_TOOL]: {
		name: SAFEAPPEALS_FIND_FILES_TOOL,
		description: 'Search for files in the workspace by glob pattern. This only returns the paths of matching files. Use this tool when you know the exact filename pattern of the files you\'re searching for.',
		inputSchema: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: 'Search for files with names or paths matching this glob pattern.',
				},
				maxResults: {
					type: 'number',
					description: 'The maximum number of results to return (capped).',
				},
			},
			required: ['query'],
		},
	},
	[SAFEAPPEALS_FIND_TEXT_IN_FILES_TOOL]: {
		name: SAFEAPPEALS_FIND_TEXT_IN_FILES_TOOL,
		description: 'Do a fast text search in the workspace. Use this tool when you want to search with an exact string or regex.',
		inputSchema: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: 'The pattern to search for in files in the workspace.',
				},
				isRegexp: {
					type: 'boolean',
					description: 'Whether the pattern is a regex.',
				},
				includePattern: {
					type: 'string',
					description: 'Search files matching this glob pattern.',
				},
				maxResults: {
					type: 'number',
					description: 'The maximum number of results to return (capped).',
				},
				includeIgnoredFiles: {
					type: 'boolean',
					description: 'Whether to include files normally ignored by .gitignore and exclude settings.',
				},
			},
			required: ['query'],
		},
	},
	[SAFEAPPEALS_SEARCH_WORKSPACE_SYMBOLS_TOOL]: {
		name: SAFEAPPEALS_SEARCH_WORKSPACE_SYMBOLS_TOOL,
		description: 'Search the user\'s workspace for code symbols using language services. Use this tool when the user is looking for a specific symbol in their workspace.',
		inputSchema: {
			type: 'object',
			properties: {
				symbolName: {
					type: 'string',
					description: 'The symbol to search for, such as a function name, class name, or variable name.',
				},
			},
			required: ['symbolName'],
		},
	},
	[SAFEAPPEALS_GET_ERRORS_TOOL]: {
		name: SAFEAPPEALS_GET_ERRORS_TOOL,
		description: 'Get any compile or lint errors in a specific file or across all files. Also use this tool after editing a file to validate the change.',
		inputSchema: {
			type: 'object',
			properties: {
				filePaths: {
					type: 'array',
					items: { type: 'string' },
					description: 'Optional list of workspace file paths. If omitted, returns problems across the workspace. An empty array returns no results.',
				},
			},
		},
	},
	[SAFEAPPEALS_GET_CHANGED_FILES_TOOL]: {
		name: SAFEAPPEALS_GET_CHANGED_FILES_TOOL,
		description: 'Get git-changed files in a git repository via the vscode.git extension API. Don\'t forget that you can use run_in_terminal to run git commands as well.',
		inputSchema: {
			type: 'object',
			properties: {
				repositoryPath: {
					type: 'string',
					description: 'The absolute path to the git repository to look for changes in. If not provided, the first git repository is used.',
				},
				sourceControlState: {
					type: 'array',
					items: {
						type: 'string',
						enum: ['staged', 'unstaged', 'merge-conflicts'],
					},
					description: 'The kinds of git state to filter by. If not provided, all states are included.',
				},
			},
		},
	},
	[SAFEAPPEALS_SEARCH_CODEBASE_TOOL]: {
		name: SAFEAPPEALS_SEARCH_CODEBASE_TOOL,
		description: 'Search the workspace codebase for relevant code using enhanced text search over query tokens. Returns path and snippet matches (no Copilot index).',
		inputSchema: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: 'The query to search the codebase for. Should ideally be text that might appear in the codebase, such as function names, variable names, or comments.',
				},
			},
			required: ['query'],
		},
	},
	[SAFEAPPEALS_REPLACE_STRING_TOOL]: {
		name: SAFEAPPEALS_REPLACE_STRING_TOOL,
		description:
			'Replace exactly one occurrence of a literal string in an existing workspace file. Provide filePath, oldString (exact match including whitespace), and newString. Fails if oldString matches zero or multiple times.',
		inputSchema: {
			type: 'object',
			properties: {
				filePath: {
					type: 'string',
					description: 'An absolute path to the file to edit.',
				},
				oldString: {
					type: 'string',
					description: 'The exact literal text to replace. Must uniquely identify one occurrence.',
				},
				newString: {
					type: 'string',
					description: 'The exact literal text to replace oldString with.',
				},
				explanation: {
					type: 'string',
					description: 'A short explanation of the edit being made.',
				},
			},
			required: ['filePath', 'oldString', 'newString'],
		},
	},
	[SAFEAPPEALS_MULTI_REPLACE_STRING_TOOL]: {
		name: SAFEAPPEALS_MULTI_REPLACE_STRING_TOOL,
		description:
			'Apply multiple exact one-occurrence string replacements in a single call. Each replacement has filePath, oldString, and newString. Replacements are applied sequentially.',
		inputSchema: {
			type: 'object',
			properties: {
				explanation: {
					type: 'string',
					description: 'A brief explanation of what the multi-replace operation will accomplish.',
				},
				replacements: {
					type: 'array',
					description: 'Replacement operations to apply sequentially.',
					items: {
						type: 'object',
						properties: {
							filePath: { type: 'string', description: 'An absolute path to the file to edit.' },
							oldString: { type: 'string', description: 'The exact literal text to replace.' },
							newString: { type: 'string', description: 'The exact literal replacement text.' },
						},
						required: ['filePath', 'oldString', 'newString'],
					},
					minItems: 1,
				},
			},
			required: ['explanation', 'replacements'],
		},
	},
	[SAFEAPPEALS_APPLY_PATCH_TOOL]: {
		name: SAFEAPPEALS_APPLY_PATCH_TOOL,
		description:
			'Apply a V4A-lite / unified-diff-style patch to workspace files. Pass an "input" string wrapped in *** Begin Patch / *** End Patch with *** Add File, *** Update File, or *** Delete File sections and @@ hunks using space/-/+ line prefixes.',
		inputSchema: {
			type: 'object',
			properties: {
				input: {
					type: 'string',
					description: 'The edit patch to apply (*** Begin Patch … *** End Patch).',
				},
				explanation: {
					type: 'string',
					description: 'A short description of what the patch aims to achieve.',
				},
			},
			required: ['input', 'explanation'],
		},
	},
	[SAFEAPPEALS_RUN_VSCODE_COMMAND_TOOL]: {
		name: SAFEAPPEALS_RUN_VSCODE_COMMAND_TOOL,
		description:
			'Run a VS Code command via executeCommand. Commands with known-safe prefixes run directly; others require user confirmation.',
		inputSchema: {
			type: 'object',
			properties: {
				commandId: {
					type: 'string',
					description: 'The ID of the command to execute.',
				},
				name: {
					type: 'string',
					description: 'A clear, concise description of the command for the user.',
				},
				args: {
					type: 'array',
					description: 'Optional arguments to pass to the command.',
					items: {},
				},
			},
			required: ['commandId', 'name'],
		},
	},
	[SAFEAPPEALS_FETCH_WEB_PAGE_TOOL]: {
		name: SAFEAPPEALS_FETCH_WEB_PAGE_TOOL,
		description:
			'Fetch the main content from one or more web pages as raw extracted text for you to read. Prefer this when you need the full page body for a specific URL. Optional maxLength clamps extracted text (1000–200000 chars). There is no AI summary — you must read the returned text yourself.',
		inputSchema: {
			type: 'object',
			properties: {
				urls: {
					type: 'array',
					items: { type: 'string' },
					description: 'An array of URLs to fetch content from.',
				},
				query: {
					type: 'string',
					description: 'What content to look for on the page(s).',
				},
				maxLength: {
					type: 'number',
					description: 'Max characters of extracted text per page after HTML stripping (clamped 1000–200000, default 100000). Raw text only — no AI summary.',
				},
			},
			required: ['urls'],
		},
	},
	[SAFEAPPEALS_WEB_SEARCH_TOOL]: {
		name: SAFEAPPEALS_WEB_SEARCH_TOOL,
		description: WEB_SEARCH_MODEL_DESCRIPTION,
		inputSchema: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: 'Search query (max 400 chars, 50 words). Be specific and include relevant keywords for better results.',
				},
				count: {
					type: 'number',
					description: 'Number of results (1-20, default 10). Optional.',
				},
				offset: {
					type: 'number',
					description: 'Pagination offset (max 9, default 0). Optional.',
				},
				safesearch: {
					type: 'string',
					enum: ['off', 'moderate', 'strict'],
					description: 'Adult content filter (default moderate).',
				},
				freshness: {
					type: 'string',
					description: 'Recency filter: pd|pw|pm|py, aliases past_day|past_week|past_month|past_year, or YYYY-MM-DDtoYYYY-MM-DD.',
				},
				country: {
					type: 'string',
					description: '2-letter country code or ALL for result locale.',
				},
				search_lang: {
					type: 'string',
					description: 'Language code for search results (e.g. en).',
				},
				ui_lang: {
					type: 'string',
					description: 'UI language for response metadata (e.g. en-US).',
				},
				site: {
					type: 'string',
					description: 'Restrict to a domain; appended as site:{domain} when not already in the query.',
				},
				autoFetch: {
					type: 'number',
					description: 'After search, fetch raw page text for the top N result URLs (1–5). Returns full page text for you to read — not an AI summary.',
				},
			},
			required: ['query'],
		},
	},
	[SAFEAPPEALS_MULTI_WEB_SEARCH_TOOL]: {
		name: SAFEAPPEALS_MULTI_WEB_SEARCH_TOOL,
		description: MULTI_WEB_SEARCH_MODEL_DESCRIPTION,
		inputSchema: {
			type: 'object',
			properties: {
				queries: {
					type: 'array',
					items: { type: 'string' },
					description: 'Array of search queries (1-10 items, each max 400 chars). Searches are executed sequentially.',
				},
				count: {
					type: 'number',
					description: 'Number of results per query (1-20, default 10). Optional.',
				},
				safesearch: {
					type: 'string',
					enum: ['off', 'moderate', 'strict'],
					description: 'Adult content filter applied to every query (default moderate).',
				},
				freshness: {
					type: 'string',
					description: 'Recency filter applied to every query: pd|pw|pm|py, aliases past_day|past_week|past_month|past_year, or YYYY-MM-DDtoYYYY-MM-DD.',
				},
				country: {
					type: 'string',
					description: '2-letter country code or ALL for result locale.',
				},
				search_lang: {
					type: 'string',
					description: 'Language code for search results (e.g. en).',
				},
				ui_lang: {
					type: 'string',
					description: 'UI language for response metadata (e.g. en-US).',
				},
				site: {
					type: 'string',
					description: 'Restrict every query to a domain; appended as site:{domain} when not already present.',
				},
			},
			required: ['queries'],
		},
	},
	[SAFEAPPEALS_SWITCH_MODE_TOOL]: {
		name: SAFEAPPEALS_SWITCH_MODE_TOOL,
		description: SWITCH_MODE_MODEL_DESCRIPTION,
		inputSchema: {
			type: 'object',
			properties: {
				mode: {
					type: 'string',
					enum: ['Plan', 'Agent'],
					description: 'Target chat mode. Use "Plan" to research and plan; use "Agent" to implement.',
				},
			},
			required: ['mode'],
		},
	},
};

/**
 * Production allowlist of host tools used when the picker is absent or yields no enabled tools after mapping.
 * Export name kept as `MVP_AGENT_TOOL_NAMES` for compatibility with existing imports.
 */
export const MVP_AGENT_TOOL_NAMES: readonly string[] = [
	SAFEAPPEALS_READ_FILE_TOOL,
	SAFEAPPEALS_LIST_DIR_TOOL,
	SAFEAPPEALS_EDIT_FILE_TOOL,
	SAFEAPPEALS_CREATE_FILE_TOOL,
	SAFEAPPEALS_CREATE_DIRECTORY_TOOL,
	SAFEAPPEALS_FIND_FILES_TOOL,
	SAFEAPPEALS_FIND_TEXT_IN_FILES_TOOL,
	SAFEAPPEALS_SEARCH_WORKSPACE_SYMBOLS_TOOL,
	SAFEAPPEALS_GET_ERRORS_TOOL,
	SAFEAPPEALS_GET_CHANGED_FILES_TOOL,
	SAFEAPPEALS_SEARCH_CODEBASE_TOOL,
	SAFEAPPEALS_REPLACE_STRING_TOOL,
	SAFEAPPEALS_MULTI_REPLACE_STRING_TOOL,
	SAFEAPPEALS_APPLY_PATCH_TOOL,
	SAFEAPPEALS_RUN_VSCODE_COMMAND_TOOL,
	SAFEAPPEALS_FETCH_WEB_PAGE_TOOL,
	SAFEAPPEALS_WEB_SEARCH_TOOL,
	SAFEAPPEALS_MULTI_WEB_SEARCH_TOOL,
	SAFEAPPEALS_SWITCH_MODE_TOOL,
	'run_in_terminal',
	'manage_todo_list',
	VSCODE_EDIT_FILE_TOOL,
];

/**
 * UI / Copilot picker names → SafeAppeals or host tool ids.
 * Raw `copilot_*` tools are never allowed through; only these substitutions apply.
 * Void-style `web_search` / `multi_link_search` map to SafeAppeals cloud search tools.
 */
export const AGENT_TOOL_NAME_SUBSTITUTIONS: Readonly<Record<string, string>> = {
	copilot_readFile: SAFEAPPEALS_READ_FILE_TOOL,
	copilot_listDirectory: SAFEAPPEALS_LIST_DIR_TOOL,
	copilot_insertEdit: SAFEAPPEALS_EDIT_FILE_TOOL,
	copilot_createFile: SAFEAPPEALS_CREATE_FILE_TOOL,
	copilot_createDirectory: SAFEAPPEALS_CREATE_DIRECTORY_TOOL,
	copilot_findFiles: SAFEAPPEALS_FIND_FILES_TOOL,
	copilot_findTextInFiles: SAFEAPPEALS_FIND_TEXT_IN_FILES_TOOL,
	copilot_searchWorkspaceSymbols: SAFEAPPEALS_SEARCH_WORKSPACE_SYMBOLS_TOOL,
	copilot_getErrors: SAFEAPPEALS_GET_ERRORS_TOOL,
	copilot_getChangedFiles: SAFEAPPEALS_GET_CHANGED_FILES_TOOL,
	copilot_searchCodebase: SAFEAPPEALS_SEARCH_CODEBASE_TOOL,
	copilot_replaceString: SAFEAPPEALS_REPLACE_STRING_TOOL,
	copilot_multiReplaceString: SAFEAPPEALS_MULTI_REPLACE_STRING_TOOL,
	copilot_applyPatch: SAFEAPPEALS_APPLY_PATCH_TOOL,
	copilot_runVscodeCommand: SAFEAPPEALS_RUN_VSCODE_COMMAND_TOOL,
	copilot_fetchWebPage: SAFEAPPEALS_FETCH_WEB_PAGE_TOOL,
	copilot_switchAgent: SAFEAPPEALS_SWITCH_MODE_TOOL,
	web_search: SAFEAPPEALS_WEB_SEARCH_TOOL,
	multi_link_search: SAFEAPPEALS_MULTI_WEB_SEARCH_TOOL,
	[VSCODE_EDIT_FILE_TOOL_ALIAS]: VSCODE_EDIT_FILE_TOOL,
	// Void Private Search short names → frozen safeappeals_rag_* tools
	rag_index_document: 'safeappeals_rag_index_document',
	rag_search_reference: 'safeappeals_rag_search_reference',
	rag_search_workspace: 'safeappeals_rag_search_workspace',
	rag_search_all: 'safeappeals_rag_search_all',
	rag_get_stats: 'safeappeals_rag_get_stats',
};

const CORE_AGENT_TOOL_NAME_SET = new Set(CORE_AGENT_TOOL_NAMES);

interface NamedToolSource {
	readonly name: string;
	readonly description?: string;
	readonly inputSchema?: object;
}

/**
 * Maps a picker/model tool name to the host tool id to send/invoke, or `undefined` if blocked.
 */
export function resolveAgentToolName(name: string): string | undefined {
	const substituted = AGENT_TOOL_NAME_SUBSTITUTIONS[name];
	if (substituted !== undefined) {
		return substituted;
	}
	if (isAgentToolAllowed(name)) {
		return name;
	}
	return undefined;
}

/**
 * Resolve a model tool-call name to an invoke id allowed for this turn.
 * Returns `undefined` when the name is unmapped, not allowlisted, or not in the selected tool set.
 */
export function resolveAllowedInvokeToolName(
	callName: string,
	selectedToolNames: ReadonlySet<string>,
): string | undefined {
	const resolved = resolveAgentToolName(callName);
	if (resolved === undefined || !selectedToolNames.has(resolved)) {
		return undefined;
	}
	return resolved;
}

/**
 * Whether a tool name is allowed for the SafeAppeals agent loop.
 * Names must not start with `copilot_` (vendor-reserved); use substitutions instead.
 */
export function isAgentToolAllowed(name: string): boolean {
	if (name.startsWith('copilot_')) {
		return false;
	}
	if (name.startsWith('safeappeals_')) {
		return true;
	}
	return CORE_AGENT_TOOL_NAME_SET.has(name);
}

/**
 * Filters a tool list to the production allowlist (no picker mapping).
 */
export function filterAgentTools<T extends { name: string }>(tools: readonly T[]): T[] {
	return tools.filter(tool => isAgentToolAllowed(tool.name));
}

function descriptorFromSource(name: string, source: NamedToolSource): AgentChatToolDescriptor {
	return {
		name,
		description: typeof source.description === 'string' && source.description.length > 0
			? source.description
			: name,
		...(source.inputSchema !== undefined ? { inputSchema: source.inputSchema } : {}),
	};
}

function descriptorForResolvedName(
	resolved: string,
	poolByName: ReadonlyMap<string, NamedToolSource>,
	source?: NamedToolSource,
): AgentChatToolDescriptor | undefined {
	const fromPool = poolByName.get(resolved);
	if (fromPool) {
		return descriptorFromSource(resolved, fromPool);
	}
	if (source) {
		return descriptorFromSource(resolved, source);
	}
	return ENSURED_AGENT_TOOL_DESCRIPTORS[resolved];
}

/**
 * Selects tools for `sendRequest` from the picker map and/or host pool.
 *
 * - Enabled picker entries are mapped via {@link resolveAgentToolName}; raw `copilot_*` names are never returned.
 * - When the resolved id is missing from `pool`, synthesizes a plain descriptor (from the picker source,
 *   or {@link ENSURED_AGENT_TOOL_DESCRIPTORS} for SafeAppeals ensured tools).
 * - Force-adds ensured tools when not explicitly disabled, even if absent from `pool`.
 * - Never force-adds terminal/todo over a picker `false`.
 */
export function selectAgentTools(options: {
	readonly pool: readonly NamedToolSource[];
	readonly requestTools?: ReadonlyMap<NamedToolSource, boolean>;
}): AgentChatToolDescriptor[] {
	const { pool, requestTools } = options;
	const poolByName = new Map<string, NamedToolSource>();
	for (const tool of pool) {
		poolByName.set(tool.name, tool);
	}

	const selectedByName = new Map<string, AgentChatToolDescriptor>();
	const explicitlyDisabled = new Set<string>();

	const addSelected = (descriptor: AgentChatToolDescriptor): void => {
		if (!selectedByName.has(descriptor.name)) {
			selectedByName.set(descriptor.name, descriptor);
		}
	};

	if (requestTools && requestTools.size > 0) {
		for (const [tool, enabled] of requestTools) {
			const resolved = resolveAgentToolName(tool.name);
			if (!resolved) {
				continue;
			}
			if (!enabled) {
				explicitlyDisabled.add(resolved);
				continue;
			}
			const descriptor = descriptorForResolvedName(resolved, poolByName, tool);
			if (descriptor) {
				addSelected(descriptor);
			}
		}
	}

	if (selectedByName.size === 0) {
		for (const tool of filterAgentTools(pool)) {
			if (!explicitlyDisabled.has(tool.name)) {
				addSelected(descriptorFromSource(tool.name, tool));
			}
		}
	}

	for (const ensuredName of ENSURED_AGENT_TOOL_NAMES) {
		if (explicitlyDisabled.has(ensuredName) || selectedByName.has(ensuredName)) {
			continue;
		}
		const descriptor = descriptorForResolvedName(ensuredName, poolByName);
		if (descriptor) {
			addSelected(descriptor);
		}
	}

	return [...selectedByName.values()];
}

/**
 * Returns true when `candidateFsPath` resolves inside one of `rootFsPaths`.
 *
 * Collapses `..` via {@link path.resolve} before checking with {@link path.relative}.
 * Does not resolve symlinks — a symlink under the workspace may still point outside.
 */
export function isPathInsideWorkspaceRoot(candidateFsPath: string, rootFsPaths: readonly string[]): boolean {
	const candidate = path.resolve(candidateFsPath);
	for (const rootRaw of rootFsPaths) {
		const root = path.resolve(rootRaw);
		const relative = path.relative(root, candidate);
		if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
			return true;
		}
	}
	return false;
}
