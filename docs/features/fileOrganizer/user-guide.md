# File Organizer User Guide

This guide provides comprehensive instructions for using the File Organizer system to manage legal case documents efficiently.

## 🎯 Getting Started

### Accessing the File Organizer

**Method 1: Keyboard Shortcut**
- Press `Ctrl+Shift+O` (Windows/Linux) or `Cmd+Shift+O` (macOS)

**Method 2: Command Palette**
1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type "Open File Organizer Dashboard"
3. Select the command

**Method 3: Activity Bar**
- Look for the folder icon (📁) in the left sidebar
- Click to open the File Organizer panel

## 📋 Basic Usage Workflow

### Step 1: Choose Template & Select Files

1. **Select Organization Template**
   - Choose from predefined templates based on your needs:
     - **Workers Compensation - Full Case**: Complete case organization
     - **Medical Reports Only**: Medical documentation focus
     - **Legal Documents Only**: Court documents and filings
     - **Your Side vs Their Side**: Binary classification
     - **Quick Sort - AI Assisted**: AI-powered organization

2. **Select Files to Organize**
   - Click "Select Your Side Files" to choose claimant/treating documents
   - Click "Select Their Side Files" to choose employer/WCB/defense documents
   - Files are automatically pre-classified based on selection method

### Step 2: Review Classifications

1. **View Classification Summary**
   - See counts of files in each category (Your Side, Their Side, Unclassified)
   - Review automatic classifications applied during file selection

2. **Handle Unclassified Files**
   - Unclassified files appear in a warning section
   - Use "Select All Unclassified" to bulk select
   - Use "Assign to Your Side" or "Assign to Their Side" for bulk classification
   - Or manually classify individual files using the dropdown

3. **Manual Overrides**
   - Click individual files to change their classification
   - All changes are tracked with `classificationMethod: 'manual'`

### Step 3: Configure Organization Rules

1. **Adjust Naming Patterns**
   - Modify the naming pattern using available variables:
     - `{Side}`: YourSide or TheirSide
     - `{Category}`: Medical, Legal, Evidence
     - `{ProjectName}`: Auto-extracted from filename
     - `{FileType}`: Document type classification
     - `{Version}`: Version number (auto-detected)
     - `{Date}`: Current date
     - `{Description}`: Original filename

2. **Preview Pattern Effects**
   - See how patterns affect your files in real-time
   - Example: `{ProjectName}_{FileType}_{Version}_{Side}.pdf`

3. **Customize Rules**
   - Templates come with predefined rules
   - Modify conditions, actions, and target paths as needed

### Step 4: Review & Apply Changes

1. **Preview All Changes**
   - Review every proposed file move/rename
   - See confidence scores for AI-assisted changes
   - Check for potential conflicts

2. **Apply Organization**
   - Click "Process Files" to execute changes
   - Monitor progress with real-time updates
   - Review results and any errors

## 🎨 Advanced Features

### Case Configuration Setup

For enhanced automation, set up case-specific information:

1. **First-Time Setup**
   - File Organizer detects no existing case config
   - Launches Case Onboarding wizard automatically

2. **Case Onboarding Steps**
   - **Basic Info**: Case number, claimant name, injury date, case type
   - **Your Side**: Your lawyers and treating physicians
   - **Their Side**: Employer info, defense lawyers, IME doctors, WCB details
   - **Keywords**: Custom keywords for auto-classification

3. **Generated Configuration**
   - Creates `.fileorg.json` in workspace root
   - Enables context-aware AI integration
   - Provides custom keywords for classification

### AI-Powered Classification

The **"Quick Sort - AI Assisted"** template provides:

- **Intelligent Analysis**: LLM examines filenames for content and context
- **Smart Naming**: Suggests professional naming conventions
- **Tag Generation**: Creates 3-5 relevant tags per file
- **Confidence Scoring**: Rates classification certainty
- **Fallback Support**: Works even when AI is unavailable

### Manual Rule Building

Create custom organization rules:

1. **Rule Types**
   - **Rename**: Apply naming patterns
   - **Tag**: Add metadata tags
   - **Move**: Change file location
   - **Classify**: Set side/category classification

2. **Rule Conditions**
   - **Field-based**: filename, extension, size, mime type
   - **Operators**: equals, contains, startsWith, endsWith, greaterThan, lessThan

3. **Rule Actions**
   - **Tags**: Add multiple tags
   - **Target Path**: Set destination folder
   - **Name Format**: Apply naming pattern

## 📁 Organization Templates

### Workers Compensation - Full Case
**Best for**: Complete case file organization
**Creates folders**: Medical/, Legal/, Decisions/, Correspondence/, Evidence/
**Naming**: `{Description}_{Side}` with automatic categorization

### Medical Reports Only
**Best for**: Medical documentation management
**Categories**: Initial reports, treatment records, diagnostic tests
**Keywords**: medical, doctor, physician, diagnosis, treatment, mri, xray

### Legal Documents Only
**Best for**: Court filings and legal correspondence
**Categories**: Filings, motions, judgments, attorney correspondence
**Keywords**: filing, motion, judgment, attorney, appeal

### Correspondence & Communications
**Best for**: Email and letter management
**Categories**: By sender/recipient type (insurance, employer, WCB)
**File types**: .eml, .msg, .pdf correspondence

### Your Side vs Their Side
**Best for**: Binary classification workflows
**Structure**: YourSide/ and TheirSide/ folders
**Classification**: Strict claimant vs defendant separation

### Chronological Organization
**Best for**: Timeline-based case review
**Structure**: Date-based organization
**Naming**: Preserves original names with date context

### Quick Sort - AI Assisted
**Best for**: Fast organization with minimal manual input
**Features**: AI analysis, automatic categorization, smart naming
**Fallback**: Works without AI using basic keyword matching

## 🔧 Configuration Options

### Organization Settings

```json
{
  "selectedTemplate": "workers-comp-full",
  "preserveOriginalNames": true,
  "createBackup": true,
  "targetFolder": "./organized"
}
```

- **preserveOriginalNames**: Keep original filenames alongside new ones
- **createBackup**: Create backup copies before moving files
- **targetFolder**: Root folder for organized files

### Case Keywords Customization

```json
{
  "keywords": {
    "yourSide": ["claimant", "treating", "personal", "plaintiff"],
    "theirSide": ["employer", "wcb", "ime", "defense", "defendant"],
    "medical": ["medical", "doctor", "diagnosis", "treatment"],
    "legal": ["legal", "court", "decision", "appeal"],
    "evidence": ["evidence", "study", "research", "expert"]
  }
}
```

Add case-specific terms:
- Party names (lawyers, doctors, companies)
- Case numbers or references
- Specific terminology from your case

## 🚨 Safety & Best Practices

### File Safety

- **Never Overwrites**: System prevents accidental file overwrites
- **Unique Naming**: Automatic numbering for duplicate names
- **Backup Creation**: Optional backup folder creation
- **Dry Run Preview**: Always review changes before applying

### Organization Best Practices

1. **Start with Case Setup**: Configure case info first for better automation
2. **Use Appropriate Templates**: Choose templates matching your document types
3. **Review Classifications**: Always check automatic classifications
4. **Bulk Operations**: Use bulk actions for efficiency with many files
5. **Consistent Naming**: Establish naming conventions for your case

### Performance Tips

- **Batch Processing**: Organize files in reasonable batches (50-100 files)
- **Pre-classification**: Classify files when selecting for better results
- **Template Selection**: Choose specific templates over general ones when possible
- **AI Usage**: Use AI-assisted sorting for complex or varied file types

## 🐛 Troubleshooting

### Common Issues

**"Cannot find module './react/out/...'"**
- Solution: Run `bun run buildreact` to compile React components

**Files not classifying automatically**
- Check: Ensure case config exists with proper keywords
- Check: Verify filename patterns match keyword lists

**AI classification not working**
- Check: Void settings have LLM provider configured
- Check: Network connectivity for AI services

**Permission denied errors**
- Check: Write access to target directories
- Check: No files are open in other applications

**Files not moving**
- Check: Target folder exists and is writable
- Check: No naming conflicts in destination

### Debug Mode

Enable detailed logging:
1. Open VSCode developer console (`Help` → `Toggle Developer Tools`)
2. Look for `[FileOrganizer]` log messages
3. Check error details in console output

### Recovery Options

**If organization fails partway through:**
1. Check the results summary for specific errors
2. Manually move any successfully processed files
3. Re-run organization on remaining files
4. Contact support if issues persist

**To undo changes:**
1. Check backup folder (if created)
2. Manually restore files from backup
3. Use file history/recovery tools if available

## 📞 Support & Resources

### Getting Help

- **VSCode Console**: Check for detailed error messages
- **Log Files**: Review VSCode logs in developer console
- **Configuration**: Verify `.fileorg.json` syntax
- **Templates**: Test with different organization templates

### Advanced Configuration

For complex cases, consider:
- Custom rule creation for unique document types
- Multiple organization passes with different templates
- Combination of manual and automatic classification
- Integration with external document management systems

## 📈 Advanced Workflows

### Multi-Pass Organization

1. **First Pass**: Use "Your Side vs Their Side" for basic separation
2. **Second Pass**: Apply specific templates (Medical, Legal) to each side
3. **Third Pass**: Use AI-assisted sorting for remaining files

### Batch Processing Large Cases

1. **Group by Document Type**: Organize similar documents together
2. **Use Bulk Classification**: Minimize individual file handling
3. **Progressive Refinement**: Start general, then specialize

### Integration with Case Management

1. **Regular Updates**: Re-run organization as case progresses
2. **Version Control**: Track organization changes over time
3. **Team Collaboration**: Share configuration files with team members

---

**Related Topics:**
- [Configuration Guide](configuration-guide.md) - Detailed setup instructions
- [Examples](examples.md) - Real-world usage examples
- [API Reference](../api-reference.md) - Developer documentation
