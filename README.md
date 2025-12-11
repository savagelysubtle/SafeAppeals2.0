# ⚖️ SafeAppealNavigator

_Support this project: [paypal.me/safeappealnavigator](https://paypal.me/safeappealnavigator)_

[![GitHub stars](https://img.shields.io/github/stars/savagelysubtle/SafeAppeals2.0?style=social)](https://github.com/savagelysubtle/SafeAppeals2.0/stargazers)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-94.7%25-blue.svg)](https://www.typescriptlang.org/)

<div align="center">
 <img
  src="./void_icons/slice_of_void.png"
   alt="Safe Appeals Navigator Welcome"
  width="300"
   height="300"
 />
</div>

**Your intelligent companion for navigating workers' compensation appeals.** Organize case files, research policy manuals, and manage your documents with AI-powered assistance—all in one desktop application designed specifically for legal case management.

SafeAppealNavigator is a specialized document management platform that combines native PDF, DOCX, and XLSX viewing with intelligent file organization and AI-powered research tools. Whether you're an injured worker managing your own case, a legal advocate helping clients, or a support organization assisting multiple claimants, SafeAppealNavigator provides the tools you need to build compelling appeals.

---

## 🎯 Who Is This For?

- **Injured Workers**: Organize your case, understand your rights, build stronger appeals
- **Legal Advocates**: Streamline case research and document preparation
- **Support Organizations**: Assist multiple clients with professional case management

---

## ✨ Core Features

### 📄 Native Document Viewing & Editing

Open and work with your legal documents directly—no external apps needed.

**PDF Viewer**

- Multi-page navigation with smooth scrolling
- Zoom controls (fit-to-width, fit-to-page, custom zoom)
- Text selection and copy
- Highlight annotations with color options (yellow, green, blue, pink)
- Bookmarks for quick navigation
- Annotation persistence to workspace

**Word Documents (DOCX)**

- Rich text display with formatting preservation
- Live editing via built-in editor
- Insert text, tables, and page breaks
- Find and replace functionality
- Format text (bold, italic, underline, font size, color)

**Excel Spreadsheets (XLSX/XLS)**

- Multi-sheet support with tab navigation
- Cell selection and editing
- Formula display and evaluation
- Insert/delete rows and columns
- Cell formatting options

**Image Viewer**

- Support for JPG, PNG, GIF, WEBP, SVG
- Zoom controls with fit-to-window and 100% view
- Pan/drag navigation when zoomed
- Rotate controls (left/right)
- Checkerboard background for transparency

---

### 📁 Smart File Organization

Organize your case files intelligently with the File Organizer.

**Classification System**

- Categorize files as "Your Side" or "Their Side"
- Keyword-based auto-classification using configurable keyword lists
- AI-powered classification with naming suggestions and tag recommendations

**Rule Engine**

- Apply naming patterns: `{Side}_{Category}_{Date}_{Description}.ext`
- Tag files automatically based on content
- Route files to appropriate folders based on classification

**Smart Destination Routing**

- Auto-detection of case folder structure
- Classification-based folder routing
- Preview changes before applying

**Safety Features**

- No overwrites—duplicate detection with auto-suffix
- Automatic folder creation
- Metadata storage in companion `.meta` files

---

### 📋 Case Info Dashboard

Track all case details in one place with the dedicated sidebar panel.

**What You Can Store**

- Case number and claimant name
- Injury date and case type
- Party information:
  - **Your Side**: Advocates, treating doctors, lawyers
  - **Their Side**: Employer, case managers, review officers, IME doctors
  - **WCB**: Adjudicators, references

**Keyword Configuration**

- Define keywords for automatic file tagging
- Separate "Your Side" and "Their Side" keywords
- Names from parties are automatically added to keywords

**AI Context Integration**

- Case information is automatically available to the AI chat
- Helps AI understand your case context for better assistance

---

### 🔍 Policy Manual Research (RAG System)

Build a searchable knowledge base of policy manuals and reference documents.

**Document Indexing**

- Drop PDF, DOCX, TXT, or MD files into `policy-manuals/` folder
- Auto-indexing with file watching
- Right-click context menu: "Index as Policy Manual"

**Semantic Search**

- Find relevant policies by meaning, not just keywords
- Local embeddings using `all-MiniLM-L6-v2` model (~23 MB)
- **$0 cost** — works offline after first model download

**AI Integration**

- Search policy manuals from chat
- Get context-aware answers based on your indexed documents
- Relevance scoring and attribution

---

### 🤖 AI-Powered Assistance

Built-in AI chat to help with your case research.

**Chat Features**

- Multi-provider support (OpenAI, Anthropic, Google, DeepSeek)
- BYOK (Bring Your Own Key) or use Void Cloud
- Context-aware responses using your case info and documents

**Agent Mode**

- Automated workflows for file organization
- Case Organizer agent for sorting unsorted files
- Terminal tool access for file operations

**Quick Actions**

- Ctrl+K for quick edits
- Ctrl+L to open chat with context

---

### 📂 Case Organizer Workflow

Automated agent workflow for organizing messy case folders.

**How It Works**

1. Run "Void: Initialize Case Organizer" command
2. Agent opens in sidebar with pre-filled prompt
3. Choose mode: Full Auto, Interactive, or Manual
4. Agent organizes files with dry-run preview

**Folder Structure Created**

- `Medical_Reports/`
- `Correspondence/`
- `Decisions_and_Orders/`
- `Evidence/`
- `Personal_Notes/`
- `Uncategorized/`

**Safety Features**

- Dry-run preview before any changes
- Automatic backups to `tosort/_originals/`
- Operation logging and undo plans
- No deletions by default

---

## 🚀 Installation

### Prerequisites

- **Node.js 20+** (see `.nvmrc` file)
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
   npm install
   ```

3. **Fetch Prelaunch Dependencies**

   ```bash
   node build/lib/preLaunch.js
   ```

4. **Build the Application**

   ```bash
   # Start watch mode (recommended for development)
   npm run watch-clientd

   # Or single build
   npm run compile
   ```

5. **Launch SafeAppealNavigator**

   ```bash
   # Windows
   .\scripts\code.bat

   # macOS/Linux
   ./scripts/code.sh
   ```

6. **Configure AI (Optional)**

   Open Settings (Ctrl+,) and add your API keys for enhanced AI features:

   - OpenAI, Anthropic, Google, or DeepSeek
   - Or sign in to Void Cloud for managed access

---

## 📖 Getting Started

### 1. Set Up Your Case

1. Open a folder for your case files
2. Click the **Briefcase icon** in the sidebar to open Case Info
3. Enter your claimant name, case number, and case type
4. Add party names (advocates, case managers, etc.)
5. Save to create `.fileorg.json`

### 2. Organize Your Documents

1. Press **Ctrl+Shift+O** to open File Organizer
2. Select files to organize
3. Classify as "Your Side" or "Their Side"
4. Review proposed changes
5. Apply organization

### 3. Build Your Policy Reference

1. Drop policy manuals into the `policy-manuals/` folder
2. Files are automatically indexed
3. Use AI chat to search: "What does policy say about..."

### 4. Get AI Assistance

1. Press **Ctrl+L** to open AI chat
2. Ask questions about your case
3. Request document summaries
4. Get help drafting responses

---

## 🛡️ Privacy & Security

- **Local Data Storage**: All case information stays on your computer
- **Offline Capable**: RAG system works without internet after model download
- **No Data Sharing**: Your documents are never uploaded without explicit action
- **Open Source**: Full transparency—review the code yourself

---

## 📊 Supported File Formats

| Format      | View | Edit        | Index for RAG |
| ----------- | ---- | ----------- | ------------- |
| PDF         | ✅   | Annotations | ✅            |
| DOCX        | ✅   | ✅          | ✅            |
| XLSX/XLS    | ✅   | ✅          | ✅            |
| TXT         | ✅   | ✅          | ✅            |
| MD          | ✅   | ✅          | ✅            |
| JPG/PNG/GIF | ✅   | —           | —             |
| SVG/WEBP    | ✅   | —           | —             |

---

## 🤝 Contributing

SafeAppealNavigator welcomes contributions from developers, legal professionals, and anyone who has navigated the workers' compensation system.

1. Check the [Project Board](https://github.com/savagelysubtle/SafeAppeals2.0/projects)
2. Read [HOW_TO_CONTRIBUTE](https://github.com/savagelysubtle/SafeAppeals2.0/blob/main/HOW_TO_CONTRIBUTE.md)
3. Review [VOID_CODEBASE_GUIDE](https://github.com/savagelysubtle/SafeAppeals2.0/blob/main/VOID_CODEBASE_GUIDE.md)

### Code Standards

- **TypeScript**: Use Prettier, follow existing conventions, no `any` types
- **React Components**: Located in `src/vs/workbench/contrib/void/browser/react/`
- Write tests for new features
- Submit pull requests with clear descriptions

---

## 📄 License

Licensed under the Apache License 2.0 - see [LICENSE.txt](LICENSE.txt) for details.

- ✅ Commercial use allowed
- ✅ Modification and distribution permitted
- ✅ Patent protection included
- ⚠️ Attribution required
- ⚠️ Notice of changes required

---

## 🆘 Support & Resources

- **Documentation**: See `ADDED_FEATURES_TRACKER.md` for detailed feature documentation
- **Issues**: [GitHub Issues](https://github.com/savagelysubtle/SafeAppeals2.0/issues)
- **Email**: simpleflowworks@gmail.com

**Legal Disclaimer**: This tool assists with legal research and document preparation. Always consult qualified legal professionals for legal advice.

---

## 🧭 Quick Reference

| Action              | Shortcut           |
| ------------------- | ------------------ |
| Open AI Chat        | Ctrl+L             |
| Quick Edit          | Ctrl+K             |
| Open File Organizer | Ctrl+Shift+O       |
| Command Palette     | F1 or Ctrl+Shift+P |
| Open Settings       | Ctrl+,             |

---

**Created and maintained by [SavagelySubtle](https://github.com/savagelysubtle)**

_Empowering injured workers to navigate the legal system with confidence_ ⚖️

---

_Support this project: [paypal.me/safeappealnavigator](https://paypal.me/safeappealnavigator)_
