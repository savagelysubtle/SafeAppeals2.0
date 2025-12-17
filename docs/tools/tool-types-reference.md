# Tool Types Reference

Complete reference for all built-in tools, their parameters, return types, and usage patterns.

## Tool Categories

### 🔍 Read-Only Tools

Tools that gather information without modifying the environment.

#### `read_file`

Reads content from a file with optional line range and pagination.

**Parameters:**
```typescript
{
  uri: URI,                    // File URI to read
  startLine: number | null,     // Starting line (1-based, null = start)
  endLine: number | null,       // Ending line (null = end of file)
  pageNumber: number          // Pagination for large files
}
```

**Returns:**
```typescript
{
  fileContents: string,       // File content
  totalFileLen: number,       // Total characters in file
  totalNumLines: number,      // Total lines in file
  hasNextPage: boolean       // Whether more pages exist
}
```

**Example:**
```xml
<tool_call name="read_file">
  <parameter name="uri">file:///path/to/file.ts
