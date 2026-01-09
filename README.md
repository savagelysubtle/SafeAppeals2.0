# ⚖️ SafeAppeals

_Support this project: [paypal.me/safeappealnavigator](https://paypal.me/safeappealnavigator)_

[![GitHub stars](https://img.shields.io/github/stars/savagelysubtle/SafeAppeals2.0?style=social)](https://github.com/savagelysubtle/SafeAppeals2.0/stargazers)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-94.7%25-blue.svg)](https://www.typescriptlang.org/)
[![Download](https://img.shields.io/badge/Download-Windows-blue.svg)](https://github.com/savagelysubtle/SafeAppeals2.0/releases/latest)

<div align="center">
  <img
    src="./void_icons/slice_of_void.png"
    alt="SafeAppeals"
    width="200"
    height="200"
  />

  <h3>Stop Juggling Word, Excel, and ChatGPT.</h3>
  <p><strong>One AI-native workspace for your entire project.</strong></p>
</div>

---

SafeAppeals is a Windows desktop workspace and AI assistant for complex document work. Legal appeals, research papers, dissertations, grant applications—open all your PDFs, Word docs, and sources in one place, then work with an AI that remembers everything.

## 🎯 Who Is This For?

|                      |                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------- |
| ⚖️ **Legal Appeals** | Injured workers, advocates, and paralegals managing workers' comp and human-rights cases    |
| 🎓 **Grad Students** | Dissertations, thesis research, literature reviews—all your sources and drafts in one place |
| 📚 **Researchers**   | Academic papers, grant applications, and multi-source analysis with AI assistance           |
| 💼 **Consultants**   | Client reports, case studies, and project documentation with context-aware AI               |

---

## ✨ Why SafeAppeals?

### 📁 Unified Project Workspace

All your files—PDFs, Word docs, spreadsheets, research papers, emails—in one place. No more switching between apps or losing track of sources.

### 🤖 AI That Knows Your Whole Project

Unlike ChatGPT, our AI sees your entire project: documents, notes, and prior conversations. No re-explaining. No copy-paste.

### 📄 Native Document Editors

Edit Word, Excel, and PDF files directly inside SafeAppeals. Write papers, annotate sources, manage citations—all without leaving the app.

---

## 🚀 Quick Start

### Download & Install

1. **[Download SafeAppeals](https://github.com/savagelysubtle/SafeAppeals2.0/releases/latest)** (Windows)
2. Run the installer
3. Open SafeAppeals and create your first project workspace

### How It Works

1. **Create a Project Workspace** — Open a folder for your project
2. **Drop In Your Documents** — Import PDFs, Word docs, notes, and sources
3. **Chat With Your AI** — Ask questions, draft content, analyze sources
4. **Export Your Work** — Generate polished papers, timelines, and summaries

---

## 📄 Document Viewing & Editing

Open and work with your documents directly—no external apps needed.

| Format   | View | Edit                                    | RAG Index |
| -------- | ---- | --------------------------------------- | --------- |
| PDF      | ✅   | Annotations, highlights, bookmarks      | ✅        |
| DOCX     | ✅   | Full editing (text, tables, formatting) | ✅        |
| XLSX/XLS | ✅   | Cells, formulas, rows/columns           | ✅        |
| TXT/MD   | ✅   | ✅                                      | ✅        |
| Images   | ✅   | Zoom, pan, rotate                       | —         |
| EML      | ✅   | AI draft replies                        | —         |

### PDF Viewer

- Multi-page navigation with smooth scrolling
- Zoom controls (fit-to-width, fit-to-page, custom)
- Highlight annotations with color options (yellow, green, blue, pink)
- Bookmarks for quick navigation
- Annotation persistence to workspace

### Word Documents (DOCX)

- Rich text display with formatting preservation
- Live editing via built-in editor
- Insert text, tables, and page breaks
- Find and replace functionality

### Excel Spreadsheets (XLSX)

- Multi-sheet support with tab navigation
- Cell selection and editing
- Formula display and evaluation
- Insert/delete rows and columns

---

## 🔍 Policy Manual Research (RAG)

Build a searchable knowledge base of policy manuals and reference documents.

- **Drop & Index**: Add PDFs, DOCX, TXT, or MD files to `policy-manuals/`
- **Semantic Search**: Find relevant policies by meaning, not just keywords
- **Local Embeddings**: Uses `all-MiniLM-L6-v2` model (~23 MB)
- **$0 Cost**: Works completely offline after first model download
- **AI Integration**: Search policy manuals from chat with source attribution

---

## 📁 Smart File Organization

Organize your project files intelligently with the File Organizer.

https://github.com/savagelysubtle/SafeAppeals2.0/raw/main/videos/organize-using-ai-chat.mp4

- **Classification**: Categorize files as "Your Side" or "Their Side"
- **AI-Powered**: Automatic naming suggestions and tag recommendations
- **Rule Engine**: Apply naming patterns like `{Side}_{Category}_{Date}_{Description}`
- **Smart Routing**: Auto-detection of folder structure and classification-based routing
- **Safe**: Preview changes before applying, no overwrites, automatic backups

**Keyboard**: `Ctrl+Shift+O` to open File Organizer

---

## 📧 Email Dashboard

Manage case-related correspondence with AI-assisted draft replies.

- Import `.eml` and `.pdf` email files
- Full-text search across all emails
- View emails with complete headers and attachments
- **AI Draft Replies**: Generate contextual responses using your project documents
- DOCX output ready for editing

**Keyboard**: `Ctrl+Shift+E` to open Email Dashboard

---

## 📅 Timeline & Event Tracker

Visual timeline of project events for tracking important dates and deadlines.

- Add events with date, title, description, and category
- 8 event categories (Injury, Medical, Hearing, Decision, Deadline, Filing, Correspondence, Custom)
- Deadline tracking with reminder notifications
- 12 pre-configured jurisdictions for legal appeals
- Export timeline to PDF

**Keyboard**: `Ctrl+Shift+T` to open Timeline

---

## 🤖 AI Assistant

Built-in AI chat to help with your project research.

### Providers

- **BYOK**: OpenAI, Anthropic, Google, DeepSeek (bring your own API keys — free)
- **SafeAppeals Cloud**: Claude, GPT, Gemini access without API key setup

### Features

- Context-aware responses using your documents and case info
- Agent mode for automated workflows (file organization, case setup)
- Quick actions: `Ctrl+K` for quick edits, `Ctrl+L` to open chat

### Cloud Credits

- Purchase once, use across all models
- Credits never expire
- Optional—BYOK always available

---

## 🛠️ Development Setup

### Prerequisites

- **Node.js 20+** (see `.nvmrc`)
- **Git**
- **Windows, macOS, or Linux**

### Build from Source

```bash
# Clone
git clone https://github.com/savagelysubtle/SafeAppeals2.0.git
cd SafeAppeals2.0

# Install dependencies
npm install

# Fetch prelaunch dependencies
node build/lib/preLaunch.js

# Start watch mode
npm run watch-clientd

# Launch
.\scripts\code.bat   # Windows
./scripts/code.sh    # macOS/Linux
```

---

## 🛡️ Privacy & Security

- **Local Data Storage**: All project data stays on your computer
- **Offline Capable**: RAG system works without internet after model download
- **No Data Sharing**: Your documents are never uploaded without explicit action
- **Open Source**: Full transparency—review the code yourself

---

## ⌨️ Keyboard Shortcuts

| Action          | Shortcut               |
| --------------- | ---------------------- |
| Open AI Chat    | `Ctrl+L`               |
| Quick Edit      | `Ctrl+K`               |
| File Organizer  | `Ctrl+Shift+O`         |
| Email Dashboard | `Ctrl+Shift+E`         |
| Timeline        | `Ctrl+Shift+T`         |
| Command Palette | `F1` or `Ctrl+Shift+P` |
| Settings        | `Ctrl+,`               |

---

## 🤝 Contributing

SafeAppeals welcomes contributions from developers, legal professionals, and anyone who has navigated complex document work.

1. Check the [Project Board](https://github.com/savagelysubtle/SafeAppeals2.0/projects)
2. Read [HOW_TO_CONTRIBUTE](https://github.com/savagelysubtle/SafeAppeals2.0/blob/main/HOW_TO_CONTRIBUTE.md)
3. Review [VOID_CODEBASE_GUIDE](https://github.com/savagelysubtle/SafeAppeals2.0/blob/main/VOID_CODEBASE_GUIDE.md)

### Code Standards

- **TypeScript**: Follow existing conventions, no `any` types
- **React Components**: Located in `src/vs/workbench/contrib/void/browser/react/`
- Write tests for new features

---

## 📄 License

Licensed under the Apache License 2.0 - see [LICENSE.txt](LICENSE.txt) for details.

---

## 🆘 Support

- **Documentation**: [safeappeals.cloud/docs](https://safeappeals.cloud/docs)
- **Issues**: [GitHub Issues](https://github.com/savagelysubtle/SafeAppeals2.0/issues)
- **Email**: simpleflowworks@gmail.com

**Disclaimer**: This tool assists with document research and preparation. Always consult qualified professionals for legal or medical advice.

---

<div align="center">

**[Download SafeAppeals](https://github.com/savagelysubtle/SafeAppeals2.0/releases/latest)** · [Documentation](https://safeappeals.cloud/docs) · [Report Issue](https://github.com/savagelysubtle/SafeAppeals2.0/issues)

Created by [SavagelySubtle](https://github.com/savagelysubtle)

_Empowering people to navigate complex document work with confidence_ ⚖️

</div>
