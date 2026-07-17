1. "When loading google.com in an Electron WebContentsView (not iframe), the page renders correctly but buttons and interactive elements are completely non-clickable, while other websites work fine. The session is fresh (no prior cookies). Could Google's cookie consent overlay ('Before you continue to Google') be blocking all interaction? How does Google's consent mechanism work for new browser sessions, and can it render as an invisible blocking overlay?"

Google’s EU cookie/consent flow absolutely can block all interaction, but in your case it’s unlikely to be “invisible” in the normal way; if it’s blocking, it’s almost always via a full‑screen interstitial DOM overlay that should be visible unless something in your Electron environment breaks its styles or scripts. [reddit](https://www.reddit.com/r/uBlockOrigin/comments/mhqxeh/google_search_cookie_consent_popup_problem_again/)

### How Google’s consent flow works

For new / “fresh” sessions (no relevant cookies, EU/UK IP etc.), Google typically:

- Redirects to a consent host (e.g. `consent.google.com` / `consent.youtube.com`) or injects a full‑screen consent dialog into `www.google.com`.
- Renders a large dialog plus a backdrop element, often covering the whole viewport and disabling background scroll (`overflow: hidden` on `<body>` or `:root`). [daniel-lange](https://daniel-lange.com/archives/164-Getting-rid-of-the-Google-cookie-consent-popup.html)
- Uses a high‑z‑index overlay container with pointer events enabled, so clicks on the underlying page are never delivered until you accept/decline. [daniel-lange](https://daniel-lange.com/archives/164-Getting-rid-of-the-Google-cookie-consent-popup.html)

If consent is never recorded (e.g. you clear cookies each run or block the consent host), this interstitial appears every time and can effectively make the page unusable. [ghacks](https://www.ghacks.net/2021/04/01/here-is-the-easiest-way-to-get-rid-of-googles-before-you-continue-to-youtube-prompt/)

### Can it be “invisible” but still block?

Yes, that can happen, but it’s usually a _broken_ state, not the intended UX:

- Many ad‑block / filter lists “hide” the consent elements with CSS (`display:none` on the dialog) but leave behind the backdrop or body‑locking state.
- That leftover backdrop can be fully transparent, positioned over the viewport, and still intercept all mouse events, so underlying buttons never receive clicks. [cookieyes](https://www.cookieyes.com/blog/cookie-consent-and-seo/)
- There are known filters that target Google’s consent overlay (`www.google.com###lb` etc.). If those are applied in a way that only removes part of the structure, you get exactly “everything looks normal, nothing is clickable.” [reddit](https://www.reddit.com/r/uBlockOrigin/comments/mhqxeh/google_search_cookie_consent_popup_problem_again/)

In normal Chrome without special blocking, you’d see a very obvious full‑page “Before you continue…” dialog, and it would not be invisible. [daniel-lange](https://daniel-lange.com/archives/164-Getting-rid-of-the-Google-cookie-consent-popup.html)

### Why this can show up specifically in Electron

In Electron, a few things can flip you into this broken-consent state:

- Custom session / partition with no cookies, plus an ad‑blocking extension, custom `webRequest` filters, or CSP that blocks scripts or frames from `consent.google.com` or related resources. [ghacks](https://www.ghacks.net/2021/04/01/here-is-the-easiest-way-to-get-rid-of-googles-before-you-continue-to-youtube-prompt/)
- Preload scripts or `executeJavaScript` that tweak styles (e.g. `:root { overflow-y: visible !important; }` or element removal) but don’t remove the blocking layer correctly. [daniel-lange](https://daniel-lange.com/archives/164-Getting-rid-of-the-Google-cookie-consent-popup.html)
- Content filtering that removes the dialog node but not the overlay, or blocks the script that would dismiss / wire it properly. [community.brave](https://community.brave.app/t/cookie-consent-pop-up-doesn-t-show-up-page-inaccessible/510709)

The net effect is: DOM and layout for the search page look fine, but a transparent, full‑page element with `position: fixed` and pointer events is sitting on top, eating clicks.

### How to confirm in your WebContentsView

Run this in the devtools console of that WebContents:

```js
// Look for obvious consent containers
[...document.querySelectorAll('[role="dialog"], [aria-modal="true"], #lb')]
  .map(el => ({ el, z: getComputedStyle(el).zIndex, rect: el.getBoundingClientRect() }))

// Look for any full-viewport, click-blocking overlays
[...document.querySelectorAll('div, section')]
  .filter(el => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return (
      (s.position === 'fixed' || s.position === 'absolute') &&
      s.pointerEvents !== 'none' &&
      r.width >= window.innerWidth * 0.9 &&
      r.height >= window.innerHeight * 0.9
    );
  })
  .map(el => ({ el, z: getComputedStyle(el).zIndex }))
```

If you see a full‑viewport overlay element, that’s your click‑blocker. If it vanishes in Chrome but exists in Electron, your Electron environment or filters are interfering with Google’s consent UI.

### Practical implications for your bug

- Yes, a consent interstitial can definitely block all interaction globally for a fresh session. That is by design. [daniel-lange](https://daniel-lange.com/archives/164-Getting-rid-of-the-Google-cookie-consent-popup.html)
- It’s not _supposed_ to be invisible, but if you block / strip its visible UI while leaving the overlay layer or body‑locking in place, you get a “page looks fine but nothing is clickable” behavior, which matches what you’re seeing. [community.brave](https://community.brave.app/t/cookie-consent-pop-up-doesn-t-show-up-page-inaccessible/510709)
- Because other sites work, this strongly suggests either: Google is putting you through its consent interstitial for that environment only, or something about your Electron setup / filters is specifically breaking Google’s consent overlay rather than generic input handling.

2. "What specific JavaScript-level checks does Google Search perform to determine if the browser is authentic Chrome vs an embedded Chromium/Electron browser? Specifically: does Google check navigator.userAgentData.brands for 'Google Chrome', and if it's missing, does Google silently disable page interactivity (vs showing a warning or serving different HTML)?"

There is no public evidence that Google Search uses a single “navigator.userAgentData.brands contains 'Google Chrome'” check as a gate that turns interactivity on or off, nor that it silently disables interactivity specifically when that brand is missing. Instead, Google and Chromium docs suggest a broader, layered approach.

### What checks are typically available

In Chromium-based browsers, Google (and any site) can distinguish Chrome from other Chromium shells using at least:

- `navigator.userAgentData.brands` / `navigator.userAgentData` (User-Agent Client Hints) to see a **browser brand** such as `"Google Chrome"`, `"Chromium"`, `"Microsoft Edge"` etc. [stackoverflow](https://stackoverflow.com/questions/4565112/how-to-find-out-if-the-user-browser-is-chrome)
- The legacy `navigator.userAgent` + `navigator.vendor` combo (e.g. `"Chrome"` plus vendor `"Google Inc."`) for older or non-UA-CH environments. [developer.mozilla](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Browser_detection_using_the_user_agent)

Developer examples that try to detect “real Chrome” commonly do something like:

```js
navigator.userAgentData?.brands?.some((b) => b.brand === "Google Chrome");
```

combined with other checks, and this pattern is explicitly described as distinguishing Chrome from other Chromium-based browsers. [abeautifulsite](https://www.abeautifulsite.net/posts/not-everything-can-be-feature-detected/)

So yes: checking `navigator.userAgentData.brands` for `"Google Chrome"` is a known and recommended way to tell Chrome apart from other Chromium-based browsers, and it is available to Google Search as well. [developer.chrome](https://developer.chrome.com/docs/privacy-security/user-agent-client-hints)

### Electron / embedded Chromium and branding

Electron and other embedders generally identify as Chromium plus an app-specific brand in UA-CH, not as `"Google Chrome"`. Some projects explicitly expose their own brand in `navigator.userAgentData.brands` (for example, Wavebox), while still letting Chrome’s mechanisms surface the underlying Chromium brand. [github](https://github.com/nwjs/nw.js/issues/7970)

Google has a history of treating Electron-based OAuth flows differently, but that has primarily been visible in:

- OAuth login flows being blocked or flagged as “unsupported browser,” typically via user agent checks that look for `"Electron"` and/or non-Chrome patterns in the UA. [reddit](https://www.reddit.com/r/electronjs/comments/eiy2sf/google_blocking_log_in_from_electron_apps/)

Those cases show up as explicit error messages or warnings (e.g., OAuth blocked), not as Search “just not being clickable.” [reddit](https://www.reddit.com/r/electronjs/comments/eiy2sf/google_blocking_log_in_from_electron_apps/)

### Does Google Search disable interactivity if “Google Chrome” is missing?

There is no documented behavior or official guidance indicating that Search globally disables its interactive UI when the browser is not branded `"Google Chrome"` in `navigator.userAgentData.brands`. [nielsleenheer](https://nielsleenheer.com/articles/2024/the-user-agent-client-hints-api/)

What is known instead:

- Google encourages **feature detection** and progressive enhancement rather than hard UA gating. [support.google](https://support.google.com/chrome/thread/137261347/audit-usage-of-navigator-useragent-navigator-appversion-and-navigator-platform?hl=en)
- Search’s interactive widgets (People Also Ask, carousels, etc.) are driven by JS that expects a modern, fully-functional DOM/JS environment; breakage is more often due to CSP, blocked scripts, extension interference, sandboxing, or pointer-events-level CSS than to UA branding alone. [stackoverflow](https://stackoverflow.com/questions/52162205/how-to-disable-the-click-event-in-electron-app)
- Reports of “can’t click Search widgets” on non-standard browsers or locked-down environments usually trace back to missing/blocked scripts, custom CSS, or overlay elements, not to Google intentionally disabling all interaction based on UA. [support.google](https://support.google.com/websearch/thread/301321237/unable-to-click-or-interact-with-extra-features-from-google-search?hl=en)

If Google wanted to block or degrade functionality based on browser identity, the common pattern in security-related flows (like OAuth) is to surface an explicit message saying the browser is unsupported, not to silently wire up no handlers. [reddit](https://www.reddit.com/r/electronjs/comments/eiy2sf/google_blocking_log_in_from_electron_apps/)

### Putting it together for your question

- It is technically straightforward and common to check `navigator.userAgentData.brands` for `"Google Chrome"` to differentiate Chrome from other Chromium/Electron setups, and example code doing exactly that exists in the wild. [learn.microsoft](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/user-agent-guidance)
- However, there is no public, authoritative documentation that **Google Search itself** uses that specific check as a hard gate or that it silently disables page interactivity (instead of showing an “unsupported” message) when `"Google Chrome"` is absent in `brands`. [developer.mozilla](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Browser_detection_using_the_user_agent)

If you are seeing Search interactivity missing inside an Electron or embedded Chromium app, the more likely culprits are:

- User-agent or UA-CH spoofing causing different JS or experiments to be served,
- Blocked or failing JS resources (CSP, network, sandbox),
- Overlay/pointer-events issues in your shell (e.g., a transparent always-on-top layer catching clicks). [stackoverflow](https://stackoverflow.com/questions/52162205/how-to-disable-the-click-event-in-electron-app)

You can confirm whether Search is branching on UA-CH in your environment by logging `navigator.userAgent`, `navigator.vendor`, and `navigator.userAgentData` inside the embedded browser and comparing them to stock Chrome; any differences there are more about **which code path** you get than an intentional “disable interactivity if not Chrome brand” kill switch. [stackoverflow](https://stackoverflow.com/questions/4565112/how-to-find-out-if-the-user-browser-is-chrome)

3. "In Electron, when using a preload script with contextIsolation: false and sandbox: true, does Object.defineProperty on Navigator.prototype successfully override navigator.webdriver and navigator.userAgentData BEFORE the loaded page's scripts execute? Are there known issues where these overrides fail in sandboxed Electron renderers?"

With `sandbox: true` you cannot rely on `contextIsolation: false` to behave the way it does in a non‑sandboxed renderer, and your `Object.defineProperty` hacks on `Navigator.prototype` are not guaranteed to work or run before every script in the page in the way you expect. [electronjs](https://electronjs.org/docs/latest/api/structures/web-preferences)

### 1. Timing: preload vs page scripts

- Electron guarantees that the preload script runs before the page’s own scripts for a given navigation. [electronjs](https://electronjs.org/docs/latest/api/structures/web-preferences)
- However, this is “before other scripts in the page”, not “before every bit of JS that Chromium might run internally or via extensions such as UA / feature detection.” Some frameworks also cache `navigator` properties very early, so races are possible if you depend on _exact_ ordering. [electronjs](https://electronjs.org/docs/latest/api/structures/web-preferences)

### 2. Sandbox + contextIsolation interaction

- When you enable `sandbox: true`, the renderer is put into Chromium’s OS‑level sandbox and Node is disabled in that renderer context. [electronjs](https://electronjs.org/docs/latest/tutorial/sandbox)
- Disabling context isolation is tightly coupled to sandboxing: security docs explicitly warn that changing `contextIsolation` affects process sandboxing behavior. In particular, disabling context isolation can disable sandboxing in some configurations, but a sandboxed preload is more restricted and does not have full power to tamper with the page context the way a classic non‑isolated preload did. [electronjs](https://electronjs.org/docs/latest/tutorial/security)
- The modern, supported pattern is `sandbox: true` + `contextIsolation: true` + `contextBridge`, not `contextIsolation: false` in a sandboxed renderer. Several libraries and docs treat `contextIsolation: false` as legacy and warn that behavior is not future‑proof. [stackoverflow](https://stackoverflow.com/questions/65967137/the-default-of-contextisolation-is-deprecated-and-will-be-changing-from-false-to)

### 3. Overriding `navigator.webdriver` / `navigator.userAgentData`

Known pitfalls in sandboxed Electron renderers:

- The sandboxed preload runs in a separate “privileged” world and the page runs in another; direct mutation of `Navigator.prototype` in the preload world does not always affect the main world where page scripts run, even if `contextIsolation` is false in your config. This is a side‑effect of Chromium’s multiple JS worlds under sandboxing and Electron tightening security. [github](https://github.com/electron/electron/issues/28466)
- Chromium treats `navigator.webdriver` as a special, sometimes non‑configurable or controlled property in automation contexts. Attempts to redefine it via `Object.defineProperty` can be ignored or overwritten, especially when DevTools / automation are attached. This is a Chromium behavior, not specific to Electron, and it persists in Electron because Electron embeds Chromium directly. [webdriver](https://webdriver.io/docs/desktop-testing/electron/api/)
- `navigator.userAgentData` is a UA‑Client‑Hints API, and in recent Chromium builds parts of it are behind feature flags, privacy reductions, or may be frozen and not configurable in the way classic `navigator.userAgent` was. Definitions that appear to “work” in one version can silently fail after an Electron / Chromium upgrade. [github](https://github.com/electron/electron/issues/28466)

In practice, people report:

- Preload scripts not reliably altering environment-dependent values when `sandbox: true` is on, leading to advice to disable sandbox in some cases when a preload must fully control the JS environment. [electron-vite](https://electron-vite.org/guide/dev)
- Bugs and issues filed around sandboxed preloads being more limited and the Electron team explicitly tightening sandbox behavior over time. [github](https://github.com/electron/forge/issues/3425)

### 4. Recommended approach

If your _goal_ is to guarantee that page scripts see modified `navigator.webdriver` / `navigator.userAgentData`:

- The robust option is to avoid relying on prototype mutation from a sandboxed preload. Instead:
  - Use `sandbox: false` (while taking other security precautions), **or**
  - Keep `sandbox: true` but accept that you cannot reliably spoof these properties at the JS level for arbitrary remote content. [electronjs](https://electronjs.org/docs/latest/tutorial/sandbox)
- If you must stay sandboxed, treat any successful override of those properties as best‑effort, version‑dependent behavior, and test against each Electron/Chromium version you target. [github](https://github.com/electron/electron/issues/28466)

So: `Object.defineProperty` in a sandboxed preload is not a reliable or supported way to guarantee overriding `navigator.webdriver` and `navigator.userAgentData` before every page script executes, and there are known limitations/edge cases where those overrides fail or don’t affect the main world seen by page scripts. [electronjs](https://electronjs.org/docs/latest/tutorial/security)
