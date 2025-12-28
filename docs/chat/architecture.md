# Chat System Architecture

## Process Model

SafeAppeals runs on Electron with two main processes that handle chat:

### Browser Process (Renderer)
Location: `src/vs/workbench/contrib/void/browser/`

- **React UI** (`react/src/sidebar-tsx/`) - Chat interface components
- **chatThreadService** - Thread state, message history, tool execution
- **llmMessageService** - IPC proxy to main process
- **convertToLLMMessageService** - Message format conversion
- **contextTrackingService** - Token counting, context window management

### Main Process (Node.js)
Location: `src/vs/workbench/contrib/void/electron-main/`

- **llmMessageChannel** - IPC handler for browser requests
- **sendLLMMessage** - LLM provider implementations
- **Provider SDKs** - Anthropic, OpenAI, Google GenAI, etc.

### Why This Split?

1. **Security**: LLM SDK calls happen in main process (not exposed to web)
2. **CSP Compliance**: Browser can't make direct API calls to LLM providers
3. **Node.js Access**: Main process can use native modules (crypto, fs, etc.)

## Core Services

### chatThreadService (`browser/chatThreadService.ts`)

The central orchestrator for all chat operations.

```typescript
interface IChatThreadService {
  // Thread management
  getCurrentThread(): ChatThread | undefined;
  createNewThread(opts: { mode?: ChatMode }): string;

  // Messaging
  sendMessage(threadId: string, message: UserMessage): Promise<void>;
  abortRunning(threadId: string): void;

  // Tool handling
  approveToolCall(threadId: string): void;
  rejectLatestToolRequest(threadId: string): void;

  // State
  readonly state: ChatThreadState;
  readonly streamState: StreamState;
}
```

**Key Responsibilities:**
- Maintains thread state (messages, selections, mode)
- Orchestrates the agent loop (send → receive → tool → repeat)
- Handles streaming state (LLM running, tool running, awaiting user)
- Manages checkpoints for undo/redo

### llmMessageService (`common/sendLLMMessageService.ts`)

Browser-side proxy that communicates with main process over IPC.

```typescript
interface ILLMMessageService {
  sendLLMMessage(params: ServiceSendLLMMessageParams): string | null;
  abort(requestId: string): void;
  ollamaList(params: ServiceModelListParams<OllamaModelResponse>): void;
  openAICompatibleList(params: ServiceModelListParams<OpenaiCompatibleModelResponse>): void;
}
```

**IPC Channels:**
- `void-channel-llmMessage` - Main message channel
- Events: `onText_sendLLMMessage`, `onFinalMessage_sendLLMMessage`, `onError_sendLLMMessage`

### convertToLLMMessageService (`browser/convertToLLMMessageService.ts`)

Converts internal message format to provider-specific formats.

```typescript
interface IConvertToLLMMessageService {
  prepareLLMChatMessages(params: {
    chatMessages: ChatMessage[];
    chatMode: ChatMode;
    modelSelection: ModelSelection;
  }): Promise<{ messages: LLMChatMessage[]; separateSystemMessage: string | undefined }>;
}
```

**Key Functions:**
- Generates system prompts based on chat mode
- Converts tool results to provider format
- Handles image/vision content
- Manages context window trimming

## Data Flow

### Message Lifecycle

```
User Input (React)
       │
       ▼
┌──────────────────────┐
│  chatThreadService   │
│  - Validates input   │
│  - Creates user msg  │
│  - Updates thread    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ convertToLLMMessage  │
│  - Generate system   │
│  - Format messages   │
│  - Apply trimming    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  llmMessageService   │
│  - IPC to main       │
│  - Register hooks    │
└──────────┬───────────┘
           │
     IPC Channel
           │
           ▼
┌──────────────────────┐
│   Main Process       │
│  - Provider SDK call │
│  - Stream handling   │
│  - Post-processing   │
└──────────┬───────────┘
           │
     IPC Events
           │
           ▼
┌──────────────────────┐
│  chatThreadService   │
│  - Update stream     │
│  - Add assistant msg │
│  - Handle tool calls │
└──────────┬───────────┘
           │
           ▼
React UI Updates
```

### Stream State Machine

```typescript
type StreamState = {
  isRunning: 'LLM' | 'tool' | 'awaiting_user' | 'idle' | undefined;
  llmInfo: {
    displayContentSoFar: string;
    reasoningSoFar: string;
    toolCallSoFar: RawToolCallObj | null;
  };
  toolInfo?: { /* tool execution state */ };
  error?: { message: string; fullError: Error | null };
  interrupt: Promise<() => void>;
}
```

## File Structure

```
src/vs/workbench/contrib/void/
├── browser/
│   ├── chatThreadService.ts          # Main chat orchestrator
│   ├── chatThreadServiceTypes.ts     # (in common/)
│   ├── convertToLLMMessageService.ts # Message format conversion
│   ├── cloudLLMRouterService.ts      # Cloud routing
│   ├── react/src/sidebar-tsx/        # React chat UI
│   │   ├── SidebarChat.tsx           # Main chat component
│   │   ├── Sidebar.tsx               # Sidebar container
│   │   └── ContextWindowIndicator.tsx # Token usage display
│   └── toolsService.ts               # Tool validation/execution
├── common/
│   ├── sendLLMMessageService.ts      # IPC proxy service
│   ├── sendLLMMessageTypes.ts        # Message type definitions
│   ├── chatThreadServiceTypes.ts     # Chat message types
│   ├── contextTrackingService.ts     # Token counting
│   └── voidSettingsService.ts        # Settings management
└── electron-main/
    ├── llmMessage/
    │   ├── sendLLMMessage.ts         # Entry point
    │   ├── sendLLMMessage.impl.ts    # Provider implementations
    │   ├── extractGrammar.ts         # Reasoning/tool extraction
    │   ├── toolRouter.ts             # Native vs XML routing
    │   └── xmlParserService.ts       # XML tool parser
    └── llmMessageChannel.ts          # IPC channel handler
```

## Provider Implementations

Each provider has specific handling in `sendLLMMessage.impl.ts`:

| Provider | SDK | Reasoning | Tool Format |
|----------|-----|-----------|-------------|
| Anthropic | @anthropic-ai/sdk | Native thinking blocks | XML (forced) |
| OpenAI | openai | N/A | XML (forced) |
| Gemini | @google/genai | thinkingConfig | XML (forced) |
| DeepSeek | openai (compat) | <think> tags | XML |
| Ollama | ollama + openai | Model-specific | XML |

**Note**: Tool format is currently forced to XML for all providers because the system prompt includes XML tool definitions. Native tool calling is available but disabled.

