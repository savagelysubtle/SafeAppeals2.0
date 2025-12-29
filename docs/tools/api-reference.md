# Tools API Reference

Complete TypeScript API documentation for the Void tools system, including type definitions, interfaces, and function signatures.

## Core Types

### Tool Call Parameters

#### BuiltinToolCallParams

Type-safe parameter definitions for all built-in tools.

```typescript
export type BuiltinToolCallParams = {
	// File reading operations
	'read_file': {
		uri: URI;                    // File URI to read
		startLine: number | null;     // Starting line (1-based, null = start)
		endLine: number | null;       // Ending line (null = end of file)
		pageNumber: number;          // Pagination for large files
	};

	'ls_dir': {
		uri: URI;                   // Directory URI to list
		pageNumber: number;         // Pagination for large directories
	};

	'get_dir_tree': {
		uri: URI;                  // Directory URI for tree view
	};

	'search_pathnames_only': {
		query: string;             // Search query for filenames
		includePattern: string | null; // Glob pattern to include
		pageNumber: number;        // Pagination for results
	};

	'search_for_files': {
		query: string;             // Content search query
		isRegex: boolean;          // Whether query is regex
		searchInFolder: URI | null; // Directory to search (null = workspace)
		pageNumber: number;        // Pagination for results
	};

	'search_in_file': {
		uri: URI;                  // File URI to search in
		query: string;             // Search query
		isRegex: boolean;          // Whether query is regex
	};

	'read_lint_errors': {
		uri: URI;                  // File URI to check for lint errors
	};

	// File modification operations
	'rewrite_file': {
		uri: URI;                  // File URI to rewrite
		newContent: string;        // Complete new file content
	};

	'edit_file': {
		uri: URI;                  // File URI to edit
		searchReplaceBlocks: string; // Search/replace operations
	};

	'create_file_or_folder': {
		uri: URI;                  // URI to create
		isFolder: boolean;         // Whether to create folder or file
	};

	'delete_file_or_folder': {
		uri: URI;                  // URI to delete
		isRecursive: boolean;      // Whether to delete recursively
		isFolder: boolean;         // Whether URI is a folder
	};

	'edit_document': {
		uri: URI;                  // Document URI to edit
		operations: Array<{        // Rich text operations
			type: string;
			[key: string]: any;
		}>;
	};

	// Terminal operations
	'run_command': {
		command: string;           // Command to execute
		cwd: string | null;        // Working directory (null = current)
		terminalId: string;        // Terminal identifier
	};

	'open_persistent_terminal': {
		cwd: string | null;        // Working directory for terminal
	};

	'run_persistent_command': {
		command: string;           // Command for persistent terminal
		persistentTerminalId: string; // Persistent terminal ID
	};

	'kill_persistent_terminal': {
		persistentTerminalId: string; // Terminal to kill
	};

	// RAG operations
	'rag_index_document': {
		uri: URI;                  // Document to index
		isPolicyManual: boolean;   // Whether it's a policy document
		workspaceId?: string;      // Optional workspace ID (auto-injected)
		indexScope?: 'policy_manual' | 'case_index'; // Target index
	};

	'rag_search_policy': {
		query: string;             // Search query for policy documents
		limit: number;             // Maximum results
	};

	'rag_search_workspace': {
		query: string;             // Search query for case documents
		limit: number;             // Maximum results
	};

	'rag_search_all': {
		query: string;             // Search query across ALL documents
		limit: number;             // Maximum results
	};

	'rag_get_stats': {};          // No parameters needed

	// Web search operations
	'web_search': {
		query: string;             // Search query
		count: number | null;      // Number of results (null = default)
		offset: number | null;     // Pagination offset (null = 0)
	};

	'multi_link_search': {
		queries: string[];         // Multiple search queries
		count: number | null;      // Results per query
	};
};
```

#### BuiltinToolResultType

Result type definitions for all built-in tools.

```typescript
export type BuiltinToolResultType = {
	// File reading results
	'read_file': {
		fileContents: string;      // File content
		totalFileLen: number;      // Total characters
		totalNumLines: number;     // Total lines
		hasNextPage: boolean;     // Whether more pages exist
	};

	'ls_dir': {
		children: ShallowDirectoryItem[] | null; // Directory contents
		hasNextPage: boolean;     // More pages available
		hasPrevPage: boolean;     // Previous pages available
		itemsRemaining: number;   // Items not shown due to pagination
	};

	'get_dir_tree': {
		str: string;              // Directory tree as string
	};

	'search_pathnames_only': {
		uris: URI[];              // Matching file URIs
		hasNextPage: boolean;     // More results available
	};

	'search_for_files': {
		uris: URI[];              // Matching file URIs
		hasNextPage: boolean;     // More results available
	};

	'search_in_file': {
		lines: number[];          // Line numbers with matches
	};

	'read_lint_errors': {
		lintErrors: LintErrorItem[] | null; // Lint errors found
	};

	// File modification results
	'rewrite_file': Promise<{
		lintErrors: LintErrorItem[] | null; // Post-write lint errors
	}>;

	'edit_file': Promise<{
		lintErrors: LintErrorItem[] | null; // Post-edit lint errors
	}>;

	'create_file_or_folder': {}; // No specific result data

	'delete_file_or_folder': {}; // No specific result data

	'edit_document': {
		success: boolean;         // Whether operation succeeded
		error?: string;           // Error message if failed
		message?: string;         // Success message
	};

	// Terminal results
	'run_command': {
		result: string;           // Command output
		resolveReason: TerminalResolveReason; // How command ended
	};

	'run_persistent_command': {
		result: string;           // Command output
		resolveReason: TerminalResolveReason; // How command ended
	};

	'open_persistent_terminal': {
		persistentTerminalId: string; // ID of opened terminal
	};

	'kill_persistent_terminal': {}; // No specific result data

	// RAG results
	'rag_index_document': {
		success: boolean;         // Whether indexing succeeded
		message: string;          // Status message
	};

	'rag_search_policy': {
		contextPack: string;      // Retrieved context from policy manuals
	};

	'rag_search_workspace': {
		contextPack: string;      // Retrieved context from case files
	};

	'rag_search_all': {
		contextPack: string;      // Retrieved context from ALL sources
	};

	'rag_get_stats': {
		stats: string;            // Statistics as string
	};

	// Web search results
	'web_search': {
		results: WebSearchResult[]; // Search results
		totalResults: number;     // Total results found
	};

	'multi_link_search': {
		searchResults: MultiSearchResult[]; // Results for each query
	};
};
```

### Tool Approval System

#### ToolApprovalType

Approval categories for tool security classification.

```typescript
export type ToolApprovalType = 'edits' | 'terminal' | 'MCP tools' | 'RAG tools';
```

#### approvalTypeOfBuiltinToolName

Mapping of tools to their approval requirements.

```typescript
export const approvalTypeOfBuiltinToolName: Partial<{
	[T in BuiltinToolName]?: ToolApprovalType;
}> = {
	// File editing tools require approval
	'create_file_or_folder': 'edits',
	'delete_file_or_folder': 'edits',
	'rewrite_file': 'edits',
	'edit_file': 'edits',
	'edit_document': 'edits',

	// Terminal tools require approval
	'run_command': 'terminal',
	'run_persistent_command': 'terminal',
	'open_persistent_terminal': 'terminal',
	'kill_persistent_terminal': 'terminal',

	// RAG tools are read-only (no approval needed)
	// 'rag_index_document': 'RAG tools', // Commented out - read-only
	// 'rag_search_policy': 'RAG tools',   // Commented out - read-only
	// 'rag_search_workspace': 'RAG tools', // Commented out - read-only
	// 'rag_search_all': 'RAG tools',      // Commented out - read-only
	// 'rag_get_stats': 'RAG tools',       // Commented out - read-only
};
```

### Generic Tool Types

#### ToolCallParams

Generic tool parameter type that works with both built-in and MCP tools.

```typescript
export type ToolCallParams<T extends BuiltinToolName | (string & {})> =
	T extends BuiltinToolName
		? BuiltinToolCallParams[T]
		: RawToolParamsObj; // For MCP tools
```

#### ToolResult

Generic tool result type that works with both built-in and MCP tools.

```typescript
export type ToolResult<T extends BuiltinToolName | (string & {})> =
	T extends BuiltinToolName
		? BuiltinToolResultType[T]
		: RawMCPToolCall; // For MCP tools
```

## Schema Validation API

### ToolSchemaValidator Class

Main class for tool parameter validation with caching and performance monitoring.

```typescript
export class ToolSchemaValidator {
	// Private fields
	private compiledValidators: Map<BuiltinToolName, CompiledValidator<any>>;
	private validationMetrics: Map<BuiltinToolName, {
		count: number;
		totalTime: number;
		errors: number;
	}>;

	/**
	 * Compile a validator for a tool schema (cached for performance)
	 */
	compileValidator<T>(schema: ToolSchema): CompiledValidator<T>;

	/**
	 * Validate tool call parameters against schema
	 */
	validateToolCall<T extends BuiltinToolName>(
		toolName: T,
		params: RawToolParamsObj
	): ValidationResult<BuiltinToolCallParams[T]>;

	/**
	 * Create schema from tool info (utility function)
	 */
	createSchemaFromToolInfo(toolInfo: InternalToolInfo): ToolSchema;

	/**
	 * Get validation metrics for monitoring
	 */
	getValidationMetrics(): Map<BuiltinToolName, {
		count: number;
		totalTime: number;
		errors: number;
		averageTime: number;
		errorRate: number;
	}>;
}
```

### Validation Types

#### ValidationError

Detailed error information for validation failures.

```typescript
export interface ValidationError {
	field: string;           // Parameter name that failed
	message: string;         // Human-readable error message
	value?: unknown;         // The invalid value that was provided
}
```

#### ValidationResult

Result of a validation operation with success status and errors.

```typescript
export interface ValidationResult<T> {
	success: boolean;       // Whether validation passed
	data?: T;              // Validated and typed data (if success)
	errors: ValidationError[]; // All validation errors found
}
```

#### ParamType

Supported parameter types for schema validation.

```typescript
export type ParamType =
	| 'string'           // Basic string
	| 'number'           // Numeric value
	| 'boolean'          // True/false
	| 'uri'              // VSCode URI object
	| 'optional_string'  // Optional string (can be empty)
	| 'optional_uri'     // Optional URI
	| 'page_number';     // Special pagination number
```

#### ParamConstraint

Complete constraint definition for parameter validation.

```typescript
export interface ParamConstraint {
	type: ParamType;                      // Parameter type
	required?: boolean;                   // Whether parameter is mandatory
	min?: number;                         // Minimum value (for numbers)
	max?: number;                         // Maximum value (for numbers)
	pattern?: RegExp;                     // Regex pattern for strings
	customValidator?: (value: unknown) => string | null; // Custom validation function
}
```

#### ToolSchema

Schema definition for a complete tool with all its parameters.

```typescript
export interface ToolSchema {
	toolName: BuiltinToolName;            // Tool identifier
	params: {                             // Parameter constraints
		[paramName: string]: ParamConstraint;
	};
}
```

### CompiledValidator

Pre-compiled validation function for performance.

```typescript
export type CompiledValidator<T> = (params: RawToolParamsObj) => ValidationResult<T>;
```

## Utility Functions

### createSchemaFromToolInfo

Converts internal tool information into a validation schema.

```typescript
export function createSchemaFromToolInfo(toolInfo: InternalToolInfo): ToolSchema;
```

**Parameters:**
- `toolInfo`: Internal tool definition from the prompts system

**Returns:** Complete `ToolSchema` for the tool

## Supporting Types

### TerminalResolveReason

How a terminal command execution ended.

```typescript
export type TerminalResolveReason =
	| { type: 'timeout' }           // Command timed out
	| { type: 'done', exitCode: number }; // Command completed normally
```

### LintErrorItem

Lint error information for file validation.

```typescript
export type LintErrorItem = {
	code: string;                   // Error code
	message: string;               // Error message
	startLineNumber: number;        // Starting line (1-based)
	endLineNumber: number;          // Ending line (1-based)
};
```

### ShallowDirectoryItem

File system item information (partial IFileStat).

```typescript
export type ShallowDirectoryItem = {
	uri: URI;                      // Item URI
	name: string;                  // Item name
	isDirectory: boolean;          // Whether it's a directory
	isSymbolicLink: boolean;       // Whether it's a symlink
};
```

### Web Search Types

```typescript
export type WebSearchResult = {
	title: string;                 // Result title
	url: string;                   // Result URL
	description: string;           // Result description
	age?: string;                  // Result age
	published?: string;            // Publication date
};

export type MultiSearchResult = {
	query: string;                 // Original search query
	results: WebSearchResult[];    // Results for this query
	error?: string;                // Error if search failed
};
```

## Tool Name Types

### BuiltinToolName

Union type of all built-in tool names.

```typescript
export type BuiltinToolName = keyof BuiltinToolResultType;
```

### ToolName

Generic tool name type (built-in or MCP).

```typescript
export type ToolName = BuiltinToolName | (string & {});
```

### ToolParamName

Generic parameter name type with tool-specific typing.

```typescript
export type ToolParamName<T extends ToolName> =
	T extends BuiltinToolName
		? BuiltinToolParamNameOfTool<T>
		: string;
```

## Constants

### toolApprovalTypes

Set of all available tool approval types for runtime checks.

```typescript
export const toolApprovalTypes = new Set<ToolApprovalType>([
	'edits',
	'terminal',
	'MCP tools',
	'RAG tools',
]);
```

This API reference provides the complete type system for the Void tools framework, enabling type-safe tool calling, validation, and execution across the entire AI agent system.
