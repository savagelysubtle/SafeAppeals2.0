# SafeAppeals 2.0 - Project Modifications

## Overview

SafeAppeals 2.0 is a fork of [Void IDE](https://github.com/voideditor/void) that has been customized and enhanced for legal research and workers' compensation case management. This document tracks the major modifications and additions made to the original Void IDE codebase.

---

## Core Modifications

### 1. **Forked Void IDE**

- **Base**: Void IDE (VSCode fork with AI-powered code editing)
- **Purpose**: Repurposed from general software development to legal research and case management
- **Repository**: SafeAppeals 2.0

### 2. **Language Support Stripped**

- Removed code language-specific features not relevant to legal document processing
- Focused on document viewing and legal research capabilities
- Streamlined for legal professional workflows

### 3. **PDF Viewer Integration**

- **Location**: `src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/`
- **Features**:
  - Native PDF rendering and viewing
  - PDF context gathering for AI interactions (`pdfContextGathering.ts`)
  - Quick edit actions on PDF content (`pdfQuickEditActions.ts`)
  - Custom PDF viewer UI (`media/pdfViewer.css`, `media/pdfViewer.js`)
- **Use Case**: View and analyze legal documents, case files, and precedents

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
4. **Context Retrieval** → Relevant context retrieved for queries (`ragContextService.ts`)
5. **AI Enhancement** → LLM receives relevant legal context for better responses

### Key Services

- **ragContextService** - Orchestrates RAG operations
- **ragLocalEmbeddings** - Generates embeddings locally
- **ragVectorAdapter** - ChromaDB interface
- **toolsService** - Manages RAG tools and legal research capabilities
- **pdfContextGathering** - Extracts context from PDF documents

---

## File Structure

```
src/vs/workbench/contrib/void/
├── browser/
│   ├── documentViewers/
│   │   └── pdfViewer/          # PDF viewing capabilities
│   │       ├── pdfContextGathering.ts
│   │       ├── pdfQuickEditActions.ts
│   │       └── media/
│   │           ├── pdfViewer.css
│   │           └── pdfViewer.js
│   ├── contextGatheringService.ts
│   ├── sidebarActions.ts
│   └── toolsService.ts         # RAG tools integration
└── common/
    ├── prompt/
    │   └── prompts.ts          # Legal-specific prompts
    ├── modelCapabilities.ts    # Updated model list
    ├── ragContextService.ts    # RAG orchestration
    ├── ragLocalEmbeddings.ts   # Local embeddings
    └── ragVectorAdapter.ts     # ChromaDB interface
```

---

## Technologies Added

- **ChromaDB** - Vector database for document embeddings
- **PDF.js** (or equivalent) - PDF rendering and parsing
- **Transformers.js** (or similar) - Local embedding generation
- **Vector Search** - Similarity search for legal precedents

---

## Use Cases

1. **Legal Research** - Search through case law and precedents using semantic search
2. **Document Analysis** - AI-powered analysis of legal documents with relevant context
3. **Case Management** - Organize and retrieve case-related documents efficiently
4. **Workers' Compensation** - Specialized tools for workers' comp appeals and research

---

## Future Enhancements

- Additional document format support (DOCX improvements, etc.)
- Advanced citation extraction and linking
- Timeline generation from case documents
- Automated legal brief generation
- Integration with legal databases and APIs

---

## Development Notes

- Based on VSCode/Void IDE architecture
- Most custom code in `src/vs/workbench/contrib/void/`
- React components for UI built separately (`npm run buildreact`)
- Electron-based desktop application
- TypeScript primary language (94.7% of codebase)

---

## Credits

- **Base**: [Void IDE](https://github.com/voideditor/void) - AI-powered code editor
- **Foundation**: [VSCode](https://github.com/microsoft/vscode) - Microsoft's open-source editor
- **Customization**: SafeAppeals team - Legal research specialization

---

**Last Updated**: October 22, 2025
**Version**: 2.0
**Branch**: feat-pdf-docx-viewer
