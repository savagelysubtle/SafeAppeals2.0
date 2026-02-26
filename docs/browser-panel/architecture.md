# Browser Panel Architecture

## Table of Contents

1. [System Overview](#system-overview)
2. [Process Model](#process-model)
3. [Component Map](#component-map)
4. [IPC Channel Design](#ipc-channel-design)
5. [Session & Identity](#session--identity)
6. [Navigation Pipeline](#navigation-pipeline)
7. [View Lifecycle](#view-lifecycle)
8. [Focus Management](#focus-management)
9. [Security Exemptions in app.ts](#security-exemptions-in-appts)
10. [Coordinate System](#coordinate-system)

---

## System Overview

The browser panel uses Electron's `WebContentsView` API to embed a real Chromium renderer as a native child view of the main application window. Unlike VS Code's built-in webview (which is an iframe with restrictive sandboxing), `WebContentsView` runs a full browser process with unrestricted web standards support.

```
┌──────────────────────────────────────────────────────────────────┐
│  Electron Main Process                                            │
│                                                                    │
│  app.ts                                                           │
│  ├── Registers BrowserPanelChannel on IPC                        │
│  ├── Exempts persist:void-browser-v2 from will-navigate block    │
│  └── Exempts persist:void-browser-v2 from setWindowOpenHandler   │
│                                                                    │
│  BrowserPanelChannel (electron-main/browserPanelChannel.ts)      │
│  ├── Creates/destroys WebContentsView instances                   │
│  ├── Manages persist:void-browser-v2 session                     │
│  ├── Handles navigation, bounds, visibility, downloads           │
│  └── Fires events: onNavigation, onLoading, onDownload           │
│                                │                                   │
│                          IPC (IServerChannel)                      │
│                                │                                   │
│  ┌─────────────────────────────▼────────────────────────────────┐ │
│  │  VS Code Browser Process (Renderer)                          │ │
│  │                                                               │ │
│  │  BrowserPanelService (browser/browserService.ts)             │ │
│  │  ├── IChannel client for BrowserPanelChannel                 │ │
│  │  ├── Persists history + bookmarks via IStorageService        │ │
│  │  └── Relays events to BrowserEditor                          │ │
│  │                                                               │ │
│  │  BrowserEditor (browser/browserEditor.ts)                    │ │
│  │  ├── EditorPane — renders toolbar, URL bar, find bar         │ │
│  │  ├── Computes WebContentsView bounds from DOM layout         │ │
│  │  ├── Listens for navigation/loading events to update UI      │ │
│  │  └── Manages focus and resize observation                    │ │
│  │                                                               │ │
│  │  BrowserInput (browser/browserInput.ts)                      │ │
│  │  ├── EditorInput — represents one browser tab                │ │
│  │  └── Serializable for session restore                        │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  WebContentsView (native child view)                          │ │
│  │  ├── Full Chromium renderer (sandbox: true)                   │ │
│  │  ├── Session: persist:void-browser-v2                         │ │
│  │  ├── Clean User-Agent (Electron/app identifiers stripped)     │ │
│  │  └── Positioned over BrowserEditor's _contentArea div         │ │
│  └───────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## Process Model

The browser spans two Electron processes:

### Main Process (`electron-main/`)

- **`BrowserPanelChannel`** — The IPC server. Creates `WebContentsView` instances, attaches them to the `BrowserWindow`, manages sessions, handles navigation commands, and emits events.
- **`app.ts`** — Registers the channel on the `mainProcessElectronServer` and contains security exemptions that allow the browser's `WebContentsView` to navigate freely.

### Browser Process (`browser/`)

- **`BrowserPanelService`** — The IPC client. Wraps the channel in a service interface (`IBrowserPanelService`) for dependency injection. Also manages persistent history and bookmarks via `IStorageService`.
- **`BrowserEditor`** — The `EditorPane` subclass that renders the browser's toolbar UI (back/forward/reload/home, URL bar, bookmarks, find bar, DevTools button) and computes the native bounds for the `WebContentsView`.
- **`BrowserInput`** — The `EditorInput` subclass representing one browser tab. Each instance has a unique `tabId` and stores the current URL and title.
- **`BrowserInputSerializer`** — Serializes `BrowserInput` to JSON for session restore.

### Common (`common/`)

- **`browserPanelTypes.ts`** — Shared TypeScript interfaces for IPC messages (`BrowserViewBounds`, `BrowserViewNavigationEvent`, `BrowserViewLoadingEvent`).

---

## Component Map

```
src/vs/workbench/contrib/void/
├── common/
│   └── browserPanelTypes.ts          # Shared IPC interfaces
├── browser/
│   └── browserPanel/
│       ├── browserEditor.ts          # EditorPane (toolbar + DOM layout)
│       ├── browserInput.ts           # EditorInput (tab identity)
│       ├── browserInputSerializer.ts # Session restore serializer
│       └── browserService.ts         # IBrowserPanelService (IPC client)
└── electron-main/
    └── browserPanelChannel.ts        # IServerChannel (view manager)

src/vs/code/electron-main/
└── app.ts                            # Channel registration + security exemptions
```

### Registration

All components are registered in `documentViewer.contribution.ts`:

- `BrowserEditor` is registered as an `EditorPane` with a `SyncDescriptor(BrowserInput)` binding
- `BrowserInputSerializer` is registered as an editor serializer
- `BrowserPanelService` self-registers via `registerSingleton` in `browserService.ts`
- The "Open Browser" action is registered in `sidebarActions.ts`

---

## IPC Channel Design

Communication uses VS Code's `IServerChannel` / `IChannel` pattern over Electron IPC.

### Commands (browser → main)

| Command | Arguments | Description |
|---|---|---|
| `createView` | `viewId`, `url`, `bounds` | Creates a new `WebContentsView` and loads the URL |
| `destroyView` | `viewId` | Removes the view from the window and closes its webContents |
| `navigateTo` | `viewId`, `url` | Navigates the view to a new URL |
| `goBack` | `viewId` | Navigates back in history |
| `goForward` | `viewId` | Navigates forward in history |
| `reload` | `viewId` | Reloads the current page |
| `setBounds` | `viewId`, `bounds` | Updates the view's position and size |
| `setVisible` | `viewId`, `visible` | Shows or hides the view (adds/removes from window) |
| `openDevTools` | `viewId` | Opens Chromium DevTools in a detached window |
| `findInPage` | `viewId`, `text`, `options?` | Starts find-in-page |
| `stopFindInPage` | `viewId` | Stops find-in-page |
| `focusView` | `viewId` | Focuses the webContents for keyboard input |

### Events (main → browser)

| Event | Payload | Description |
|---|---|---|
| `onNavigation` | `BrowserViewNavigationEvent` | Fires on `did-navigate`, `did-navigate-in-page`, `did-stop-loading`, `page-title-updated` |
| `onLoading` | `BrowserViewLoadingEvent` | Fires on `did-start-loading` and `did-stop-loading` |
| `onDownload` | `BrowserDownloadEvent` | Fires on download start, progress, and completion |

---

## Session & Identity

### Dedicated Partition

The browser uses `session.fromPartition('persist:void-browser-v2')` — a persistent, isolated session that:

- **Persists cookies and storage** across app restarts (the `persist:` prefix ensures data is written to disk)
- **Isolates the browser** from VS Code's own session, preventing cross-contamination of cookies, caches, or storage
- **Provides a clean identity** — Electron and app identifiers are stripped from the User-Agent string to present as a standard Chrome browser

### User-Agent Cleaning

```
Before: Mozilla/5.0 ... Chrome/128.0 ... Electron/32.0 safe-appeals-navigator/1.0
After:  Mozilla/5.0 ... Chrome/128.0 ...
```

Only `Electron/<version>` and `safe-appeals-navigator/<version>` are stripped. The underlying Chromium UA string remains intact, including Client Hints, which allows websites like Google to serve their full-featured experience.

---

## Navigation Pipeline

When a user clicks a link or submits a form in the embedded page:

### Standard Navigation (`will-navigate`)

1. The Chromium renderer fires a `will-navigate` event on the webContents
2. VS Code's global handler in `app.ts` intercepts ALL `will-navigate` events
3. The handler checks `contents.session === session.fromPartition('persist:void-browser-v2')`
4. If the session matches → navigation is **allowed** (handler returns early)
5. If not → navigation is **blocked** (`event.preventDefault()`)

### Window Open (`setWindowOpenHandler`)

For `target="_blank"` links or `window.open()` calls:

1. The Chromium renderer triggers `setWindowOpenHandler`
2. VS Code's global handler in `app.ts` normally intercepts this and opens the URL in the OS default browser
3. For our browser session, `app.ts` **skips setting** the handler entirely
4. Our handler in `browserPanelChannel.ts` catches the event, denies the new window, and navigates the current view to the target URL via `process.nextTick(() => wc.loadURL(targetUrl))`

### URL Bar Navigation

1. User types in the URL bar and presses Enter
2. `BrowserEditor._navigate()` normalizes the input:
   - Contains `.` and no spaces → prepend `https://`
   - Otherwise → Google search query (`https://www.google.com/search?q=...`)
   - Already has a scheme → use as-is
3. Calls `browserPanelService.navigateTo()` which sends `navigateTo` via IPC
4. Main process calls `wc.loadURL(url)`

---

## View Lifecycle

### Creation

1. User triggers `void.openBrowser` action (globe button or command palette)
2. Action creates a `BrowserInput` and opens it via `IEditorService`
3. VS Code creates a `BrowserEditor` pane and calls `setInput()` → `_tryCreateView()`
4. `_tryCreateView()` computes content bounds and calls `browserPanelService.createView()`
5. Main process creates a `WebContentsView`, attaches it to the window, and loads the URL
6. `focusView()` is called to give the view keyboard focus

### Visibility

When the user switches to a different editor tab:

1. VS Code calls `setEditorVisible(false)` on the `BrowserEditor`
2. `BrowserEditor` calls `browserPanelService.setVisible(viewId, false)`
3. Main process calls `win.contentView.removeChildView(view)` — the native view is detached but not destroyed

When the user switches back:

1. VS Code calls `setEditorVisible(true)`
2. `BrowserEditor` calls `setVisible(true)` → `addChildView()` re-attaches the view
3. Bounds are updated and `focusView()` restores keyboard focus

### Destruction

When the user closes the browser tab:

1. VS Code calls `clearInput()` on the `BrowserEditor`
2. `clearInput()` calls `browserPanelService.destroyView(viewId)`
3. Main process removes the child view from the window and calls `wc.close()`
4. The `WebContentsView` and its renderer process are destroyed

If the `EditorPane` itself is disposed, `dispose()` also calls `destroyView()` as a safety net.

---

## Focus Management

`WebContentsView` requires explicit focus for keyboard input. The browser calls `browserPanelService.focusView()` (which calls `wc.focus()` in the main process) in two scenarios:

1. **After view creation** — Immediately after `createView()` returns, the view is focused
2. **On visibility restore** — When `setEditorVisible(true)` fires, focus is restored after bounds are updated

Mouse events are routed natively by Electron's compositor to the topmost view at the click position, so clicks on the embedded page work without explicit focus management.

---

## Security Exemptions in app.ts

VS Code's `app.ts` contains security measures in the `web-contents-created` handler that block navigation and window opens for all webContents. The browser panel requires two exemptions:

### 1. `will-navigate` Exemption

```typescript
contents.on('will-navigate', (event, url) => {
    if (contents.session === session.fromPartition('persist:void-browser-v2')) {
        return; // allow navigation in embedded browser
    }
    event.preventDefault();
});
```

Without this, every in-page navigation (link clicks, form submissions, JavaScript redirects) would be silently blocked.

### 2. `setWindowOpenHandler` Exemption

```typescript
if (contents.session !== session.fromPartition('persist:void-browser-v2')) {
    contents.setWindowOpenHandler(details => { ... });
}
```

Without this, `target="_blank"` links would be intercepted and opened in the OS default browser, and `setWindowOpenHandler` is a replace operation so it would overwrite our custom handler.

Both exemptions use session identity comparison (`===` on the `Session` object) because Electron caches `session.fromPartition()` results — the same partition string always returns the same `Session` instance.

---

## Coordinate System

The `WebContentsView` uses native DIP (device-independent pixel) coordinates for `setBounds()`, but the browser-process DOM uses CSS pixels. When VS Code applies a zoom level, these diverge.

The conversion in `_computeContentBounds()`:

```typescript
const rect = this._contentArea.getBoundingClientRect(); // CSS pixels
const zoom = getZoomFactor(DOM.getWindow(this._contentArea));

return {
    x: Math.round(rect.left * zoom),
    y: Math.round(rect.top * zoom),
    width: Math.round(rect.width * zoom),
    height: Math.round(rect.height * zoom),
};
```

A `ResizeObserver` on the parent element triggers `_updateViewBounds()` on every resize, keeping the native view aligned with the DOM layout as panels are resized, split, or the window is resized.
