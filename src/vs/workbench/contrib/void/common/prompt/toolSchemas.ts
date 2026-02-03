/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Glass Devtools, Inc. All rights reserved.
 *  Void Editor additions licensed under the AGPL 3.0 License.
 *--------------------------------------------------------------------------------------------*/

// JSON Schema definitions for edit_document operations
export const DOCX_OPERATION_SCHEMA = {
	oneOf: [
		{
			type: 'object',
			required: ['type', 'position', 'text'],
			properties: {
				type: { const: 'insert_text' },
				position: { type: 'number', description: 'Character position (0 = start)' },
				text: { type: 'string', description: 'Text content. Use \\n for line breaks, \\n\\n for paragraphs' }
			}
		},
		{
			type: 'object',
			required: ['type', 'search', 'replace'],
			properties: {
				type: { const: 'replace_text' },
				search: { type: 'string', description: 'Text to find' },
				replace: { type: 'string', description: 'Replacement text' },
				all: { type: 'boolean', description: 'Replace all occurrences (default: first only)' }
			}
		},
		{
			type: 'object',
			required: ['type', 'range', 'format'],
			properties: {
				type: { const: 'format_text' },
				range: {
					type: 'object',
					properties: {
						start: { type: 'number' },
						end: { type: 'number' }
					}
				},
				format: {
					type: 'object',
					properties: {
						bold: { type: 'boolean' },
						italic: { type: 'boolean' },
						underline: { type: 'boolean' },
						fontSize: { type: 'number' },
						fontFamily: { type: 'string' },
						color: { type: 'string' }
					}
				}
			}
		},
		{
			type: 'object',
			required: ['type', 'position', 'rows', 'cols'],
			properties: {
				type: { const: 'insert_table' },
				position: { type: 'number' },
				rows: { type: 'number' },
				cols: { type: 'number' }
			}
		},
		{
			type: 'object',
			required: ['type', 'position'],
			properties: {
				type: { const: 'insert_page_break' },
				position: { type: 'number' }
			}
		},
		{
			type: 'object',
			required: ['type', 'margins'],
			properties: {
				type: { const: 'set_margins' },
				margins: {
					type: 'object',
					properties: {
						top: { type: 'number' },
						right: { type: 'number' },
						bottom: { type: 'number' },
						left: { type: 'number' }
					}
				}
			}
		}
	]
};

export const XLSX_OPERATION_SCHEMA = {
	oneOf: [
		{
			type: 'object',
			required: ['type', 'sheet', 'cell', 'value'],
			properties: {
				type: { const: 'set_cell_value' },
				sheet: { oneOf: [{ type: 'number' }, { type: 'string' }], description: '0-based index or sheet name' },
				cell: { type: 'string', description: 'Excel notation (A1, B2, etc.)' },
				value: { oneOf: [{ type: 'string' }, { type: 'number' }] }
			}
		},
		{
			type: 'object',
			required: ['type', 'sheet', 'cell', 'formula'],
			properties: {
				type: { const: 'set_cell_formula' },
				sheet: { oneOf: [{ type: 'number' }, { type: 'string' }] },
				cell: { type: 'string' },
				formula: { type: 'string', description: 'Must start with =' }
			}
		},
		{
			type: 'object',
			required: ['type', 'sheet', 'cell', 'format'],
			properties: {
				type: { const: 'format_cell' },
				sheet: { oneOf: [{ type: 'number' }, { type: 'string' }] },
				cell: { type: 'string' },
				format: {
					type: 'object',
					properties: {
						bold: { type: 'boolean' },
						italic: { type: 'boolean' },
						backgroundColor: { type: 'string' },
						fontSize: { type: 'number' }
					}
				}
			}
		},
		{
			type: 'object',
			required: ['type', 'sheet', 'rowIndex'],
			properties: {
				type: { const: 'insert_row' },
				sheet: { oneOf: [{ type: 'number' }, { type: 'string' }] },
				rowIndex: { type: 'number', description: '0-based row position' }
			}
		},
		{
			type: 'object',
			required: ['type', 'sheet', 'colIndex'],
			properties: {
				type: { const: 'insert_column' },
				sheet: { oneOf: [{ type: 'number' }, { type: 'string' }] },
				colIndex: { type: 'number', description: '0-based column position' }
			}
		},
		{
			type: 'object',
			required: ['type', 'sheet', 'rowIndex'],
			properties: {
				type: { const: 'delete_row' },
				sheet: { oneOf: [{ type: 'number' }, { type: 'string' }] },
				rowIndex: { type: 'number' }
			}
		},
		{
			type: 'object',
			required: ['type', 'sheet', 'colIndex'],
			properties: {
				type: { const: 'delete_column' },
				sheet: { oneOf: [{ type: 'number' }, { type: 'string' }] },
				colIndex: { type: 'number' }
			}
		}
	]
};


// --- Tool Validation Schemas (for ToolSchemaValidator) ---

export const READ_FILE_SCHEMA = {
	toolName: 'read_file',
	params: {
		uri: { type: 'uri', required: true },
		start_line: { type: 'number', required: false },
		end_line: { type: 'number', required: false },
		page_number: { type: 'page_number', required: false }
	}
}

export const LS_DIR_SCHEMA = {
	toolName: 'ls_dir',
	params: {
		uri: { type: 'optional_uri', required: false }, // Optional per prompts.ts
		page_number: { type: 'page_number', required: false }
	}
}

export const GET_DIR_TREE_SCHEMA = {
	toolName: 'get_dir_tree',
	params: {
		uri: { type: 'uri', required: true }
	}
}

export const SEARCH_PATHNAMES_ONLY_SCHEMA = {
	toolName: 'search_pathnames_only',
	params: {
		query: { type: 'string', required: true },
		include_pattern: { type: 'optional_string', required: false },
		page_number: { type: 'page_number', required: false }
	}
}

export const SEARCH_FOR_FILES_SCHEMA = {
	toolName: 'search_for_files',
	params: {
		query: { type: 'string', required: true },
		search_in_folder: { type: 'optional_uri', required: false },
		is_regex: { type: 'boolean', required: false },
		page_number: { type: 'page_number', required: false }
	}
}

export const SEARCH_IN_FILE_SCHEMA = {
	toolName: 'search_in_file',
	params: {
		uri: { type: 'uri', required: true },
		query: { type: 'string', required: true },
		is_regex: { type: 'boolean', required: false }
	}
}

export const READ_LINT_ERRORS_SCHEMA = {
	toolName: 'read_lint_errors',
	params: {
		uri: { type: 'uri', required: true }
	}
}

export const CREATE_FILE_OR_FOLDER_SCHEMA = {
	toolName: 'create_file_or_folder',
	params: {
		uri: { type: 'uri', required: true }
		// is_folder inferred from path ending with /
	}
}

export const DELETE_FILE_OR_FOLDER_SCHEMA = {
	toolName: 'delete_file_or_folder',
	params: {
		uri: { type: 'uri', required: true },
		is_recursive: { type: 'boolean', required: false }
	}
}

export const EDIT_FILE_SCHEMA = {
	toolName: 'edit_file',
	params: {
		uri: { type: 'uri', required: true },
		search_replace_blocks: { type: 'string', required: true }
	}
}

export const REWRITE_FILE_SCHEMA = {
	toolName: 'rewrite_file',
	params: {
		uri: { type: 'uri', required: true },
		new_content: { type: 'string', required: true }
	}
}

export const RUN_COMMAND_SCHEMA = {
	toolName: 'run_command',
	params: {
		command: { type: 'string', required: true },
		cwd: { type: 'optional_string', required: false }
	}
}

export const RUN_PERSISTENT_COMMAND_SCHEMA = {
	toolName: 'run_persistent_command',
	params: {
		command: { type: 'string', required: true },
		persistent_terminal_id: { type: 'string', required: true }
	}
}

export const OPEN_PERSISTENT_TERMINAL_SCHEMA = {
	toolName: 'open_persistent_terminal',
	params: {
		cwd: { type: 'optional_string', required: false }
	}
}

export const KILL_PERSISTENT_TERMINAL_SCHEMA = {
	toolName: 'kill_persistent_terminal',
	params: {
		persistent_terminal_id: { type: 'string', required: true }
	}
}

export const RAG_INDEX_DOCUMENT_SCHEMA = {
	toolName: 'rag_index_document',
	params: {
		uri: { type: 'uri', required: true },
		is_core_reference: { type: 'boolean', required: false }
	}
}

export const RAG_SEARCH_REFERENCE_SCHEMA = {
	toolName: 'rag_search_reference',
	params: {
		query: { type: 'string', required: true },
		limit: { type: 'number', required: false }
	}
}

export const RAG_SEARCH_WORKSPACE_SCHEMA = {
	toolName: 'rag_search_workspace',
	params: {
		query: { type: 'string', required: true },
		limit: { type: 'number', required: false }
	}
}

export const RAG_SEARCH_ALL_SCHEMA = {
	toolName: 'rag_search_all',
	params: {
		query: { type: 'string', required: true },
		limit: { type: 'number', required: false }
	}
}

export const RAG_GET_STATS_SCHEMA = {
	toolName: 'rag_get_stats',
	params: {}
}

export const EDIT_DOCUMENT_SCHEMA = {
	toolName: 'edit_document',
	params: {
		uri: { type: 'uri', required: true },
		operations: { type: 'string', required: true } // Passed as JSON string to be parsed
	}
}

export const WEB_SEARCH_SCHEMA = {
	toolName: 'web_search',
	params: {
		query: { type: 'string', required: true },
		count: { type: 'number', required: false },
		offset: { type: 'number', required: false }
	}
}

export const MULTI_LINK_SEARCH_SCHEMA = {
	toolName: 'multi_link_search',
	params: {
		queries: { type: 'string', required: true }, // Expecting JSON array string or comma-separated? Prompts says array. Usually tools service handles parsing. Assuming array of strings.
		count: { type: 'number', required: false }
	}
}

export const TIMELINE_ADD_EVENT_SCHEMA = {
	toolName: 'timeline_add_event',
	params: {
		date: { type: 'string', required: true },
		title: { type: 'string', required: true },
		description: { type: 'optional_string', required: false },
		category: { type: 'string', required: true },
		is_deadline: { type: 'boolean', required: false },
		linked_documents: { type: 'string', required: false } // JSON array string of URIs
	}
}

export const TIMELINE_UPDATE_EVENT_SCHEMA = {
	toolName: 'timeline_update_event',
	params: {
		event_id: { type: 'string', required: true },
		date: { type: 'optional_string', required: false },
		title: { type: 'optional_string', required: false },
		description: { type: 'optional_string', required: false },
		category: { type: 'optional_string', required: false },
		is_deadline: { type: 'boolean', required: false },
		is_complete: { type: 'boolean', required: false }
	}
}

export const TIMELINE_DELETE_EVENT_SCHEMA = {
	toolName: 'timeline_delete_event',
	params: {
		event_id: { type: 'string', required: true }
	}
}

export const TIMELINE_GET_EVENTS_SCHEMA = {
	toolName: 'timeline_get_events',
	params: {
		category: { type: 'optional_string', required: false },
		start_date: { type: 'optional_string', required: false },
		end_date: { type: 'optional_string', required: false },
		is_deadline: { type: 'boolean', required: false },
		limit: { type: 'number', required: false }
	}
}

export const TIMELINE_LINK_DOCUMENT_SCHEMA = {
	toolName: 'timeline_link_document',
	params: {
		event_id: { type: 'string', required: true },
		document_uri: { type: 'uri', required: true }
	}
}

export const TIMELINE_GET_DEADLINES_SCHEMA = {
	toolName: 'timeline_get_deadlines',
	params: {
		days_ahead: { type: 'number', required: false }
	}
}
