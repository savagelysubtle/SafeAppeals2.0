# File Organizer System

A comprehensive file organization and classification system designed specifically for legal case management, particularly workers' compensation cases. The system provides both manual and automated file organization capabilities with AI-assisted classification.

## 🎯 Overview

The File Organizer automates the tedious process of organizing legal case documents by:

- **Classifying documents** as "Your Side" vs "Their Side" (claimant vs employer/defense)
- **Applying intelligent naming conventions** based on document types and content
- **Organizing files into structured folders** using customizable templates
- **Supporting AI-powered classification** for advanced automation
- **Integrating with case metadata** for context-aware organization

## 🏗️ Architecture

### Core Components

```
fileOrganizer/
├── fileOrganizerService.ts          # Main business logic & VSCode integration
├── fileOrganizerContribution.ts     # VSCode extension point registration
├── fileOrganizerDashboardPane.ts    # React dashboard container
├── types.ts                         # TypeScript interfaces & types
├── caseConfig.ts                    # Case configuration & AI context
├── aiClassifier.ts                  # AI-powered file classification
├── templates/
│   └── organizationTemplates.ts     # Predefined organization templates
└── react/
    └── src/file-organizer-tsx/      # React UI components
        ├── FileOrganizerDashboard.tsx
        ├── TemplateSelector.tsx
        ├── ClassificationReview.tsx
        ├── RuleBuilder.tsx
        ├── ReviewChanges.tsx
        └── CaseOnboarding.tsx
```

### Key Services

- **IFileOrganizerService**: Core service handling file operations and organization
- **AIFileClassifier**: LLM-powered file analysis and naming suggestions
- **FileOrgConfig**: Case-specific configuration and keyword management

## 🚀 Quick Start

### Basic Usage

1. **Open File Organizer**: `Ctrl+Shift+O` or Command Palette → "Open File Organizer Dashboard"

2. **Choose Template**: Select from predefined templates (Workers Comp, Medical Docs, Legal Docs, etc.)

3. **Select Files**: Choose files to organize, optionally pre-classifying them as "Your Side" or "Their Side"

4. **Review Classifications**: Manually adjust automatic classifications if needed

5. **Configure Rules**: Customize naming patterns and organization rules

6. **Process Files**: Apply changes and organize your documents

### Advanced Setup

For enhanced automation, set up case configuration:

```bash
# Create .fileorg.json in your workspace root
{
  "version": "1.0",
  "caseInfo": {
    "caseNumber": "39573881",
    "claimantName": "John Doe",
    "caseType": "Workers Compensation",
    "keywords": {
      "yourSide": ["claimant", "treating", "personal"],
      "theirSide": ["employer", "wcb", "ime", "defense"],
      "medical": ["medical", "doctor", "diagnosis"],
      "legal": ["legal", "court", "decision"],
      "evidence": ["evidence", "study", "expert"]
    }
  },
  "organizationSettings": {
    "selectedTemplate": "workers-comp-full",
    "targetFolder": "./organized"
  }
}
```

## 📋 Features

### Classification Methods

1. **Manual Classification**: User explicitly assigns files to "Your Side" or "Their Side"
2. **Keyword-Based Auto-Classification**: Automatic detection using filename patterns
3. **Case-Specific Keywords**: Custom keywords from case configuration
4. **AI-Powered Classification**: LLM analysis for intelligent suggestions

### Organization Templates

- **Workers Compensation - Full Case**: Complete case organization
- **Medical Reports Only**: Focus on medical documentation
- **Legal Documents Only**: Court filings and legal correspondence
- **Correspondence & Communications**: Email and letter organization
- **Your Side vs Their Side**: Binary classification approach
- **Chronological Organization**: Date-based organization
- **Quick Sort - AI Assisted**: AI-powered categorization
- **Custom**: Build your own rules

### Safety Features

- **Conflict Prevention**: Never overwrites existing files
- **Unique Naming**: Automatic suffix addition for duplicate names
- **Backup Support**: Optional backup creation
- **Dry Run Preview**: Review all changes before applying
- **Rollback Support**: Detailed error reporting for troubleshooting

## 🎨 User Interface

### 4-Step Organization Wizard

1. **Template & File Selection**
   - Choose organization strategy
   - Select and pre-classify files

2. **Classification Review**
   - Review automatic classifications
   - Bulk reclassify unclassified files
   - Manual override capabilities

3. **Rule Configuration**
   - Customize naming patterns
   - Adjust organization rules
   - Preview pattern effects

4. **Review & Process**
   - Preview all proposed changes
   - Apply organization with progress tracking
   - Detailed results and error reporting

## 🤖 AI Integration

### Context-Aware Classification

The system integrates with Void's AI capabilities to:

- **Analyze filenames** for content and context
- **Suggest appropriate naming** following legal conventions
- **Generate relevant tags** for better organization
- **Extract project names and versions** from filenames
- **Provide confidence scores** for classification suggestions

### Case Context in AI Prompts

When using AI chat features, case information is automatically included:

```
# Case Information

**Case Number:** 39573881
**Claimant:** John Doe
**Case Type:** Workers Compensation

## Classification Keywords
**Your Side:** claimant, treating, personal
**Their Side:** employer, wcb, ime, defense
```

## 🔧 Configuration

### Case Configuration (.fileorg.json)

```json
{
  "version": "1.0",
  "caseInfo": {
    "caseNumber": "CASE-12345",
    "claimantName": "Plaintiff Name",
    "injuryDate": "2024-01-15",
    "caseType": "Workers Compensation",
    "parties": {
      "claimant": {
        "name": "Plaintiff Name",
        "lawyers": ["Attorney Name"],
        "doctors": ["Dr. Treating Physician"]
      },
      "employer": {
        "name": "Defendant Corp",
        "lawyers": ["Defense Attorney"],
        "doctors": ["Dr. IME Physician"]
      },
      "wcb": {
        "adjudicators": ["Adjudicator Name"],
        "references": ["REF-123"]
      }
    },
    "keywords": {
      "yourSide": ["claimant", "treating", "personal"],
      "theirSide": ["employer", "wcb", "ime", "defense"],
      "medical": ["medical", "doctor", "diagnosis", "treatment"],
      "legal": ["legal", "court", "decision", "appeal"],
      "evidence": ["evidence", "study", "research", "expert"]
    }
  },
  "organizationSettings": {
    "selectedTemplate": "workers-comp-full",
    "preserveOriginalNames": true,
    "createBackup": true,
    "targetFolder": "./organized"
  }
}
```

### Naming Patterns

Available pattern variables:
- `{Side}` - YourSide/TheirSide classification
- `{Category}` - Medical/Legal/Evidence category
- `{ProjectName}` - Extracted from filename
- `{FileType}` - Document type (Medical, Legal, etc.)
- `{Version}` - Version number (v1, v2, etc.)
- `{Date}` - Current date (YYYY-MM-DD)
- `{Description}` - Original filename without extension

Example: `{ProjectName}_{FileType}_{Version}_{Side}`

## 📚 API Reference

See [API Reference](api-reference.md) for detailed service interfaces and methods.

## 🛠️ Development

See [Developer Guide](developer-guide.md) for setup instructions, architecture details, and contribution guidelines.

## 📖 User Guide

See [User Guide](user-guide.md) for comprehensive usage instructions and examples.

## 🔍 Troubleshooting

### Common Issues

- **"Cannot find module './react/out/...'"**: Run `bun run buildreact` to compile React components
- **Files not classifying automatically**: Ensure case config has proper keywords
- **AI classification not working**: Check Void settings for LLM configuration
- **Permission errors**: Ensure write access to target directories

### Debug Information

Enable debug logging:
```typescript
console.log('[FileOrganizer]', debugInfo);
```

Check the VSCode developer console (Help → Toggle Developer Tools) for detailed error messages.

## 🤝 Contributing

1. Follow the established code patterns in `src/vs/workbench/contrib/void/browser/fileOrganizer/`
2. Add comprehensive TypeScript types
3. Include error handling and user feedback
4. Update documentation for new features
5. Test with various file types and edge cases

## 📄 License

Licensed under the Apache License, Version 2.0. See LICENSE.txt for details.

---

**Related Documentation:**
- [User Guide](user-guide.md)
- [Developer Guide](developer-guide.md)
- [API Reference](api-reference.md)
- [Configuration Guide](configuration-guide.md)
- [Examples](examples.md)
