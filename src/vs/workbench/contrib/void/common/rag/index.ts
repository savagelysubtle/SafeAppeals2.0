/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// Service exports
export { IRAGService, RAGService } from './ragService.js';
export { RAGContextService, IRAGContextService } from './ragContextService.js';
export { IRAGPathService, RAGPathService } from './ragPathService.js';

// Type exports
export * from './ragServiceTypes.js';

// Implementation exports (for electron-main)
export { VectorAdapter, ChromaPersistentAdapter, PersistentVectorAdapterConfig, VectorAdapterConfig } from './ragVectorAdapter.js';
export { LocalEmbeddingService } from './ragLocalEmbeddings.js';
export { LocalCrossEncoderReranker } from './ragReranker.js';
export { QueryProcessor } from './ragQueryProcessor.js';
export { HybridRetriever } from './ragHybridRetriever.js';

