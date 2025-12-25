---
name: RAG System Modularization
overview: Refactor the RAG (Retrieval-Augmented Generation) system from flat files into organized `rag/` subfolders across common/, browser/, and electron-main/ directories, following the established pattern used by timeline/, fileOrganizer/, and llmMessage/.
todos:
  - id: create-folders
    content: Create rag/ subdirectories in common/, browser/, and electron-main/
    status: completed
  - id: move-common-files
    content: Move 9 RAG files from common/ to common/rag/
    status: completed
  - id: move-browser-files
    content: Move 2 RAG files from browser/ to browser/rag/
    status: completed
  - id: move-electron-files
    content: Move 4 RAG files from electron-main/ to electron-main/rag/
    status: completed
  - id: update-internal-imports
    content: Update import paths within moved RAG files
    status: completed
    dependencies:
      - move-common-files
      - move-browser-files
      - move-electron-files
  - id: create-barrel-exports
    content: Create index.ts barrel exports in each rag/ folder
    status: completed
    dependencies:
      - move-common-files
      - move-browser-files
      - move-electron-files
  - id: update-external-consumers
    content: Update ~10 external files importing from old RAG paths
    status: completed
    dependencies:
      - update-internal-imports
---

# RAG System Modularization Plan

Reorganize 15 RAG-related files from flat structure into modular `rag/` subfolders, updating all import paths across ~20 consumer files.

## Target Structure

```javascript
common/rag/
  ├── index.ts                  # NEW: barrel exports
  ├── ragService.ts
  ├── ragServiceTypes.ts
  ├── ragContextService.ts
  ├── ragVectorAdapter.ts
  ├── ragLocalEmbeddings.ts
  ├── ragReranker.ts
  ├── ragQueryProcessor.ts
  ├── ragHybridRetriever.ts
  └── ragPathService.ts

browser/rag/
  ├── index.ts                  # NEW: barrel exports
  ├── ragActions.ts
  └── ragWorkspaceService.ts

electron-main/rag/
  ├── index.ts                  # NEW: barrel exports
  ├── ragMainService.ts
  ├── ragMainChannel.ts
  ├── ragIndexService.ts
  └── ragFileService.ts
```



## Implementation Steps

### Phase 1: Create folder structure and move files

1. Create `common/rag/`, `browser/rag/`, `electron-main/rag/` directories
2. Move 9 files from `common/` to `common/rag/`
3. Move 2 files from `browser/` to `browser/rag/`
4. Move 4 files from `electron-main/` to `electron-main/rag/`

### Phase 2: Update internal imports within RAG files

Files with internal RAG dependencies that need path updates:

- [`ragVectorAdapter.ts`](src/vs/workbench/contrib/void/common/ragVectorAdapter.ts) - imports ragLocalEmbeddings, ragReranker, ragServiceTypes
- [`ragHybridRetriever.ts`](src/vs/workbench/contrib/void/common/ragHybridRetriever.ts) - imports ragServiceTypes, ragVectorAdapter
- [`ragContextService.ts`](src/vs/workbench/contrib/void/common/ragContextService.ts) - imports ragServiceTypes
- [`ragQueryProcessor.ts`](src/vs/workbench/contrib/void/common/ragQueryProcessor.ts) - imports ragServiceTypes
- [`ragService.ts`](src/vs/workbench/contrib/void/common/ragService.ts) - imports ragServiceTypes
- [`ragMainService.ts`](src/vs/workbench/contrib/void/electron-main/ragMainService.ts) - imports from common/rag/

### Phase 3: Create barrel exports (index.ts)

Each `index.ts` will re-export public interfaces:**common/rag/index.ts**: Export `IRAGService`, `RAGService`, all types from ragServiceTypes, `RAGContextService`**browser/rag/index.ts**: Re-export actions and `IRAGWorkspaceService`**electron-main/rag/index.ts**: Export `IRAGMainService`, `RAGMainService`, channel registration

### Phase 4: Update external consumers

Files importing from old paths (change `../common/ragX` to `../common/rag/ragX`):| File | Imports to Update ||------|-------------------|| [`browser/void.contribution.ts`](src/vs/workbench/contrib/void/browser/void.contribution.ts) | ragWorkspaceService || [`browser/tools/toolsService.ts`](src/vs/workbench/contrib/void/browser/tools/toolsService.ts) | ragContextService, ragService || [`browser/sidebarActions.ts`](src/vs/workbench/contrib/void/browser/sidebarActions.ts) | ragService, ragContextService || [`browser/documentViewers/pdfViewer/pdfQuickEditActions.ts`](src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/pdfQuickEditActions.ts) | ragService, ragContextService || [`common/voidSettingsTypes.ts`](src/vs/workbench/contrib/void/common/voidSettingsTypes.ts) | ragServiceTypes || [`electron-main/ragMainChannel.ts`](src/vs/workbench/contrib/void/electron-main/ragMainChannel.ts) | ragServiceTypes || [`electron-main/docxExtractorChannel.ts`](src/vs/workbench/contrib/void/electron-main/docxExtractorChannel.ts) | ragServiceTypes || [`electron-main/pdfExtractorChannel.ts`](src/vs/workbench/contrib/void/electron-main/pdfExtractorChannel.ts) | ragServiceTypes || [`electron-main/xlsxExtractorChannel.ts`](src/vs/workbench/contrib/void/electron-main/xlsxExtractorChannel.ts) | ragServiceTypes || [`electron-main/docxCreatorChannel.ts`](src/vs/workbench/contrib/void/electron-main/docxCreatorChannel.ts) | ragServiceTypes |

## Verification

After refactoring, run TypeScript compilation to verify all imports resolve:

```bash
cd src && bunx tsc --skipLibCheck




```