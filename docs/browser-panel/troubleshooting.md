# Browser Panel Troubleshooting

## Table of Contents

1. [Browser Page Stays Visible After Closing Tab](#browser-page-stays-visible-after-closing-tab)
2. [Can't Type in Web Pages](#cant-type-in-web-pages)
3. [Links Don't Navigate](#links-dont-navigate)
4. [Google Shows Degraded Page](#google-shows-degraded-page)
5. [Google Search Returns Blank Page](#google-search-returns-blank-page)
6. [Buttons Work on Other Sites but Not Google](#buttons-work-on-other-sites-but-not-google)
7. [Browser Opens in OS Default Browser](#browser-opens-in-os-default-browser)
8. [Page Overflows or Has Wrong Size](#page-overflows-or-has-wrong-size)
9. [TrustedHTML Assignment Error](#trustedhtml-assignment-error)
10. [Network Location Provider 403 Error](#network-location-provider-403-error)
11. [Downloads Don't Work](#downloads-dont-work)
12. [Diagnostic Logging](#diagnostic-logging)
13. [Known Limitations](#known-limitations)

---

## Browser Page Stays Visible After Closing Tab

**Symptom**: Closing the browser tab leaves the web page visible on top of other editors.

**Cause**: The `WebContentsView` is a native child view of the Electron `BrowserWindow`. It must be explicitly removed when the editor tab closes.

**Fix**: Ensure `clearInput()` in `browserEditor.ts` calls `destroyView()`:

```typescript
override clearInput(): void {
    if (this._viewCreated) {
        this.browserPanelService.destroyView(this.viewId);
        this._viewCreated = false;
    }
    super.clearInput();
}
```

---

## Can't Type in Web Pages

**Symptom**: You can click buttons but keyboard input doesn't reach the embedded page.

**Cause**: `WebContentsView` requires explicit `webContents.focus()` to receive keyboard events. If the view isn't focused, keyboard input goes to VS Code instead.

**Fix**: Ensure `focusView()` is called when the browser becomes active:

- After `_tryCreateView()` succeeds
- In `setEditorVisible(true)` via `requestAnimationFrame`

---

## Links Don't Navigate

**Symptom**: Clicking links on pages does nothing. No console errors.

**Cause**: VS Code's `app.ts` contains a global `will-navigate` handler that calls `event.preventDefault()` on ALL webContents. This silently blocks navigation with no error output.

**Fix**: The `will-navigate` handler must exempt the browser's session:

```typescript
// In app.ts
contents.on('will-navigate', (event, url) => {
    if (contents.session === session.fromPartition('persist:void-browser-v2')) {
        return; // allow
    }
    event.preventDefault();
});
```

**Also check**: `setWindowOpenHandler` in `app.ts` must not be set for the browser's webContents, or it will intercept `target="_blank"` links.

---

## Google Shows Degraded Page

**Symptom**: Google loads a basic HTML page (no JavaScript, no modern UI) with `no_sw_cr=1` in the URL.

**Cause**: Google detected the Electron User-Agent string and served a degraded experience. The strings `Electron/<version>` and `safe-appeals-navigator/<version>` in the UA trigger this.

**Fix**: Strip Electron/app identifiers from the User-Agent:

```typescript
const rawUA = ses.getUserAgent();
this._cleanUA = rawUA
    .replace(/\s*Electron\/\S+/g, '')
    .replace(/\s*safe-appeals-navigator\/\S+/g, '');
ses.setUserAgent(this._cleanUA);
```

---

## Google Search Returns Blank Page

**Symptom**: Typing a search in the URL bar and pressing Enter navigates to `https://www.google.com/search?q=...` but shows a blank white page.

**Cause**: This can result from:

1. Stale/corrupted cookies from previous session configurations (consent cookies, etc.)
2. Over-engineered session setup (CSP stripping, permission handlers, header interception)

**Fix**: Change the session partition to get a fresh start (e.g., `persist:void-browser-v2` → `persist:void-browser-v3`). Update `app.ts` exemptions to match. Keep session configuration minimal — only strip UA identifiers.

---

## Buttons Work on Other Sites but Not Google

**Symptom**: YouTube, GitHub, and other sites work fine, but Google's buttons (search, app grid links, etc.) are unresponsive.

**Cause**: Google is particularly sensitive to browser fingerprinting. Multiple factors can cause this:

1. `navigator.webdriver` being set to `true` (Electron default)
2. Missing or inconsistent Client Hints headers
3. Broken consent/cookie flow leaving invisible overlays
4. Over-aggressive session modifications interfering with Google's JS

**What was tried and didn't work**:

- Overriding `navigator.webdriver` via CDP (`Page.addScriptToEvaluateOnNewDocument`)
- Manual `Sec-CH-UA` header injection via `onBeforeSendHeaders`
- Pre-setting Google consent cookies (`SOCS`, `CONSENT`)
- JavaScript overlay dismissal scripts
- `disableBlinkFeatures: 'AutomationControlled'`
- CSP header stripping
- Custom permission handlers

**What works**: Minimal session setup (clean UA only) + proper navigation exemptions in `app.ts`. Google handles its own consent and feature detection correctly when we don't interfere.

---

## Browser Opens in OS Default Browser

**Symptom**: Clicking a link opens the URL in Chrome/Edge/Firefox instead of navigating within the embedded browser.

**Cause**: The `setWindowOpenHandler` in `app.ts` calls `nativeHostMainService.openExternal()` for all URLs. If this handler is active for the browser's webContents, it intercepts `target="_blank"` links.

**Fix**: `app.ts` must skip setting `setWindowOpenHandler` for the browser's session:

```typescript
if (contents.session !== session.fromPartition('persist:void-browser-v2')) {
    contents.setWindowOpenHandler(details => { ... });
}
```

---

## Page Overflows or Has Wrong Size

**Symptom**: The embedded page is offset, too large, doesn't fit the editor area, or covers the tab bar.

**Cause**: `WebContentsView.setBounds()` uses native DIP coordinates, but the DOM uses CSS pixels. At non-default zoom levels, these diverge.

**Fix**: Multiply `getBoundingClientRect()` values by `getZoomFactor()`:

```typescript
const rect = this._contentArea.getBoundingClientRect();
const zoom = getZoomFactor(DOM.getWindow(this._contentArea));
return {
    x: Math.round(rect.left * zoom),
    y: Math.round(rect.top * zoom),
    width: Math.round(rect.width * zoom),
    height: Math.round(rect.height * zoom),
};
```

Also ensure:
- The parent element has `position: relative`
- The content area has `overflow: hidden` and `min-height: 0`
- A `ResizeObserver` triggers `_updateViewBounds()` on resize

---

## TrustedHTML Assignment Error

**Symptom**: `TypeError: Failed to set the 'innerHTML' property on 'Element': This document requires 'TrustedHTML' assignment.`

**Cause**: VS Code enforces Trusted Types CSP. Direct `innerHTML` assignment is blocked.

**Fix**: Use DOM API methods instead of `innerHTML`:

```typescript
// Don't do this:
element.innerHTML = '<span class="codicon codicon-arrow-left"></span>';

// Do this instead:
const span = document.createElement('span');
span.classList.add('codicon', 'codicon-arrow-left');
element.appendChild(span);
```

---

## Network Location Provider 403 Error

**Symptom**: Console shows `Network location provider at 'https://www.googleapis.com/' : Returned error code 403.`

**Cause**: Chromium's geolocation service is blocked by Google because the browser doesn't have a Google API key configured. This is an Electron-level issue, not specific to the browser panel.

**Impact**: None for normal browsing. Geolocation-dependent features won't work, but this doesn't affect search, navigation, or page interactivity.

---

## Downloads Don't Work

**Symptom**: Clicking download links doesn't prompt a save dialog.

**Check**: The `will-download` handler is attached to the session, not the webContents. If the session was recreated (partition name change), the handler may not be re-attached.

The handler is set in `_createView()` via `wc.session.on('will-download', ...)`. Since the session is shared across all views, the handler is attached once and applies to all downloads from any browser tab.

---

## Diagnostic Logging

The browser panel includes diagnostic logging for navigation events. Check the **main process** console (not the renderer DevTools) for:

| Log Prefix | Location | Meaning |
|---|---|---|
| `[BrowserPanel] did-navigate:` | Channel | Page navigation completed |
| `[BrowserPanel] did-navigate-in-page:` | Channel | In-page navigation (hash change, pushState) |
| `[BrowserPanel] will-navigate (from view):` | Channel | Navigation is about to happen |
| `[BrowserPanel] setWindowOpenHandler:` | Channel | `target="_blank"` link or `window.open()` detected |
| `[BrowserPanel] Navigating to:` | Channel | View is loading a new URL |
| `[BrowserPanel] Load failed:` | Channel | Page load failed with error code |
| `[void-browser] will-navigate ALLOWED:` | app.ts | Navigation exemption triggered |

To access main process logs, check the terminal where the application was launched, or view the Electron main process output.

---

## Known Limitations

### Voice Search

Google's voice search shows "No internet connection" because the Web Speech API and microphone permissions are not fully supported in Electron's sandboxed `WebContentsView`.

### Printing

The embedded browser does not support `Ctrl+P` or `window.print()` natively. Use the DevTools to print if needed.

### Extensions

Browser extensions (Chrome Web Store) are not supported. `WebContentsView` does not have an extension system.

### Multiple Windows

The browser panel attaches to the focused `BrowserWindow`. If multiple windows are open, views may not track correctly across windows.

### PDF Viewing in Browser

PDFs opened via browser navigation use Chromium's built-in PDF viewer, which is separate from the IDE's custom PDF viewer.

### WebRTC / Camera / Microphone

Permission requests for camera, microphone, and other hardware are handled by Electron's default behavior (generally denied in sandbox mode). Video conferencing and similar features may not work.
