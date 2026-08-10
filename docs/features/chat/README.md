# Chat System Documentation

> Comprehensive documentation for SafeAppeals' LLM-powered chat and agent system.

> **Shipping path (Aug 2026):** Plan/Agent modes via workbench chat + SafeAppeals auth
> agents; tools are `vscode.lm` contributions (`safeappeals_*` satellites and CORE host
> tools). House pattern: [Agent LM Tools Pattern](../../agent-tools-pattern.md).
> Diagrams and pages that describe Void sidebar IPC / `extractXMLToolsWrapper` are
> **historical** — not the current primary tool pipeline.

## Overview

The SafeAppeals chat system is a sophisticated conversational AI interface that combines:

- **Multi-provider LLM support** (Anthropic, OpenAI, Gemini, and 10+ other providers)
- **Extended thinking/reasoning** capabilities (Claude Opus 4.5, Sonnet 4.5)
- **Tool calling** via extension `languageModelTools` + agent allowlist (`safeappeals_*`)
- **Agent modes** for case research, document drafting, and case management
- **Plan mode** with durable `.safeAppeals/plans/*.plan.md` files via `safeappeals_createPlan` (see [Plan Mode](./plan-mode.md))

## Architecture (historical Void diagram)

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
│       └── extractXMLToolsWrapper()  ── Parses XML tool calls (Void-era)        │
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
| [Tool Calling](./tool-calling.md)         | Historical Void XML parsing notes (legacy)  |
| [Agent LM Tools Pattern](../../agent-tools-pattern.md) | Satellite `languageModelTools` + `safeappeals_*` allowlist; integrated browser CORE suite + `browser_cdp` |
| [Chat Modes](./chat-modes.md)             | Agent, gather, normal, case-specific modes  |
| [Plan Mode](./plan-mode.md)               | Plan agent, CreatePlan persistence, sticky sessions |
| [Bug Fixes](./bug-fixes.md)               | Known issues and their solutions            |
| [API Reference](./api-reference.md)       | Service interfaces and types                |
| [Per-Workspace Storage](./per-workspace-storage.md) | Workspace-isolated chat thread storage      |

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

**Shipping today (workbench):** **Plan** (custom agent — research and write `.safeAppeals/plans/*.plan.md`) and **Agent** (implement). Switch with `safeappeals_switchMode` or the chat mode UI. Details: [Plan Mode](./plan-mode.md).

Historical Void-era mode names still documented under [Chat Modes](./chat-modes.md):

| Mode           | Purpose                        | Tools Available       |
| -------------- | ------------------------------ | --------------------- |
| `agent`        | Full agent capabilities        | All tools             |
| `gather`       | Research and context gathering | RAG, read, web search |
| `normal`       | Basic chat                     | Limited tools         |
| `case_manager` | Case management                | Case-specific tools   |
| `research`     | Legal research                 | Research tools        |
| `drafting`     | Document drafting              | Document tools        |

### 3. Tool Call Flow

**Shipping:** Extensions contribute `languageModelTools` and register with
`vscode.lm.registerTool`; the SafeAppeals agent loop allowlists `safeappeals_*`
(plus CORE names). Catalog and checklist:
[Agent LM Tools Pattern](../../agent-tools-pattern.md).

**Historical (Void XML):** LLM emitted ANTML/XML → `extractXMLToolsWrapper` →
`toolsService` validate/approve/execute. Details in [Tool Calling](./tool-calling.md)
(legacy only).

### 4. Integrated browser Agent tools

When Agent mode and `workbench.browser.enableChatTools` are on, CORE tools can open and drive **shared** integrated browser pages: snapshot (`read_page`), click/type, `run_playwright_code`, and page-scoped `browser_cdp`. Plan mode strips the whole browser suite. Workbench Electron CDP (`--remote-debugging-port`) stays developer-only — not an Agent tool. See [Agent LM Tools Pattern](../../agent-tools-pattern.md).

## Related Documentation

- [Agent LM Tools Pattern](../../agent-tools-pattern.md) - Satellite tools, CORE browser suite + `browser_cdp`, allowlist
- [Models System](../modelsSystem/README.md) - Provider configuration, capabilities
- [Tools System](../tools/README.md) - Tool definitions (shipping LM + historical Void)
- [Private Search](../../rag/tool-contracts.md) - Shipping RAG agent tools
- [Storage & Databases](../storage/README.md) - Complete database path reference (dev vs prod)
- [Per-Workspace Storage](per-workspace-storage.md) - Chat-specific thread storage details
