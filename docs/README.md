# SafeAppeals Documentation

This directory contains comprehensive documentation for the SafeAppeals system components and features.

## 📚 Documentation Index

### Core Systems

#### [File Organizer System](./features/fileOrganizer/)

Case-folder organization via the `organize-files` skill (standard snake_case folders under the case root).

**Components:**

- [Main README](./features/fileOrganizer/README.md) - Overview and architecture
- [User Guide](./features/fileOrganizer/user-guide.md) - Complete usage instructions
- [Developer Guide](./features/fileOrganizer/developer-guide.md) - Technical implementation details
- [API Reference](./features/fileOrganizer/api-reference.md) - Complete API documentation
- [Configuration Guide](./features/fileOrganizer/configuration-guide.md) - Setup and customization
- [Examples](./features/fileOrganizer/examples.md) - Practical usage examples
- [Case config notes](./features/FILE_ORG_CASE_CONFIG.md) - Historical `.fileorg.json` / current `AGENTS.md` + `.safeAppeals/` layout

**Key Features:**

- Standard folders: `medical_reports`, `correspondence`, `decisions_and_orders`, `evidence`, `personal_notes`, `to_sort`, plus `core_references/` for shared refs
- Skill-driven organize flow (`extensions/safeappeals-timeline/skills/organize-files`)
- Case config and skills under `.safeAppeals/` (not `.vscode/` for new SafeAppeals case settings)

#### [AI Models Configuration](./modelsSystem/)

Comprehensive AI model configuration and capabilities system for SafeAppeals / VS Code.

**Components:**

- [Main README](./modelsSystem/README.md) - Overview and architecture
- [API Reference](./modelsSystem/api-reference.md) - Complete type definitions and functions
- [Provider Guide](./modelsSystem/provider-guide.md) - Detailed provider configurations
- [Reasoning Guide](./modelsSystem/reasoning-guide.md) - Advanced reasoning capabilities

**Key Features:**

- Support for 15+ AI providers (OpenAI, Anthropic, Google, xAI, etc.)
- Type-safe model definitions with capabilities tracking
- Advanced reasoning support (budget-based, effort-based, open-source)
- Cost tracking and usage monitoring
- Local model support (Ollama, vLLM, LM Studio)
- Intelligent fallback mechanisms

#### [Tools System](./tools/)

Comprehensive AI tool calling system with XML parsing, schema validation, and secure execution.

**Components:**

- [Main README](./tools/README.md) - Overview and architecture
- [API Reference](./tools/api-reference.md) - Complete type definitions and functions
- [Schema Validation Guide](./tools/schema-validation-guide.md) - Validation system usage
- [XML Parsing System](./tools/xml-parsing-system.md) - XML tool call parsing
- [Tool Execution Guide](./tools/tool-execution-guide.md) - Approval and execution workflows
- [Usage Examples](./tools/examples.md) - Practical integration examples
- [Developer Guide](./tools/developer-guide.md) - Extending the tools system

**Key Features:**

- Multi-level XML parsing with error recovery (custom → streaming → regex fallback)
- Type-safe schema validation with custom validators (75x performance improvement)
- Approval-based security system (edits, terminal, MCP, RAG tools)
- 25+ built-in tools for file operations, terminal commands, and information retrieval
- Streaming support for real-time tool call processing
- Comprehensive telemetry and performance monitoring

#### [Chat System](./features/chat/)

LLM-powered conversational AI with extended thinking and tool calling.

**Components:**

- [Main README](./features/chat/README.md) - Overview and architecture
- [Architecture](./features/chat/architecture.md) - System design, process model, data flow
- [Message Flow](./features/chat/message-flow.md) - End-to-end message lifecycle
- [Reasoning System](./features/chat/reasoning-system.md) - Extended thinking, separation
- [Tool Calling](./features/chat/tool-calling.md) - Historical Void XML notes (legacy)
- [Agent LM Tools Pattern](./agent-tools-pattern.md) - Satellite tools (`languageModelTools` + allowlist)
- [Chat Modes](./features/chat/chat-modes.md) - Plan/Agent (shipping) and historical Void modes
- [Plan Mode](./features/chat/plan-mode.md) - CreatePlan persistence under `.safeAppeals/plans/`
- [Bug Fixes](./features/chat/bug-fixes.md) - Known issues and solutions
- [API Reference](./features/chat/api-reference.md) - Service interfaces and types

**Key Features:**

- Multi-provider LLM support (Anthropic, OpenAI, Gemini, 10+ providers)
- Extended thinking/reasoning (Claude Opus 4.5, Sonnet 4.5)
- Extension LM tools via `contributes.languageModelTools` + `vscode.lm.registerTool` (`safeappeals_*`)
- Plan and Agent modes (`safeappeals_switchMode`); durable plans via `safeappeals_createPlan`
- Historical Void-era modes also documented (gather, research, drafting, …)
- Context window tracking and management
- Agent loop with tool execution and checkpoints

#### [Storage & Database System](./storage/)

Per-workspace isolation and Electron user-data paths.

**Components:**

- [Main README](./storage/README.md) - Dev vs production user-data paths

**Key Features:**

- Development (`VSCODE_DEV`): user-data product name `safe-appeals-dev` (Linux: `~/.config/safe-appeals-dev`; Windows: `%APPDATA%\safe-appeals-dev`)
- Production: Safe Appeals (`product.json` `applicationName` / `dataFolderName`: `safe-appeals-navigator` / `.safe-appeals-navigator`) — not Void / code-oss-dev
- Private Search indexes live under the RAG extension `globalStorageUri` (`…/rag/<workspaceId>/`)
- Case timeline data: `.safeAppeals/timeline.json` in the workspace

#### [Time Tracker](./features/timeTracker/)

Professional legal time tracking with UTBMS codes and LEDES export.

**Components:**

- [Main README](./features/timeTracker/README.md) - Overview and architecture
- [User Guide](./features/timeTracker/user-guide.md) - Complete usage instructions
- [Developer Guide](./features/timeTracker/developer-guide.md) - Technical implementation details
- [API Reference](./features/timeTracker/api-reference.md) - TypeScript interfaces and services

**Key Features:**

- 6-minute billing increments with configurable rounding
- UTBMS task and activity codes (litigation + workers' comp)
- Matter/case tracking with billing rates
- LEDES 1998B export for legal billing
- CSV/JSON export for reporting
- Per-workspace SQLite storage
- Live timer in status bar and sidebar

#### [Audio Recorder](./features/audioRecorder/)

Audio recording, playback, and transcription for legal professionals.

**Components:**

- [Main README](./features/audioRecorder/README.md) - Overview and architecture
- [User Guide](./features/audioRecorder/user-guide.md) - Complete usage instructions
- [Developer Guide](./features/audioRecorder/developer-guide.md) - Technical implementation details
- [API Reference](./features/audioRecorder/api-reference.md) - TypeScript interfaces and services

**Key Features:**

- In-app audio recording with start/stop/pause
- Inline playback with seek bar, time display, volume control
- Local Whisper transcription (no API costs, fully offline)
- Import audio files (WAV, MP3, M4A, OGG, WEBM, FLAC)
- Export transcripts as DOCX, TXT, SRT, JSON
- Per-workspace SQLite storage
- Hearings Audio walkthrough (`safeappeals-audio`)

#### [Case Timeline](./features/timeline/)

Case chronology, deadlines, sample case, and Tutorials hub.

**Components:**

- [Main README](./features/timeline/README.md) - Overview
- [User Guide](./features/timeline/user-guide.md) - Usage
- [Configuration Guide](./features/timeline/configuration-guide.md) - Storage and jurisdictions
- [API Reference](./features/timeline/api-reference.md) - Services and types

**Key Features:**

- Persists under `.safeAppeals/timeline.json` (not root `.timeline.json`)
- Command `safeappeals-timeline.openTutorials` (Help → Tutorials) opens/ensures the sample case as a real `file://` workspace, then Setup/Beginner walkthrough + feature walkthroughs
- Standard case folders are snake_case (`medical_reports`, `to_sort`, …) plus `core_references/`

#### [Private Search (RAG)](./rag/)

On-device Private Search — shipped in `extensions/safeappeals-rag`.

**Status:** Shipped

**Current docs (prefer these):**

- [Tool contracts](./rag/tool-contracts.md) — frozen `safeappeals_rag_*` tools and scopes
- [Packaging](./rag/packaging-rung-14.md) — native / prebuild notes

**UI:** left status bar `$(search) Private Search` (RAG). The Copilot shield icon is not Private Search.

**Shared refs folder:** `core_references/` (not `policy-manuals/`).

> Historical Void-era notes under [`./ragSystem/`](./ragSystem/) (Docling/Chroma/`rag_search_policy`) are superseded by `docs/rag/` + the shipping Private Search extension.

#### [SafeAppeals Cloud](./SafeAppealsCloud/)

Backend infrastructure for AI, billing, and web search services.

**Components:**

- [Main README](./SafeAppealsCloud/README.md) - Overview and architecture
- [Model Pricing](./SafeAppealsCloud/model-pricing.md) - Complete AI model pricing reference
- [Credit System](./SafeAppealsCloud/credit-system.md) - Token/credit system documentation
- [Web Search](./SafeAppealsCloud/web-search.md) - Brave Search pricing and configuration
- [Configuration Guide](./SafeAppealsCloud/configuration.md) - How to configure all settings
- [LiteLLM Config](./SafeAppealsCloud/litellm-config.md) - LiteLLM proxy configuration
- [Database Schema](./SafeAppealsCloud/database-schema.md) - Supabase tables and migrations
- [Deployment Guide](./SafeAppealsCloud/deployment.md) - Railway deployment instructions
- [Security](./SafeAppealsCloud/security.md) - Security best practices

**Key Features:**

- Token-based credit system ($30 = 700K tokens, $65 = 2M tokens, $130 = 5M tokens)
- Multi-provider AI routing via LiteLLM (OpenAI, Anthropic, Google)
- Web search integration with Brave Search API
- Stripe payment processing for credit purchases
- Usage logging and cost analytics
- Row Level Security on all database tables

### 📁 Organized Documentation

#### [Development](./development/)

Setup guides, migration plans, and installation documentation.

- **[Bun Migration Plan](./development/BUN_MIGRATION_PLAN.md)** - Migration strategy from npm/yarn to Bun
- **[Docling Quick Start](./development/DOCLING_QUICKSTART.md)** - 5-minute setup for PDF extraction
- **[Docling Local Models](./development/DOCLING_LOCAL_MODELS.md)** - Complete guide for offline ML models
- **[HuggingFace Token Guide](./development/HUGGINGFACE_TOKEN.md)** - Authentication setup for ML models

#### [Technical Research](./technical-research/)

Research, analysis, and implementation details for advanced features.

- **[XML Parser Improvements](./technicalResearch/XML_PARSER_IMPROVEMENTS_SUMMARY.md)** - XML parsing enhancements summary
- **[XML Tool Parsing Research](./technicalResearch/XML_TOOL_PARSING_RESEARCH.md)** - Comprehensive XML parsing strategies
- **[Deep XML Research](./technicalResearch/DEEP_RESEARCH_XML_PARSING.md)** - Advanced XML parsing techniques
- **[Comprehensive XML Research](./technicalResearch/COMPREHENSIVE_XML_TOOL_PARSING_RESEARCH.md)** - Extended implementation strategies
- **[Tool Calling Strategy](./technicalResearch/TOOL_CALLING_STRATEGY_RECOMMENDATION.md)** - Tool calling recommendations
- **[Agent System Analysis](./technicalResearch/CURRENT_AGENT_SYSTEM_ANALYSIS.md)** - Current system architecture
- **[Private Search tool contracts](./rag/tool-contracts.md)** - Shipping RAG agent tools
- **[RAG Enhancement Research](./technicalResearch/RAG_ENHANCEMENT_RESEARCH.md)** - Historical RAG research

#### [Features](./features/)

User-facing features, configuration, and customization guides.

- **[File Organization Config](./features/FILE_ORG_CASE_CONFIG.md)** - `.safeAppeals/` / `AGENTS.md` case layout
- **[Case Timeline](./features/timeline/README.md)** - Timeline, Tutorials, sample case
- **[App Theming Guide](./features/APP_THEMING_GUIDE.md)** - Complete theming and styling guide
- **[Pagination Implementation](./features/PAGINATION_IMPLEMENTATION.md)** - DOCX editor pagination

#### [Data Analysis](./dataAnalysis/)

Research data, matrices, and analysis files.

- **[Provider Matrix](./dataAnalysis/void_provider_matrix.csv)** - AI provider capabilities comparison
- **[Streaming Protocols](./dataAnalysis/streaming_protocols.csv)** - Protocol analysis for AI integration
- **[Detection Failures](./dataAnalysis/detection_failures.csv)** - Failure scenario analysis

## 🚀 Quick Start

### For New Developers

1. **Development Setup:**
   - **[Quick Start Guide](./development/DOCLING_QUICKSTART.md)** - Historical Docling notes
   - **[Local Models Setup](./development/DOCLING_LOCAL_MODELS.md)** - Configure offline ML models
   - **[Bun Migration](./development/BUN_MIGRATION_PLAN.md)** - Upgrade to faster builds
   - **[Private Search contracts](./rag/tool-contracts.md)** - Shipping on-device search tools

2. **Explore the Codebase:**
   - Start with [File Organizer Developer Guide](./features/fileOrganizer/developer-guide.md)
   - Review [API Reference](./features/fileOrganizer/api-reference.md)
   - Check [Examples](./features/fileOrganizer/examples.md)

### For Legal Case Management

1. **Case Configuration:**
   - **[File Organization Guide](./features/FILE_ORG_CASE_CONFIG.md)** — `.safeAppeals/`, `AGENTS.md`, snake_case folders
   - Prefer Help → **Tutorials** (`safeappeals-timeline.openTutorials`) or the project-setup skill for a sample/standard layout

2. **File Organization:**
   - Use the `organize-files` skill (default source `./to_sort`)
   - Confirm moves; logs land under `.safeAppeals/`

### For Feature Customization

1. **Theming:**
   - **[App Theming Guide](./features/APP_THEMING_GUIDE.md)** - Customize SafeAppeals appearance

2. **Document Processing:**
   - **[Pagination Guide](./features/PAGINATION_IMPLEMENTATION.md)** - DOCX editor features

## 📋 Documentation Organization

### Folder Structure

| Folder                                          | Purpose                                          | Audience       |
| ----------------------------------------------- | ------------------------------------------------ | -------------- |
| **[SafeAppealsCloud/](./SafeAppealsCloud/)**    | Cloud backend, pricing, billing, deployment      | DevOps/Admins  |
| **[features/chat/](./features/chat/)**          | Chat system, Plan/Agent modes, CreatePlan        | Developers     |
| **[agent-tools-pattern.md](./agent-tools-pattern.md)** | Satellite LM tools house pattern                 | Developers     |
| **[modelsSystem/](./modelsSystem/)**            | AI model configuration and capabilities          | Developers     |
| **[tools/](./tools/)**                          | AI tool calling and execution system             | Developers     |
| **[development/](./development/)**              | Setup guides, migration plans, installation docs | Developers     |
| **[technicalResearch/](./technicalResearch/)** | Research, analysis, implementation details       | Technical team |
| **[features/](./features/)**                    | User features, configuration, customization      | All users      |
| **[dataAnalysis/](./dataAnalysis/)**           | Research data, matrices, analysis files          | Administrators |
| **[features/fileOrganizer/](./features/fileOrganizer/)** | File organization system documentation  | All users      |
| **[storage/](./storage/)**                      | Database paths, dev vs prod locations            | Developers     |
| **[rag/](./rag/)**                              | Private Search tool contracts + packaging (current) | Technical team |
| **[ragSystem/](./ragSystem/)**                  | Historical Void RAG notes (superseded by `docs/rag/`) | Historical |
| **[features/timeTracker/](./features/timeTracker/)** | Legal time tracking extension               | All users      |
| **[features/audioRecorder/](./features/audioRecorder/)** | Audio recording and transcription      | All users      |
| **[features/timeline/](./features/timeline/)**  | Timeline, Tutorials, sample case                 | All users      |
| **[features/images/](./features/images/)**      | Documentation screenshots and diagrams           | All users      |

### File Types

| Icon | Meaning                       |
| ---- | ----------------------------- |
| 📁   | Directory/Folder              |
| 📄   | Markdown documentation        |
| 📊   | CSV data/analysis files       |
| 🔧   | Development/Technical content |
| 🎯   | User-Facing features          |
| 🚀   | Quick Start guides            |
| 📈   | Research/Analysis content     |

## 🔍 Finding Documentation

### By Role

**New Developers:**

- [Development Setup](./development/README.md) - Getting started guides
- [File Organizer Developer Guide](./features/fileOrganizer/developer-guide.md)
- [Technical Research](./technicalResearch/README.md) - System architecture
- [Private Search tool contracts](./rag/tool-contracts.md) - Shipping RAG agent tools

**Legal Professionals:**

- [File Organization Features](./features/README.md) - Case management tools
- [File Organizer User Guide](./features/fileOrganizer/user-guide.md)
- [Case Timeline](./features/timeline/README.md) - Chronology, Tutorials, sample case
- [App Theming Guide](./features/APP_THEMING_GUIDE.md) - UI customization

**System Administrators:**

- [SafeAppeals Cloud](./SafeAppealsCloud/README.md) - Backend infrastructure
- [Model Pricing](./SafeAppealsCloud/model-pricing.md) - AI cost management
- [Deployment Guide](./SafeAppealsCloud/deployment.md) - Railway deployment
- [Data Analysis](./dataAnalysis/README.md) - Performance and capability matrices
- [Technical Research](./technicalResearch/README.md) - System internals

### By Task

**Setting up Development Environment:**

- [Docling Quick Start](./development/DOCLING_QUICKSTART.md) (historical Docling notes; Private Search uses consent-install models)
- [Local Models Setup](./development/DOCLING_LOCAL_MODELS.md)
- [Bun Migration Plan](./development/BUN_MIGRATION_PLAN.md)

**Configuring Legal Cases:**

- [Case Configuration](./features/FILE_ORG_CASE_CONFIG.md)
- [File Organizer Guide](./features/fileOrganizer/user-guide.md)
- [Timeline configuration](./features/timeline/configuration-guide.md) — `.safeAppeals/timeline.json`

**Understanding Technical Implementation:**

- [XML Parser Research](./technicalResearch/XML_PARSER_IMPROVEMENTS_SUMMARY.md)
- [Private Search tool contracts](./rag/tool-contracts.md) (current)
- [RAG Enhancement Research](./technicalResearch/RAG_ENHANCEMENT_RESEARCH.md) (historical)
- [Provider Analysis](./dataAnalysis/void_provider_matrix.csv)

**Customizing the Application:**

- [App Theming Guide](./features/APP_THEMING_GUIDE.md)
- [Pagination Features](./features/PAGINATION_IMPLEMENTATION.md)

**Managing Pricing & Billing:**

- [Model Pricing](./SafeAppealsCloud/model-pricing.md) - Update AI model costs
- [Credit System](./SafeAppealsCloud/credit-system.md) - Token pack configuration
- [Web Search](./SafeAppealsCloud/web-search.md) - Brave Search costs
- [Configuration Guide](./SafeAppealsCloud/configuration.md) - All settings

**Deploying & Operating Cloud Services:**

- [Deployment Guide](./SafeAppealsCloud/deployment.md) - Railway deployment
- [LiteLLM Config](./SafeAppealsCloud/litellm-config.md) - AI model routing
- [Database Schema](./SafeAppealsCloud/database-schema.md) - Supabase structure
- [Security](./SafeAppealsCloud/security.md) - Security best practices

## 🤝 Contributing to Documentation

### Documentation Standards

1. **Structure:** Use consistent heading hierarchy (H1 → H2 → H3)
2. **Code Examples:** Include practical, runnable examples
3. **Cross-References:** Link related documentation sections
4. **Screenshots:** Include UI screenshots where helpful
5. **Versioning:** Note when features are in development/beta

### Adding New Documentation

1. **Choose appropriate location:**
   - Feature-specific: Create subfolder under `docs/`
   - General development: Add to main `docs/` directory
   - Component updates: Update existing documentation

2. **Update this README:**
   - Add entry to Documentation Index
   - Include brief description
   - Add appropriate icons/categories

3. **Follow naming conventions:**
   - `README.md` for main component documentation
   - `user-guide.md` for user-facing instructions
   - `developer-guide.md` for technical implementation
   - `api-reference.md` for API documentation
   - `examples.md` for practical examples

### Documentation Checklist

- [ ] Clear, descriptive title
- [ ] Table of contents for longer documents
- [ ] Practical examples and code snippets
- [ ] Troubleshooting section
- [ ] Cross-references to related docs
- [ ] Updated main README entry

## 📞 Support

### Documentation Issues

- **Missing Information:** Open an issue with details about what's unclear
- **Outdated Content:** Report discrepancies between docs and implementation
- **Suggestions:** Propose improvements or additional content

### Development Support

- **Code Examples:** Request specific implementation examples
- **Architecture Questions:** Ask about system design decisions
- **Integration Help:** Get guidance on component integration

---

**Last Updated:** August 2026
**Documentation Reorganized:** December 2025
**Maintained by:** SafeAppeals Development Team
