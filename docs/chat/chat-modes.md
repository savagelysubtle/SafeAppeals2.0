# Chat Modes

SafeAppeals supports multiple chat modes, each tailored for different use cases with specific tools and system prompts.

## Available Modes

| Mode | Purpose | Tools | System Prompt Focus |
|------|---------|-------|---------------------|
| `agent` | Full agent capabilities | All tools | General assistance |
| `gather` | Research and context | RAG, read, search | Information gathering |
| `normal` | Basic chat | Minimal tools | Conversation |
| `case_manager` | Case management | Case-specific | Legal case handling |
| `research` | Legal research | Research tools | Legal analysis |
| `drafting` | Document creation | Document tools | Writing assistance |

## Mode Configuration

### Setting Thread Mode

```typescript
// Creating a new thread with a mode
const threadId = chatThreadService.createNewThread({ mode: 'research' });

// Mode is stored in thread state
const thread = chatThreadService.getCurrentThread();
console.log(thread.mode); // 'research'
```

### Mode in Settings

Global default mode can be set in SafeAppeals Settings:

```typescript
// voidSettingsTypes.ts
type GlobalSettings = {
  chatMode: ChatMode;  // Default mode for new threads
  // ...
}
```

## Mode Details

### Agent Mode

**Purpose**: Full autonomous agent capabilities for code editing and complex tasks.

**Available Tools**:
- `read_file` - Read file contents
- `edit_file` - Modify files
- `create_file` - Create new files
- `delete_file` - Remove files
- `list_directory` - Browse folders
- `run_terminal_command` - Execute shell commands
- `web_search` - Search the internet
- `rag_query` - Semantic code search
- All MCP tools

**System Prompt Includes**:
- Workspace directory structure
- Open files list
- XML tool definitions
- Code editing guidelines

### Gather Mode

**Purpose**: Research and context gathering without making changes.

**Available Tools**:
- `read_file` - Read file contents
- `rag_query` - Semantic search
- `web_search` - Internet research
- `list_directory` - Browse structure

**Restrictions**:
- No file modification tools
- No terminal commands
- Read-only operations

**Use Cases**:
- Researching a codebase
- Understanding how something works
- Gathering context before editing

### Normal Mode

**Purpose**: Basic conversational chat with minimal tool access.

**Available Tools**:
- `read_file` (limited)
- `rag_query` (limited)

**Use Cases**:
- Quick questions
- Explanations
- Code review discussions

### Case Manager Mode

**Purpose**: Workers' compensation case management (SafeAppeals-specific).

**Available Tools**:
- Case profile tools
- Document management
- Timeline operations
- Standard file operations

**System Prompt Includes**:
- Case management context
- Legal terminology
- Document templates

### Research Mode

**Purpose**: Legal research and analysis.

**Available Tools**:
- `rag_query` - Search case documents
- `web_search` - Legal research
- `read_file` - Read documents
- Case-specific tools

**System Prompt Includes**:
- Legal research guidelines
- Citation formats
- Analysis frameworks

### Drafting Mode

**Purpose**: Document creation and editing.

**Available Tools**:
- `edit_document` - DOCX editing
- `create_file` - New documents
- `read_file` - Reference documents
- Template tools

**System Prompt Includes**:
- Document formatting guidelines
- Legal writing standards
- Template references

## Tool Availability by Mode

```typescript
// prompt/prompts.ts - availableTools function
export const availableTools = (
  chatMode: ChatMode | null,
  mcpTools: InternalToolInfo[] | undefined
): InternalToolInfo[] | null => {
  if (!chatMode) return null;

  const builtinTools = getBuiltinToolsForMode(chatMode);
  const mcp = mcpTools ?? [];

  return [...builtinTools, ...mcp];
}
```

### Tool Matrix

| Tool | agent | gather | normal | case_manager | research | drafting |
|------|:-----:|:------:|:------:|:------------:|:--------:|:--------:|
| read_file | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| edit_file | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| create_file | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| delete_file | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| list_directory | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| run_terminal_command | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| web_search | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| rag_query | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| edit_document | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| MCP tools | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |

## System Prompt Generation

Each mode generates a tailored system prompt:

```typescript
// convertToLLMMessageService.ts
private _generateChatMessagesSystemMessage = async (
  chatMode: ChatMode,
  specialToolFormat: 'openai-style' | 'anthropic-style' | 'gemini-style' | undefined
) => {
  const workspaceFolders = this.workspaceContextService.getWorkspace().folders;
  const directoryStr = await this.directoryStrService.getAllDirectoriesStr({
    cutOffMessage: chatMode === 'case_manager' || chatMode === 'research'
      ? `...Use tools to read more...`
      : `...Ask user for more if necessary...`
  });

  const mcpTools = this.mcpService.getMCPTools();

  return chat_systemMessage({
    workspaceFolders,
    openedURIs,
    directoryStr,
    activeURI,
    chatMode,
    mcpTools,
    includeXMLToolDefinitions: true,  // Always include XML definitions
  });
}
```

## Switching Modes

### During Conversation

Modes are per-thread and cannot be changed mid-conversation. To switch modes:

1. Create a new thread with the desired mode
2. The previous thread is preserved in history

### Programmatic Mode Selection

```typescript
// Example: Create research thread for legal work
const researchThread = chatThreadService.createNewThread({ mode: 'research' });

// Example: Create agent thread for code editing
const agentThread = chatThreadService.createNewThread({ mode: 'agent' });
```

## Mode-Specific Behaviors

### Context Window Management

Different modes prioritize different context:

| Mode | Priority Context |
|------|-----------------|
| `agent` | Open files, recent edits, directory structure |
| `gather` | Search results, file contents |
| `case_manager` | Case profile, timeline, documents |
| `research` | Legal documents, citations |
| `drafting` | Templates, existing documents |

### Auto-Approval Settings

Tool auto-approval can be configured per mode:

```typescript
// Settings
{
  autoApproveTools: {
    agent: ['read_file', 'rag_query'],      // Limited auto-approve
    case_manager: ['read_file', 'rag_query', 'list_directory'],  // More permissive
    research: ['read_file', 'rag_query', 'web_search'],  // Research-focused
  }
}
```

