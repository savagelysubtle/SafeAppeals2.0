# Chat Message Flow

This document traces how a message travels from user input to LLM response and back.

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           1. USER INPUT (React)                                  │
│  SidebarChat.tsx                                                                │
│  - User types message and presses Enter                                         │
│  - Calls chatThreadService.sendMessage()                                        │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      2. CHAT THREAD SERVICE (Browser)                            │
│  chatThreadService.ts                                                           │
│  - Adds user message to thread                                                  │
│  - Calls convertToLLMMessageService.prepareLLMChatMessages()                    │
│  - Gets model selection from settings                                           │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                   3. CONVERT TO LLM MESSAGE (Browser)                            │
│  convertToLLMMessageService.ts                                                  │
│  - Generates system prompt based on chatMode                                    │
│  - Converts ChatMessage[] → SimpleLLMMessage[]                                  │
│  - Applies context window trimming                                              │
│  - Formats for provider (Anthropic/OpenAI/Gemini format)                        │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                   4. LLM MESSAGE SERVICE (Browser → IPC)                         │
│  sendLLMMessageService.ts                                                       │
│  - Validates model selection                                                    │
│  - Generates requestId                                                          │
│  - Registers callback hooks (onText, onFinalMessage, onError)                   │
│  - Calls channel.call('sendLLMMessage', params)                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                              IPC Channel
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                   5. LLM MESSAGE CHANNEL (Main Process)                          │
│  llmMessageChannel.ts                                                           │
│  - Receives IPC call                                                            │
│  - Creates abortRef for cancellation                                            │
│  - Calls sendLLMMessage()                                                       │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                   6. SEND LLM MESSAGE (Main Process)                             │
│  sendLLMMessage.ts → sendLLMMessage.impl.ts                                     │
│  - Routes to provider implementation                                            │
│  - Wraps callbacks with extractXMLToolsWrapper (tool parsing)                   │
│  - For open-source: wraps with extractReasoningWrapper                          │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                   7. PROVIDER SDK CALL (Main Process)                            │
│  Example: sendAnthropicChat()                                                   │
│  - Creates SDK instance (Anthropic, OpenAI, etc.)                               │
│  - Configures reasoning (thinking.budget_tokens)                                │
│  - Starts streaming request                                                     │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                   8. STREAMING RESPONSE (Main Process)                           │
│  Provider SDK streaming events                                                  │
│                                                                                  │
│  Anthropic:                                                                     │
│    content_block_start (type: 'thinking') → fullReasoning                      │
│    content_block_start (type: 'text')     → fullText                           │
│    content_block_delta                    → append to respective field          │
│                                                                                  │
│  OpenAI/Compatible:                                                             │
│    chunk.choices[0].delta.content         → fullText                           │
│    chunk.choices[0].delta.reasoning_content → fullReasoning (if supported)      │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                   9. POST-PROCESSING (Main Process)                              │
│  extractGrammar.ts                                                              │
│                                                                                  │
│  extractXMLToolsWrapper():                                                      │
│    - Receives { fullText, fullReasoning, toolCall }                            │
│    - Searches fullText for tool XML tags                                        │
│    - Parses tool parameters from XML                                            │
│    - Returns { displayText, fullReasoning, toolCall }                          │
│                                                                                  │
│  extractReasoningWrapper() (open-source models):                                │
│    - Finds <think>...</think> tags in fullText                                  │
│    - Separates into fullReasoning and fullText                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                              IPC Events
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                  10. CALLBACK INVOCATION (Browser)                               │
│  sendLLMMessageService.ts event listeners                                       │
│                                                                                  │
│  onText_sendLLMMessage:                                                         │
│    - Finds hook by requestId                                                    │
│    - Calls onText({ fullText, fullReasoning, toolCall })                       │
│                                                                                  │
│  onFinalMessage_sendLLMMessage:                                                 │
│    - Calls onFinalMessage({ fullText, fullReasoning, toolCall, ... })          │
│    - Clears hooks                                                               │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                  11. STATE UPDATE (Browser)                                      │
│  chatThreadService.ts                                                           │
│                                                                                  │
│  onText callback:                                                               │
│    - Updates streamState.llmInfo.displayContentSoFar                           │
│    - Updates streamState.llmInfo.reasoningSoFar                                │
│    - Updates streamState.llmInfo.toolCallSoFar                                 │
│                                                                                  │
│  onFinalMessage callback:                                                       │
│    - Adds assistant message to thread                                           │
│    - If toolCall exists: enters tool execution flow                            │
│    - If no toolCall: ends agent loop                                           │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                  12. REACT UI UPDATE (Browser)                                   │
│  SidebarChat.tsx                                                                │
│                                                                                  │
│  Renders based on streamState:                                                  │
│    - Streaming message bubble with displayContentSoFar                         │
│    - Collapsible reasoning section with reasoningSoFar                         │
│    - Tool call indicator if toolCallSoFar present                              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Key Data Transformations

### 1. ChatMessage → SimpleLLMMessage

```typescript
// Input (ChatMessage)
{
  role: 'user',
  content: 'Help me edit this file',
  displayContent: 'Help me edit this file',
  selections: [{ type: 'File', uri: 'file:///src/app.ts', ... }]
}

// Output (SimpleLLMMessage)
{
  role: 'user',
  content: 'Help me edit this file\n\n```typescript\n// file contents...\n```',
  images: undefined
}
```

### 2. SimpleLLMMessage → AnthropicLLMChatMessage

```typescript
// Input
{ role: 'user', content: 'Hello' }

// Output (Anthropic format)
{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }
```

### 3. LLM Response → Parsed Response

```typescript
// Raw LLM output
"I'll help you edit that file.\n\n<edit_file>\n<path>src/app.ts</path>\n<content>...</content>\n</edit_file>"

// After extractXMLToolsWrapper
{
  fullText: "I'll help you edit that file.",  // Display to user
  fullReasoning: "",                           // From extended thinking
  toolCall: {
    name: 'edit_file',
    rawParams: { path: 'src/app.ts', content: '...' },
    doneParams: ['path', 'content'],
    isDone: true,
    id: 'uuid-xxx'
  }
}
```

## Streaming States

The `streamState` tracks what's currently happening:

| State | Meaning | UI Shows |
|-------|---------|----------|
| `undefined` | Idle, nothing running | Normal chat |
| `{ isRunning: 'LLM' }` | LLM is generating | Typing indicator, streaming text |
| `{ isRunning: 'tool' }` | Tool is executing | Tool running indicator |
| `{ isRunning: 'awaiting_user' }` | Waiting for approval | Approve/Reject buttons |
| `{ isRunning: 'idle' }` | Between operations | Brief pause |
| `{ error: {...} }` | Error occurred | Error message |

## Abort Flow

When user cancels:

1. `chatThreadService.abortRunning(threadId)` called
2. Retrieves `interrupt` function from streamState
3. Calls interrupt (which calls `llmMessageService.abort(requestId)`)
4. Main process aborts SDK stream
5. Partial message saved to thread
6. StreamState cleared

