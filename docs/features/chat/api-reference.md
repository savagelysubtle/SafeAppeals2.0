# Chat System API Reference

## Services

### IChatThreadService

Main orchestrator for chat operations.

**Location**: `src/vs/workbench/contrib/void/browser/chatThreadService.ts`

```typescript
interface IChatThreadService {
  readonly _serviceBrand: undefined;

  // State
  readonly state: ChatThreadState;
  readonly streamState: { [threadId: string]: StreamState };
  readonly onDidChangeCurrentThread: Event<void>;

  // Thread Management
  getCurrentThread(): ChatThread | undefined;
  createNewThread(opts?: { mode?: ChatMode }): string;
  switchToThread(threadId: string): void;
  deleteThread(threadId: string): void;

  // Messaging
  sendMessage(threadId: string, message: UserMessage): Promise<void>;
  abortRunning(threadId: string): void;

  // Tool Handling
  approveToolCall(threadId: string): void;
  rejectLatestToolRequest(threadId: string): void;

  // Checkpoints
  restoreToCheckpoint(threadId: string, checkpointIdx: number): void;
}
```

### ILLMMessageService

Browser-side proxy for LLM communication.

**Location**: `src/vs/workbench/contrib/void/common/sendLLMMessageService.ts`

```typescript
interface ILLMMessageService {
  readonly _serviceBrand: undefined;

  sendLLMMessage(params: ServiceSendLLMMessageParams): string | null;
  abort(requestId: string): void;

  // Model listing
  ollamaList(params: ServiceModelListParams<OllamaModelResponse>): void;
  openAICompatibleList(params: ServiceModelListParams<OpenaiCompatibleModelResponse>): void;
}
```

### IConvertToLLMMessageService

Converts internal messages to LLM format.

**Location**: `src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts`

```typescript
interface IConvertToLLMMessageService {
  readonly _serviceBrand: undefined;

  prepareLLMChatMessages(params: {
    chatMessages: ChatMessage[];
    chatMode: ChatMode;
    modelSelection: ModelSelection;
  }): Promise<{
    messages: LLMChatMessage[];
    separateSystemMessage: string | undefined;
  }>;

  prepareLLMSimpleMessages(params: {
    simpleMessages: SimpleLLMMessage[];
    systemMessage: string;
    modelSelection: ModelSelection;
    featureName: FeatureName;
  }): {
    messages: LLMChatMessage[];
    separateSystemMessage: string | undefined;
  };
}
```

### IContextTrackingService

Tracks token usage and context window.

**Location**: `src/vs/workbench/contrib/void/common/contextTrackingService.ts`

```typescript
interface IContextTrackingService {
  readonly _serviceBrand: undefined;

  onDidChangeContextUsage: Event<ContextUsageInfo>;
  onThresholdCrossed: Event<{ level: ContextUsageLevel; usagePercent: number }>;

  getContextUsageForThread(
    messages: ChatMessage[],
    providerName: ProviderName | null,
    modelName: string | null
  ): ContextUsageInfo;

  estimateTokenCount(text: string): number;

  shouldSummarize(
    messages: ChatMessage[],
    providerName: ProviderName | null,
    modelName: string | null,
    threshold?: number
  ): boolean;
}
```

## Types

### ChatMessage

```typescript
type ChatMessage =
  | {
      role: 'user';
      content: string;              // Content sent to LLM
      displayContent: string;       // Content shown to user
      selections: StagingSelectionItem[] | null;
      state: {
        stagingSelections: StagingSelectionItem[];
        isBeingEdited: boolean;
      }
    }
  | {
      role: 'assistant';
      displayContent: string;       // Response shown to user
      reasoning: string;            // Reasoning/thinking
      anthropicReasoning: AnthropicReasoning[] | null;
    }
  | ToolMessage<ToolName>
  | DecorativeCanceledTool
  | CheckpointEntry
```

### ToolMessage

```typescript
type ToolMessage<T extends ToolName> = {
  role: 'tool';
  content: string;
  id: string;
  rawParams: RawToolParamsObj;
  mcpServerName: string | undefined;
} & (
  | { type: 'invalid_params', result: null, name: T }
  | { type: 'tool_request', result: null, name: T, params: ToolCallParams<T> }
  | { type: 'running_now', result: null, name: T, params: ToolCallParams<T> }
  | { type: 'tool_error', result: string, name: T, params: ToolCallParams<T> }
  | { type: 'success', result: Awaited<ToolResult<T>>, name: T, params: ToolCallParams<T> }
  | { type: 'rejected', result: null, name: T, params: ToolCallParams<T> }
)
```

### RawToolCallObj

```typescript
type SingleToolCall = {
  name: ToolName;
  rawParams: RawToolParamsObj;
  doneParams: ToolParamName<ToolName>[];
  id: string;
  isDone: boolean;
}

type MultipleToolCalls = {
  toolCalls: SingleToolCall[];
  format: 'antml';
}

type RawToolCallObj = SingleToolCall | MultipleToolCalls;
```

### ChatMode

```typescript
type ChatMode =
  | 'agent'
  | 'gather'
  | 'normal'
  | 'case_manager'
  | 'research'
  | 'drafting'
```

### StreamState

```typescript
type StreamState = {
  isRunning: 'LLM' | 'tool' | 'awaiting_user' | 'idle' | undefined;
  llmInfo: {
    displayContentSoFar: string;
    reasoningSoFar: string;
    toolCallSoFar: RawToolCallObj | null;
  };
  toolInfo?: {
    toolName: ToolName;
    toolParams: ToolCallParams<ToolName>;
    id: string;
    content: string;
    rawParams: RawToolParamsObj;
    mcpServerName: string | undefined;
  };
  error?: {
    message: string;
    fullError: Error | null;
  };
  interrupt: Promise<() => void> | 'not_needed';
}
```

### ContextUsageInfo

```typescript
interface ContextUsageInfo {
  totalTokens: number;
  contextWindow: number;
  reservedOutputTokens: number;
  availableInputTokens: number;
  usagePercent: number;
  usageLevel: 'green' | 'yellow' | 'orange' | 'red';
  tokensRemaining: number;
  breakdown: {
    systemTokens: number;
    userTokens: number;
    assistantTokens: number;
    toolTokens: number;
  };
  providerName: ProviderName | null;
  modelName: string | null;
}
```

## Callbacks

### OnText

```typescript
type OnText = (params: {
  fullText: string;
  fullReasoning: string;
  toolCall?: RawToolCallObj;
}) => void
```

### OnFinalMessage

```typescript
type OnFinalMessage = (params: {
  fullText: string;
  fullReasoning: string;
  toolCall?: RawToolCallObj;
  anthropicReasoning: AnthropicReasoning[] | null;
}) => void
```

### OnError

```typescript
type OnError = (params: {
  message: string;
  fullError: Error | null;
}) => void
```

## IPC Channels

### void-channel-llmMessage

**Methods**:
- `sendLLMMessage` - Send message to LLM
- `abort` - Abort in-progress request
- `ollamaList` - List Ollama models
- `openAICompatibleList` - List OpenAI-compatible models

**Events**:
- `onText_sendLLMMessage` - Streaming text update
- `onFinalMessage_sendLLMMessage` - Final message
- `onError_sendLLMMessage` - Error occurred
- `onSuccess_list_ollama` - Ollama model list
- `onError_list_ollama` - Ollama list error
- `onSuccess_list_openAICompatible` - OpenAI model list
- `onError_list_openAICompatible` - OpenAI list error

## Helper Functions

### Type Guards

```typescript
// sendLLMMessageTypes.ts
function isSingleToolCall(toolCall: RawToolCallObj): toolCall is SingleToolCall {
  return 'name' in toolCall;
}

function isMultipleToolCalls(toolCall: RawToolCallObj): toolCall is MultipleToolCalls {
  return 'toolCalls' in toolCall && 'format' in toolCall;
}
```

### Error Helpers

```typescript
// sendLLMMessageTypes.ts
const errorDetails = (fullError: Error | null): string | null => {
  if (fullError === null) return null;
  if (typeof fullError === 'object') {
    if (Object.keys(fullError).length === 0) return null;
    return JSON.stringify(fullError, null, 2);
  }
  return null;
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return error + '';
}
```

## Constants

### Context Tracking

```typescript
// contextTrackingService.ts
const CHARS_PER_TOKEN = 8;  // Approximation for token counting

const CONTEXT_THRESHOLDS = {
  GREEN: 0.60,    // 0-60% usage
  YELLOW: 0.80,   // 60-80% usage
  ORANGE: 0.90,   // 80-90% usage
  RED: 1.0,       // 90%+ usage
}
```

### Chat Retries

```typescript
// chatThreadService.ts
const CHAT_RETRIES = 3;
const RETRY_DELAY = 1000;  // ms
```

