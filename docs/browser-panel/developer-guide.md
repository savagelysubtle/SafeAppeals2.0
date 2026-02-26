# Browser Panel Developer Guide

## Table of Contents

1. [Code Organization](#code-organization)
2. [Adding a New IPC Command](#adding-a-new-ipc-command)
3. [Adding a Toolbar Button](#adding-a-toolbar-button)
4. [Modifying the Session](#modifying-the-session)
5. [Handling New Electron Events](#handling-new-electron-events)
6. [Working with app.ts Security](#working-with-appts-security)
7. [Testing Changes](#testing-changes)
8. [Common Pitfalls](#common-pitfalls)

---

## Code Organization

### Source Files

| File | Process | Purpose |
|---|---|---|
| `common/browserPanelTypes.ts` | Shared | IPC interface definitions |
| `browser/browserPanel/browserEditor.ts` | Browser | EditorPane — toolbar UI, DOM layout, bounds |
| `browser/browserPanel/browserInput.ts` | Browser | EditorInput — tab identity and serialization |
| `browser/browserPanel/browserInputSerializer.ts` | Browser | Session restore serializer |
| `browser/browserPanel/browserService.ts` | Browser | `IBrowserPanelService` — IPC client, history, bookmarks |
| `electron-main/browserPanelChannel.ts` | Main | `IServerChannel` — view lifecycle, session, events |

### Registration Points

| What | Where |
|---|---|
| EditorPane + EditorInput | `documentViewer.contribution.ts` |
| EditorSerializer | `documentViewer.contribution.ts` |
| Service singleton | `browserService.ts` (self-registers) |
| IPC channel | `app.ts` line ~1357 |
| Open action | `sidebarActions.ts` (`void.openBrowser`) |
| Security exemptions | `app.ts` lines ~445 and ~459 |

---

## Adding a New IPC Command

To add a new command that the browser process can call on the main process:

### Step 1: Add the Interface Method

In `browserService.ts`, add the method to the `IBrowserPanelService` interface:

```typescript
export interface IBrowserPanelService {
    // ...existing methods...
    myNewCommand(viewId: string, arg: string): Promise<void>;
}
```

### Step 2: Implement the Client

In the `BrowserPanelService` class in `browserService.ts`:

```typescript
async myNewCommand(viewId: string, arg: string): Promise<void> {
    return this.channel.call('myNewCommand', { viewId, arg });
}
```

### Step 3: Implement the Server

In `browserPanelChannel.ts`, add the case in `call()` and the implementation:

```typescript
async call(_ctx: unknown, command: string, args?: any): Promise<any> {
    switch (command) {
        // ...existing cases...
        case 'myNewCommand': return this._myNewCommand(args.viewId, args.arg);
    }
}

private _myNewCommand(viewId: string, arg: string): void {
    const managed = this.viewOfId.get(viewId);
    if (!managed) { return; }
    // Use managed.view.webContents for Electron APIs
}
```

### Step 4: Add Shared Types (if needed)

If the command uses new data structures, define them in `common/browserPanelTypes.ts`.

---

## Adding a Toolbar Button

Toolbar buttons are created in `BrowserEditor._buildToolbar()`:

```typescript
private _buildToolbar(): void {
    // ...existing buttons...

    const myBtn = DOM.append(rightGroup, DOM.$('button.browser-btn')) as HTMLButtonElement;
    appendIcon(myBtn, 'codicon-my-icon');
    myBtn.title = 'My Action';
    myBtn.addEventListener('click', () => {
        this.browserPanelService.myNewCommand(this.viewId, 'value');
    });
}
```

Button styling is applied automatically by `_applyStyles()` via the `.browser-btn` class selector.

Available Codicon names can be found in VS Code's [Codicon reference](https://microsoft.github.io/vscode-codicons/dist/codicon.html).

---

## Modifying the Session

The browser session is created in `BrowserPanelChannel._ensureBrowserSession()`. This method runs once and caches the session.

### Changing the Partition Name

If you change the partition name (e.g., from `persist:void-browser-v2` to `persist:void-browser-v3`), you **must also update** `app.ts` in two places:

1. The `will-navigate` exemption (~line 446)
2. The `setWindowOpenHandler` exemption (~line 459)

Changing the partition clears all stored cookies, cache, and site data for the browser.

### Adding Session Configuration

Add configuration after the `session.fromPartition()` call in `_ensureBrowserSession()`:

```typescript
private _ensureBrowserSession(): Electron.Session {
    if (this._browserSession) { return this._browserSession; }

    const ses = session.fromPartition('persist:void-browser-v2');

    // User-Agent cleaning (existing)
    const rawUA = ses.getUserAgent();
    this._cleanUA = rawUA
        .replace(/\s*Electron\/\S+/g, '')
        .replace(/\s*safe-appeals-navigator\/\S+/g, '');
    ses.setUserAgent(this._cleanUA);

    // Add your configuration here, e.g.:
    // ses.setPermissionRequestHandler(...)
    // ses.webRequest.onBeforeSendHeaders(...)

    this._browserSession = ses;
    return ses;
}
```

**Important**: Keep session configuration minimal. Over-engineering the session (header interception, CSP stripping, UA spoofing) was found to break websites more than it helps. The current minimal approach works with all tested sites including Google.

---

## Handling New Electron Events

Electron `webContents` events are attached in `_createView()`:

```typescript
private _createView(viewId: string, url: string, bounds: BrowserViewBounds): void {
    // ...view creation...
    const wc = view.webContents;

    // Add your event listener
    wc.on('my-event', (event, ...args) => {
        // Handle the event
        // Fire an IPC event if the browser process needs to know:
        this._onMyEvent.fire({ viewId, ...data });
    });
}
```

To expose the event to the browser process:

1. Add an `Emitter` to `BrowserPanelChannel`
2. Add it to the `listen()` switch statement
3. Add a listener in `BrowserPanelService` constructor
4. Expose the event on `IBrowserPanelService`

---

## Working with app.ts Security

The `app.ts` file contains security-critical code guarded by:

```
// !!! DO NOT CHANGE without consulting the documentation !!!
```

Our browser panel requires two narrowly-scoped exemptions that use session identity to ensure only the browser's `WebContentsView` is affected. When modifying these:

- **Never** remove the security measures for non-browser webContents
- **Always** use session identity comparison (`contents.session === session.fromPartition(...)`)
- **Never** use URL-based checks (URLs can be spoofed)
- **Test** that VS Code's webviews, auxiliary windows, and extension host still have navigation blocked after your changes

---

## Testing Changes

### Compilation

```bash
bun run compile
```

Or use the watch task for automatic rebuilding:

```bash
bun run watch-clientd
```

### Launch

```bash
.\scripts\code.bat   # Windows
./scripts/code.sh    # macOS/Linux
```

### Manual Test Checklist

After changes to the browser panel:

- [ ] Browser opens via globe button and command palette
- [ ] URL bar accepts text and navigates on Enter
- [ ] Plain text searches Google
- [ ] Domain names get `https://` prepended
- [ ] Back/Forward/Reload/Home buttons work
- [ ] Links on web pages navigate correctly
- [ ] `target="_blank"` links open in the same view (not OS browser)
- [ ] Google Search works (both URL bar and google.com search box)
- [ ] Google sign-in works
- [ ] Bookmarks can be added and removed
- [ ] History dropdown shows recent pages
- [ ] Find in page works (`Ctrl+F`)
- [ ] Downloads prompt a save dialog
- [ ] DevTools opens in a detached window
- [ ] Closing the browser tab removes the embedded page
- [ ] Switching tabs hides/shows the browser correctly
- [ ] Resizing panels updates the browser bounds
- [ ] VS Code webviews and extensions are NOT affected by security exemptions

---

## Common Pitfalls

### 1. Forgetting to Update app.ts

If you change the session partition name, the `will-navigate` and `setWindowOpenHandler` exemptions in `app.ts` will stop matching. All navigation will be silently blocked with no console errors.

### 2. setWindowOpenHandler is a Replace Operation

`setWindowOpenHandler` allows only ONE handler per webContents. The last call wins. This is why `app.ts` conditionally skips setting it for our browser session — if it set one, it would overwrite ours.

### 3. IPC is Asynchronous

All `browserPanelService` calls go through Electron IPC. They are asynchronous even when the main process handler is synchronous. Don't assume immediate effect after calling a service method.

### 4. Coordinate Systems

`getBoundingClientRect()` returns CSS pixels. `WebContentsView.setBounds()` expects native DIP pixels. Always multiply by `getZoomFactor()` when converting.

### 5. Focus Management

`WebContentsView` does not automatically receive keyboard focus on click in all environments. Always call `focusView()` when the editor becomes active.

### 6. Session Configuration

Aggressive session configuration (header interception, CSP stripping, UA overrides, permission handlers) was tested extensively and found to break more than it fixes. The minimal approach (clean UA only) is the result of iterative debugging. Add new session configuration only with specific justification and thorough testing.
