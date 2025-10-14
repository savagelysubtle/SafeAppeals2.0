# ⚖️ SafeAppealNavigator

*Support this project: [paypal.me/safeappealnavigator](https://paypal.me/safeappealnavigator)*

[![GitHub stars](https://img.shields.io/github/stars/savagelysubtle/SafeAppeals2.0?style=social)](https://github.com/savagelysubtle/SafeAppeals2.0/stargazers)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-94.7%25-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

<div align="center">
 <img
  src="./void_icons/slice_of_void.png"
   alt="Safe Appeals Navigator Welcome"
  width="300"
   height="300"
 />
</div>

**Your intelligent companion for navigating workers compensation appeals. Organize case files, research legal precedents, and build compelling appeals with AI-powered document management and legal research—all within a powerful code editor environment.**

SafeAppealNavigator is a next-generation IDE and research platform built on VSCode, combining the power of AI-assisted code editing with specialized tools for legal research and case management. Whether you're developing software, managing legal documents, or navigating Workers' Compensation appeals, SafeAppealNavigator provides an integrated environment with vibrant lime green accents.

---

## 🎯 Dual-Purpose Platform

### 💻 **AI-Powered Code Editor**

- Fork of VSCode with enhanced AI agent capabilities
- Use AI agents on your codebase with checkpoint and change visualization
- Bring any model or host locally—messages sent directly to providers without data retention
- Vibrant lime green accents for a modern, open-source Cursor alternative

### ⚖️ **Legal Research & Case Management**

- **For Injured Workers**: Organize your case, understand your rights, build stronger appeals
- **For Legal Advocates**: Streamline case research and document preparation
- **For Support Organizations**: Assist multiple clients with professional case management

---

## 🧭 Quick Links

- 📂 [GitHub Repository](https://github.com/savagelysubtle/SafeAppeals2.0)
- 🐛 [Issues](https://github.com/savagelysubtle/SafeAppeals2.0/issues)
- 📋 [Project Board](https://github.com/savagelysubtle/SafeAppeals2.0/projects)

---

## ✨ Key Features

### 📁 Smart Case Organization

- **Document Management**: Automatically organize medical reports, correspondence, and legal documents
- **Timeline Builder**: Create visual timelines of case progression and key milestones
- **Deadline Tracking**: Never miss critical deadlines or hearing dates
- **Evidence Categorization**: Smart tagging and organization of supporting documentation

### ⚖️ Workers Compensation Research

- **Precedent Discovery**: Find appeal decisions and case law with circumstances similar to your case
- **Policy Analysis**: Search and understand relevant workers compensation policies and procedures
- **Case Strength Assessment**: AI analysis of your position based on similar successful cases
- **Gap Identification**: Discover what evidence or documentation might strengthen your case

### 📝 Professional Document Creation

- **Appeal Letters**: Generate well-structured appeal submissions with proper legal formatting
- **Medical Summaries**: Transform complex medical records into clear, compelling narratives
- **Case Briefs**: Create comprehensive overviews for legal representatives or hearings
- **Evidence Packages**: Organize supporting documentation for maximum impact

### 🤖 AI-Powered Insights

- **Plain Language Explanations**: Complex legal concepts explained in understandable terms
- **Strategic Recommendations**: Next steps and strategies based on case analysis
- **Document Analysis**: AI review of documents to identify strengths and weaknesses
- **Research Assistance**: Intelligent search across legal databases and precedent cases

### 🛠️ Advanced Development Tools

- **AI Code Agents**: Multi-agent workflows for code analysis and refactoring
- **Version Control Integration**: Git integration with visual diff and merge tools
- **Rich Text Editing**: Built-in support for DOCX and rich text formats
- **Extensible Architecture**: MCP (Model Context Protocol) support for custom tool integration

---

## 🚀 Installation & Setup

### Prerequisites

- **Node.js 20** (see `.nvmrc` file)
- **Git**
- **Windows, macOS, or Linux**

### Quick Start

1. **Clone the Repository**

   ```bash
   git clone https://github.com/savagelysubtle/SafeAppeals2.0.git
   cd SafeAppeals2.0
   ```

2. **Install Dependencies**

   ```bash
   # Install all Node.js dependencies
   npm install
   ```

3. **Fetch Prelaunch Dependencies**

   ```bash
   # Download Electron and required prebuilts
   node build/lib/preLaunch.js
   ```

4. **Build the Editor**

   ```bash
   # Start watch mode builds (TypeScript core, React components, extensions)
   npm run watch-clientd
   ```

   Or run the default build task in VS Code: **Ctrl/Cmd+Shift+B** → "VS Code - Build"

5. **Launch SafeAppealNavigator**

   **From Terminal:**

   ```bash
   # macOS/Linux
   ./scripts/code.sh

   # Windows
   .\scripts\code.bat
   ```

   **From VS Code:**
   - Press **F5** or use the "Launch VS Code Internal" debug configuration
   - This sets `VSCODE_DEV=1` for proper CSS import support

6. **Configure AI API Keys** (Optional)

   For enhanced AI features, you can configure your API keys in the editor settings or through environment variables:

   ```env
   OPENAI_API_KEY="your-openai-key"
   ANTHROPIC_API_KEY="your-anthropic-key"
   GOOGLE_API_KEY="your-google-key"
   ```

7. **Optional: Configure MCP Tools**

   SafeAppealNavigator supports extensible tool integration through MCP (Model Context Protocol). Configure additional research databases, document processing services, or legal research tools through the Void settings panel. The system comes pre-configured with essential file management and vector database tools.

### Development Workflows

- **Desktop App** (Recommended): Build with "VS Code - Build" task, then launch with "Launch VS Code Internal" (F5)
- **Web Server**: Run task "Run code server" → Opens on `http://localhost:8080`
- **Static Web**: Run task "Run code web" → Opens on `http://localhost:8080`
- **Tests**: Run `./scripts/test.sh` (macOS/Linux) or `.\scripts\test.bat` (Windows)

For detailed development instructions, see [`.vscode/README.md`](./.vscode/README.md)

---

## 📖 How to Use

### 🏥 Legal Case Management

1. **Create New Case**: Set up a case file with injury and claim information
2. **Upload Documents**: Import medical reports, agency correspondence, legal documents
3. **Build Timeline**: Add key dates like injury date, claim submission, decisions, deadlines
4. **Research Precedents**: Find appeal decisions and case law similar to your case
5. **Generate Appeals**: Create professional appeal letters and supporting documents

### 💻 Code Development

1. **Open Project**: Use File > Open Folder to open your codebase
2. **AI Assistance**: Access AI agents through the Void panel
3. **Code Analysis**: Let AI agents analyze and suggest improvements
4. **Version Control**: Use built-in Git tools for change tracking

---

## 📊 Real-World Success Stories

### 🏗️ Construction Worker - Denied Surgery Coverage

**Challenge**: Back injury from lifting, surgery coverage denied
**Solution**: Found 12 similar appeal cases where surgery was approved, generated appeal emphasizing medical necessity
**Outcome**: Surgery coverage approved on appeal

### 🏥 Healthcare Worker - "Not Work-Related" Claim

**Challenge**: Repetitive strain injury denied as non-work related
**Solution**: Organized evidence linking injury to work duties, found precedents for similar injuries
**Outcome**: Claim accepted after comprehensive appeal submission

### 🚛 Driver - Mental Health Benefits

**Challenge**: PTSD after workplace accident, mental health benefits denied
**Solution**: Research showed precedents for psychological injury acceptance, organized witness statements
**Outcome**: Mental health claim recognized and benefits approved

---

## 🛡️ Privacy & Security

- **Local Data Storage**: All case information stays on your computer
- **Secure API Connections**: All AI interactions use encrypted connections
- **No Data Sharing**: Your personal and legal information is never shared or stored externally
- **Open Source**: Full transparency—review the code yourself
- **Direct Provider Access**: Messages sent directly to AI providers without retention

---

## 🤝 Contributing

SafeAppealNavigator is open source and welcomes contributions from developers, legal professionals, and anyone who has navigated the workers compensation system.

### Development Setup

1. Check out our [Project Board](https://github.com/savagelysubtle/SafeAppeals2.0/projects)
2. Read [HOW_TO_CONTRIBUTE](https://github.com/savagelysubtle/SafeAppeals2.0/blob/main/HOW_TO_CONTRIBUTE.md)
3. Review [VOID_CODEBASE_GUIDE](https://github.com/savagelysubtle/SafeAppeals2.0/blob/main/VOID_CODEBASE_GUIDE.md) for codebase architecture

### Code Standards

- **TypeScript** (94.7% of codebase): Use Prettier for formatting, follow existing VSCode conventions, no unnecessary type casts or `any` types
- **CSS/JavaScript**: Follow existing patterns in the codebase
- **Python** (for extensions): Follow PEP 8, use Ruff for formatting, add type hints
- Add comprehensive JSDoc/TSDoc comments for TypeScript code
- Write tests for new features
- Submit pull requests with clear descriptions

---

## 📄 License

Licensed under the Apache License 2.0 - see the [LICENSE.txt](LICENSE.txt) file for details.

- ✅ Commercial use allowed
- ✅ Modification and distribution permitted
- ✅ Patent protection included
- ⚠️ Attribution required
- ⚠️ Notice of changes required

---

## 🆘 Support & Resources

- **Documentation**: Comprehensive guides in `/docs`
- **Issues**: Report bugs and request features on [GitHub Issues](https://github.com/savagelysubtle/SafeAppeals2.0/issues)
- **Email Support**: <simpleflowworks@gmail.com>
- **Legal Disclaimer**: This tool assists with legal research and document preparation. Always consult qualified legal professionals for legal advice.

---

## 📚 Reference

SafeAppealNavigator is a fork of the [vscode](https://github.com/microsoft/vscode) repository with enhanced capabilities for legal research and AI-powered development. The editor core provides a robust foundation, while custom extensions add specialized functionality for case management and legal document processing.

---

**Created and maintained by [SavagelySubtle](https://github.com/savagelysubtle)**

*Empowering injured workers to navigate the legal system with confidence while providing developers with cutting-edge AI-assisted coding tools* ⚖️💻

---

## Note

SafeAppealNavigator is actively maintained and developed. Stay updated with new releases by watching the repository!
