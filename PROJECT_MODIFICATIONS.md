# SafeAppeals 2.0 - Project Modifications

## Overview

SafeAppeals 2.0 is a fork of [Void IDE](https://github.com/voideditor/void) that has been customized and enhanced for legal research and workers' compensation case management. This document tracks the major modifications and additions made to the original Void IDE codebase.

---

## Core Modifications

### 1. **Forked Void IDE**

- **Base**: Void IDE (VSCode fork with AI-powered code editing)
- **Purpose**: Repurposed from general software development to legal research and case management
- **Repository**: SafeAppeals 2.0

### 2. **PDF Viewer Integration**

- **Location**: `src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/`
- **Features**:
  - Native PDF rendering and viewing
  - PDF context gathering for AI interactions (`pdfContextGathering.ts`)
  - Quick edit actions on PDF content (`pdfQuickEditActions.ts`)
  - Custom PDF viewer UI (`media/pdfViewer.css`, `media/pdfViewer.js`)
- **Use Case**: View and analyze legal documents, case files, and precedents

### 3. **Advanced PDF Extraction with Docling**

- **Location**: `src/vs/workbench/contrib/void/electron-main/ragFileService.ts`
- **Technology Stack**:
  - **TypeScript Client**: `docling-sdk` (npm package) - Bridge to Python backend
  - **Python Engine**: `docling` (Python package) - ML-powered PDF processing
  - **Architecture**: TypeScript SDK spawns Python CLI subprocess for processing
- **Features**:
  - **Dual Extraction Methods**:
    - Standard: `pdfjs-dist` for reliable baseline extraction
    - Enhanced: Docling for ML-powered extraction with table detection and layout analysis
  - **ML Capabilities**:
    - Vision Language Model (VLM) pipeline for image analysis
    - Table structure recognition and preservation
    - Multi-column layout detection
    - Enhanced metadata extraction
  - **Comparison Tool**: VS Code command "RAG: Test Docling PDF Extraction" for side-by-side comparison
  - **Project-Local Python**: Uses `uv` for isolated `.venv` environment (no global installs)
- **Dependencies**:
  - PyTorch for ML models (~260MB)
  - Transformers for NLP processing
  - Docling core libraries for PDF analysis
- **Integration**: Automatically adds `.venv/Scripts` to PATH for subprocess execution
- **Use Case**: Enhanced extraction quality for complex legal documents with tables, multi-column layouts, and embedded images

### 4. **Chroma Vector Database Integration**

- **Purpose**: Local vector storage for legal document embeddings
- **Technology**: ChromaDB
- **Implementation**: `ragVectorAdapter.ts`
- **Features**:
  - Persistent local storage of document embeddings
  - Fast similarity search for legal precedents
  - Privacy-focused (all data stored locally)

### 5. **Local Vector Embeddings**

- **Location**: `src/vs/workbench/contrib/void/common/ragLocalEmbeddings.ts`
- **Features**:
  - Local embedding generation for documents
  - Privacy-preserving (no external API calls for embeddings)
  - Optimized for legal document processing
- **Integration**: Works with ChromaDB for efficient retrieval

### 6. **RAG (Retrieval-Augmented Generation) Tools**

- **Core Service**: `ragContextService.ts`
- **Capabilities**:
  - Document ingestion and indexing
  - Context-aware retrieval for legal queries
  - Integration with AI chat for enhanced responses
  - Case-specific knowledge base management
- **Vector Adapter**: `ragVectorAdapter.ts` - Interface to ChromaDB
- **Embeddings Engine**: `ragLocalEmbeddings.ts` - Local embedding generation

### 7. **Updated Prompting System**

- **Location**: `src/vs/workbench/contrib/void/common/prompt/prompts.ts`
- **Changes**:
  - Legal-specific prompt templates
  - Case research and analysis prompts
  - Document summarization and precedent discovery
  - Workers' compensation specific guidance
- **Tool Integration**: Updated `toolsService.ts` to support RAG tools and legal research workflows

### 8. **UI Color Scheme Updates**

- Modified color palette to match legal professional aesthetic
- Updated branding from Void IDE to SafeAppeals
- Custom styling for document viewers and legal research interface

### 9. **Model Capabilities Updates**

- **Location**: `src/vs/workbench/contrib/void/common/modelCapabilities.ts`
- **Changes**:
  - Updated model list for legal-specific LLMs
  - Enhanced capabilities for document analysis
  - Optimized model selection for legal research tasks
  - Support for longer context windows for case documents

### 10. **Document Organization Folders**

- **Auto Folder** - Automated document processing and ingestion
- **Policy Manual Folder** - Repository for workers' compensation policy manuals and regulations
- **To Sort Folder** - Staging area for incoming documents before categorization
- **Purpose**: Streamlined document workflow for legal research
- **Integration**: Works with RAG system for automatic indexing and retrieval

---

## Architecture Overview

### RAG Pipeline

1. **Document Ingestion** → Legal documents (PDFs, DOCX) are processed
2. **Embedding Generation** → Local embeddings created (`ragLocalEmbeddings.ts`)
3. **Vector Storage** → Embeddings stored in ChromaDB (`ragVectorAdapter.ts`)
4. **Hybrid Retrieval** → BM25 + Vector search via `ragHybridRetriever.ts`
5. **Reranking** → Results refined by `ragReranker.ts`
6. **Context Retrieval** → Relevant context assembled (`ragContextService.ts`)
7. **AI Enhancement** → LLM receives relevant legal context for better responses

### Cloud Pipeline (Void Cloud)

1. **Authentication** → Google OAuth via Supabase
2. **Credit Check** → Balance verified before request
3. **Routing** → `cloudLLMRouterService` determines BYOK vs Cloud
4. **Proxy** → Request forwarded to LiteLLM
5. **Provider** → LiteLLM routes to appropriate LLM (Anthropic, OpenAI, etc.)
6. **Billing** → Credits deducted based on token usage
7. **Response** → Streamed back to desktop client

### Key Services

- **ragContextService** - Orchestrates RAG operations
- **ragLocalEmbeddings** - Generates embeddings locally
- **ragVectorAdapter** - ChromaDB interface
- **ragHybridRetriever** - Hybrid BM25 + vector search
- **ragReranker** - Cross-encoder reranking
- **toolsService** - Manages RAG tools and legal research capabilities
- **pdfContextGathering** - Extracts context from PDF documents
- **voidCloudService** - Cloud authentication and API client
- **cloudLLMRouterService** - Routes LLM requests to cloud or BYOK
- **voidSCMService** - Git integration for context

---

## File Structure

```
src/vs/workbench/contrib/void/
├── browser/
│   ├── documentViewers/
│   │   ├── pdfViewer/          # PDF viewing
│   │   ├── docxViewer/         # DOCX viewing
│   │   ├── xlsxViewer/         # XLSX viewing
│   │   ├── imageViewer/        # Image viewing
│   │   └── documentEditorService.ts
│   ├── caseInfo/               # Case info sidebar
│   ├── fileOrganizer/          # File organization
│   ├── react/                  # React UI components
│   │   ├── src/               # Main React source
│   │   └── src2/              # Additional components
│   ├── voidCloudService.ts     # Cloud auth & API
│   ├── cloudLLMRouterService.ts # Cloud LLM routing
│   ├── voidSCMService.ts       # Git integration
│   ├── contextGatheringService.ts
│   ├── toolsService.ts         # RAG tools
│   └── void.contribution.ts    # Main registration
├── common/
│   ├── prompt/
│   │   ├── prompts.ts          # System prompts
│   │   └── toolSchemas.ts      # Tool definitions
│   ├── ragContextService.ts    # RAG orchestration
│   ├── ragLocalEmbeddings.ts   # Local embeddings
│   ├── ragVectorAdapter.ts     # ChromaDB interface
│   ├── ragHybridRetriever.ts   # Hybrid search
│   ├── ragQueryProcessor.ts    # Query processing
│   ├── ragReranker.ts          # Result reranking
│   ├── voidCloudTypes.ts       # Cloud types
│   ├── voidUpdateService.ts    # Update service
│   └── voidSCMTypes.ts         # SCM types
├── electron-main/
│   ├── llmMessage/             # LLM messaging
│   ├── ragFileService.ts       # PDF/DOCX extraction
│   ├── ragMainService.ts       # Main RAG service
│   ├── ragIndexService.ts      # SQLite index
│   ├── voidUpdateMainService.ts # Update main service
│   └── voidSCMMainService.ts   # Git operations
└── test/                       # Test files

void-cloud/                     # Cloud backend (separate)
├── api/                        # Node.js/Fastify API
├── dashboard/                  # Next.js web dashboard
├── litellm/                    # LiteLLM proxy config
└── supabase/                   # Database migrations
```

---

## Technologies Added

### Document Processing

- **ChromaDB** - Vector database for document embeddings
- **PDF.js** - Standard PDF rendering and parsing
- **Docling SDK (TypeScript)** - Bridge to Python-based ML PDF processing
- **Docling (Python)** - ML-powered PDF extraction with VLM and table detection
- **PyTorch** - Deep learning framework for PDF analysis models
- **Transformers.js** - Local embedding generation for privacy
- **mammoth** - DOCX text extraction
- **SheetJS** - XLSX parsing and manipulation

### Cloud Infrastructure (void-cloud/)

- **Fastify** - Node.js API framework
- **Supabase** - Auth and PostgreSQL database
- **Stripe** - Payment processing
- **LiteLLM** - Unified LLM proxy
- **Next.js 14** - Web dashboard framework
- **Tailwind CSS** - Dashboard styling
- **Railway** - API and LiteLLM hosting

### Development Tools

- **Python 3.8+** - Backend for advanced PDF processing
- **uv** - Fast Python package installer
- **Vector Search** - Similarity search for legal precedents

---

## Use Cases

1. **Legal Research** - Search through case law and precedents using semantic search
2. **Document Analysis** - AI-powered analysis of legal documents with relevant context
3. **Case Management** - Organize and retrieve case-related documents efficiently
4. **Workers' Compensation** - Specialized tools for workers' comp appeals and research

---

## 10. **Void Cloud Integration**

- **Location**: `void-cloud/` (separate backend) + `src/vs/workbench/contrib/void/browser/`
- **Features**:
  - Cloud-based LLM access without API key management
  - Google OAuth authentication via Supabase
  - Credit-based usage system with Stripe payments
  - Per-provider routing (BYOK vs Cloud mode)
  - Real-time balance tracking
- **Components**:
  - `voidCloudService.ts` - Main cloud service client
  - `cloudLLMRouterService.ts` - Request routing logic
  - `voidCloudAuthProvider.ts` - VS Code auth integration
  - `voidCloudUrlHandler.ts` - OAuth callback handler
- **Backend** (void-cloud/):
  - Node.js/Fastify API service (Railway deployed)
  - LiteLLM proxy for unified model access
  - Next.js dashboard for web management
  - Supabase for auth and database
  - Stripe for payments

### 11. **Auto-Update System**

- **Location**: `src/vs/workbench/contrib/void/common/` + `electron-main/`
- **Features**:
  - Automatic update checking
  - Version comparison with releases
  - User notification for available updates
  - IPC communication between browser and main process
- **Files**:
  - `voidUpdateService.ts` - Browser-side service
  - `voidUpdateMainService.ts` - Main process implementation
  - `voidUpdateActions.ts` - UI actions

### 12. **Advanced RAG Features**

- **Location**: `src/vs/workbench/contrib/void/common/`
- **Features**:
  - **Hybrid Retriever**: Combines BM25 keyword + vector semantic search
  - **Reciprocal Rank Fusion (RRF)**: Merges results from both methods
  - **Query Processor**: Preprocessing and domain-specific handling
  - **Reranker**: Cross-encoder reranking for precision
- **Files**:
  - `ragHybridRetriever.ts` - Hybrid search implementation
  - `ragQueryProcessor.ts` - Query preprocessing
  - `ragReranker.ts` - Result reranking

### 13. **SCM/Git Integration**

- **Location**: `src/vs/workbench/contrib/void/`
- **Features**:
  - Git diff statistics (`gitStat`)
  - Sampled diffs for top changed files
  - Branch information
  - Recent commit log
- **Files**:
  - `common/voidSCMTypes.ts` - Interface definitions
  - `browser/voidSCMService.ts` - Browser service
  - `electron-main/voidSCMMainService.ts` - Main process

### 14. **Email Dashboard**

- **Location**: `browser/react/src2/email-dashboard-tsx/`
- **Features**: Email management integration (in development)

---

## Future Enhancements

- Additional document format support (DOCX improvements, etc.)
- Advanced citation extraction and linking
- Timeline generation from case documents
- Automated legal brief generation
- Integration with legal databases and APIs
- Cloud subscription plans (beyond pay-as-you-go)
- Team/enterprise features

---

## Development Notes

- Based on VSCode/Void IDE architecture
- Most custom code in `src/vs/workbench/contrib/void/`
- React components for UI built separately (`npm run buildreact`)
- Electron-based desktop application
- **TypeScript** primary language (94.7% of codebase)
- **Python** for ML-powered PDF extraction (Docling)
- **Hybrid Architecture**: TypeScript main process with Python subprocess for document processing
- **Project-Local Python**: Uses `uv` and `.venv` for isolated dependencies
- **Dual Extraction**: Standard (pdfjs-dist) + Enhanced (Docling ML)
- **Cloud Backend**: Separate `void-cloud` repository for cloud services

---

## Python Setup

### Dependencies Management

- **Python Version**: 3.8+
- **Package Manager**: `uv` (fast, modern Python package installer)
- **Environment**: Project-local `.venv` (no global installs)
- **Dependency File**: `pyproject.toml`

### Installation

```bash
# Create virtual environment
uv venv

# Install Python dependencies
uv pip install docling

# Or install from pyproject.toml
uv sync
```

### Dependencies Installed (~260MB)

- **docling**: Core PDF processing library
- **torch**: PyTorch for ML models
- **transformers**: NLP and vision transformers
- **pillow**: Image processing
- **opencv-python**: Computer vision
- **pandas**: Data manipulation
- **scipy/numpy**: Scientific computing

### Integration with TypeScript

The TypeScript `docling-sdk` client automatically:

1. Detects `.venv/Scripts` directory
2. Adds it to subprocess PATH
3. Spawns Python CLI for processing
4. Returns results to TypeScript layer

---

## Credits

- **Base**: [Void IDE](https://github.com/voideditor/void) - AI-powered code editor
- **Foundation**: [VSCode](https://github.com/microsoft/vscode) - Microsoft's open-source editor
- **Customization**: SafeAppeals team - Legal research specialization
- **Cloud Backend**: [void-cloud](https://github.com/savagelysubtle/void-cloud) - Deployed on Railway

---

**Last Updated**: December 5, 2025
**Version**: 2.1
**Branch**: main
**Python Support**: Added Docling ML PDF extraction
**Cloud Integration**: Void Cloud fully deployed and operational
