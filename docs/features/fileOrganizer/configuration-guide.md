# File Organizer Configuration Guide

This guide covers how to configure and customize the File Organizer system for different case types, workflows, and organizational needs.

## 📋 Configuration Overview

The File Organizer supports multiple levels of configuration:

1. **Case Configuration** (`.fileorg.json`) - Case-specific settings and keywords
2. **Organization Templates** - Predefined rule sets for different document types
3. **Custom Rules** - User-defined organization rules
4. **Naming Patterns** - Customizable file naming conventions

## 🔧 Case Configuration (.fileorg.json)

### Creating Case Configuration

The case configuration file is automatically created during the case onboarding process, but can also be created manually:

```json
{
  "version": "1.0",
  "caseInfo": {
    "caseNumber": "WC-2024-001",
    "claimantName": "John Doe",
    "injuryDate": "2024-01-15",
    "caseType": "Workers Compensation",
    "description": "Slip and fall injury at workplace",
    "parties": {
      "claimant": {
        "name": "John Doe",
        "lawyers": ["Sarah Johnson", "Mike Chen"],
        "doctors": ["Dr. Emily Carter", "Dr. Robert Smith"],
        "advocate": ["Jane Wilson"]
      },
      "employer": {
        "name": "ABC Manufacturing Corp",
        "lawyers": ["David Brown", "Lisa Davis"],
        "doctors": ["Dr. Michael IME"],
        "caseManager": ["Tom Anderson"],
        "reviewOfficer": ["Karen White"]
      },
      "wcb": {
        "adjudicators": ["Judge Patricia Lee"],
        "references": ["WCB-REF-2024-001", "ADJ-12345"]
      }
    },
    "keywords": {
      "yourSide": [
        "claimant", "plaintiff", "injured worker", "employee",
        "personal", "my", "treating", "treating physician",
        "attorney", "counsel", "lawyer"
      ],
      "theirSide": [
        "employer", "defendant", "wcb", "workers comp", "insurance",
        "ime", "independent medical exam", "defense", "respondents",
        "case manager", "review officer", "adjudicator"
      ],
      "medical": [
        "medical", "doctor", "physician", "diagnosis", "treatment",
        "hospital", "clinic", "mri", "xray", "ct scan", "surgery",
        "medication", "prescription", "therapy", "rehabilitation"
      ],
      "legal": [
        "legal", "court", "decision", "ruling", "judgment", "appeal",
        "motion", "filing", "petition", "complaint", "answer",
        "discovery", "deposition", "hearing", "trial"
      ],
      "evidence": [
        "evidence", "study", "research", "expert", "witness",
        "report", "analysis", "data", "statistics", "documentation"
      ]
    }
  },
  "organizationSettings": {
    "selectedTemplate": "workers-comp-full",
    "preserveOriginalNames": true,
    "createBackup": true,
    "targetFolder": "./organized"
  },
  "createdAt": "2024-12-17T10:00:00.000Z",
  "updatedAt": "2024-12-17T10:00:00.000Z"
}
```

### Case Information Fields

#### Basic Case Details

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `caseNumber` | string | Unique case identifier | "WC-2024-001" |
| `claimantName` | string | Plaintiff/claimant full name | "John Doe" |
| `injuryDate` | string | Date of incident (ISO format) | "2024-01-15" |
| `caseType` | string | Type of case | "Workers Compensation" |
| `description` | string | Brief case description | "Slip and fall injury" |

#### Party Information

**Claimant/Plaintiff Side:**
```json
{
  "claimant": {
    "name": "John Doe",
    "lawyers": ["Sarah Johnson", "Mike Chen"],
    "doctors": ["Dr. Emily Carter"],
    "advocate": ["Jane Wilson"],
    "caseManager": ["Bob Wilson"]
  }
}
```

**Employer/Defendant Side:**
```json
{
  "employer": {
    "name": "ABC Manufacturing Corp",
    "lawyers": ["David Brown"],
    "doctors": ["Dr. Michael IME"],
    "caseManager": ["Tom Anderson"],
    "reviewOfficer": ["Karen White"],
    "employerRepresentative": ["Susan Miller"]
  }
}
```

**Government/Board Side (WCB):**
```json
{
  "wcb": {
    "adjudicators": ["Judge Patricia Lee"],
    "references": ["WCB-REF-2024-001", "ADJ-12345"]
  }
}
```

### Keyword Configuration

Keywords are used for automatic file classification. The system looks for these words in filenames to determine:

- **Which side** the document belongs to (Your Side vs Their Side)
- **What type** of document it is (Medical, Legal, Evidence)

#### Keyword Matching Rules

1. **Case-sensitive matching**: Keywords are matched case-insensitively
2. **Partial matching**: "medical" matches "Medical_Report.pdf"
3. **Priority**: Manual classification > Case keywords > Default keywords
4. **Multiple categories**: A file can match multiple keyword categories

#### Customizing Keywords

**For Personal Injury Cases:**
```json
{
  "yourSide": ["plaintiff", "claimant", "injured", "victim"],
  "theirSide": ["defendant", "insurance", "adjuster", "defense"],
  "medical": ["hospital", "emergency", "ambulance", "surgery"],
  "legal": ["complaint", "answer", "discovery", "deposition"],
  "evidence": ["accident", "scene", "witness", "photograph"]
}
```

**For Employment Cases:**
```json
{
  "yourSide": ["employee", "plaintiff", "former employee"],
  "theirSide": ["employer", "company", "hr", "management"],
  "legal": ["wrongful termination", "discrimination", "harassment"],
  "evidence": ["email", "memo", "policy", "handbook"]
}
```

## 🗂️ Organization Templates

### Built-in Templates

#### Workers Compensation - Full Case
**Purpose:** Complete organization for workers' compensation cases
**Folders Created:**
- `Medical/` - Treatment records, doctor reports, test results
- `Legal/` - Court filings, decisions, correspondence
- `Correspondence/` - Email communications, letters
- `Decisions/` - Board decisions, rulings, orders
- `Evidence/` - Expert reports, studies, research

#### Medical Reports Only
**Purpose:** Focus on medical documentation organization
**Categories:**
- Initial reports and evaluations
- Treatment records and progress notes
- Diagnostic imaging (MRI, X-ray, CT)
- Specialist consultations
- Medication and therapy records

#### Legal Documents Only
**Purpose:** Court document management
**Categories:**
- Initial filings (complaints, petitions)
- Motions and responses
- Discovery documents
- Hearing transcripts
- Appellate documents

#### Correspondence & Communications
**Purpose:** Communication management
**Categories:**
- Attorney-client communications
- Insurance correspondence
- Medical provider letters
- Court notifications
- Settlement discussions

#### Your Side vs Their Side
**Purpose:** Binary classification workflow
**Structure:**
- `YourSide/` - All claimant/plaintiff documents
- `TheirSide/` - All defendant/employer documents
**Sub-folders:** Created based on document types within each side

#### Chronological Organization
**Purpose:** Timeline-based case review
**Structure:** Files organized by date with minimal categorization
**Naming:** Preserves original names with date prefixes

#### Quick Sort - AI Assisted
**Purpose:** Fast organization with AI analysis
**Features:**
- AI-powered filename analysis
- Automatic tag generation
- Confidence scoring
- Fallback to keyword matching

### Custom Template Creation

Templates are defined in `organizationTemplates.ts`:

```typescript
{
  id: 'custom-civil-litigation',
  name: 'Civil Litigation - General',
  description: 'Organization template for general civil litigation cases',
  icon: '$(law)',
  rules: [
    {
      type: 'tag',
      conditions: [
        { field: 'name', operator: 'contains', value: 'complaint' }
      ],
      action: {
        tags: ['legal', 'initial-filing'],
        targetPath: 'Legal/Initial Filings'
      }
    },
    {
      type: 'tag',
      conditions: [
        { field: 'name', operator: 'contains', value: 'deposition' }
      ],
      action: {
        tags: ['legal', 'discovery', 'testimony'],
        targetPath: 'Legal/Discovery'
      }
    }
  ]
}
```

## 🎯 Custom Rules

### Rule Structure

Each rule consists of:
1. **Type**: What action to perform
2. **Conditions**: When to apply the rule
3. **Action**: What to do when conditions are met

### Rule Types

#### 1. Rename Rules
```typescript
{
  type: 'rename',
  conditions: [
    { field: 'extension', operator: 'equals', value: 'pdf' }
  ],
  action: {
    nameFormat: '{ProjectName}_{FileType}_{Date}.pdf'
  }
}
```

#### 2. Tag Rules
```typescript
{
  type: 'tag',
  conditions: [
    { field: 'name', operator: 'contains', value: 'medical' }
  ],
  action: {
    tags: ['medical', 'case-document'],
    targetPath: 'Medical'
  }
}
```

#### 3. Move Rules
```typescript
{
  type: 'move',
  conditions: [
    { field: 'size', operator: 'greaterThan', value: 1048576 } // > 1MB
  ],
  action: {
    targetPath: 'Large Files'
  }
}
```

#### 4. Classify Rules
```typescript
{
  type: 'classify',
  conditions: [
    { field: 'name', operator: 'contains', value: 'defense' }
  ],
  action: {
    // Sets classification to 'TheirSide'
  }
}
```

### Advanced Conditions

#### Multiple Conditions (AND logic)
```typescript
{
  type: 'tag',
  conditions: [
    { field: 'extension', operator: 'equals', value: 'pdf' },
    { field: 'name', operator: 'contains', value: 'report' },
    { field: 'size', operator: 'lessThan', value: 5242880 } // < 5MB
  ],
  action: {
    tags: ['small-report'],
    targetPath: 'Reports/Small'
  }
}
```

#### Complex Filename Patterns
```typescript
{
  type: 'tag',
  conditions: [
    { field: 'name', operator: 'startsWith', value: 'DOE_V_' }
  ],
  action: {
    tags: ['versioned', 'draft'],
    targetPath: 'Drafts'
  }
}
```

## 🏷️ Naming Patterns

### Available Variables

| Variable | Description | Example Output |
|----------|-------------|----------------|
| `{Side}` | YourSide/TheirSide | "YourSide" |
| `{Category}` | Medical/Legal/Evidence | "Medical" |
| `{ProjectName}` | Auto-extracted from filename | "Smith_Case" |
| `{FileType}` | Document type classification | "Report" |
| `{Version}` | Version number (auto-detected) | "v2" |
| `{Date}` | Current date | "2024-12-17" |
| `{YYYY-MM-DD}` | Formatted date | "2024-12-17" |
| `{Description}` | Original filename | "medical_report_january" |
| `{Name}` | Original filename | "medical_report_january" |

### Pattern Examples

#### Legal Case Naming
```
{Side}_{Category}_{Description}_{Date}.pdf
// Output: "YourSide_Medical_Doctor_Report_2024-12-17.pdf"
```

#### Version-Controlled Documents
```
{ProjectName}_{FileType}_{Version}_{Side}.docx
// Output: "Smith_Deposition_v2_YourSide.docx"
```

#### Date-Based Organization
```
{Date}_{Category}_{Description}.{extension}
// Output: "2024-12-17_Medical_XRay_Results.pdf"
```

#### Custom Case-Specific Patterns
```
{CaseNumber}_{Side}_{Category}_{Description}.{extension}
// Output: "WC-2024-001_YourSide_Legal_Motion_to_Compel.pdf"
```

## ⚙️ Organization Settings

### Core Settings

```json
{
  "organizationSettings": {
    "selectedTemplate": "workers-comp-full",
    "preserveOriginalNames": true,
    "createBackup": true,
    "targetFolder": "./organized"
  }
}
```

#### Setting Descriptions

| Setting | Type | Description | Default |
|---------|------|-------------|---------|
| `selectedTemplate` | string | Default organization template | "workers-comp-full" |
| `preserveOriginalNames` | boolean | Keep original filenames | true |
| `createBackup` | boolean | Create backup before organizing | true |
| `targetFolder` | string | Root folder for organized files | "./organized" |

### Advanced Configuration

#### Backup Configuration
```json
{
  "organizationSettings": {
    "createBackup": true,
    "backupFolder": "./backups/{Date}",
    "backupRetentionDays": 30
  }
}
```

#### Performance Settings
```json
{
  "organizationSettings": {
    "batchSize": 50,
    "parallelProcessing": true,
    "skipLargeFiles": false,
    "maxFileSizeMB": 100
  }
}
```

## 🔄 Case-Specific Configurations

### Workers' Compensation Cases

```json
{
  "caseInfo": {
    "caseType": "Workers Compensation",
    "keywords": {
      "yourSide": ["claimant", "injured worker", "employee"],
      "theirSide": ["employer", "wcb", "insurance carrier"],
      "medical": ["treating physician", "medical report", "treatment"],
      "legal": ["appeal", "hearing", "board decision"],
      "evidence": ["accident report", "witness statement"]
    }
  },
  "organizationSettings": {
    "selectedTemplate": "workers-comp-full",
    "targetFolder": "./organized-wc-case"
  }
}
```

### Personal Injury Cases

```json
{
  "caseInfo": {
    "caseType": "Personal Injury",
    "keywords": {
      "yourSide": ["plaintiff", "injured party", "victim"],
      "theirSide": ["defendant", "insurance", "negligence"],
      "medical": ["emergency room", "ambulance", "hospital"],
      "legal": ["complaint", "liability", "damages"],
      "evidence": ["accident scene", "police report", "photographs"]
    }
  },
  "organizationSettings": {
    "selectedTemplate": "civil-litigation-full"
  }
}
```

### Employment Discrimination Cases

```json
{
  "caseInfo": {
    "caseType": "Employment Discrimination",
    "keywords": {
      "yourSide": ["employee", "plaintiff", "former employee"],
      "theirSide": ["employer", "company", "hr department"],
      "legal": ["eeoc", "discrimination", "wrongful termination"],
      "evidence": ["email", "performance review", "policy"]
    }
  },
  "organizationSettings": {
    "selectedTemplate": "employment-case"
  }
}
```

## 🔧 Custom Template Development

### Template Structure

```typescript
export interface OrganizationTemplate {
  id: string;                    // Unique identifier
  name: string;                  // Display name
  description: string;           // Detailed description
  icon: string;                  // VSCode codicon
  rules: Rule[];                // Organization rules
}
```

### Adding Custom Templates

1. **Create template definition:**
```typescript
const myCustomTemplate: OrganizationTemplate = {
  id: 'my-custom-template',
  name: 'My Custom Organization',
  description: 'Custom organization for specific case type',
  icon: '$(folder)',
  rules: [
    // Define your rules here
  ]
};
```

2. **Add to template registry:**
```typescript
export const ORGANIZATION_TEMPLATES: OrganizationTemplate[] = [
  // ... existing templates
  myCustomTemplate
];
```

3. **Test the template:**
```typescript
// Test with sample files
const testFiles = await fileOrganizerService.analyzeFiles(testUris);
const changes = await fileOrganizerService.previewChanges(testFiles, myCustomTemplate.rules);
```

### Template Best Practices

1. **Start Simple**: Begin with basic categorization rules
2. **Use Specific Conditions**: Make rules as targeted as possible
3. **Include Fallbacks**: Have catch-all rules for unclassified files
4. **Test Thoroughly**: Test with various filename patterns
5. **Document Clearly**: Provide clear descriptions of what each rule does

## 🚀 Advanced Configuration

### Multi-Case Support

For handling multiple cases in one workspace:

```json
{
  "caseInfo": {
    "caseNumber": "MULTI-001",
    "caseType": "Multiple Cases",
    "subCases": [
      {
        "id": "wc-2024-001",
        "name": "Workers Comp Case",
        "keywords": { /* specific keywords */ }
      },
      {
        "id": "pi-2024-002",
        "name": "Personal Injury Case",
        "keywords": { /* specific keywords */ }
      }
    ]
  }
}
```

### Integration with External Systems

#### Document Management Systems
```json
{
  "organizationSettings": {
    "externalIntegration": {
      "enabled": true,
      "system": "netdocuments",
      "apiKey": "your-api-key",
      "workspaceId": "case-workspace-id"
    }
  }
}
```

#### Version Control Integration
```json
{
  "organizationSettings": {
    "gitIntegration": {
      "enabled": true,
      "autoCommit": true,
      "commitMessage": "Organize case documents - {Date}"
    }
  }
}
```

## 🔍 Troubleshooting Configuration

### Common Configuration Issues

**Keywords not matching:**
- Check case sensitivity
- Verify keyword spelling
- Test with sample filenames

**Rules not applying:**
- Validate condition syntax
- Check operator usage
- Test conditions individually

**Templates not loading:**
- Verify template ID uniqueness
- Check template registration
- Validate rule syntax

### Configuration Validation

```typescript
// Validate case configuration
function validateCaseConfig(config: FileOrgConfig): string[] {
  const errors: string[] = [];

  if (!config.caseInfo.caseType) {
    errors.push('Case type is required');
  }

  if (!config.caseInfo.keywords.yourSide?.length) {
    errors.push('Your side keywords are required');
  }

  // Add more validation rules
  return errors;
}
```

### Debugging Configuration

Enable debug logging for configuration issues:

```typescript
// In fileOrganizerService.ts
private logger = {
  debug: (message: string, data?: any) => {
    if (process.env.FILE_ORG_DEBUG) {
      console.log(`[FileOrg Debug] ${message}`, data);
    }
  }
};
```

---

**Related Topics:**
- [User Guide](user-guide.md) - Basic usage instructions
- [API Reference](api-reference.md) - Technical API details
- [Examples](examples.md) - Configuration examples
