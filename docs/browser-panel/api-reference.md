# Browser Panel API Reference

## Table of Contents

1. [IBrowserPanelService](#ibrowserpanelservice)
2. [BrowserPanelChannel (IPC Server)](#browserpanelchannel-ipc-server)
3. [BrowserInput](#browserinput)
4. [BrowserEditor](#browsereditor)
5. [Shared Types](#shared-types)

---

## IBrowserPanelService

**File**: `browser/browserPanel/browserService.ts`
**Decorator**: `createDecorator<IBrowserPanelService>('browserPanelService')`
**Registration**: `InstantiationType.Delayed`

The primary service interface for the browser panel. Inject via `@IBrowserPanelService` in constructors.

### Events

#### `onNavigation: Event<BrowserViewNavigationEvent>`

Fires when the embedded page navigates (URL change, title change, or page load completes).

```typescript
this.browserPanelService.onNavigation(e => {
    console.log(`Navigated to: ${e.url} (${e.title})`);
    console.log(`Can go back: ${e.canGoBack}, forward: ${e.canGoForward}`);
});
```

#### `onLoading: Event<BrowserViewLoadingEvent>`

Fires when the page starts or stops loading.

```typescript
this.browserPanelService.onLoading(e => {
    if (e.isLoading) { showSpinner(); }
    else { hideSpinner(); }
});
```

#### `onDownload: Event<BrowserDownloadEvent>`

Fires on download lifecycle events (started, progress, completed, cancelled).

```typescript
this.browserPanelService.onDownload(e => {
    console.log(`${e.filename}: ${e.state} (${e.receivedBytes}/${e.totalBytes})`);
});
```

### View Management Methods

#### `createView(viewId: string, url: string, bounds: BrowserViewBounds): Promise<void>`

Creates a new `WebContentsView`, attaches it to the main window, and loads the specified URL.

| Parameter | Type | Description |
|---|---|---|
| `viewId` | `string` | Unique identifier for the view (UUID) |
| `url` | `string` | Initial URL to load |
| `bounds` | `BrowserViewBounds` | Native DIP coordinates `{x, y, width, height}` |

#### `destroyView(viewId: string): Promise<void>`

Removes the view from the window, closes its webContents, and frees resources.

#### `navigateTo(viewId: string, url: string): Promise<void>`

Navigates the view to a new URL. Equivalent to entering a URL in a browser's address bar.

#### `goBack(viewId: string): Promise<void>`

Navigates backward in the view's history. No-op if `canGoBack` is `false`.

#### `goForward(viewId: string): Promise<void>`

Navigates forward in the view's history. No-op if `canGoForward` is `false`.

#### `reload(viewId: string): Promise<void>`

Reloads the current page.

#### `setBounds(viewId: string, bounds: BrowserViewBounds): Promise<void>`

Updates the view's position and size. Coordinates are native DIP pixels.

#### `setVisible(viewId: string, visible: boolean): Promise<void>`

Shows or hides the view by adding/removing it from the window's content view. The view is not destroyed — its state is preserved.

#### `openDevTools(viewId: string): Promise<void>`

Opens Chromium DevTools in a detached window for the view's webContents.

#### `findInPage(viewId: string, text: string, options?: { forward?: boolean; matchCase?: boolean }): Promise<void>`

Starts a find-in-page search. Subsequent calls with the same text advance to the next match.

#### `stopFindInPage(viewId: string): Promise<void>`

Stops the find-in-page search and clears highlights.

#### `focusView(viewId: string): Promise<void>`

Gives the view's webContents keyboard focus. Required for the user to type in the embedded page.

### History Methods

#### `getHistory(): BrowserHistoryEntry[]`

Returns all history entries, most recent first. Maximum 200 entries.

#### `clearHistory(): void`

Removes all history entries.

### Bookmark Methods

#### `getBookmarks(): BrowserBookmark[]`

Returns all bookmarks, most recently added first.

#### `addBookmark(url: string, title: string): void`

Adds a bookmark. Duplicate URLs are silently ignored.

#### `removeBookmark(url: string): void`

Removes a bookmark by URL.

#### `isBookmarked(url: string): boolean`

Returns `true` if the URL is bookmarked.

---

## BrowserPanelChannel (IPC Server)

**File**: `electron-main/browserPanelChannel.ts`
**Registered**: `mainProcessElectronServer.registerChannel('void-channel-browser-panel', ...)`

The main-process IPC server. Not directly accessible from browser-process code — use `IBrowserPanelService` instead.

### Internal State

| Field | Type | Description |
|---|---|---|
| `viewOfId` | `Map<string, ManagedView>` | Maps view IDs to `{view, windowId}` |
| `_browserSession` | `Electron.Session` | Cached session (`persist:void-browser-v2`) |
| `_cleanUA` | `string` | Cleaned User-Agent string |

### ManagedView

```typescript
interface ManagedView {
    view: WebContentsView;
    windowId: number;
}
```

### WebContentsView Configuration

```typescript
new WebContentsView({
    webPreferences: {
        sandbox: true,           // OS-level process isolation
        contextIsolation: true,  // Isolate preload from page context
        nodeIntegration: false,  // No Node.js APIs in the renderer
        session: browserSession, // Dedicated persistent session
    }
});
```

---

## BrowserInput

**File**: `browser/browserPanel/browserInput.ts`
**Type ID**: `void.browserInput`
**Editor ID**: `void.browserEditor`

An `EditorInput` subclass representing one browser tab.

### Constructor

```typescript
new BrowserInput(url?: string, tabId?: string)
```

| Parameter | Default | Description |
|---|---|---|
| `url` | `'https://www.google.com'` | Initial URL |
| `tabId` | `generateUuid()` | Unique tab identifier |

### Properties

| Property | Type | Description |
|---|---|---|
| `url` | `string` | Current URL (updated via `setUrl()`) |
| `tabId` | `string` | Immutable unique identifier |
| `resource` | `URI` | `void-browser://<tabId>` |

### Methods

#### `setUrl(url: string): void`

Updates the stored URL. Does not trigger navigation.

#### `setTitle(title: string): void`

Updates the tab title and fires `_onDidChangeLabel` to update the editor tab UI.

#### `toJSON(): { url: string; tabId: string }`

Serializes the input for session restore.

#### `matches(otherInput: EditorInput | IUntypedEditorInput): boolean`

Returns `true` if the other input is a `BrowserInput` with the same `tabId`.

---

## BrowserEditor

**File**: `browser/browserPanel/browserEditor.ts`
**ID**: `void.browserEditor`

An `EditorPane` subclass that renders the browser toolbar and manages the `WebContentsView` bounds.

### Lifecycle Methods

| Method | When Called | Action |
|---|---|---|
| `createEditor(parent)` | Once, when pane is first created | Builds DOM structure (toolbar, find bar, content area) |
| `setInput(input, ...)` | When a `BrowserInput` is assigned | Creates the view or navigates existing view |
| `layout(dimension)` | On every resize | Updates view bounds |
| `setEditorVisible(visible)` | On tab switch | Shows/hides view, restores focus |
| `clearInput()` | On tab close | Destroys the view |
| `dispose()` | On pane destruction | Destroys view and disconnects observers |

### Internal Components

| Component | DOM Class | Purpose |
|---|---|---|
| `_container` | `.browser-editor-container` | Root flex container |
| `_toolbar` | `.browser-toolbar` | Navigation buttons + URL bar |
| `_contentArea` | `.browser-content-area` | Placeholder for `WebContentsView` bounds |
| `_findBar` | `.browser-find-bar` | Find-in-page UI |
| `_historyDropdown` | `.browser-history-dropdown` | URL bar dropdown |
| `_loadingBar` | `.browser-loading-bar` | Animated loading indicator |

---

## Shared Types

**File**: `common/browserPanelTypes.ts`

### BrowserViewBounds

```typescript
interface BrowserViewBounds {
    x: number;      // X position in native DIP pixels
    y: number;      // Y position in native DIP pixels
    width: number;  // Width in native DIP pixels
    height: number; // Height in native DIP pixels
}
```

### BrowserViewNavigationEvent

```typescript
interface BrowserViewNavigationEvent {
    viewId: string;
    url: string;
    title: string;
    canGoBack: boolean;
    canGoForward: boolean;
}
```

### BrowserViewLoadingEvent

```typescript
interface BrowserViewLoadingEvent {
    viewId: string;
    isLoading: boolean;
}
```

### BrowserDownloadEvent

```typescript
interface BrowserDownloadEvent {
    viewId: string;
    filename: string;
    url: string;
    state: 'started' | 'completed' | 'cancelled' | 'interrupted';
    receivedBytes: number;
    totalBytes: number;
    savePath: string;
}
```

### BrowserHistoryEntry

```typescript
interface BrowserHistoryEntry {
    url: string;
    title: string;
    timestamp: number;
}
```

### BrowserBookmark

```typescript
interface BrowserBookmark {
    url: string;
    title: string;
    addedAt: number;
}
```
