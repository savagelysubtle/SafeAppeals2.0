# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SafeAppealNavigator is a VSCode fork that combines AI-powered code editing with specialized legal research and case management tools. The codebase is built on Electron with TypeScript (94.7%) and includes React components for the UI.

**Core Identity**: Dual-purpose platform serving both as an advanced IDE with AI agent capabilities AND as a legal research tool for workers' compensation appeals.

## Build Commands

### Essential Development Workflow

```bash
# 1. Install dependencies (first time only)
npm install

# 2. Fetch Electron and prebuilts (first time only)
node build/lib/preLaunch.js

# 3. Build React components (Void features)
npm run buildreact

# 4. Start watch mode for automatic rebuilding
npm run watch-clientd

# 5. Launch the application
./scripts/code.sh          # macOS/Linux
.\scripts\code.bat         # Windows
```

### Quick Compilation Commands

```bash
# TypeScript only (fastest for type checking)
cd src && npx tsc --skipLibCheck

# Full VS Code compilation
npm run compile

# React components only
npm run buildreact

# Watch React components
npm run watchreact
```

### Testing Commands

```bash
# Unit tests (Node)
npm run test-node

# Browser tests
npm run test-browser

# After making changes: Ctrl+Shift+P → "Developer: Reload Window"
```

## Code Architecture

### VSCode Process Model

VSCode runs on Electron with two main processes:

- **Main Process** (`electron-main/`): Node.js environment with access to `node_modules`, file system, and OS APIs
- **Browser Process** (`browser/`): Renderer process with DOM/browser APIs but restricted `node_modules` access
- **Common** (`common/`): Shared code usable by both processes

**Key Pattern**: When browser code needs Node functionality, implement on `electron-main/` and create a communication channel between processes.

### Void Directory Structure

**Primary codebase location**: `src/vs/workbench/contrib/void/`

```
src/vs/workbench/contrib/void/
├── browser/           # UI components, services (browser process)
│   ├── react/        # React components (bundled for browser)
│   │   ├── sidebar-tsx/       # Chat interface
│   │   ├── quick-edit-tsx/    # Cmd+K quick edit
│   │   ├── void-settings-tsx/ # Settings panel
│   │   └── void-onboarding/   # Onboarding flow
│   ├── *Service.ts   # Core services (singleton pattern)
│   └── *.contribution.ts # VSCode extension points
├── common/           # Shared business logic
│   ├── voidSettingsService.ts  # Settings management
│   ├── mcpService.ts           # Model Context Protocol
│   └── caseProfileService.ts   # Legal case management
└── electron-main/    # Node.js backend services
```

### Core Services (Singleton Pattern)

Services are registered with `registerSingleton` and injected via constructor with `@IServiceName`:

- **voidSettingsService** (`common/`): Central settings store (providers, models, global settings, MCP state)
- **editCodeService** (`browser/`): Manages Apply/Cmd+K operations, diff zones, streaming changes
- **chatThreadService** (`browser/`): Chat thread state and message history
- **contextGatheringService** (`browser/`): Collects context for LLM (files, selection, workspace)
- **convertToLLMMessageService** (`browser/`): Converts messages to provider-specific formats
- **toolsService** (`browser/`): MCP tool execution and management
- **mcpService** (`common/`): MCP server connection and lifecycle management

### LLM Message Pipeline

1. User sends message via React sidebar (`SidebarChat.tsx`)
2. `chatThreadService` updates thread state
3. `contextGatheringService` collects context (files, selection, codebase)
4. `convertToLLMMessageService` formats for provider
5. Message sent to `electron-main/` to avoid CSP issues
6. Provider SDK (OpenAI, Anthropic, etc.) called from main process
7. Streaming response flows back to browser process
8. Updates reflected in sidebar UI

**Important**: `modelCapabilities.ts` must be updated when new models are released.

### Apply System

Two modes:
- **Fast Apply**: Uses Search/Replace blocks (`<<<<<<< ORIGINAL` / `=======` / `>>>>>>> UPDATED`)
- **Slow Apply**: Rewrites entire file

**Key Terminology**:
- **DiffZone**: `{startLine, endLine}` region showing red/green diffs, supports streaming
- **DiffArea**: Generalized line number tracker
- Each DiffZone has an `llmCancelToken` for streaming cancellation

**Workflow**:
- Apply button → Creates DiffZone over file → Streams LLM changes → Shows diffs
- LLM Edit tool → Calls Apply internally
- Cmd+K → Same as Apply but smaller DiffZone (selection only)

### Settings Architecture

`voidSettingsService` manages all settings through immutable state updates:

```typescript
VoidSettingsState {
  settingsOfProvider     // Provider configs (API keys, endpoints, models)
  modelSelectionOfFeature  // Selected model per feature (Chat, Ctrl+K, Apply, Autocomplete, SCM)
  optionsOfModelSelection  // Per-model options (temperature, etc.)
  globalSettings         // Global Void settings (chatMode, autoApprove, etc.)
  overridesOfModel       // Model capability overrides
  mcpUserStateOfName     // MCP server state (enabled/disabled)
}
```

**ChatMode**: `normal | gather | agent` (configurable per thread or globally via Case Organizer)

### React Build Process

React components are bundled separately using a custom build script:

```bash
cd src/vs/workbench/contrib/void/browser/react/
node build.js          # Single build
node build.js --watch  # Watch mode
```

Build outputs to `react/out/` and is imported by VSCode's browser process. Tailwind CSS is scoped to avoid conflicts with VSCode's styling.

## Code Conventions

### TypeScript Guidelines

- **No unnecessary type casts**: Find the correct type instead of using `any`
- **Semicolons**: Follow existing file convention (don't add/remove)
- **Naming convention for mappings**: Use `bOfA` pattern
  - Example: `toolNameOfToolId` for a map from `toolId` → `toolName`
- **VSCode Services**: Use dependency injection pattern with `@IServiceName` in constructor

### File Modification Rules

**CRITICAL**: Never modify files outside `src/vs/workbench/contrib/void/` without explicit user approval.

Most Void-specific code lives in the `void/` directory. Only venture outside when integrating with core VSCode functionality.

### VSCode API Patterns

- **Models**: Use `ITextModel` for file contents (shared between editors)
- **Editors**: Use `ICodeEditor` for editor instances
- **URIs**: File paths represented as URIs (resources)
- **Actions/Commands**: Register with `registerAction` for user-accessible commands
- **Disposables**: Always dispose of subscriptions and event listeners
- **Events**: Use `Emitter<T>` and `Event<T>` pattern for pub/sub

## Legal Research Features (Case Organizer)

The application includes specialized legal case management:

- **Case Profiles** (`caseProfileService.ts`): Store case metadata, timelines, documents
- **Document Management**: DOCX support with rich text editing
- **Research Tools**: Precedent discovery, policy analysis
- **Chat Modes**: Special `gather` mode for case research

## Testing Workflow

After making changes:

1. **If React components changed**: `npm run buildreact`
2. **If TypeScript changed**: `npm run compile` (or let watch mode handle it)
3. **Reload window**: `Ctrl+Shift+P` → "Developer: Reload Window"
4. **Check console**: Look for errors in DevTools (`Help` → `Toggle Developer Tools`)

## Common Issues

**"Cannot find module './react/out/...'"**
```bash
npm run buildreact
```

**TypeScript errors**
```bash
cd src && npx tsc --skipLibCheck
```

**Watch processes stuck**
```bash
npm run kill-watchd
npm run restart-watchd
```

## Key Files to Know

- `void.contribution.ts` - Main entry point, registers all Void features
- `voidSettingsService.ts` - Central settings management
- `editCodeService.ts` - Apply/Cmd+K implementation
- `modelCapabilities.ts` - Model definitions and capabilities (update for new models)
- `actionIDs.ts` - Command ID constants
- `sidebarPane.ts` - Sidebar panel registration
- `react/build.js` - React build configuration

## Development References

- [VSCode Source Code Organization](https://github.com/microsoft/vscode/wiki/Source-Code-Organization)
- [Built-in VSCode Styles](https://code.visualstudio.com/api/references/theme-color) - Use `var(--vscode-*)` CSS variables
- See `VOID_CODEBASE_GUIDE.md` for detailed architecture diagrams
- See `.acheatcode/complete-cheatsheet.md` for exhaustive command reference

## Launch Configurations

**From VSCode**: Press `F5` or use "Launch VS Code Internal" debug configuration (sets `VSCODE_DEV=1` for CSS imports)

**From Terminal**:
- Desktop: `./scripts/code.sh` (macOS/Linux) or `.\scripts\code.bat` (Windows)
- Web server: `./scripts/code-server.sh`
- Static web: `./scripts/code-web.sh`
