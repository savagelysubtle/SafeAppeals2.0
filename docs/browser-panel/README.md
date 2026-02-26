# Browser Panel

A fully functional web browser embedded directly into the SafeAppealNavigator IDE. Built on Electron's `WebContentsView` API, the browser runs real Chromium rendering in a native child view — not an iframe or webview — providing full website compatibility including Google Search, sign-in flows, and modern JavaScript applications.

## Features

- **Full Chromium browsing** — Renders pages using a native Electron `WebContentsView` with full web standards support
- **Google compatibility** — Supports Google Search, sign-in, and all interactive features without degradation
- **URL bar with smart navigation** — Type a URL, a domain, or plain text to search Google automatically
- **Back / Forward / Reload / Home** — Standard navigation controls with keyboard shortcut support
- **Bookmarks** — Star any page to save it; bookmarks appear in the URL bar dropdown
- **Browsing history** — Persistent history (up to 200 entries) accessible from the URL bar
- **Find in page** — `Ctrl+F` opens an inline find bar with forward/reverse search
- **Downloads** — File downloads prompt a native save dialog with progress notifications
- **DevTools** — One-click access to Chromium DevTools for the embedded page
- **New tab** — Open additional browser tabs in the editor group
- **Session persistence** — The browser session (`persist:void-browser-v2`) persists cookies and storage across restarts
- **Editor integration** — Opens as a standard editor tab; close, split, drag, and pin like any other editor

## Quick Start

1. Click the **globe icon** in the top-right title bar (next to layout controls), or press `Ctrl+Shift+P` and run **SafeAppeals: Open Browser**
2. The browser opens as an editor tab defaulting to `https://www.google.com`
3. Click the **URL bar** and type a search query or URL, then press **Enter**
4. Use `Ctrl+L` to focus the URL bar, `Ctrl+F` to find in page
5. Click the **star** icon to bookmark the current page
6. Click the **wrench** icon to open DevTools for the embedded page

## Documentation

| Document | Description |
|---|---|
| [Architecture](./architecture.md) | Process model, IPC design, Electron integration |
| [Developer Guide](./developer-guide.md) | Code organization, extension points, adding features |
| [User Guide](./user-guide.md) | End-user feature walkthrough |
| [API Reference](./api-reference.md) | IPC protocol, TypeScript interfaces, service API |
| [Troubleshooting](./troubleshooting.md) | Common issues, debugging steps, known limitations |

## Technology Stack

| Layer | Technology |
|---|---|
| Page Rendering | Chromium (via Electron `WebContentsView`) |
| Main Process | `BrowserPanelChannel` — manages views, sessions, navigation |
| Browser Process | `BrowserPanelService` — IPC client, history, bookmarks |
| Editor Integration | `BrowserEditor` (EditorPane) + `BrowserInput` (EditorInput) |
| Session Isolation | `session.fromPartition('persist:void-browser-v2')` |
| IPC Transport | VS Code `IServerChannel` / `IChannel` over Electron IPC |
| Persistence | `IStorageService` (history + bookmarks in VS Code profile storage) |
