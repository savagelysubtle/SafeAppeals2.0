# RAG System Quick Start Guide

## 🎯 Overview

This guide will get you up and running with the RAG system in 15 minutes. By the end, you'll be able to index documents and perform semantic searches.

## 📋 Prerequisites

- Void development environment set up
- Node.js and Bun package manager
- Basic TypeScript knowledge
- 2GB+ available RAM for embedding models

## 🚀 Step 1: Environment Setup

### 1.1 Install Dependencies
```bash
# Ensure all dependencies are installed
bun install

# Build React components (includes RAG UI)
bun run buildreact
```

### 1.2 Environment Variables
Create a `.env` file in your project root:
```bash
# Required for Docling PDF extraction
HF_TOKEN=hf_your_huggingface_token_here
HUGGING_FACE_HUB_TOKEN=hf_your_huggingface_token_here
```

Get your HuggingFace token from [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)

## 🏗️ Step 2: Basic Usage

### 2.1 Import the Service
```typescript
import { IRAGService } from 'vs/workbench/contrib/void/common/ragService';

// Inject via dependency injection
constructor(
  @IRAGService private readonly ragService: IRAGService
) {}
```

### 2.2 Index a Document
```typescript
// Index a policy manual
const result = await this.ragService.indexDocument({
  uri: URI.file('/path/to/policy-manual.pdf'),
  isPolicyManual: true,
  workspaceId: 'current-workspace'
});

if (result.success) {
  console.log('Document indexed:', result.message);
} else {
  console.error('Indexing failed:', result.message);
}
```

### 2.3 Search Documents
```typescript
// Search policy manuals only
const policyResults = await this.ragService.search({
  query: 'worker eligibility requirements',
  scope: 'policy_manual',  // Only policy manuals
  limit: 5
});

// Search case files only
const caseResults = await this.ragService.search({
  query: 'medical evaluation findings',
  scope: 'case_index',     // Only case files
  limit: 5
});

// Search ALL documents (both sources)
const allResults = await this.ragService.search({
  query: 'appeal deadline requirements',
  scope: 'workspace_all',  // Both policy + case files
  limit: 8
});

console.log('Found', allResults.totalResults, 'relevant chunks');
console.log('Context:', allResults.answerContext);
```

**Available Scopes:**
- `'policy_manual'` - Search policy manuals only
- `'case_index'` - Search case files only
- `'workspace_all'` - Search both sources

### 2.4 Check System Status
```typescript
// Get system statistics
const stats = await this.ragService.getStats();
console.log('Documents indexed:', stats.totalDocuments);
console.log('Total chunks:', stats.chunks.totalChunks);
console.log('Average tokens per chunk:', stats.chunks.avgTokens);
```

## 🔧 Step 3: Basic Configuration

### 3.1 Settings Integration
The RAG system integrates with Void settings. Configure via the settings UI or programmatically:

```typescript
// Access via settings service
const openaiKey = this.settingsService.state.settingsOfProvider.openAI.apiKey;

// The system will use this for future API-based features
```

### 3.2 Memory and Performance
For optimal performance with large document sets:

```typescript
// Recommended settings for production
const recommendedSettings = {
  // Batch processing for memory efficiency
  embeddingBatchSize: 25,

  // Search parameters
  searchLimit: 10,
  rerankingEnabled: true,

  // File size limits
  maxFileSizeMB: 100,
  warningFileSizeMB: 50
};
```

## 🧪 Step 4: Testing Your Setup

### 4.1 Test Document Types
```typescript
// Test different file formats
const testFiles = [
  'policy-manual.pdf',
  'case-report.docx',
  'data-spreadsheet.xlsx',
  'notes.md'
];

for (const filename of testFiles) {
  const uri = URI.file(`/test-files/${filename}`);
  const result = await this.ragService.indexDocument({
    uri,
    isPolicyManual: filename.includes('policy'),
    workspaceId: 'test-workspace'
  });
  console.log(`${filename}: ${result.success ? '✅' : '❌'} ${result.message}`);
}
```

### 4.2 Test Search Queries
```typescript
// Test various query types
const testQueries = [
  'worker compensation eligibility',
  'medical treatment approval process',
  'appeal deadline requirements',
  'disability determination criteria'
];

for (const query of testQueries) {
  const results = await this.ragService.search({
    query,
    scope: 'both',
    limit: 3
  });
  console.log(`"${query}": ${results.totalResults} results (${results.responseTime}ms)`);
}
```

### 4.3 Test Extraction Methods
```typescript
// Compare extraction methods for PDFs
const testUri = URI.file('/path/to/test-document.pdf');
const extractionTest = await this.ragService.testDoclingExtraction(testUri);

console.log('Standard extraction:', extractionTest.standard.metadata);
console.log('Docling extraction:', extractionTest.docling?.metadata || 'N/A');
if (extractionTest.doclingError) {
  console.warn('Docling error:', extractionTest.doclingError);
}
```

## 🎯 Step 5: Common Patterns

### 5.1 Document Organization
```typescript
// Organize documents by type and workspace
const documentTypes = {
  policy: {
    pattern: /policy|guideline|regulation/i,
    scope: 'policy_manual' as const
  },
  case: {
    pattern: /case|claim|appeal|report/i,
    scope: 'workspace_docs' as const
  }
};

function categorizeDocument(filename: string): RAGStorageScope {
  for (const [type, config] of Object.entries(documentTypes)) {
    if (config.pattern.test(filename)) {
      return config.scope;
    }
  }
  return 'workspace_docs'; // default
}
```

### 5.2 Search Optimization
```typescript
// Optimize search for legal queries
async function legalSearch(query: string, scope: RAGStorageScope = 'both') {
  // Preprocess legal terminology
  const enhancedQuery = query
    .replace(/pre-existing/g, 'pre-existing preexisting prior existing')
    .replace(/injured worker/g, 'injured worker employee claimant')
    .replace(/workers comp/g, 'workers comp workers compensation');

  return await this.ragService.search({
    query: enhancedQuery,
    scope,
    limit: 10,
    workspaceId: 'current-workspace'
  });
}
```

### 5.3 Batch Processing
```typescript
// Process multiple documents efficiently
async function batchIndexDocuments(fileUris: URI[], options: {
  isPolicyManual: boolean;
  workspaceId?: string;
  onProgress?: (completed: number, total: number) => void;
}) {
  const results = [];
  const total = fileUris.length;

  for (let i = 0; i < total; i++) {
    const uri = fileUris[i];
    const result = await this.ragService.indexDocument({
      uri,
      isPolicyManual: options.isPolicyManual,
      workspaceId: options.workspaceId
    });

    results.push(result);
    options.onProgress?.(i + 1, total);

    // Small delay to prevent overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}
```

## 🔍 Step 6: Verification

### 6.1 System Health Check
```typescript
async function healthCheck() {
  try {
    // Test basic functionality
    const stats = await this.ragService.getStats();

    // Verify embeddings are loaded
    const testSearch = await this.ragService.search({
      query: 'test query',
      scope: 'policy_manual',
      limit: 1
    });

    return {
      healthy: true,
      stats,
      searchWorks: testSearch.totalResults >= 0,
      message: 'RAG system is operational'
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      message: 'RAG system has issues'
    };
  }
}
```

### 6.2 Performance Metrics
```typescript
async function performanceTest() {
  const startTime = Date.now();

  // Test indexing performance
  const testUri = URI.file('/path/to/test-doc.pdf');
  const indexResult = await this.ragService.indexDocument({
    uri: testUri,
    isPolicyManual: false
  });

  // Test search performance
  const searchResults = [];
  for (let i = 0; i < 10; i++) {
    const start = Date.now();
    await this.ragService.search({
      query: 'test query ' + i,
      scope: 'workspace_docs',
      limit: 5
    });
    searchResults.push(Date.now() - start);
  }

  const totalTime = Date.now() - startTime;
  const avgSearchTime = searchResults.reduce((a, b) => a + b) / searchResults.length;

  return {
    totalTime,
    indexingTime: indexResult.success ? 'Success' : 'Failed',
    avgSearchTime,
    searchesPerSecond: 1000 / avgSearchTime
  };
}
```

## 🎉 You're Ready!

Congratulations! You've successfully set up and tested the RAG system. You can now:

- ✅ Index documents of various formats
- ✅ Perform semantic searches
- ✅ Monitor system performance
- ✅ Handle different document types
- ✅ Optimize for legal/medical content

## 📚 Next Steps

- Read the [API Reference](./api-reference.md) for advanced usage
- Learn about [Architecture](./architecture.md) for deeper understanding
- Check [Performance Guide](./performance.md) for optimization
- Review [Configuration](./configuration.md) for production deployment

## 🆘 Need Help?

- [Troubleshooting Guide](./troubleshooting.md)
- Check the system logs: `~/.safe-appeals-navigator/logs/`
- Verify your environment setup
- Test with smaller documents first

---

*Quick start guide last updated: December 2025*


