"use strict";
(() => {
  // webview-src/eml/main.ts
  var vscode = acquireVsCodeApi();
  var root = document.getElementById("root");
  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function render(message) {
    const atts = (message.attachments || []).map((a) => `<li>${escapeHtml(a.filename)} <span class="muted">(${escapeHtml(a.contentType)})</span></li>`).join("");
    const body = message.bodyHtml ? `<iframe class="body-html" sandbox="" title="body" srcdoc="${escapeAttr(message.bodyHtml)}"></iframe>` : `<pre class="body-text">${escapeHtml(message.bodyText || "(empty)")}</pre>`;
    root.innerHTML = `
		<style>
			body { margin: 0; font-family: var(--vscode-font-family); color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); }
			.wrap { padding: 16px 20px; max-width: 900px; }
			h1 { font-size: 1.25rem; margin: 0 0 12px; }
			.headers { color: var(--vscode-descriptionForeground); line-height: 1.5; margin-bottom: 16px; }
			.body-text { white-space: pre-wrap; background: var(--vscode-textCodeBlock-background, rgba(127,127,127,.1)); padding: 12px; border-radius: 4px; }
			.body-html { width: 100%; min-height: 320px; border: 1px solid var(--vscode-panel-border, #444); background: #fff; }
			.muted { opacity: .8; font-size: 12px; }
			ul { padding-left: 18px; }
		</style>
		<div class="wrap">
			<h1>${escapeHtml(message.subject || "(No Subject)")}</h1>
			<div class="headers">
				<div><strong>From:</strong> ${escapeHtml(message.from || "")}</div>
				<div><strong>To:</strong> ${escapeHtml(message.to || "")}</div>
				${message.cc ? `<div><strong>Cc:</strong> ${escapeHtml(message.cc)}</div>` : ""}
				<div><strong>Date:</strong> ${escapeHtml(message.date ? new Date(message.date).toLocaleString() : "")}</div>
			</div>
			${atts ? `<div><strong>Attachments</strong><ul>${atts}</ul></div>` : ""}
			${body}
		</div>
	`;
  }
  function escapeAttr(s) {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }
  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (msg?.type === "loadEmail" && msg.message) {
      render(msg.message);
    }
  });
  vscode.postMessage({ type: "ready" });
})();
