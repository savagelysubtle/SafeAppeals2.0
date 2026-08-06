# RAG System Documentation Index

> **Historical Void docs — superseded.** Shipping Private Search is documented in
> [`docs/rag/tool-contracts.md`](../rag/tool-contracts.md) and
> [`docs/rag/packaging-rung-14.md`](../rag/packaging-rung-14.md)
> (`extensions/safeappeals-rag`). Shared folder: `core_references/`. Status bar:
> `$(search) Private Search`.

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

## 🔧 Agent RAG Tools (current — see `docs/rag/tool-contracts.md`)

| Tool | Description | Scope |
|------|-------------|-------|
| `safeappeals_rag_search_reference` | Search core references (`core_references/`) | `core_reference` |
| `safeappeals_rag_search_workspace` | Search case files | `case_index` |
| `safeappeals_rag_search_all` | Search both | `all` |
| `safeappeals_rag_index_document` | Index a document | `core_reference` or `case_index` |
| `safeappeals_rag_get_stats` | Index statistics | — |

Void-era aliases such as `rag_search_policy` / scope `policy_manual` normalize to
`safeappeals_rag_search_reference` / `core_reference` and must not be documented as
the primary API.

## 📊 System Status

| Component | Status | Version |
|-----------|--------|---------|
| Core RAG Service | ✅ Active | **v2.1 Performance Overhaul** |
| Workspace Isolation | ✅ Active | **Per-workspace micro databases** |
| Global Database | ❌ **REMOVED** | N/A - workspaceId required |
| Vector Search | ✅ Active | Float32Array + dot product + binary BLOB |
| Document Indexing | ✅ Active | Batch transactions + async I/O |
| Cross-Encoder | ✅ Active | Local MS MARCO (lazy init, short-circuit) |
| Docling Integration | ✅ Active | Hybrid Mode |
| Auto-Index on Drop | ✅ Active | RAGAutoIndexService |
| File Watcher | ✅ Active | Debounced (500ms) + dedup guard |

### v2.1 Performance Overhaul Highlights
- ✅ **Float32Array embeddings** with binary BLOB persistence (~40% memory, ~60% disk savings)
- ✅ **Dot product similarity** on pre-normalized vectors (faster than cosine)
- ✅ **Persistent SQLite connection** (no open/close overhead)
- ✅ **Batch transactions** for chunk and embedding writes (~10x faster inserts)
- ✅ **File watcher debouncing** prevents duplicate indexing on Windows
- ✅ **Reranker short-circuit** skips cross-encoder when candidates ≤ topN

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

*Last updated: February 2026 (v2.1 Performance Overhaul)*


