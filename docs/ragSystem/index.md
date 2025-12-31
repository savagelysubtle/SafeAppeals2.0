# RAG System Documentation Index

## 📚 Documentation Overview

The Retrieval-Augmented Generation (RAG) system in Void provides sophisticated document indexing and semantic search capabilities optimized for legal and medical document analysis.

## 📖 Documentation Structure

| Document | Purpose | Audience |
|----------|---------|----------|
| [README.md](./README.md) | System overview and architecture | All users |
| [quickstart.md](./quickstart.md) | Getting started guide | New developers |
| [api-reference.md](./api-reference.md) | Complete API documentation | Developers |
| [architecture.md](./architecture.md) | Detailed technical architecture | Senior developers |
| [configuration.md](./configuration.md) | Configuration and deployment | DevOps/Administrators |
| [performance.md](./performance.md) | Performance optimization guide | Performance engineers |
| [troubleshooting.md](./troubleshooting.md) | Common issues and solutions | Support teams |
| [migration.md](./migration.md) | Database migration guide | Database administrators |

## 🚀 Quick Access

### For New Developers
1. [Quick Start Guide](./quickstart.md) - Get up and running in 15 minutes
2. [API Reference](./api-reference.md) - Learn the interfaces
3. [Configuration](./configuration.md) - Basic setup

### For Production Deployment
1. [Configuration Guide](./configuration.md) - Production settings
2. [Performance Guide](./performance.md) - Optimization strategies
3. [Troubleshooting](./troubleshooting.md) - Production support

### For System Maintenance
1. [Architecture Guide](./architecture.md) - Deep technical details
2. [Migration Guide](./migration.md) - Database updates
3. [Performance Monitoring](./performance.md) - Health checks

## 🔧 Agent RAG Tools

| Tool | Description | Scope |
|------|-------------|-------|
| `rag_search_policy` | Search policy manuals only | `policy_manual` |
| `rag_search_workspace` | Search case files only | `case_index` |
| `rag_search_all` | Search ALL documents (both) | `workspace_all` |
| `rag_index_document` | Index a document | N/A |
| `rag_get_stats` | Get system statistics | N/A |

## 📊 System Status

| Component | Status | Version |
|-----------|--------|---------|
| Core RAG Service | ✅ Active | **v2.0 MICRO DATABASE** |
| Workspace Isolation | ✅ Active | **Per-workspace micro databases** |
| Global Database | ❌ **REMOVED** | N/A - workspaceId required |
| Vector Search | ✅ Active | Chroma Persistent (per-workspace) |
| Document Indexing | ✅ Active | Hierarchical Chunks |
| Cross-Encoder | ✅ Active | Local MS MARCO (lazy init) |
| Docling Integration | ✅ Active | Hybrid Mode |
| Auto-Index on Drop | ✅ Active | RAGAutoIndexService |

### Micro Database Architecture Highlights
- ✅ **NO global database** - all data isolated per workspace
- ✅ **workspaceId REQUIRED** for all operations
- ✅ Policy manuals and case files kept logically separate
- ✅ Each workspace can be independently managed

## 🔗 Related Documentation

- [Void Platform Documentation](../../README.md)
- [File Organizer System](../fileOrganizer/)
- [Case Management System](../../src/vs/workbench/contrib/void/common/caseProfileService.ts)

## 📞 Support

For issues with the RAG system:
- Check [Troubleshooting Guide](./troubleshooting.md)
- Review [Performance Guide](./performance.md)
- Consult [Architecture Guide](./architecture.md)

---

*Last updated: December 2025*


