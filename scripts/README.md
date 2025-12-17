# SafeAppeals Scripts

This directory contains utility scripts for development, documentation, and maintenance.

## 📋 Available Scripts

### Documentation Generation

#### `generate-docs.js`

**Purpose:** Automatically generates AI prompts for documenting codebases

**Usage:**

```bash
# Basic usage - analyze a folder and create documentation prompt
node scripts/generate-docs.js <folder-path>

# With custom output directory
node scripts/generate-docs.js <folder-path> --output <output-dir>
```

**Examples:**

```bash
# Document the fileOrganizer system
node scripts/generate-docs.js src/vs/workbench/contrib/void/browser/fileOrganizer

# Document with custom output location
node scripts/generate-docs.js src/my-component --output docs/my-component-docs

# Document a library
node scripts/generate-docs.js packages/my-library --output docs/libraries/my-library
```

**What it does:**

1. **Analyzes** the folder structure and file types
2. **Reads** relevant source files and configuration files
3. **Generates** a comprehensive AI prompt for documentation
4. **Saves** the prompt to `ai-prompt.md` in the output directory

**Output:**

- `ai-prompt.md` - Complete prompt for AI documentation generation
- Ready-to-use prompt that can be copied to Claude, GPT-4, or other AI assistants

**Supported file types:**

- Source code: `.js`, `.ts`, `.jsx`, `.tsx`, `.py`, `.java`, `.go`, `.rs`, etc.
- Configuration: `package.json`, `requirements.txt`, `cargo.toml`, etc.
- Documentation: `README.md`, `.md` files
- Build files: `Dockerfile`, `Makefile`

**File size limits:**

- Source files: Up to 50KB (to avoid overwhelming the AI)
- Configuration files: Fully read
- Binary/large files: Skipped with metadata only

## 🤖 How to Use Generated Prompts

1. **Run the script** on your target folder
2. **Copy the generated prompt** from `ai-prompt.md`
3. **Paste into your AI assistant** (Claude, ChatGPT, etc.)
4. **Wait for AI to generate** comprehensive documentation
5. **Review and save** the generated docs in the output folder

## 📝 Documentation Structure Generated

The AI will typically generate:

```
docs/
├── README.md              # Main project documentation
├── user-guide.md         # User instructions
├── developer-guide.md    # Technical details
├── api-reference.md      # API documentation
├── configuration-guide.md # Setup instructions
├── examples.md           # Usage examples
└── ai-prompt.md          # The original prompt (for reference)
```

## 🎯 Use Cases

### Documenting New Features

```bash
# Document a new component
node scripts/generate-docs.js src/vs/workbench/contrib/void/browser/new-feature
```

### Library Documentation

```bash
# Document a shared library
node scripts/generate-docs.js packages/shared-utils
```

### API Documentation

```bash
# Document an API service
node scripts/generate-docs.js src/api
```

### Legacy Code Documentation

```bash
# Document existing code that needs docs
node scripts/generate-docs.js legacy-code-folder
```

## 🔧 Customization

### Modifying File Types

Edit `generate-docs.js` to change which files are analyzed:

```javascript
// Add more file extensions
const extensions = [".js", ".ts", ".jsx", ".tsx", ".py", ".rs", ".go"];

// Change file size limits
const maxFileSize = 100000; // 100KB

// Modify excluded directories
const excludeDirs = ["node_modules", ".git", "dist", "build", ".next"];
```

### Custom AI Prompts

The script uses a generic prompt, but you can create specialized prompts for:

- API documentation only
- User guides only
- Technical architecture docs
- Security documentation

## 🚀 Integration Ideas

### CI/CD Integration

Add to your build pipeline to auto-generate docs on commits:

```yaml
# .github/workflows/docs.yml
name: Generate Documentation
on: [push, pull_request]
jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: "18"
      - name: Generate Docs
        run: node scripts/generate-docs.js src/my-feature
      - name: Commit Docs
        run: |
          git add docs/
          git commit -m "Auto-generate documentation" || true
```

### Pre-commit Hooks

Use Husky to auto-generate docs before commits:

```json
// package.json
{
	"husky": {
		"hooks": {
			"pre-commit": "node scripts/generate-docs.js src/changed-feature"
		}
	}
}
```

## 🐛 Troubleshooting

### Common Issues

**"Cannot find module" errors:**

- Ensure you're running from the project root
- Check that all dependencies are installed

**Empty or incomplete analysis:**

- Verify the folder path exists and is accessible
- Check file permissions
- Some binary files are intentionally skipped

**Large prompts:**

- The script limits file content to prevent AI context limits
- For very large codebases, analyze sub-folders individually

**Memory issues:**

- For extremely large folders, increase Node.js memory: `node --max-old-space-size=4096 scripts/generate-docs.js ...`

### Debug Mode

Add debug logging by modifying the script:

```javascript
const DEBUG = process.env.DEBUG === "true";
// Add console.log statements throughout
```

## 🤝 Contributing

### Adding New Features

1. Test your changes on various folder types
2. Update this README with new capabilities
3. Add examples for new use cases
4. Ensure backwards compatibility

### Script Improvements

- Better file type detection
- Configurable analysis depth
- Progress indicators for large folders
- Parallel file processing
- Custom prompt templates

## 📞 Support

For issues or questions:

1. Check the troubleshooting section above
2. Review the generated `ai-prompt.md` for analysis details
3. Test with a simple folder first to isolate issues
4. Create an issue with folder structure and error details

---

**Last Updated:** December 2024
