# Chat System Documentation

> Comprehensive documentation for SafeAppeals' LLM-powered chat and agent system.

## Overview

The SafeAppeals chat system is a sophisticated conversational AI interface that combines:

- **Multi-provider LLM support** (Anthropic, OpenAI, Gemini, and 10+ other providers)
- **Extended thinking/reasoning** capabilities (Claude Opus 4.5, Sonnet 4.5)
- **Tool calling** for code editing, file operations, and web search
- **Agent modes** for case research, document drafting, and case management

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER PROCESS                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  React Sidebar (SidebarChat.tsx)                                                │
│       │                                                                          │
│       ▼                                                                          │
│  chatThreadService  ─────────────────────────────────────────────────────────── │
│       │  • Manages chat threads and message history                             │
│       │  • Handles tool call execution                                          │
│       │  • Tracks streaming state (reasoning, text, tools)                      │
│       ▼                                                                          │
│  cloudLLMRouterService                                                          │
│       │  • Routes through SafeAppeals Cloud (if enabled)                        │
│       ▼                                                                          │
│  llmMessageService (sendLLMMessageService.ts)                                   │
│       │                                                                          │
│       │  IPC Channel: 'void-channel-llmMessage'                                 │
└───────┼─────────────────────────────────────────────────────────────────────────┘
        │
        │  Serialized over IPC (functions → event listeners)
        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              MAIN PROCESS (Node.js)                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  llmMessageChannel.ts                                                           │
│       │                                                                          │
│       ▼                                                                          │
│  sendLLMMessage.ts → sendLLMMessage.impl.ts                                     │
│       │                                                                          │
│       ├── sendAnthropicChat()     ── Anthropic SDK (native thinking blocks)    │
│       ├── _sendOpenAICompatibleChat() ── OpenAI SDK + compatible providers     │
│       └── sendGeminiChat()        ── Google GenAI SDK                          │
│                                                                                  │
│  Post-processing wrappers:                                                      │
│       ├── extractReasoningWrapper() ── Parses <think> tags (open-source)       │
│       └── extractXMLToolsWrapper()  ── Parses XML tool calls                   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Documentation Index

| Document                                  | Description                                 |
| ----------------------------------------- | ------------------------------------------- |
| [Architecture](./architecture.md)         | System design, process model, data flow     |
| [Message Flow](./message-flow.md)         | How messages travel from UI to LLM and back |
| [System Prompts](./system-prompts.md)     | How prompts are assembled and structured    |
| [Reasoning System](./reasoning-system.md) | Extended thinking, <think> tags, separation |
| [Tool Calling](./tool-calling.md)         | XML parsing, native tools, execution        |
| [Chat Modes](./chat-modes.md)             | Agent, gather, normal, case-specific modes  |
| [Bug Fixes](./bug-fixes.md)               | Known issues and their solutions            |
| [API Reference](./api-reference.md)       | Service interfaces and types                |

## Quick Start

### Sending a Chat Message (Internal)

```typescript
// From a VSCode service:
@IChatThreadService private readonly chatThreadService: IChatThreadService

// Send a message
await chatThreadService.sendMessage(threadId, {
  content: 'Hello, please help me with...',
  selections: [], // File/code selections
});
```

### Understanding Message Types

```typescript
type ChatMessage =
	| {
			role: "user";
			content: string;
			displayContent: string;
			selections: StagingSelectionItem[];
	  }
	| {
			role: "assistant";
			displayContent: string;
			reasoning: string;
			anthropicReasoning: AnthropicReasoning[];
	  }
	| ToolMessage<ToolName>
	| CheckpointEntry;
```

## Key Concepts

### 1. Reasoning vs Display Content

When using models with extended thinking (Claude Opus 4.5, Sonnet 4.5):

- **`reasoning`**: The model's internal thought process (collapsible in UI)
- **`displayContent`**: The actual response shown to the user

### 2. Chat Modes

| Mode           | Purpose                        | Tools Available       |
| -------------- | ------------------------------ | --------------------- |
| `agent`        | Full agent capabilities        | All tools             |
| `gather`       | Research and context gathering | RAG, read, web search |
| `normal`       | Basic chat                     | Limited tools         |
| `case_manager` | Case management                | Case-specific tools   |
| `research`     | Legal research                 | Research tools        |
| `drafting`     | Document drafting              | Document tools        |

### 3. Tool Call Flow

1. LLM outputs XML tool call in response
2. `extractXMLToolsWrapper` parses the XML
3. Tool parameters are validated by `toolsService`
4. User approves (or auto-approve if enabled)
5. Tool executes and result is added to thread
6. Loop continues with tool result context

## Related Documentation

- [Models System](../modelsSystem/README.md) - Provider configuration, capabilities
- [Tools System](../tools/README.md) - Tool definitions, execution
- [RAG System](../ragSystem/README.md) - Context gathering, embeddings
