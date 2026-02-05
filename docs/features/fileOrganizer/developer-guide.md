# File Organizer Developer Guide

This guide provides technical details for developers working on the File Organizer system, including architecture, APIs, and contribution guidelines.

## 🏗️ System Architecture

### Core Architecture

The File Organizer follows VSCode's extension architecture with clear separation of concerns:

```
fileOrganizer/
├── browser/                    # UI Layer (Renderer Process)
│   ├── fileOrganizerService.ts # Business Logic Service
│   ├── fileOrganizerContribution.ts # VSCode Integration
│   └── react/                  # React UI Components
├── common/                     # Shared Types & Logic
│   ├── types.ts               # TypeScript Interfaces
│   └── caseConfig.ts          # Configuration Types
└── electron-main/             # Backend Services (if needed)
```

### Service Architecture

#### IFileOrganizerService

**Registration Pattern:**
```typescript
export const IFileOrganizerService = createDecorator<IFileOrganizerService>('fileOrganizerService');

// In contribution file:
registerSingleton(IFileOrganizerService, FileOrganizerService, InstantiationType.Delayed);
```

**Dependency Injection:**
```typescript
constructor(
    @IFileService private readonly fileService: IFileService,
    @IFileDialogService private readonly fileDialogService: IFileDialogService,
    @IWorkspaceContextService private readonly contextService: IWorkspaceContextService
) {}
```

### Component Hierarchy

```
FileOrganizerDashboard (Main Container)
├── TemplateSelector (Step 1)
├── ClassificationReview (Step 2)
├── RuleBuilder (Step 3)
└── ReviewChanges (Step 4)
```

## 🔧 Core Services

### FileOrganizerService

**Key Methods:**

```typescript
interface IFileOrganizerService {
    // File Selection & Analysis
    selectFiles(): Promise<URI[]>;
    analyzeFiles(files: URI[]): Promise<FileMetadata[]>;

    // Organization Logic
    previewChanges(files: FileMetadata[], rules: Rule[]): Promise<FileChange[]>;
    applyChanges(changes: FileChange[]): Promise<ProcessResult[]>;

    // Configuration Management
    saveCaseConfig(workspaceFolder: URI, config: FileOrgConfig): Promise<void>;
    loadCaseConfig(workspaceFolder: URI): Promise<FileOrgConfig | null>;
    caseConfigExists(workspaceFolder: URI): Promise<boolean>;
}
```

**File Analysis Process:**
```typescript
async analyzeFiles(files: URI[]): Promise<FileMetadata[]> {
    for (const uri of files) {
        const stat = await this.fileService.stat(uri);
        const name = basename(uri.path);
        const extension = extname(uri.path).slice(1);

        metadata.push({
            uri,
            name,
            extension,
            size: stat.size,
            mimeType: this.getMimeType(extension),
            classification: undefined, // Set later
            classificationMethod: undefined
        });
    }
}
```

### AI Classification Service

**Integration with Void LLM:**
```typescript
constructor(
    private readonly llmMessageService: ILLMMessageService,
    private readonly voidSettingsService: IVoidSettingsService
) {}

async classifyFile(file: FileMetadata): Promise<AIClassificationResult | null> {
    const prompt = this.buildClassificationPrompt(file);

    return new Promise((resolve) => {
        const modelSelection = this.voidSettingsService.state.modelSelectionOfFeature['Chat'];

        this.llmMessageService.sendLLMMessage({
            messagesType: 'chatMessages',
            messages: [{
                role: 'system',
                content: 'You are a file organization assistant...'
            }, {
                role: 'user',
                content: prompt
            }],
            // ... streaming response handling
        });
    });
}
```

## 🎨 React Component Architecture

### Component Structure

**FileOrganizerDashboard.tsx** - Main orchestrator component
- Manages 4-step wizard state
- Coordinates between child components
- Handles case info loading

**TemplateSelector.tsx** - Template and file selection
- Displays available organization templates
- Handles file selection with pre-classification
- Manages template selection logic

**ClassificationReview.tsx** - Manual classification override
- Shows classification statistics
- Provides bulk operations for unclassified files
- Individual file classification controls

**RuleBuilder.tsx** - Rule customization interface
- Pattern preview functionality
- Rule editing capabilities
- Real-time validation

**ReviewChanges.tsx** - Final review and execution
- Change preview with confidence scores
- Batch processing with progress tracking
- Error handling and rollback

### State Management

**Local Component State:**
```typescript
const [currentStep, setCurrentStep] = useState(0);
const [selectedFiles, setSelectedFiles] = useState<any[]>([]);
const [proposedChanges, setProposedChanges] = useState<any[]>([]);
const [manualRenames, setManualRenames] = useState<Record<string, string>>({});
```

**Service Integration:**
```typescript
const fileOrganizerService = useMemo(() => {
    try {
        return accessor.get("IFileOrganizerService");
    } catch (error) {
        console.error("[Component] Service not available:", error);
        return null;
    }
}, [accessor]);
```

## 📋 Rule Engine

### Rule Structure

```typescript
interface Rule {
    type: 'rename' | 'tag' | 'move' | 'classify';
    pattern?: string;           // For rename rules
    conditions?: Condition[];   // Match criteria
    action: RuleAction;         // What to do when matched
}

interface Condition {
    field: 'extension' | 'name' | 'size' | 'mimeType';
    operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan';
    value: string | number;
}

interface RuleAction {
    tags?: string[];           // Tags to add
    targetPath?: string;       // Where to move file
    nameFormat?: string;       // Naming pattern
}
```

### Rule Processing Logic

```typescript
private applyRulesToFile(file: FileMetadata, rules: Rule[]): FileChange | null {
    let proposedName = file.name;
    const tags: string[] = [];
    let targetFolder: string | undefined;

    for (const rule of rules) {
        if (rule.conditions && !this.matchesConditions(file, rule.conditions)) {
            continue; // Skip rules that don't match
        }

        // Apply rule actions
        switch (rule.type) {
            case 'rename':
                if (rule.action.nameFormat) {
                    proposedName = this.applyNamingPattern(file, rule.action.nameFormat);
                }
                break;
            case 'tag':
                if (rule.action.tags) {
                    tags.push(...rule.action.tags);
                }
                if (rule.action.targetPath) {
                    targetFolder = rule.action.targetPath;
                }
                break;
        }
    }

    // Return change if anything was modified
    if (proposedName !== file.name || tags.length > 0 || targetFolder) {
        return {
            original: file,
            proposed: { name: proposedName, tags, location: targetLocation },
            confidence: 0.8,
            reasoning: `Applied ${rules.length} rules`
        };
    }

    return null;
}
```

## 🧪 Testing Strategy

### Unit Testing

**Service Testing:**
```typescript
// Test file analysis
describe('FileOrganizerService', () => {
    let service: FileOrganizerService;

    beforeEach(() => {
        // Mock dependencies
        const fileService = mock<IFileService>();
        const dialogService = mock<IFileDialogService>();
        const contextService = mock<IWorkspaceContextService>();

        service = new FileOrganizerService(
            fileService,
            dialogService,
            contextService
        );
    });

    it('should analyze files correctly', async () => {
        // Test implementation
    });
});
```

**Rule Engine Testing:**
```typescript
describe('Rule Engine', () => {
    it('should apply rename rules', () => {
        const rule: Rule = {
            type: 'rename',
            conditions: [{ field: 'extension', operator: 'equals', value: 'pdf' }],
            action: { nameFormat: '{ProjectName}_{FileType}_{Version}' }
        };

        const result = service.applyRulesToFile(file, [rule]);
        expect(result?.proposed.name).toMatch(expectedPattern);
    });
});
```

### Integration Testing

**Full Workflow Testing:**
```typescript
describe('Organization Workflow', () => {
    it('should complete full organization process', async () => {
        // 1. Select files
        const files = await service.selectFiles();

        // 2. Analyze files
        const metadata = await service.analyzeFiles(files);

        // 3. Apply rules
        const changes = await service.previewChanges(metadata, rules);

        // 4. Apply changes
        const results = await service.applyChanges(changes);

        // Verify results
        expect(results.every(r => r.success)).toBe(true);
    });
});
```

### UI Testing

**Component Testing:**
```typescript
describe('FileOrganizerDashboard', () => {
    it('should render all steps', () => {
        render(<FileOrganizerDashboard />);

        expect(screen.getByText('Choose Template & Files')).toBeInTheDocument();
        expect(screen.getByText('Review Classifications')).toBeInTheDocument();
    });

    it('should handle step navigation', () => {
        render(<FileOrganizerDashboard />);

        const nextButton = screen.getByText('Next');
        fireEvent.click(nextButton);

        expect(screen.getByText('Review Classifications')).toBeVisible();
    });
});
```

## 🚀 Performance Optimization

### File Processing Optimization

**Batch Processing:**
```typescript
async previewChanges(files: FileMetadata[], rules: Rule[]): Promise<FileChange[]> {
    const changes: FileChange[] = [];
    const BATCH_SIZE = 50;

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const batchChanges = await Promise.all(
            batch.map(file => this.processFileRules(file, rules))
        );
        changes.push(...batchChanges.filter(Boolean));
    }

    return changes;
}
```

**Memory Management:**
```typescript
// Stream processing for large file sets
async analyzeFiles(files: URI[]): Promise<FileMetadata[]> {
    const metadata: FileMetadata[] = [];
    const errors: string[] = [];

    for (const uri of files) {
        try {
            // Process one file at a time to manage memory
            const fileMetadata = await this.analyzeSingleFile(uri);
            metadata.push(fileMetadata);
        } catch (error) {
            errors.push(`Failed to analyze ${uri.toString()}: ${error.message}`);
        }
    }

    return metadata;
}
```

### UI Performance

**Virtual Scrolling for Large Lists:**
```typescript
// For file lists with 100+ items
const VirtualizedFileList = ({ files, onClassify }) => {
    return (
        <FixedSizeList
            height={400}
            itemCount={files.length}
            itemSize={50}
        >
            {({ index, style }) => (
                <FileRow
                    style={style}
                    file={files[index]}
                    onClassify={onClassify}
                />
            )}
        </FixedSizeList>
    );
};
```

**Debounced Operations:**
```typescript
const debouncedPreview = useCallback(
    debounce((pattern: string) => {
        // Update preview with new pattern
        setPreviewPattern(pattern);
    }, 300),
    []
);
```

## 🔒 Security Considerations

### File System Access

**Safe File Operations:**
```typescript
async applyChanges(changes: FileChange[]): Promise<ProcessResult[]> {
    for (const change of changes) {
        // Always check target exists before moving
        const targetExists = await this.fileService.exists(change.proposed.location);
        if (targetExists) {
            // Check if it's the same file (rename only)
            const isSameFile = change.original.uri.toString() === newUri.toString();

            if (!isSameFile) {
                return {
                    success: false,
                    file: change.original.uri,
                    error: 'Target file already exists'
                };
            }
        }

        // Use VSCode's safe move operation
        await this.fileService.move(change.original.uri, newUri, false);
    }
}
```

**Path Traversal Protection:**
```typescript
private validatePath(path: string): boolean {
    // Prevent directory traversal attacks
    const normalized = path.normalize();
    return !normalized.includes('..') && !normalized.startsWith('/');
}
```

### Data Validation

**Input Sanitization:**
```typescript
private sanitizeFilename(name: string): string {
    // Remove dangerous characters
    return name.replace(/[<>:"|?*]/g, '_');
}
```

## 📊 Monitoring & Debugging

### Logging Strategy

**Structured Logging:**
```typescript
private logger = {
    info: (message: string, data?: any) => {
        console.log(`[FileOrganizer] ${message}`, data);
    },
    error: (message: string, error?: Error) => {
        console.error(`[FileOrganizer] ${message}`, error);
        // Send to telemetry if available
        this.telemetryService?.publicLog('fileOrganizer.error', {
            message,
            stack: error?.stack
        });
    }
};
```

**Performance Monitoring:**
```typescript
async applyChanges(changes: FileChange[]): Promise<ProcessResult[]> {
    const startTime = performance.now();
    this.logger.info(`Starting batch processing of ${changes.length} files`);

    try {
        const results = await this.processBatch(changes);

        const duration = performance.now() - startTime;
        this.logger.info(`Batch processing completed in ${duration}ms`, {
            successCount: results.filter(r => r.success).length,
            errorCount: results.filter(r => !r.success).length
        });

        return results;
    } catch (error) {
        this.logger.error('Batch processing failed', error);
        throw error;
    }
}
```

### Error Tracking

**Comprehensive Error Handling:**
```typescript
async applyChanges(changes: FileChange[]): Promise<ProcessResult[]> {
    const results: ProcessResult[] = [];

    for (const change of changes) {
        try {
            await this.applySingleChange(change);
            results.push({
                success: true,
                file: change.original.uri
            });
        } catch (error) {
            const errorResult = {
                success: false,
                file: change.original.uri,
                error: error instanceof Error ? error.message : String(error)
            };
            results.push(errorResult);

            // Log for debugging
            this.logger.error(`Failed to apply change to ${change.original.uri.path}`, error);
        }
    }

    return results;
}
```

## 🤝 Contributing Guidelines

### Code Standards

**TypeScript Guidelines:**
- Use strict null checks (`strictNullChecks: true`)
- Prefer `const` over `let`, avoid `any` types
- Use proper dependency injection patterns
- Follow VSCode's naming conventions (`bOfA` pattern for maps)

**React Best Practices:**
- Use functional components with hooks
- Implement proper error boundaries
- Follow accessibility guidelines (ARIA labels, keyboard navigation)
- Use VSCode's CSS variables for theming

### Pull Request Process

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/file-organizer-enhancement
   ```

2. **Implement Changes**
   - Follow existing code patterns
   - Add comprehensive tests
   - Update documentation
   - Ensure TypeScript compilation

3. **Testing**
   ```bash
   # Type checking
   cd src && bunx tsc --skipLibCheck

   # React compilation
   bun run buildreact

   # Unit tests (if available)
   bun run test-node
   ```

4. **Documentation**
   - Update user guide for new features
   - Add API documentation for new methods
   - Include examples for complex features

5. **Code Review**
   - Ensure proper error handling
   - Verify performance implications
   - Check security considerations

### Adding New Templates

```typescript
// In organizationTemplates.ts
{
    id: 'custom-template',
    name: 'Custom Template Name',
    description: 'Description of what this template does',
    icon: '$(icon-name)',
    rules: [
        {
            type: 'tag',
            conditions: [
                { field: 'extension', operator: 'equals', value: 'pdf' }
            ],
            action: {
                tags: ['document'],
                targetPath: 'Documents'
            }
        }
    ]
}
```

### Adding New Rule Types

1. **Update Types** (`types.ts`):
   ```typescript
   export type RuleType = 'rename' | 'tag' | 'move' | 'classify' | 'newType';

   export interface NewRuleAction extends RuleAction {
       newProperty?: string;
   }
   ```

2. **Update Processing Logic** (`fileOrganizerService.ts`):
   ```typescript
   case 'newType':
       // Implement new rule logic
       break;
   ```

3. **Update UI Components** (`RuleBuilder.tsx`):
   - Add UI controls for new rule type
   - Implement validation logic
   - Update preview functionality

## 🚀 Future Enhancements

### Planned Features

- **Bulk File Import**: Support for importing from external systems
- **Template Marketplace**: Community-contributed organization templates
- **Advanced AI Features**: Multi-file analysis and cross-reference detection
- **Integration APIs**: REST APIs for external system integration
- **Audit Trail**: Complete change history and rollback capabilities

### Architecture Improvements

- **Plugin System**: Extensible rule engine with custom plugins
- **Distributed Processing**: Support for large-scale file organization
- **Real-time Collaboration**: Multi-user organization sessions
- **Machine Learning**: Adaptive organization based on user patterns

---

**Related Topics:**
- [API Reference](api-reference.md) - Complete API documentation
- [Configuration Guide](configuration-guide.md) - Setup and configuration
- [User Guide](user-guide.md) - End-user documentation
