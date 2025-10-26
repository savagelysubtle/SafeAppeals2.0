/**
 * mcp-response-types.ts
 * --------------------------------------------------
 * **Pure** TypeScript interfaces (no external imports)
 * describing the JSON-RPC response shapes for:
 *
 *   1. tools/list      -> ToolsListResponse
 *   2. prompts/list    -> PromptsListResponse
 *   3. tools/call      -> ToolCallResponse
 *
 * They are distilled directly from the official MCP
 * 2025‑03‑26 specification:
 *   • Tools list response examples
 *   • Prompts list response examples
 *   • Tool call response examples
 *
 * Use them to get full IntelliSense when working with
 * @modelcontextprotocol/inspector‑cli responses.
 */
export const removeMCPToolNamePrefix = (name) => {
    return name.split('_').slice(1).join('_');
};
