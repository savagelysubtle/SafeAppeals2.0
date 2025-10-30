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

// Human-readable description of operations for the LLM
export const EDIT_DOCUMENT_DESCRIPTION = `Edit DOCX/XLSX files using JSON operations array.

**VALID OPERATION TYPES:**

DOCX operations: insert_text, replace_text, format_text, insert_table, insert_page_break, set_margins
XLSX operations: set_cell_value, set_cell_formula, format_cell, insert_row, insert_column, delete_row, delete_column

**EXAMPLES:**

Create welcome message in DOCX:
[{"type": "insert_text", "position": 0, "text": "Welcome\\n\\nThis document was created by your AI assistant."}]

Replace content in DOCX:
[{"type": "replace_text", "search": "old text", "replace": "new text", "all": true}]

Create spreadsheet headers in XLSX:
[
  {"type": "set_cell_value", "sheet": 0, "cell": "A1", "value": "Date"},
  {"type": "set_cell_value", "sheet": 0, "cell": "B1", "value": "Provider"},
  {"type": "format_cell", "sheet": 0, "cell": "A1", "format": {"bold": true}}
]`;

export const getToolSchemaDescription = (toolName: string): string => {
	switch (toolName) {
		case 'edit_document':
			return EDIT_DOCUMENT_DESCRIPTION;
		case 'read_file':
			return 'Returns file contents. Extracts text from PDF/DOCX/XLSX.';
		case 'edit_file':
			return 'Edit text files (.ts, .py, .js, .md, .txt, .json, etc.) with search/replace blocks. For DOCX/XLSX use edit_document.';
		case 'rewrite_file':
			return 'Completely replace text file contents. For DOCX/XLSX use edit_document.';
		case 'create_file_or_folder':
			return 'Create file or folder. For DOCX/XLSX creates valid empty document. Path ending with / creates folder.';
		case 'rag_search_policy':
			return 'Search indexed policy manuals for rules, eligibility, procedures. Returns relevant sections with citations.';
		case 'rag_search_workspace':
			return 'Search indexed case documents (medical reports, decisions, correspondence) for case-specific information.';
		default:
			return '';
	}
};

