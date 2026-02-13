# RAG System Configuration Guide

## 📋 Configuration Overview

The RAG system is highly configurable to adapt to different deployment environments, performance requirements, and use cases. Configuration is managed through Void settings, environment variables, and service parameters.

## ⚙️ Core Settings

### Void Settings Integration

The RAG system integrates with Void's centralized settings system. Access via `IVoidSettingsService`:

```typescript
// Access RAG-related settings
const settings = this.settingsService.state;

// OpenAI API key (for future features)
const openaiKey = settings.settingsOfProvider.openAI.apiKey;

// Model selections
const chatModel = settings.modelSelectionOfFeature.chat;
const editModel = settings.modelSelectionOfFeature.edit;

// Global settings
const globalSettings = settings.globalSettings;
```

### Available Settings Categories

#### Provider Settings

```typescript
settingsOfProvider: {
  openAI: {
    apiKey: string;        // Currently unused, reserved for future
    endpoint?: string;     // Custom endpoint (future)
  }
}
```

#### Model Selection

```typescript
modelSelectionOfFeature: {
  chat: ModelCapability;      // Chat interface model
  'ctrl+k': ModelCapability;  // Quick edit model
  apply: ModelCapability;     // Apply feature model
  autocomplete: ModelCapability; // Autocomplete model
  scm: ModelCapability;       // SCM model
}
```

#### Global Void Settings

```typescript
globalSettings: {
	chatMode: "normal" | "gather" | "agent";
	autoApprove: boolean;
	ragAutoIndexCaseFiles: boolean; // Auto-index non-policy files on workspace open
	// ... other Void settings
}
```

#### RAG-Specific Settings

| Setting                 | Type    | Default | Description                                                                      |
| ----------------------- | ------- | ------- | -------------------------------------------------------------------------------- |
| `ragAutoIndexCaseFiles` | boolean | `true`  | Automatically scan and index all non-policy documents when a workspace is opened |

**When `ragAutoIndexCaseFiles` is enabled:**

1. On workspace open, all folders (except `policy-manuals/`) are scanned
2. Unindexed PDF, DOCX, TXT, etc. files are automatically indexed as case files
3. Already-indexed files are skipped

## 🔧 Environment Variables

### Required Variables

#### HuggingFace Token

```bash
# Required for Docling PDF extraction
HF_TOKEN=hf_your_token_here
HUGGING_FACE_HUB_TOKEN=hf_your_token_here

# Get from: https://huggingface.co/settings/tokens
```

**Purpose:** Enables advanced PDF extraction with Docling service for ML-based document understanding.

**Impact:** Without HF_TOKEN, falls back to basic PDF.js extraction.

### Optional Variables

#### Custom Data Directory

```bash
# Override default data directory
RAG_DATA_DIR=/custom/path/to/data

# Default: ~/.safe-appeals-navigator/
```

#### Model Cache Directory

```bash
# Override model cache location
RAG_MODEL_CACHE=/custom/path/to/models

# Default: {RAG_DATA_DIR}/models/
```

#### Log Directory

```bash
# Override log directory
RAG_LOG_DIR=/custom/path/to/logs

# Default: {RAG_DATA_DIR}/logs/
```

## 📁 Directory Structure

### Micro Database Architecture (v2.0) - No Global Database

The RAG system uses a **MICRO DATABASE ARCHITECTURE** with **complete workspace isolation**. There is **NO global database** - all data is stored in per-workspace micro databases.

```
~/.safe-appeals-navigator/           # Base directory
├── databases/
│   └── workspaces/                  # Per-workspace micro databases ONLY
│       ├── a1b2c3d4/                # Workspace 1 (8-char hash)
│       │   ├── workspace.db         # SQLite: documents, chunks, FTS5
│       │   ├── emails.db            # Email data (if applicable)
│       │   └── chroma/
│       │       └── embeddings.db    # Vector embeddings (data only, no models)
│       ├── e5f6g7h8/                # Workspace 2
│       │   ├── workspace.db
│       │   └── chroma/
│       │       └── embeddings.db
│       └── [more workspaces...]
├── models/                          # ML model cache (shared across ALL workspaces)
│   └── Xenova/
│       ├── all-MiniLM-L6-v2/       # Embedding model (~23MB)
│       └── ms-marco-MiniLM-L-6-v2/ # Reranker model (~22MB)
└── logs/
    └── rag-debug.log                # Debug logging
```

**Key Points:**

- ✅ **NO global database exists** - `workspaceId` is **REQUIRED** for all operations
- ✅ **Workspace ID**: 8-character SHA256 hash of workspace folder path
- ✅ **Complete isolation**: Documents from one case cannot leak to another
- ✅ **Independent management**: Each workspace can be backed up/deleted independently

### Path Service Configuration

The `RAGPathService` provides workspace-specific paths. **Global path methods have been removed** in the micro database architecture.

```typescript
// Configure via RAGPathService - WORKSPACE-SPECIFIC ONLY
class RAGPathService implements IRAGPathService {
	private baseDir =
		process.env.RAG_DATA_DIR || join(os.homedir(), ".safe-appeals-navigator");

	// Workspace-specific paths (workspaceId is REQUIRED)
	getWorkspaceChromaDir(workspaceId: string): string {
		if (!workspaceId) throw new Error("workspaceId is required");
		return join(this.baseDir, "databases", "workspaces", workspaceId, "chroma");
	}

	getWorkspaceSqlitePath(workspaceId: string): string {
		if (!workspaceId) throw new Error("workspaceId is required");
		return join(
			this.baseDir,
			"databases",
			"workspaces",
			workspaceId,
			"workspace.db",
		);
	}

	getEmailSqlitePath(workspaceId: string): string {
		if (!workspaceId) throw new Error("workspaceId is required");
		return join(
			this.baseDir,
			"databases",
			"workspaces",
			workspaceId,
			"emails.db",
		);
	}

	// Shared resources (not workspace-specific)
	getLogsDir(): string {
		return process.env.RAG_LOG_DIR || join(this.baseDir, "logs");
	}

	getModelCacheDir(): string {
		return process.env.RAG_MODEL_CACHE || join(this.baseDir, "models");
	}

	// NOTE: getGlobalChromaDir() and getGlobalSqlitePath() have been REMOVED
	// All database operations now require a workspaceId
}
```

## 🔧 Service Configuration

### RAG Service Parameters

#### Initialization Options

```typescript
interface RAGServiceConfig {
	// Embedding model settings
	embeddingModel: "all-MiniLM-L6-v2"; // Currently fixed
	embeddingDimension: 384; // Fixed for model
	useReranking: boolean; // Default: true

	// Performance settings
	embeddingBatchSize: number; // Default: 25
	maxFileSizeMB: number; // Default: 100
	warningFileSizeMB: number; // Default: 50

	// Search settings
	defaultSearchLimit: number; // Default: 10
	bm25K1: number; // Default: 0.8
	bm25B: number; // Default: 0.5
	rrfK: number; // Default: 20

	// Memory management
	memoryWarningThresholdMB: number; // Default: 500
	enableGCHints: boolean; // Default: true
}
```

#### Runtime Configuration

```typescript
// Configure during service initialization
const ragConfig: RAGServiceConfig = {
	embeddingBatchSize: 25, // Process 25 texts per batch
	maxFileSizeMB: 100, // Reject files > 100MB
	useReranking: true, // Enable cross-encoder reranking
	defaultSearchLimit: 10, // Return top 10 results by default
	memoryWarningThresholdMB: 500, // Warn when heap > 500MB
};
```

### File Service Configuration

#### PDF Extraction Options

```typescript
interface PDFExtractionConfig {
	useDocling: boolean; // Default: true
	useHybridPdfExtraction: boolean; // Default: true
	fallbackToPdfJs: boolean; // Default: true

	// PDF.js options
	pdfJsMaxImageSize: number; // Default: 1024*1024 (1MB)
	disableFontFace: boolean; // Default: true
	verbosity: number; // Default: 0

	// Docling options
	doclingServerUrl: string; // Default: http://localhost:5001
	doclingTimeoutMs: number; // Default: 30000
}
```

#### Document Processing Limits

```typescript
interface DocumentProcessingConfig {
	// Size limits
	maxFileSizeMB: number; // Default: 100
	maxPagesPerDocument: number; // Default: 1000

	// Processing timeouts
	extractionTimeoutMs: number; // Default: 300000 (5 minutes)
	indexingTimeoutMs: number; // Default: 600000 (10 minutes)

	// Memory limits
	maxMemoryUsageMB: number; // Default: 1024
	gcHintIntervalMs: number; // Default: 10000
}
```

### Vector Adapter Configuration

#### Chroma Persistent Adapter

```typescript
interface ChromaPersistentConfig {
	persistPath: string; // Vector storage directory
	useReranking: boolean; // Default: true

	// Embedding settings
	modelName: string; // Default: 'Xenova/all-MiniLM-L6-v2'
	embeddingDimension: number; // Default: 384

	// Search settings
	minSimilarityThreshold: number; // Default: 0.07
	mmrLambda: number; // Default: 0.7 (relevance/diversity balance)
	mmrK: number; // Default: 3 (diversity candidates)

	// Performance
	batchSize: number; // Default: 25
	maxConcurrency: number; // Default: 4
}
```

## 🔍 Search Configuration

### Query Processing Settings

#### Scope Routing Rules

```typescript
interface QueryRoutingConfig {
	// Keyword-based routing
	policyKeywords: string[]; // Default: ['policy', 'rule', 'regulation', ...]
	caseKeywords: string[]; // Default: ['client', 'claimant', 'case', ...]

	// Default scope for ambiguous queries
	defaultScope: RAGStorageScope; // Default: 'both'

	// Minimum keyword matches for routing
	minKeywordMatches: number; // Default: 1
}
```

#### Query Enhancement

```typescript
interface QueryEnhancementConfig {
  // Terminology expansion
  enableTerminologyExpansion: boolean;  // Default: true
  maxExpansionsPerQuery: number;        // Default: 1

  // Legal/medical expansions
  legalExpansions: Record<string, string> = {
    'pre-existing': 'pre-existing preexisting prior existing previous',
    'aggravation': 'aggravation exacerbation worsening',
    'disability': 'disability impairment limitation restriction'
  };

  // Query preprocessing
  lowercaseQueries: boolean;      // Default: true
  removeStopWords: boolean;       // Default: false
  maxQueryLength: number;         // Default: 500
}
```

### Hybrid Search Configuration

#### BM25 Parameters

```typescript
interface BM25Config {
	k1: number; // Term frequency saturation (default: 0.8)
	b: number; // Document length normalization (default: 0.5)

	// Advanced parameters
	k3: number; // Query term frequency normalization (default: 0)
	delta: number; // Delta for BM25+ (default: 1.0)
}
```

#### RRF Parameters

```typescript
interface RRFConfig {
	k: number; // RRF constant (default: 20)
	// Lower = more emphasis on top ranks
	// Higher = more uniform ranking

	// Result expansion
	retrievalMultiplier: number; // Default: 3 (retrieve 3x desired results)
	maxResults: number; // Default: 1000
}
```

#### Cross-Encoder Configuration

```typescript
interface CrossEncoderConfig {
	enabled: boolean; // Default: true
	modelName: string; // Default: 'Xenova/ms-marco-MiniLM-L6-v2'
	batchSize: number; // Default: 16
	maxLength: number; // Default: 512

	// Reranking parameters
	topKForReranking: number; // Default: 50 (rerank top 50)
	finalResultLimit: number; // Default: 10
}
```

## 💾 Database Configuration

### SQLite Configuration

#### Connection Settings

```typescript
interface SQLiteConfig {
	databasePath: string; // Database file location
	journalMode: "WAL" | "DELETE"; // Default: 'WAL'
	synchronous: "NORMAL" | "FULL"; // Default: 'NORMAL'
	cacheSize: number; // Default: -64000 (64MB)
	tempStore: "memory" | "file"; // Default: 'memory'

	// Connection pooling
	maxConnections: number; // Default: 10
	connectionTimeoutMs: number; // Default: 30000
}
```

#### Schema Configuration

```typescript
interface SchemaConfig {
	currentVersion: number; // Default: 2
	enableMigrations: boolean; // Default: true
	migrationTimeoutMs: number; // Default: 300000

	// Table settings
	chunkSizeLimit: number; // Default: 1200 chars
	maxSectionDepth: number; // Default: 5
	enableHierarchicalChunking: boolean; // Default: true
}
```

### FTS5 Configuration

#### Full-Text Search Settings

```typescript
interface FTS5Config {
	enabled: boolean; // Default: true
	tableName: string; // Default: 'chunks_fts'
	contentTable: string; // Default: 'chunks'

	// Indexing options
	indexColumn: string; // Default: 'text'
	tokenize: string; // Default: 'unicode61'

	// Performance
	rankFunction: "bm25"; // Default: 'bm25'
	enableHighlighting: boolean; // Default: true
}
```

## 📊 Performance Configuration

### Memory Management

#### Garbage Collection Settings

```typescript
interface MemoryConfig {
	enableGCHints: boolean; // Default: true
	gcHintIntervalMs: number; // Default: 10000
	maxHeapSizeMB: number; // Default: 1024

	// Monitoring
	memoryWarningThresholdMB: number; // Default: 500
	memoryCriticalThresholdMB: number; // Default: 800
	enableMemoryLogging: boolean; // Default: true
}
```

#### Batch Processing

```typescript
interface BatchConfig {
	// Embedding batches
	embeddingBatchSize: number; // Default: 25
	maxConcurrentBatches: number; // Default: 4

	// Indexing batches
	indexingBatchSize: number; // Default: 50
	maxConcurrentIndexing: number; // Default: 2

	// Search batches
	searchBatchSize: number; // Default: 16
	maxConcurrentSearches: number; // Default: 8
}
```

### Caching Configuration

#### Embedding Cache

```typescript
interface EmbeddingCacheConfig {
	enabled: boolean; // Default: true
	maxCacheSize: number; // Default: 10000 (embeddings)
	cacheEvictionPolicy: "LRU"; // Default: 'LRU'

	// Persistence
	persistToDisk: boolean; // Default: true
	diskCachePath: string; // Auto-generated
	enableCacheCompression: boolean; // Default: false
}
```

#### Query Cache

```typescript
interface QueryCacheConfig {
	enabled: boolean; // Default: true
	maxCacheSize: number; // Default: 1000
	cacheTTLMs: number; // Default: 3600000 (1 hour)

	// Cache keys
	includeScope: boolean; // Default: true
	includeLimit: boolean; // Default: false
	includeWorkspace: boolean; // Default: true
}
```

## 🔒 Security Configuration

### Access Control

#### Workspace Isolation

```typescript
interface WorkspaceConfig {
	enableIsolation: boolean; // Default: true
	allowCrossWorkspaceSearch: boolean; // Default: false
	workspaceIdValidation: boolean; // Default: true

	// Resource limits
	maxDocumentsPerWorkspace: number; // Default: 10000
	maxChunksPerWorkspace: number; // Default: 100000
	maxStoragePerWorkspaceMB: number; // Default: 10240 (10GB)
}
```

#### File System Security

```typescript
interface FileSystemConfig {
	allowedFileTypes: string[]; // Default: ['pdf', 'docx', 'xlsx', 'txt', 'md']
	blockedFileExtensions: string[]; // Default: ['exe', 'bat', 'cmd', 'scr']
	maxPathLength: number; // Default: 4096

	// Path validation
	allowSymlinks: boolean; // Default: false
	validateParentDirectories: boolean; // Default: true
	restrictToUserDirectories: boolean; // Default: true
}
```

### Data Protection

#### Encryption Settings

```typescript
interface EncryptionConfig {
	enableDatabaseEncryption: boolean; // Default: false
	encryptionKeyPath: string; // Required if enabled
	encryptEmbeddings: boolean; // Default: false

	// Key management
	keyRotationDays: number; // Default: 90
	backupKeys: boolean; // Default: true
}
```

## 📝 Logging Configuration

### Log Levels

```typescript
enum LogLevel {
	ERROR = 0,
	WARN = 1,
	INFO = 2,
	DEBUG = 3,
	TRACE = 4,
}

interface LoggingConfig {
	level: LogLevel; // Default: INFO
	enableConsoleLogging: boolean; // Default: true
	enableFileLogging: boolean; // Default: true

	// File settings
	logDirectory: string; // Auto-generated
	maxFileSizeMB: number; // Default: 10
	maxFiles: number; // Default: 5

	// Performance logging
	enablePerformanceLogging: boolean; // Default: true
	logSlowQueriesMs: number; // Default: 1000
}
```

### Log Categories

```typescript
interface LogCategories {
	indexing: boolean; // Default: true
	search: boolean; // Default: true
	embedding: boolean; // Default: true
	database: boolean; // Default: true
	memory: boolean; // Default: true
	performance: boolean; // Default: true
}
```

## 🚀 Production Deployment

### Environment-Specific Configuration

#### Development

```typescript
const developmentConfig: RAGServiceConfig = {
	useReranking: false, // Disable for faster development
	embeddingBatchSize: 10, // Smaller batches
	enableMemoryLogging: true, // Detailed memory tracking
	logLevel: LogLevel.DEBUG, // Verbose logging
};
```

#### Staging

```typescript
const stagingConfig: RAGServiceConfig = {
	useReranking: true, // Enable all features
	embeddingBatchSize: 25, // Standard batch size
	enableMemoryLogging: true, // Performance monitoring
	logLevel: LogLevel.INFO, // Standard logging
};
```

#### Production

```typescript
const productionConfig: RAGServiceConfig = {
	useReranking: true, // Full feature set
	embeddingBatchSize: 50, // Larger batches for performance
	enableMemoryLogging: false, // Reduce log volume
	logLevel: LogLevel.WARN, // Error-only logging
	maxFileSizeMB: 200, // Allow larger files
	maxMemoryUsageMB: 2048, // Higher memory limits
};
```

### Configuration Validation

```typescript
class ConfigurationValidator {
	static validate(config: RAGServiceConfig): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Required settings
		if (!config.embeddingModel) {
			errors.push("embeddingModel is required");
		}

		// Performance validation
		if (config.embeddingBatchSize > 100) {
			warnings.push("Large batch size may cause memory issues");
		}

		// File size validation
		if (config.maxFileSizeMB > 500) {
			warnings.push("Very large file size limit may impact performance");
		}

		return { valid: errors.length === 0, errors, warnings };
	}
}
```

### Configuration Loading

```typescript
class ConfigurationManager {
	static loadConfiguration(): RAGServiceConfig {
		const env = process.env.NODE_ENV || "development";
		const baseConfig = this.getBaseConfig();
		const envConfig = this.getEnvironmentConfig(env);

		// Merge configurations
		const finalConfig = { ...baseConfig, ...envConfig };

		// Validate
		const validation = ConfigurationValidator.validate(finalConfig);
		if (!validation.valid) {
			throw new Error(`Invalid configuration: ${validation.errors.join(", ")}`);
		}

		// Log warnings
		validation.warnings.forEach((warning) => {
			console.warn(`Config warning: ${warning}`);
		});

		return finalConfig;
	}
}
```

## 🔧 Configuration Management

### Runtime Configuration Updates

```typescript
class RAGConfigurationManager {
	private currentConfig: RAGServiceConfig;

	constructor(private ragService: IRAGService) {
		this.currentConfig = this.loadInitialConfig();
	}

	async updateConfiguration(
		newConfig: Partial<RAGServiceConfig>,
	): Promise<void> {
		// Validate new configuration
		const mergedConfig = { ...this.currentConfig, ...newConfig };
		const validation = ConfigurationValidator.validate(mergedConfig);

		if (!validation.valid) {
			throw new Error(`Invalid configuration: ${validation.errors.join(", ")}`);
		}

		// Apply configuration changes
		await this.applyConfigurationChanges(newConfig);

		// Update stored configuration
		this.currentConfig = mergedConfig;

		// Log configuration change
		this.logConfigurationUpdate(newConfig);
	}

	private async applyConfigurationChanges(
		changes: Partial<RAGServiceConfig>,
	): Promise<void> {
		// Apply changes that require service restart
		if (changes.embeddingBatchSize !== undefined) {
			// Restart embedding service with new batch size
			await this.ragService.restartEmbeddingService();
		}

		// Apply changes that can be hot-swapped
		if (changes.useReranking !== undefined) {
			// Enable/disable reranking without restart
			await this.ragService.setRerankingEnabled(changes.useReranking);
		}
	}
}
```

---

_Configuration guide last updated: December 2025_
