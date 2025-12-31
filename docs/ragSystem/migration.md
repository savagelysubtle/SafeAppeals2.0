# RAG System Database Migration Guide

## 📋 Migration Overview

This guide covers database schema migrations, data migrations, and version upgrades for the RAG system. The system uses a schema versioning approach to ensure backward compatibility and safe upgrades.

## 🔢 Schema Version History

| Version | Date | Changes | Migration Required |
|---------|------|---------|-------------------|
| 1 | Initial | Basic documents and chunks tables | N/A (initial) |
| 2 | Dec 2025 | Hierarchical chunking with sections | Yes |
| **2.0 (Architecture)** | Dec 2025 | **MICRO DATABASE ARCHITECTURE** - Removed global database, per-workspace isolation | **Migration recommended** |

### Micro Database Architecture (v2.0)

As of December 2025, the RAG system uses a **MICRO DATABASE ARCHITECTURE** with:
- ✅ **NO global database** - all data is per-workspace
- ✅ **workspaceId is REQUIRED** for all operations
- ✅ Complete isolation between workspaces
- ✅ Legacy global databases should be deleted

## 🏗️ Current Schema (v2)

### Documents Table
```sql
CREATE TABLE documents (
    id TEXT PRIMARY KEY,                    -- SHA256 hash of filepath
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    filetype TEXT NOT NULL,
    filesize INTEGER NOT NULL,
    uploaded_at TEXT NOT NULL,              -- ISO timestamp
    last_indexed TEXT NOT NULL,             -- ISO timestamp
    checksum TEXT,                          -- SHA256 of file content
    metadata TEXT,                          -- JSON metadata
    is_policy_manual BOOLEAN NOT NULL DEFAULT 0,
    workspace_id TEXT
);
```

### Chunks Table
```sql
CREATE TABLE chunks (
    chunk_id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    text TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    tokens INTEGER,
    -- Hierarchical chunking fields (v2)
    section_id TEXT,
    parent_section TEXT,
    section_number TEXT,
    section_title TEXT,
    breadcrumb_path TEXT,                   -- JSON array
    chunk_type TEXT CHECK(chunk_type IN ('child', 'parent')),
    parent_chunk_id TEXT,
    FOREIGN KEY (doc_id) REFERENCES documents (id) ON DELETE CASCADE,
    FOREIGN KEY (parent_chunk_id) REFERENCES chunks (chunk_id) ON DELETE SET NULL
);
```

### FTS5 Search Index
```sql
CREATE VIRTUAL TABLE chunks_fts USING fts5(
    chunk_id UNINDEXED,
    text,
    content='chunks',
    content_rowid='rowid'
);
```

### Schema Version Tracking
```sql
CREATE TABLE schema_version (
    version INTEGER PRIMARY KEY
);
```

## 🔄 Migration Process

### Automatic Migration

The system automatically detects and applies schema migrations on startup:

```typescript
// Automatic migration in RAGIndexService
private async migrateSchema(fromVersion: number): Promise<void> {
  this.logService.info(`Starting schema migration from v${fromVersion}`);

  try {
    // Migration from v1 to v2: Add hierarchical chunking columns
    if (fromVersion < 2) {
      await this.migrateToV2();
    }

    // Future migrations here
    // if (fromVersion < 3) { ... }

  } catch (error) {
    this.logService.error('Schema migration failed:', error);
    throw error;
  }
}
```

### Manual Migration

For manual control or troubleshooting:

```typescript
class ManualMigrator {
  async migrateDatabase(): Promise<void> {
    const currentVersion = await this.getCurrentVersion();

    if (currentVersion < 2) {
      await this.migrateToV2();
    }

    // Update schema version
    await this.updateSchemaVersion(2);
  }

  private async migrateToV2(): Promise<void> {
    // Add new columns to chunks table
    const alterStatements = [
      'ALTER TABLE chunks ADD COLUMN section_id TEXT',
      'ALTER TABLE chunks ADD COLUMN parent_section TEXT',
      'ALTER TABLE chunks ADD COLUMN section_number TEXT',
      'ALTER TABLE chunks ADD COLUMN section_title TEXT',
      'ALTER TABLE chunks ADD COLUMN breadcrumb_path TEXT',
      'ALTER TABLE chunks ADD COLUMN chunk_type TEXT CHECK(chunk_type IN (\'child\', \'parent\'))',
      'ALTER TABLE chunks ADD COLUMN parent_chunk_id TEXT'
    ];

    for (const statement of alterStatements) {
      await this.db.run(statement);
    }

    // Create new indexes
    const indexStatements = [
      'CREATE INDEX IF NOT EXISTS idx_chunks_section ON chunks(section_id)',
      'CREATE INDEX IF NOT EXISTS idx_chunks_type ON chunks(chunk_type)',
      'CREATE INDEX IF NOT EXISTS idx_chunks_parent ON chunks(parent_chunk_id)'
    ];

    for (const statement of indexStatements) {
      await this.db.run(statement);
    }
  }
}
```

## 📊 Data Migration Strategies

### Re-indexing Approach

The safest migration strategy is to clear embeddings and re-index documents:

```typescript
class DataMigrator {
  async migrateWithReindexing(): Promise<void> {
    this.logService.info('Starting data migration with re-indexing...');

    // Step 1: Export document metadata
    const documents = await this.exportDocumentMetadata();
    this.logService.info(`Exported metadata for ${documents.length} documents`);

    // Step 2: Clear all data (preserves schema)
    await this.ragService.clearAllEmbeddings();
    this.logService.info('Cleared existing embeddings and chunks');

    // Step 3: Re-index documents with new schema
    let successCount = 0;
    let errorCount = 0;

    for (const doc of documents) {
      try {
        await this.ragService.indexDocument({
          uri: URI.file(doc.filepath),
          isPolicyManual: doc.isPolicyManual,
          workspaceId: doc.workspaceId
        });
        successCount++;
      } catch (error) {
        this.logService.error(`Failed to re-index ${doc.filename}:`, error);
        errorCount++;
      }
    }

    this.logService.info(`Migration complete: ${successCount} success, ${errorCount} errors`);
  }

  private async exportDocumentMetadata(): Promise<any[]> {
    // Export before clearing
    return await this.indexService.getAllDocuments();
  }
}
```

### Incremental Migration

For large datasets, migrate incrementally:

```typescript
class IncrementalMigrator {
  async migrateIncrementally(batchSize: number = 10): Promise<void> {
    const documents = await this.getDocumentsNeedingMigration();
    this.logService.info(`${documents.length} documents need migration`);

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      await this.migrateBatch(batch);

      // Progress reporting
      const progress = Math.round((i + batch.length) / documents.length * 100);
      this.logService.info(`Migration progress: ${progress}%`);

      // Allow system to breathe
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  private async migrateBatch(batch: any[]): Promise<void> {
    // Update metadata for existing chunks
    for (const doc of batch) {
      await this.updateDocumentMetadata(doc);
    }
  }

  private async updateDocumentMetadata(doc: any): Promise<void> {
    // Add hierarchical metadata to existing chunks
    const chunks = await this.getChunksByDocId(doc.id);

    for (const chunk of chunks) {
      // Parse document structure and add metadata
      const hierarchicalData = await this.extractHierarchicalData(chunk.text);

      await this.updateChunkWithHierarchy(chunk.chunkId, hierarchicalData);
    }
  }
}
```

## 🔧 Version-Specific Migrations

### Migrating from v1 to v2

**Changes:**
- Added hierarchical chunking columns
- Added chunk relationships (parent/child)
- Added section metadata

**Migration Script:**
```sql
-- Migration from v1 to v2
BEGIN TRANSACTION;

-- Add new columns to chunks table
ALTER TABLE chunks ADD COLUMN section_id TEXT;
ALTER TABLE chunks ADD COLUMN parent_section TEXT;
ALTER TABLE chunks ADD COLUMN section_number TEXT;
ALTER TABLE chunks ADD COLUMN section_title TEXT;
ALTER TABLE chunks ADD COLUMN breadcrumb_path TEXT;
ALTER TABLE chunks ADD COLUMN chunk_type TEXT CHECK(chunk_type IN ('child', 'parent'));
ALTER TABLE chunks ADD COLUMN parent_chunk_id TEXT;

-- Create new indexes
CREATE INDEX idx_chunks_section ON chunks(section_id);
CREATE INDEX idx_chunks_type ON chunks(chunk_type);
CREATE INDEX idx_chunks_parent ON chunks(parent_chunk_id);

-- Update schema version
INSERT OR REPLACE INTO schema_version (version) VALUES (2);

COMMIT;
```

**Post-Migration:**
```typescript
// After schema migration, update existing data
async function populateHierarchicalData(): Promise<void> {
  const documents = await indexService.getAllDocuments();

  for (const doc of documents) {
    const chunks = await indexService.getChunksByDocId(doc.id);

    // Re-chunk with hierarchical data
    const content = chunks.map(c => c.text).join('\n\n');
    const newChunks = indexService.chunkText(content, doc.id);

    // Update chunks with hierarchical metadata
    for (const chunk of newChunks) {
      await indexService.updateChunkHierarchy(chunk.chunkId, {
        sectionId: chunk.sectionId,
        parentSection: chunk.parentSection,
        sectionNumber: chunk.sectionNumber,
        sectionTitle: chunk.sectionTitle,
        breadcrumbPath: chunk.breadcrumbPath,
        chunkType: chunk.chunkType,
        parentChunkId: chunk.parentChunkId
      });
    }
  }
}
```

## 🛡️ Backup and Recovery

### Pre-Migration Backup

```typescript
class BackupManager {
  async createFullBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `~/.safe-appeals-navigator/backups/rag-${timestamp}`;

    // Create backup directory
    await fs.mkdir(backupPath, { recursive: true });

    // Backup database
    await this.backupDatabase(backupPath);

    // Backup embeddings
    await this.backupEmbeddings(backupPath);

    // Backup models
    await this.backupModels(backupPath);

    // Create backup manifest
    await this.createBackupManifest(backupPath);

    return backupPath;
  }

  private async backupDatabase(backupPath: string): Promise<void> {
    const dbPath = this.pathService.getGlobalSqlitePath();
    const backupDbPath = path.join(backupPath, 'workspace.db');

    // SQLite backup
    await new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath);
      db.backup(backupDbPath)
        .run(1, (err) => {
          if (err) reject(err);
          else resolve();
        });
    });
  }

  private async createBackupManifest(backupPath: string): Promise<void> {
    const manifest = {
      timestamp: new Date().toISOString(),
      schemaVersion: await this.getSchemaVersion(),
      stats: await this.ragService.getStats(),
      files: [
        'workspace.db',
        'embeddings/',
        'models/'
      ]
    };

    await fs.writeFile(
      path.join(backupPath, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );
  }
}
```

### Recovery Process

```typescript
class RecoveryManager {
  async restoreFromBackup(backupPath: string): Promise<void> {
    // Validate backup
    await this.validateBackup(backupPath);

    // Stop RAG services
    await this.stopRAGServices();

    try {
      // Restore database
      await this.restoreDatabase(backupPath);

      // Restore embeddings
      await this.restoreEmbeddings(backupPath);

      // Restore models
      await this.restoreModels(backupPath);

      // Verify restoration
      await this.verifyRestoration();

      this.logService.info('Backup restoration completed successfully');
    } catch (error) {
      this.logService.error('Backup restoration failed:', error);
      throw error;
    } finally {
      // Restart services
      await this.startRAGServices();
    }
  }

  private async validateBackup(backupPath: string): Promise<void> {
    const manifestPath = path.join(backupPath, 'manifest.json');

    if (!await fs.pathExists(manifestPath)) {
      throw new Error('Invalid backup: missing manifest.json');
    }

    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));

    // Validate required files exist
    for (const file of manifest.files) {
      const filePath = path.join(backupPath, file);
      if (!await fs.pathExists(filePath)) {
        throw new Error(`Invalid backup: missing ${file}`);
      }
    }
  }
}
```

## 🚨 Rollback Procedures

### Emergency Rollback

```typescript
class RollbackManager {
  async emergencyRollback(): Promise<void> {
    this.logService.warn('Initiating emergency rollback...');

    // Find latest good backup
    const latestBackup = await this.findLatestBackup();

    if (!latestBackup) {
      throw new Error('No backup available for rollback');
    }

    // Restore from backup
    await this.recoveryManager.restoreFromBackup(latestBackup.path);

    // Reset schema version if needed
    await this.resetSchemaVersion(latestBackup.schemaVersion);

    this.logService.info('Emergency rollback completed');
  }

  private async findLatestBackup(): Promise<BackupInfo | null> {
    const backupDir = '~/.safe-appeals-navigator/backups/';

    if (!await fs.pathExists(backupDir)) {
      return null;
    }

    const backups = await fs.readdir(backupDir);
    const backupInfos = await Promise.all(
      backups.map(async (backup) => {
        const manifestPath = path.join(backupDir, backup, 'manifest.json');
        if (await fs.pathExists(manifestPath)) {
          const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
          return {
            name: backup,
            path: path.join(backupDir, backup),
            timestamp: new Date(manifest.timestamp),
            schemaVersion: manifest.schemaVersion
          };
        }
        return null;
      })
    );

    // Return most recent valid backup
    return backupInfos
      .filter(Boolean)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
  }
}
```

## 📈 Migration Testing

### Automated Testing

```typescript
class MigrationTester {
  async testMigration(): Promise<TestResults> {
    const results = {
      schemaMigration: await this.testSchemaMigration(),
      dataMigration: await this.testDataMigration(),
      functionality: await this.testFunctionality(),
      performance: await this.testPerformance()
    };

    return results;
  }

  private async testSchemaMigration(): Promise<boolean> {
    // Create test database with old schema
    const testDb = await this.createTestDatabase(1); // v1 schema

    // Apply migration
    await this.migrateDatabase(testDb, 2);

    // Verify new schema
    const schemaValid = await this.verifySchema(testDb, 2);

    return schemaValid;
  }

  private async testDataMigration(): Promise<boolean> {
    // Create test data with old structure
    const testData = await this.createTestData();

    // Apply migration
    await this.migrateData(testData);

    // Verify data integrity
    return await this.verifyDataIntegrity(testData);
  }

  private async testFunctionality(): Promise<boolean> {
    // Test basic RAG operations after migration
    const searchResults = await this.testSearchFunctionality();
    const indexResults = await this.testIndexingFunctionality();

    return searchResults && indexResults;
  }

  private async testPerformance(): Promise<PerformanceResults> {
    // Measure performance before and after migration
    const beforeMigration = await this.measurePerformance();
    await this.applyMigration();
    const afterMigration = await this.measurePerformance();

    return {
      searchTimeChange: afterMigration.avgSearchTime - beforeMigration.avgSearchTime,
      indexTimeChange: afterMigration.avgIndexTime - beforeMigration.avgIndexTime,
      memoryChange: afterMigration.avgMemory - beforeMigration.avgMemory
    };
  }
}
```

### Migration Checklist

- [ ] Create full backup
- [ ] Run migration tests
- [ ] Verify schema migration
- [ ] Test data migration
- [ ] Validate functionality
- [ ] Monitor performance
- [ ] Update documentation
- [ ] Communicate with users

## 🔄 Migrating to Micro Database Architecture

### Cleaning Up Legacy Global Databases

If you previously used the RAG system before the micro database architecture (v2.0), you may have legacy global databases that should be removed:

```bash
# Check for legacy global databases
ls -la ~/.safe-appeals-navigator/databases/

# Legacy files that should NOT exist (delete them):
# - ~/.safe-appeals-navigator/databases/workspace.db
# - ~/.safe-appeals-navigator/databases/chroma/

# These are the CORRECT micro database locations:
# - ~/.safe-appeals-navigator/databases/workspaces/[hash]/workspace.db
# - ~/.safe-appeals-navigator/databases/workspaces/[hash]/chroma/embeddings.db
```

### Cleanup Script (PowerShell)

```powershell
# Delete legacy global databases
$basePath = "$env:APPDATA\Safe Appeals Navigator\User\.safe-appeals-navigator\databases"

# Remove legacy global workspace.db
$globalDb = "$basePath\workspace.db"
if (Test-Path $globalDb) {
    Remove-Item $globalDb -Force
    Write-Host "Deleted legacy: workspace.db"
}

# Remove legacy global chroma folder
$globalChroma = "$basePath\chroma"
if (Test-Path $globalChroma) {
    Remove-Item $globalChroma -Recurse -Force
    Write-Host "Deleted legacy: chroma/"
}

# Verify only micro databases remain
Write-Host "Remaining structure:"
Get-ChildItem "$basePath\workspaces" -Recurse
```

### Why Migrate?

1. **Data Isolation**: Prevents cross-contamination between cases
2. **Privacy**: Legal documents from one case cannot leak to another
3. **Independent Management**: Each workspace can be backed up/deleted separately
4. **Required by Code**: The new architecture throws errors if global paths are accessed

## 🔄 Future Migration Planning

### Version 3 (Planned)

**Proposed Changes:**
- Add document versioning
- Enhanced metadata fields
- Improved indexing performance
- Advanced search features

**Migration Impact:**
- Schema additions only (backward compatible)
- Optional data migration
- Performance improvements

### Migration Strategy Template

```typescript
// Template for future migrations
class MigrationV3 implements Migration {
  readonly targetVersion = 3;

  async migrate(): Promise<void> {
    // Schema changes
    await this.applySchemaChanges();

    // Data updates (if needed)
    await this.updateExistingData();

    // Index optimizations
    await this.optimizeIndexes();

    // Update version
    await this.updateSchemaVersion(3);
  }

  // Implementation details...
}
```

---

*Migration guide last updated: December 2025*


