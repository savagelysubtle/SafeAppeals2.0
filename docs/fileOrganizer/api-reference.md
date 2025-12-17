# File Organizer API Reference

This document provides comprehensive API documentation for the File Organizer system components, interfaces, and methods.

## 📋 Table of Contents

- [Core Interfaces](#core-interfaces)
- [Service APIs](#service-apis)
- [Type Definitions](#type-definitions)
- [Error Handling](#error-handling)
- [Examples](#examples)

## 🔧 Core Interfaces

### IFileOrganizerService

The main service interface for file organization operations.

```typescript
export interface IFileOrganizerService {
    readonly _serviceBrand: undefined;

    /**
     * Opens a file dialog for users to select files to organize
     * @returns Promise resolving to array of selected file URIs
     */
    selectFiles(): Promise<URI[]>;

    /**
     * Analyzes selected files and extracts metadata
     * @param files Array of file URIs to analyze
     * @returns Promise resolving to array of FileMetadata objects
     */
    analyzeFiles(files: URI[]): Promise<FileMetadata[]>;

    /**
     * Applies organization rules to files and generates change proposals
     * @param files Array of file metadata
     * @param rules Array of organization rules to apply
     * @returns Promise resolving to array of proposed changes
     */
    previewChanges(files: FileMetadata[], rules: Rule[]): Promise<FileChange[]>;

    /**
     * Executes the proposed changes on the filesystem
     * @param changes Array of file changes to apply
     * @returns Promise resolving to array of operation results
     */
    applyChanges(changes: FileChange[]): Promise<ProcessResult[]>;

    /**
     * Saves case configuration to .fileorg.json
     * @param workspaceFolder Workspace root URI
     * @param config Case configuration object
     */
    saveCaseConfig(workspaceFolder: URI, config: FileOrgConfig): Promise<void>;

    /**
     * Loads case configuration from .fileorg.json
     * @param workspaceFolder Workspace root URI
     * @returns Promise resolving to config object or null if not found
     */
    loadCaseConfig(workspaceFolder: URI): Promise<FileOrgConfig | null>;

    /**
     * Checks if case configuration exists
     * @param workspaceFolder Workspace root URI
     * @returns Promise resolving to boolean indicating config existence
     */
    caseConfigExists(workspaceFolder: URI): Promise<boolean>;

    /**
     * Loads case information from .caseinfo file
     * @param workspaceFolder Workspace root URI
     * @returns Promise resolving to case info object or null
     */
    loadCaseInfo(workspaceFolder: URI): Promise<any | null>;
}
```

### AI Classification Interface

```typescript
export interface AIFileClassifier {
    /**
     * Classifies a single file using AI analysis
     * @param file File metadata to classify
     * @returns Promise resolving to AI classification result or null
     */
    classifyFile(file: FileMetadata): Promise<AIClassificationResult | null>;

    /**
     * Classifies multiple files using AI analysis
     * @param files Array of file metadata
     * @returns Promise resolving to array of proposed changes
     */
    classifyFiles(files: FileMetadata[]): Promise<FileChange[]>;
}

export interface AIClassificationResult {
    suggestedName: string;
    tags: string[];
    confidence: number;
    reasoning: string;
    projectName?: string;
    fileType?: string;
    version?: string;
}
```

## 📄 Type Definitions

### Core Data Types

#### FileMetadata
Represents metadata extracted from a file during analysis.

```typescript
export interface FileMetadata {
    /** File URI */
    uri: URI;

    /** Filename without extension */
    name: string;

    /** File extension (without leading dot) */
    extension: string;

    /** File size in bytes */
    size: number;

    /** MIME type of the file */
    mimeType: string;

    /** Base64 encoded preview (for images) */
    preview?: string;

    /** Manual classification: 'YourSide' | 'TheirSide' | 'Unknown' */
    classification?: 'YourSide' | 'TheirSide' | 'Unknown';

    /** How the file was classified: 'manual' | 'keyword' | 'folder' */
    classificationMethod?: 'manual' | 'keyword' | 'folder';
}
```

#### FileChange
Represents a proposed change to a file during organization.

```typescript
export interface FileChange {
    /** Original file metadata */
    original: FileMetadata;

    /** Proposed changes */
    proposed: {
        /** New filename */
        name: string;

        /** Tags to assign to the file */
        tags: string[];

        /** Target location URI (if moving) */
        location?: URI;
    };

    /** Confidence score (0.0 to 1.0) */
    confidence: number;

    /** Human-readable reasoning for the change */
    reasoning: string;
}
```

#### ProcessResult
Result of applying a change to the filesystem.

```typescript
export interface ProcessResult {
    /** Whether the operation succeeded */
    success: boolean;

    /** URI of the file that was processed */
    file: URI;

    /** Error message if operation failed */
    error?: string;
}
```

### Rule System Types

#### Rule
Defines a single organization rule.

```typescript
export interface Rule {
    /** Type of rule: 'rename' | 'tag' | 'move' | 'classify' */
    type: 'rename' | 'tag' | 'move' | 'classify';

    /** Pattern for rename rules (optional) */
    pattern?: string;

    /** Conditions that must be met for rule to apply */
    conditions?: Condition[];

    /** Action to perform when rule matches */
    action: RuleAction;
}
```

#### Condition
Defines a condition for rule matching.

```typescript
export interface Condition {
    /** Field to check: 'extension' | 'name' | 'size' | 'mimeType' */
    field: 'extension' | 'name' | 'size' | 'mimeType';

    /** Comparison operator */
    operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan';

    /** Value to compare against */
    value: string | number;
}
```

#### RuleAction
Defines the action to take when a rule matches.

```typescript
export interface RuleAction {
    /** Tags to assign to the file */
    tags?: string[];

    /** Target path relative to workspace (for move operations) */
    targetPath?: string;

    /** Naming pattern for rename operations */
    nameFormat?: string;
}
```

### Configuration Types

#### FileOrgConfig
Main configuration structure stored in `.fileorg.json`.

```typescript
export interface FileOrgConfig {
    /** Configuration version */
    version: '1.0';

    /** Case information */
    caseInfo: CaseInfo;

    /** Organization settings */
    organizationSettings: OrganizationSettings;

    /** Creation timestamp */
    createdAt: string;

    /** Last update timestamp */
    updatedAt: string;
}
```

#### CaseInfo
Detailed case information.

```typescript
export interface CaseInfo {
    /** Case number/reference */
    caseNumber?: string;

    /** Claimant/plaintiff name */
    claimantName?: string;

    /** Injury/incident date */
    injuryDate?: string;

    /** Case type (e.g., 'Workers Compensation') */
    caseType: string;

    /** Case description */
    description?: string;

    /** Party information */
    parties?: CaseParties;

    /** Classification keywords */
    keywords: CaseKeywords;
}
```

#### CaseKeywords
Keyword sets for automatic classification.

```typescript
export interface CaseKeywords {
    /** Keywords indicating claimant's side */
    yourSide: string[];

    /** Keywords indicating defendant's side */
    theirSide: string[];

    /** Medical document keywords */
    medical: string[];

    /** Legal document keywords */
    legal: string[];

    /** Evidence document keywords */
    evidence: string[];
}
```

### UI Component Props

#### FileOrganizerDashboard Props
```typescript
interface FileOrganizerDashboardProps {
    // Component has no external props - uses internal state management
}
```

#### ClassificationReview Props
```typescript
interface ClassificationReviewProps {
    /** Array of files to review */
    files: any[];

    /** Callback when files are updated */
    onFilesUpdate: (files: any[]) => void;
}
```

#### RuleBuilder Props
```typescript
interface RuleBuilderProps {
    /** Current rules configuration */
    rules: any[];

    /** Selected files for preview */
    selectedFiles: any[];

    /** Case information for keyword matching */
    caseInfo?: any;

    /** Manual renames to apply */
    manualRenames?: Record<string, string>;

    /** Callback when rules change */
    onRulesChange: (rules: any[]) => void;

    /** Callback for manual renames */
    onManualRename?: (fileUri: string, newName: string) => void;
}
```

## 🛠️ Service APIs

### File Operations

#### selectFiles()
Opens a native file dialog for file selection.

```typescript
async selectFiles(): Promise<URI[]>
```

**Returns:** Array of selected file URIs

**Throws:** Error if dialog fails to open or user cancels

**Example:**
```typescript
const files = await fileOrganizerService.selectFiles();
// Returns: [URI(file:///path/to/document1.pdf), URI(file:///path/to/document2.docx)]
```

#### analyzeFiles(files)
Analyzes files and extracts metadata.

```typescript
async analyzeFiles(files: URI[]): Promise<FileMetadata[]>
```

**Parameters:**
- `files`: Array of file URIs to analyze

**Returns:** Array of `FileMetadata` objects

**Throws:** Partial failures are logged but don't throw - returns successful analyses

**Example:**
```typescript
const metadata = await fileOrganizerService.analyzeFiles(fileUris);
// Returns: [{
//   uri: URI(...),
//   name: "medical_report",
//   extension: "pdf",
//   size: 245760,
//   mimeType: "application/pdf"
// }]
```

#### previewChanges(files, rules)
Applies rules to files and generates change proposals.

```typescript
async previewChanges(files: FileMetadata[], rules: Rule[]): Promise<FileChange[]>
```

**Parameters:**
- `files`: Array of file metadata
- `rules`: Array of organization rules

**Returns:** Array of proposed changes (only files that would change)

**Example:**
```typescript
const changes = await fileOrganizerService.previewChanges(metadata, rules);
// Returns: [{
//   original: {...},
//   proposed: { name: "Medical_Report_v1.pdf", tags: ["medical"] },
//   confidence: 0.8,
//   reasoning: "Applied medical document rules"
// }]
```

#### applyChanges(changes)
Executes proposed changes on the filesystem.

```typescript
async applyChanges(changes: FileChange[]): Promise<ProcessResult[]>
```

**Parameters:**
- `changes`: Array of changes to apply

**Returns:** Array of operation results

**Safety:** Never overwrites existing files, creates unique names for conflicts

**Example:**
```typescript
const results = await fileOrganizerService.applyChanges(changes);
// Returns: [{
//   success: true,
//   file: URI(...)
// }, {
//   success: false,
//   file: URI(...),
//   error: "Target file already exists"
// }]
```

### Configuration Management

#### saveCaseConfig(workspaceFolder, config)
Saves case configuration to `.fileorg.json`.

```typescript
async saveCaseConfig(workspaceFolder: URI, config: FileOrgConfig): Promise<void>
```

**Parameters:**
- `workspaceFolder`: Workspace root URI
- `config`: Complete configuration object

**Throws:** File system errors

#### loadCaseConfig(workspaceFolder)
Loads case configuration from `.fileorg.json`.

```typescript
async loadCaseConfig(workspaceFolder: URI): Promise<FileOrgConfig | null>
```

**Parameters:**
- `workspaceFolder`: Workspace root URI

**Returns:** Configuration object or `null` if not found

#### caseConfigExists(workspaceFolder)
Checks if case configuration exists.

```typescript
async caseConfigExists(workspaceFolder: URI): Promise<boolean>
```

**Parameters:**
- `workspaceFolder`: Workspace root URI

**Returns:** Boolean indicating file existence

## 🎯 AI Classification API

### classifyFile(file)
Classifies a single file using AI analysis.

```typescript
async classifyFile(file: FileMetadata): Promise<AIClassificationResult | null>
```

**Parameters:**
- `file`: File metadata to classify

**Returns:** AI classification result or `null` if classification fails

**Example:**
```typescript
const result = await aiClassifier.classifyFile(fileMetadata);
// Returns: {
//   suggestedName: "AppRedesign_Wireframe_v2.fig",
//   tags: ["design", "wireframe", "mobile"],
//   confidence: 0.85,
//   reasoning: "Filename suggests design wireframe with version",
//   projectName: "AppRedesign",
//   fileType: "Wireframe",
//   version: "v2"
// }
```

### classifyFiles(files)
Classifies multiple files using AI analysis.

```typescript
async classifyFiles(files: FileMetadata[]): Promise<FileChange[]>
```

**Parameters:**
- `files`: Array of file metadata

**Returns:** Array of proposed changes

## 🚨 Error Handling

### Error Types

**FileSystemError**
- Thrown when file operations fail
- Includes operation type and target path

**ValidationError**
- Thrown when input validation fails
- Includes field name and validation rule

**ConfigurationError**
- Thrown when configuration is invalid
- Includes specific configuration issue

### Error Handling Patterns

```typescript
try {
    const files = await fileOrganizerService.selectFiles();
    const metadata = await fileOrganizerService.analyzeFiles(files);

    // Handle partial failures
    if (metadata.length !== files.length) {
        console.warn('Some files could not be analyzed');
    }

    const changes = await fileOrganizerService.previewChanges(metadata, rules);
    const results = await fileOrganizerService.applyChanges(changes);

    // Check for partial success
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
        console.warn(`${failures.length} files failed to process`);
        failures.forEach(failure => {
            console.error(`Failed: ${failure.file.path} - ${failure.error}`);
        });
    }

} catch (error) {
    if (error instanceof FileSystemError) {
        console.error('File system error:', error.message);
    } else if (error instanceof ValidationError) {
        console.error('Validation error:', error.message);
    } else {
        console.error('Unexpected error:', error);
    }
}
```

### Process Result Analysis

```typescript
const results = await fileOrganizerService.applyChanges(changes);

// Analyze results
const successful = results.filter(r => r.success);
const failed = results.filter(r => !r.success);

console.log(`Processed ${results.length} files: ${successful.length} success, ${failed.length} failed`);

// Detailed failure analysis
failed.forEach(result => {
    console.error(`File: ${result.file.path}`);
    console.error(`Error: ${result.error}`);

    // Attempt recovery based on error type
    if (result.error?.includes('already exists')) {
        // Handle naming conflict
    } else if (result.error?.includes('permission denied')) {
        // Handle permission issue
    }
});
```

## 💡 Examples

### Complete Organization Workflow

```typescript
import { IFileOrganizerService } from './fileOrganizerService';

// Get service instance
const fileOrganizerService = accessor.get(IFileOrganizerService);

// 1. Select files
const selectedFiles = await fileOrganizerService.selectFiles();

// 2. Analyze files
const fileMetadata = await fileOrganizerService.analyzeFiles(selectedFiles);

// 3. Load organization template
const template = getTemplateById('workers-comp-full');

// 4. Preview changes
const proposedChanges = await fileOrganizerService.previewChanges(
    fileMetadata,
    template.rules
);

// 5. Apply changes
const results = await fileOrganizerService.applyChanges(proposedChanges);

// 6. Report results
const successCount = results.filter(r => r.success).length;
const failureCount = results.filter(r => !r.success).length;

console.log(`Organization complete: ${successCount} successful, ${failureCount} failed`);
```

### Custom Rule Creation

```typescript
// Create a custom rule for PDF documents
const pdfRule: Rule = {
    type: 'tag',
    conditions: [
        { field: 'extension', operator: 'equals', value: 'pdf' }
    ],
    action: {
        tags: ['document', 'pdf'],
        targetPath: 'Documents'
    }
};

// Create a naming rule
const namingRule: Rule = {
    type: 'rename',
    conditions: [
        { field: 'name', operator: 'contains', value: 'report' }
    ],
    action: {
        nameFormat: '{ProjectName}_Report_{Date}.pdf'
    }
};

// Apply rules
const rules = [pdfRule, namingRule];
const changes = await fileOrganizerService.previewChanges(files, rules);
```

### Case Configuration Management

```typescript
// Create case configuration
const caseConfig: FileOrgConfig = {
    version: '1.0',
    caseInfo: {
        caseNumber: 'WC-2024-001',
        claimantName: 'John Doe',
        caseType: 'Workers Compensation',
        keywords: {
            yourSide: ['claimant', 'treating', 'personal'],
            theirSide: ['employer', 'wcb', 'ime'],
            medical: ['medical', 'doctor', 'diagnosis'],
            legal: ['legal', 'court', 'decision'],
            evidence: ['evidence', 'study', 'expert']
        }
    },
    organizationSettings: {
        selectedTemplate: 'workers-comp-full',
        preserveOriginalNames: true,
        createBackup: true,
        targetFolder: './organized'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
};

// Save configuration
await fileOrganizerService.saveCaseConfig(workspaceUri, caseConfig);

// Load configuration
const loadedConfig = await fileOrganizerService.loadCaseConfig(workspaceUri);
```

### AI-Assisted Classification

```typescript
import { AIFileClassifier } from './aiClassifier';

// Initialize classifier
const classifier = new AIFileClassifier(llmService, settingsService);

// Classify single file
const singleResult = await classifier.classifyFile(fileMetadata);
if (singleResult) {
    console.log('AI suggests:', singleResult.suggestedName);
    console.log('Tags:', singleResult.tags);
    console.log('Confidence:', singleResult.confidence);
}

// Classify multiple files
const batchResults = await classifier.classifyFiles(fileMetadataArray);
const changes = batchResults.map(result => ({
    original: result.original,
    proposed: {
        name: result.suggestedName,
        tags: result.tags,
        location: result.original.uri
    },
    confidence: result.confidence,
    reasoning: result.reasoning
}));
```

## 🔍 Method Signatures Summary

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `selectFiles()` | - | `Promise<URI[]>` | Open file selection dialog |
| `analyzeFiles(files)` | `URI[]` | `Promise<FileMetadata[]>` | Extract file metadata |
| `previewChanges(files, rules)` | `FileMetadata[], Rule[]` | `Promise<FileChange[]>` | Generate change proposals |
| `applyChanges(changes)` | `FileChange[]` | `Promise<ProcessResult[]>` | Execute file operations |
| `saveCaseConfig(folder, config)` | `URI, FileOrgConfig` | `Promise<void>` | Save configuration |
| `loadCaseConfig(folder)` | `URI` | `Promise<FileOrgConfig \| null>` | Load configuration |
| `caseConfigExists(folder)` | `URI` | `Promise<boolean>` | Check config existence |

---

**Related Topics:**
- [User Guide](user-guide.md) - End-user instructions
- [Developer Guide](developer-guide.md) - Architecture and development
- [Configuration Guide](configuration-guide.md) - Setup and customization
