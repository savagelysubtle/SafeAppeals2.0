export const approvalTypeOfBuiltinToolName = {
    'create_file_or_folder': 'edits',
    'delete_file_or_folder': 'edits',
    'rewrite_file': 'edits',
    'edit_file': 'edits',
    'edit_document': 'edits',
    'run_command': 'terminal',
    'run_persistent_command': 'terminal',
    'open_persistent_terminal': 'terminal',
    'kill_persistent_terminal': 'terminal',
    'rag_index_document': 'RAG tools',
    'rag_search_policy': 'RAG tools',
    'rag_search_workspace': 'RAG tools',
    'rag_get_stats': 'RAG tools',
};
export const toolApprovalTypes = new Set([
    ...Object.values(approvalTypeOfBuiltinToolName),
    'MCP tools',
    'RAG tools',
]);
