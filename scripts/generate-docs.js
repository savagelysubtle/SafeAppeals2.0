#!/usr/bin/env node

/**
 * Documentation Generation Script
 *
 * This script reads a folder and generates documentation using AI assistance.
 * It uses the generic documentation prompt to create comprehensive docs.
 *
 * Usage:
 *   node scripts/generate-docs.js <folder-path> [--output <output-dir>]
 *
 * Example:
 *   node scripts/generate-docs.js src/vs/workbench/contrib/void/browser/fileOrganizer --output docs/fileOrganizer
 */

const fs = require('fs');
const path = require('path');

class DocumentationGenerator {
	constructor() {
		this.folderPath = process.argv[2];
		this.outputDir = process.argv.includes('--output')
			? process.argv[process.argv.indexOf('--output') + 1]
			: './docs/generated';

		if (!this.folderPath) {
			console.error('❌ Error: Please provide a folder path');
			console.log('\nUsage:');
			console.log('  node scripts/generate-docs.js <folder-path> [--output <output-dir>]');
			console.log('\nExample:');
			console.log('  node scripts/generate-docs.js src/my-component --output docs/my-component');
			process.exit(1);
		}
	}

	async generate() {
		console.log(`📁 Analyzing folder: ${this.folderPath}`);
		console.log(`📝 Output directory: ${this.outputDir}`);

		try {
			// Read folder contents
			const folderContents = this.readFolderContents(this.folderPath);

			// Generate AI prompt
			const prompt = this.createDocumentationPrompt(folderContents);

			// Ensure output directory exists
			this.ensureOutputDirectory();

			// Save the prompt for AI processing
			this.savePromptForAI(prompt);

			console.log('\n✅ Analysis complete!');
			console.log(`📋 AI prompt saved to: ${this.outputDir}/ai-prompt.md`);
			console.log('\n🚀 Next steps:');
			console.log('1. Copy the prompt from ai-prompt.md');
			console.log('2. Paste it to your AI assistant (Claude, GPT-4, etc.)');
			console.log('3. The AI will generate comprehensive documentation');
			console.log('4. Save the generated docs in this folder');

		} catch (error) {
			console.error('❌ Error generating documentation:', error.message);
			process.exit(1);
		}
	}

	readFolderContents(folderPath) {
		const contents = {
			path: folderPath,
			files: [],
			directories: [],
			structure: {}
		};

		const self = this;
		function readDirectory(dirPath, relativePath = '') {
			const items = fs.readdirSync(dirPath);

			for (const item of items) {
				const fullPath = path.join(dirPath, item);
				const relPath = path.join(relativePath, item);
				const stat = fs.statSync(fullPath);

				if (stat.isDirectory()) {
					// Skip common exclude directories
					if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(item)) {
						contents.directories.push(relPath);
						readDirectory(fullPath, relPath);
					}
				} else {
					// Only include relevant file types
					const ext = path.extname(item).toLowerCase();
					if (['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.php', '.rb', '.go', '.rs', '.md', '.json', '.yaml', '.yml', '.xml', '.html', '.css', '.scss', '.less'].includes(ext) || item === 'Dockerfile' || item === 'Makefile' || item.startsWith('README') || item.startsWith('package.json') || item.startsWith('requirements.txt')) {
						contents.files.push(relPath);

						// Read content for important files
						if (self.shouldReadFileContent(relPath)) {
							try {
								const content = fs.readFileSync(fullPath, 'utf8');
								contents.structure[relPath] = {
									size: stat.size,
									lines: content.split('\n').length,
									content: content.length > 5000 ? content.substring(0, 5000) + '\n... (truncated)' : content
								};
							} catch (error) {
								contents.structure[relPath] = {
									size: stat.size,
									error: `Could not read file: ${error.message}`
								};
							}
						} else {
							contents.structure[relPath] = {
								size: stat.size,
								type: 'binary or large file'
							};
						}
					}
				}
			}
		}

		readDirectory.call(this, folderPath);
		return contents;
	}

	shouldReadFileContent(filePath) {
		const fileName = path.basename(filePath).toLowerCase();
		const fileExt = path.extname(filePath).toLowerCase();

		// Always read these files
		const alwaysRead = [
			'readme.md', 'package.json', 'requirements.txt', 'setup.py',
			'cargo.toml', 'go.mod', 'composer.json', 'gemfile'
		];

		// Read source files under certain size
		const sourceFiles = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs', '.php', '.rb'];
		const isSourceFile = sourceFiles.includes(fileExt);
		const isSmallFile = fs.statSync(path.join(this.folderPath, filePath)).size < 50000; // 50KB limit

		return alwaysRead.includes(fileName) || (isSourceFile && isSmallFile);
	}

	createDocumentationPrompt(folderContents) {
		const prompt = `# Documentation Generation Request

Please analyze this folder and generate comprehensive documentation.

## 📁 FOLDER TO DOCUMENT
**Path:** \`${folderContents.path}\`

## 📂 FOLDER STRUCTURE
**Directories:**
${folderContents.directories.map(dir => `- \`${dir}/\``).join('\n')}

**Files:**
${folderContents.files.map(file => `- \`${file}\``).join('\n')}

## 📄 FILE CONTENTS

${Object.entries(folderContents.structure).map(([filePath, info]) => {
			let content = `### \`${filePath}\`
- **Size:** ${this.formatFileSize(info.size)}
- **Lines:** ${info.lines || 'N/A'}
- **Type:** ${info.type || 'Text file'}

`;

			if (info.content) {
				content += `**Content:**
\`\`\`${this.getLanguageFromExtension(filePath)}
${info.content}
\`\`\`
`;
			} else if (info.error) {
				content += `**Error:** ${info.error}
`;
			}

			return content;
		}).join('\n')}

## 🤖 DOCUMENTATION REQUIREMENTS

Please generate comprehensive documentation for this codebase following the guidelines in the generic documentation prompt. Focus on:

1. **Project Type Detection** - What kind of project is this?
2. **Technology Stack** - What languages/frameworks are used?
3. **Architecture Overview** - How is the code organized?
4. **API Documentation** - If this is a library, document the public API
5. **Usage Examples** - How to use this code
6. **Setup Instructions** - How to install and configure
7. **Contributing Guide** - How others can contribute

Generate the documentation in the following structure:
- \`README.md\` - Main project documentation
- \`api-reference.md\` - API documentation (if applicable)
- \`user-guide.md\` - Usage instructions
- \`developer-guide.md\` - Technical details for developers
- \`examples.md\` - Practical examples
- \`configuration-guide.md\` - Setup and configuration

Make the documentation professional, comprehensive, and easy to follow.
`;

		return prompt;
	}

	getLanguageFromExtension(filePath) {
		const ext = path.extname(filePath).toLowerCase();
		const languageMap = {
			'.js': 'javascript',
			'.jsx': 'javascript',
			'.ts': 'typescript',
			'.tsx': 'typescript',
			'.py': 'python',
			'.java': 'java',
			'.cpp': 'cpp',
			'.c': 'c',
			'.h': 'c',
			'.php': 'php',
			'.rb': 'ruby',
			'.go': 'go',
			'.rs': 'rust',
			'.json': 'json',
			'.xml': 'xml',
			'.html': 'html',
			'.css': 'css',
			'.scss': 'scss',
			'.md': 'markdown',
			'.yaml': 'yaml',
			'.yml': 'yaml'
		};
		return languageMap[ext] || '';
	}

	formatFileSize(bytes) {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	ensureOutputDirectory() {
		if (!fs.existsSync(this.outputDir)) {
			fs.mkdirSync(this.outputDir, { recursive: true });
			console.log(`📁 Created output directory: ${this.outputDir}`);
		}
	}

	savePromptForAI(prompt) {
		const promptPath = path.join(this.outputDir, 'ai-prompt.md');
		fs.writeFileSync(promptPath, prompt, 'utf8');
		console.log(`💾 AI prompt saved to: ${promptPath}`);
	}
}

// Run the generator
const generator = new DocumentationGenerator();
generator.generate().catch(console.error);
