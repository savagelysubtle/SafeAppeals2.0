# SafeAppeals Documentation

This directory contains comprehensive documentation for the SafeAppeals system components and features.

## 📚 Documentation Index

### Core Systems

#### [File Organizer System](./fileOrganizer/)

A comprehensive file organization and classification system designed for legal case management.

**Components:**

- [Main README](./fileOrganizer/README.md) - Overview and architecture
- [User Guide](./fileOrganizer/user-guide.md) - Complete usage instructions
- [Developer Guide](./fileOrganizer/developer-guide.md) - Technical implementation details
- [API Reference](./fileOrganizer/api-reference.md) - Complete API documentation
- [Configuration Guide](./fileOrganizer/configuration-guide.md) - Setup and customization
- [Examples](./fileOrganizer/examples.md) - Practical usage examples

**Key Features:**

- Automated file classification (Your Side vs Their Side)
- AI-assisted organization with confidence scoring
- Customizable templates for different case types
- Workers' compensation case support
- Case-specific keyword configuration

#### [AI Models Configuration](./models/)

Comprehensive AI model configuration and capabilities system for Void/VSCode extension.

**Components:**

- [Main README](./models/README.md) - Overview and architecture
- [API Reference](./models/api-reference.md) - Complete type definitions and functions
- [Provider Guide](./models/provider-guide.md) - Detailed provider configurations
- [Reasoning Guide](./models/reasoning-guide.md) - Advanced reasoning capabilities

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

#### [Chat System](./chat/)

LLM-powered conversational AI with extended thinking and tool calling.

**Components:**

- [Main README](./chat/README.md) - Overview and architecture
- [Architecture](./chat/architecture.md) - System design, process model, data flow
- [Message Flow](./chat/message-flow.md) - End-to-end message lifecycle
- [Reasoning System](./chat/reasoning-system.md) - Extended thinking, separation
- [Tool Calling](./chat/tool-calling.md) - XML parsing, execution flow
- [Chat Modes](./chat/chat-modes.md) - Agent, gather, research modes
- [Bug Fixes](./chat/bug-fixes.md) - Known issues and solutions
- [API Reference](./chat/api-reference.md) - Service interfaces and types

**Key Features:**

- Multi-provider LLM support (Anthropic, OpenAI, Gemini, 10+ providers)
- Extended thinking/reasoning (Claude Opus 4.5, Sonnet 4.5)
- XML-based tool calling with streaming support
- Multiple chat modes (agent, gather, research, drafting)
- Context window tracking and management
- Agent loop with tool execution and checkpoints

#### [Storage & Database System](./storage/)

Per-workspace micro database architecture for complete data isolation.

**Components:**

- [Main README](./storage/README.md) - Complete path reference for dev vs production

**Key Features:**

- Per-workspace SQLite databases (no global storage)
- Development path: `%APPDATA%\code-oss-dev\User\.safe-appeals-navigator\`
- Production path: `%APPDATA%\Void\User\.safe-appeals-navigator\`
- Workspace hash-based isolation
- Databases: `threads.db`, `workspace.db`, `emails.db`, `chroma/`

#### [Time Tracker](./timeTracker/)

Professional legal time tracking with UTBMS codes and LEDES export.

**Components:**

- [Main README](./timeTracker/README.md) - Overview and architecture
- [User Guide](./timeTracker/user-guide.md) - Complete usage instructions
- [Developer Guide](./timeTracker/developer-guide.md) - Technical implementation details
- [API Reference](./timeTracker/api-reference.md) - TypeScript interfaces and services

**Key Features:**

- 6-minute billing increments with configurable rounding
- UTBMS task and activity codes (litigation + workers' comp)
- Matter/case tracking with billing rates
- LEDES 1998B export for legal billing
- CSV/JSON export for reporting
- Per-workspace SQLite storage
- Live timer in status bar and sidebar

#### [Audio Recorder](./audioRecorder/)

Audio recording, playback, and transcription for legal professionals.

**Components:**

- [Main README](./audioRecorder/README.md) - Overview and architecture
- [User Guide](./audioRecorder/user-guide.md) - Complete usage instructions
- [Developer Guide](./audioRecorder/developer-guide.md) - Technical implementation details
- [API Reference](./audioRecorder/api-reference.md) - TypeScript interfaces and services

**Key Features:**

- In-app audio recording with start/stop/pause
- Inline playback with seek bar, time display, volume control
- Local Whisper transcription (no API costs, fully offline)
- Import audio files (WAV, MP3, M4A, OGG, WEBM, FLAC)
- Export transcripts as DOCX, TXT, SRT, JSON
- Per-workspace SQLite storage
- Native contribution (faster than extension)

#### [RAG System](./ragSystem/)

Research-Augmented Generation system for enhanced AI responses.

**Status:** In development

- Advanced document processing and retrieval
- Integration with legal research databases
- Context-aware response generation

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

- Token-based credit system ($30 = 700K tokens, $60 = 1.4M tokens)
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

- **[XML Parser Improvements](./technical-research/XML_PARSER_IMPROVEMENTS_SUMMARY.md)** - XML parsing enhancements summary
- **[XML Tool Parsing Research](./technical-research/XML_TOOL_PARSING_RESEARCH.md)** - Comprehensive XML parsing strategies
- **[Deep XML Research](./technical-research/DEEP_RESEARCH_XML_PARSING.md)** - Advanced XML parsing techniques
- **[Comprehensive XML Research](./technical-research/COMPREHENSIVE_XML_TOOL_PARSING_RESEARCH.md)** - Extended implementation strategies
- **[Tool Calling Strategy](./technical-research/TOOL_CALLING_STRATEGY_RECOMMENDATION.md)** - Tool calling recommendations
- **[Agent System Analysis](./technical-research/CURRENT_AGENT_SYSTEM_ANALYSIS.md)** - Current system architecture
- **[RAG Enhancement Research](./technical-research/RAG_ENHANCEMENT_RESEARCH.md)** - RAG system improvements

#### [Features](./features/)

User-facing features, configuration, and customization guides.

- **[File Organization Config](./features/FILE_ORG_CASE_CONFIG.md)** - Case-specific file organization
- **[App Theming Guide](./features/APP_THEMING_GUIDE.md)** - Complete theming and styling guide
- **[Pagination Implementation](./features/PAGINATION_IMPLEMENTATION.md)** - DOCX editor pagination

#### [Data Analysis](./data-analysis/)

Research data, matrices, and analysis files.

- **[Provider Matrix](./data-analysis/void_provider_matrix.csv)** - AI provider capabilities comparison
- **[Streaming Protocols](./data-analysis/streaming_protocols.csv)** - Protocol analysis for AI integration
- **[Detection Failures](./data-analysis/detection_failures.csv)** - Failure scenario analysis

## 🚀 Quick Start

### For New Developers

1. **Development Setup:**
   - **[Quick Start Guide](./development/DOCLING_QUICKSTART.md)** - Get up and running in 5 minutes
   - **[Local Models Setup](./development/DOCLING_LOCAL_MODELS.md)** - Configure offline ML models
   - **[Bun Migration](./development/BUN_MIGRATION_PLAN.md)** - Upgrade to faster builds

2. **Explore the Codebase:**
   - Start with [File Organizer Developer Guide](./fileOrganizer/developer-guide.md)
   - Review [API Reference](./fileOrganizer/api-reference.md)
   - Check [Examples](./fileOrganizer/examples.md)

### For Legal Case Management

1. **Case Configuration:**
   - **[File Organization Guide](./features/FILE_ORG_CASE_CONFIG.md)** - Set up case-specific organization
   - Create `.fileorg.json` in your workspace root

2. **File Organization:**
   - Press `Ctrl+Shift+O` or use Command Palette
   - Select files to organize
   - Choose organization template
   - Review and apply changes

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
| **[chat/](./chat/)**                            | Chat system, LLM integration, agent loop         | Developers     |
| **[models/](./modelsSystem/)**                  | AI model configuration and capabilities          | Developers     |
| **[tools/](./tools/)**                          | AI tool calling and execution system             | Developers     |
| **[development/](./development/)**              | Setup guides, migration plans, installation docs | Developers     |
| **[technical-research/](./technicalResearch/)** | Research, analysis, implementation details       | Technical team |
| **[features/](./features/)**                    | User features, configuration, customization      | All users      |
| **[data-analysis/](./dataAnalysis/)**           | Research data, matrices, analysis files          | Administrators |
| **[fileOrganizer/](./fileOrganizer/)**          | File organization system documentation           | All users      |
| **[storage/](./storage/)**                      | Database paths, dev vs prod locations            | Developers     |
| **[ragSystem/](./ragSystem/)**                  | RAG system operational docs                      | Technical team |
| **[timeTracker/](./timeTracker/)**              | Legal time tracking extension                    | All users      |
| **[audioRecorder/](./audioRecorder/)**          | Audio recording and transcription                | All users      |
| **[timeline/](./timeline/)**                    | Timeline feature documentation                   | All users      |
| **[images/](./images/)**                        | Documentation screenshots and diagrams           | All users      |

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
- [File Organizer Developer Guide](./fileOrganizer/developer-guide.md)
- [Technical Research](./technical-research/README.md) - System architecture

**Legal Professionals:**

- [File Organization Features](./features/README.md) - Case management tools
- [File Organizer User Guide](./fileOrganizer/user-guide.md)
- [App Theming Guide](./features/APP_THEMING_GUIDE.md) - UI customization

**System Administrators:**

- [SafeAppeals Cloud](./SafeAppealsCloud/README.md) - Backend infrastructure
- [Model Pricing](./SafeAppealsCloud/model-pricing.md) - AI cost management
- [Deployment Guide](./SafeAppealsCloud/deployment.md) - Railway deployment
- [Data Analysis](./data-analysis/README.md) - Performance and capability matrices
- [Technical Research](./technical-research/README.md) - System internals

### By Task

**Setting up Development Environment:**

- [Docling Quick Start](./development/DOCLING_QUICKSTART.md)
- [Local Models Setup](./development/DOCLING_LOCAL_MODELS.md)
- [Bun Migration Plan](./development/BUN_MIGRATION_PLAN.md)

**Configuring Legal Cases:**

- [Case Configuration](./features/FILE_ORG_CASE_CONFIG.md)
- [File Organizer Guide](./fileOrganizer/user-guide.md)

**Understanding Technical Implementation:**

- [XML Parser Research](./technical-research/XML_PARSER_IMPROVEMENTS_SUMMARY.md)
- [RAG Enhancement Research](./technical-research/RAG_ENHANCEMENT_RESEARCH.md)
- [Provider Analysis](./data-analysis/void_provider_matrix.csv)

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

**Last Updated:** February 2026
**Documentation Reorganized:** December 2025
**Maintained by:** SafeAppeals Development Team
