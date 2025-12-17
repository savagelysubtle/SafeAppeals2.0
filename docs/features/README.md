# Feature Documentation

This folder contains documentation for user-facing features, configuration options, and customization guides.

## File Organization & Case Management

- **[FILE_ORG_CASE_CONFIG.md](./FILE_ORG_CASE_CONFIG.md)** - Case-specific file organization system with AI context integration

### Key Features:
- `.fileorg.json` configuration files for case metadata
- Automatic AI context loading for legal case information
- Smart file classification based on case parties and keywords
- Integration with Void's AI chat system

## User Interface Customization

- **[APP_THEMING_GUIDE.md](./APP_THEMING_GUIDE.md)** - Complete guide for customizing SafeAppeals Navigator's appearance

### Theming Options:
- Workbench color customizations
- Full theme extension creation
- Green color scheme (already implemented)
- Accessibility and high-contrast options

## Document Processing Features

- **[PAGINATION_IMPLEMENTATION.md](./PAGINATION_IMPLEMENTATION.md)** - Automatic pagination for DOCX editor

### Features:
- Automatic page breaks in rich text editing
- Letter/Legal/A4 page size support
- Visual page break indicators
- Print-ready document layout

## Configuration Files

Most features use JSON configuration files that can be:
- Created manually for advanced users
- Generated through guided setup wizards
- Automatically detected and loaded by the application

## Integration with AI Features

Features in this folder often integrate with SafeAppeals Navigator's AI capabilities:
- Case information automatically included in AI prompts
- Smart file classification using case context
- Document processing with ML-powered extraction

## User Workflows

### First-Time Setup
1. Configure case information (if applicable)
2. Customize appearance preferences
3. Set up document processing options

### Daily Usage
- Case configurations auto-load on project open
- Theme preferences persist across sessions
- Document features work automatically
