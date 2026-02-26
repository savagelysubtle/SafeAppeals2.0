# Browser Panel User Guide

## Table of Contents

1. [Opening the Browser](#opening-the-browser)
2. [Navigating the Web](#navigating-the-web)
3. [Using the URL Bar](#using-the-url-bar)
4. [Navigation Controls](#navigation-controls)
5. [Bookmarks](#bookmarks)
6. [Browsing History](#browsing-history)
7. [Find in Page](#find-in-page)
8. [Downloads](#downloads)
9. [DevTools](#devtools)
10. [Multiple Tabs](#multiple-tabs)
11. [Keyboard Shortcuts](#keyboard-shortcuts)

---

## Opening the Browser

There are two ways to open the browser:

1. **Globe button** — Click the globe icon in the top-right title bar area (near the layout control buttons)
2. **Command Palette** — Press `Ctrl+Shift+P` and type **SafeAppeals: Open Browser**

The browser opens as a standard editor tab and defaults to `https://www.google.com`.

---

## Navigating the Web

The browser supports full web browsing. You can:

- Visit any website by typing its URL in the address bar
- Click links on pages to navigate
- Use Google Search (both from the URL bar and from google.com directly)
- Sign in to websites (Google, GitHub, etc.)
- Interact with modern JavaScript applications

---

## Using the URL Bar

The URL bar supports three input modes:

| Input | Behavior | Example |
|---|---|---|
| **Full URL** | Navigates directly | `https://github.com` |
| **Domain** | Prepends `https://` | `github.com` → `https://github.com` |
| **Search query** | Searches Google | `electron webcontentsview` → Google search |

The detection logic:
- If the input contains a `.` and no spaces, it is treated as a domain
- If the input starts with a scheme (e.g., `https://`, `http://`, `ftp://`), it is used as-is
- Otherwise, it is sent as a Google search query

Press **Enter** to navigate. Press **Escape** to cancel and restore the current URL.

---

## Navigation Controls

The toolbar provides standard browser navigation:

| Button | Icon | Action |
|---|---|---|
| **Back** | `←` | Go to the previous page in history |
| **Forward** | `→` | Go to the next page in history |
| **Reload** | `↻` | Reload the current page |
| **Home** | `⌂` | Navigate to Google (home page) |

Back and Forward buttons are disabled when there is no history in that direction.

---

## Bookmarks

### Adding a Bookmark

Click the **star** icon (☆) in the toolbar to bookmark the current page. The star fills in (★) to indicate the page is bookmarked.

### Removing a Bookmark

Click the filled star (★) again to remove the bookmark.

### Accessing Bookmarks

Click on the URL bar to open the dropdown. Bookmarks appear at the top of the dropdown with a star icon. Click any bookmark to navigate to it.

Bookmarks are persisted in your VS Code profile and survive app restarts.

---

## Browsing History

### Viewing History

Click on the URL bar to open the dropdown. Recent history entries appear below bookmarks, showing the page title and URL. Click any entry to navigate to it.

### History Limits

The browser stores up to 200 history entries. Older entries are automatically removed when the limit is reached. Duplicate consecutive URLs are not recorded.

### Persistence

History is stored in VS Code's profile storage and persists across restarts.

---

## Find in Page

### Opening Find

Press `Ctrl+F` while the browser tab is active. A find bar appears below the toolbar.

### Searching

Type your search term in the find bar. Matches are highlighted in real-time as you type.

- Press **Enter** to jump to the next match
- Press **Shift+Enter** to jump to the previous match
- Press **Escape** or click the **X** button to close the find bar

---

## Downloads

When you click a download link on a web page:

1. A native **Save As** dialog appears, letting you choose where to save the file
2. A notification appears when the download completes
3. If you cancel the save dialog, the download is aborted

---

## DevTools

Click the **wrench** icon (🔧) in the toolbar to open Chromium DevTools for the embedded page. DevTools opens in a separate detached window, providing full access to:

- Elements inspector
- Console
- Network monitor
- Sources debugger
- Performance profiler

This is useful for debugging web pages or inspecting network requests.

---

## Multiple Tabs

### Opening a New Tab

Click the **+** button in the toolbar to open a new browser tab. Each tab opens as a separate editor tab in the editor group.

### Managing Tabs

Browser tabs behave like any other editor tab:

- **Close** — Click the X on the tab or press `Ctrl+W`
- **Pin** — Right-click the tab and select "Pin"
- **Split** — Drag the tab to create a split view
- **Reorder** — Drag tabs to rearrange them

### Session Restore

Browser tabs are serialized and restored when you reopen the workspace. Each tab remembers its last URL.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+P` → "Open Browser" | Open a new browser tab |
| `Ctrl+L` | Focus the URL bar and select all text |
| `Ctrl+F` | Toggle find-in-page bar |
| `Enter` (in URL bar) | Navigate to the entered URL or search |
| `Escape` (in URL bar) | Cancel editing, restore current URL |
| `Enter` (in find bar) | Next match |
| `Shift+Enter` (in find bar) | Previous match |
| `Escape` (in find bar) | Close find bar |
