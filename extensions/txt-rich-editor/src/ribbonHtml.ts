/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { isWebEnvironment } from './conversion';

/**
 * Generate the full ribbon HTML for the rich text editor
 * Used by both text file and DOCX file editors
 */
export function generateRibbonHtml(_webview: vscode.Webview, documentType: string = 'txt'): string {
	const isWeb = isWebEnvironment();

	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rich Text Editor</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 0;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        /* Ribbon UI Styles */
        .ribbon {
            background: linear-gradient(to bottom, #f8f8f8 0%, #e8e8e8 100%);
            border-bottom: 1px solid #d0d0d0;
            padding: 8px 12px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .ribbon-tabs {
            display: flex;
            margin-bottom: 8px;
        }

        .ribbon-tab {
            background: transparent;
            border: none;
            padding: 6px 12px;
            cursor: pointer;
            font-size: 13px;
            color: #333;
            border-radius: 3px 3px 0 0;
            margin-right: 2px;
        }

        .ribbon-tab.active {
            background: white;
            border: 1px solid #d0d0d0;
            border-bottom: none;
            color: #000;
        }

        .ribbon-content {
            background: white;
            border: 1px solid #d0d0d0;
            border-top: none;
            padding: 12px;
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
        }

        .ribbon-group {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
        }

        .ribbon-group-title {
            font-size: 11px;
            color: #666;
            margin-bottom: 6px;
            font-weight: bold;
        }

        .ribbon-group-content {
            display: flex;
            gap: 2px;
            align-items: center;
        }

        .ribbon-button {
            background: transparent;
            border: 1px solid transparent;
            padding: 6px 8px;
            cursor: pointer;
            font-size: 12px;
            color: #333;
            border-radius: 3px;
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 28px;
            height: 28px;
        }

        .ribbon-button:hover {
            background: #e6f3ff;
            border-color: #b3d9ff;
        }

        .ribbon-button.active {
            background: #cce7ff;
            border-color: #99d6ff;
        }

        .ribbon-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .ribbon-button:disabled:hover {
            background: transparent;
            border-color: transparent;
        }

        .ribbon-select {
            background: white;
            border: 1px solid #ccc;
            padding: 4px 6px;
            font-size: 12px;
            border-radius: 3px;
            min-width: 80px;
        }

        .ribbon-select:hover {
            border-color: #999;
        }

        /* Editor container with layered elements */
        .editor-container {
            position: relative;
            flex: 1;
            overflow: hidden;
            background-color: #ffffff;
            box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);
            display: flex;
            justify-content: center;
        }

        .editor-canvas-layer {
            position: absolute;
            top: 0;
            left: 60px; /* Left margin for line numbers */
            right: 0;
            bottom: 0;
            z-index: 1;
            pointer-events: none;
        }

        .ruler-top {
            position: absolute;
            top: 0;
            left: 60px;
            right: 0;
            height: 32px;
            background: linear-gradient(to bottom, #fafafa 0%, #ececec 100%);
            border-bottom: 1px solid #c0c0c0;
            z-index: 10;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .margin-left {
            position: absolute;
            left: 0;
            top: 0;
            width: 60px;
            bottom: 0;
            background: linear-gradient(to right, #fafafa 0%, #f0f0f0 100%);
            border-right: 1px solid #c0c0c0;
            z-index: 10;
            box-shadow: 1px 0 2px rgba(0,0,0,0.05);
        }

        .margin-indicator {
            position: absolute;
            top: 32px; /* Below ruler */
            bottom: 0;
            width: 1px;
            background: rgba(0, 120, 215, 0.4);
            pointer-events: none;
            z-index: 9;
            transition: left 0.1s ease, right 0.1s ease;
        }

        .margin-left-indicator {
            left: 100px; /* Left text margin */
        }

        .margin-right-indicator {
            right: 100px; /* Right text margin */
        }

        .margin-handle {
            position: absolute;
            top: 0;
            width: 12px;
            height: 32px;
            cursor: ew-resize;
            z-index: 11;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .margin-handle:hover {
            background: rgba(0, 120, 215, 0.1);
        }

        .margin-handle::after {
            content: '';
            width: 6px;
            height: 12px;
            background: #0078d4;
            border-radius: 2px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.2);
        }

        .margin-handle-left {
            left: 154px; /* Just before left margin indicator */
        }

        .margin-handle-right {
            right: 94px; /* Just before right margin indicator */
        }

        .editor-wrapper {
            position: absolute;
            top: 32px; /* Below ruler */
            left: 60px; /* After line numbers */
            right: 0;
            bottom: 0;
            overflow-y: auto;
            overflow-x: hidden;
        }

        .editor {
            position: relative;
            width: 100%;
            max-width: calc(100% - 120px); /* Account for centered content */
            padding: 10px 120px 40px 120px; /* Space for margins */
            margin: 0 auto; /* Center the content */
            outline: none;
            line-height: 1.6;
            z-index: 2;
            background: transparent;
            min-height: calc(100vh - 250px);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 14px;
            color: #1a1a1a;
            box-sizing: border-box;
        }

        .editor:focus {
            outline: none;
        }

        .editor::selection {
            background: rgba(0, 120, 215, 0.25);
        }

        .editor b {
            font-weight: bold;
        }

        .editor i {
            font-style: italic;
        }

        .editor u {
            text-decoration: underline;
        }

        .editor h1 {
            font-size: 2em;
            font-weight: bold;
            margin: 0.67em 0;
        }

        .editor h2 {
            font-size: 1.5em;
            font-weight: bold;
            margin: 0.75em 0;
        }

        .editor h3 {
            font-size: 1.17em;
            font-weight: bold;
            margin: 0.83em 0;
        }

        .editor ul, .editor ol {
            margin: 1em 0;
            padding-left: 2em;
        }

        .editor li {
            margin: 0.25em 0;
        }

        .editor blockquote {
            margin: 1em 0;
            padding-left: 1em;
            border-left: 3px solid var(--vscode-textBlockQuote-border);
            color: var(--vscode-textBlockQuote-foreground);
        }

        .editor code {
            background-color: var(--vscode-textCodeBlock-background);
            color: var(--vscode-textCodeBlock-foreground);
            padding: 2px 4px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
        }

        .editor pre {
            background-color: var(--vscode-textCodeBlock-background);
            color: var(--vscode-textCodeBlock-foreground);
            padding: 1em;
            border-radius: 3px;
            overflow-x: auto;
            margin: 1em 0;
        }

        .editor pre code {
            background: none;
            padding: 0;
        }
    </style>
</head>
<body>
    <div class="ribbon">
        <div class="ribbon-tabs">
            <button class="ribbon-tab active" id="homeTab">Home</button>
            <button class="ribbon-tab" id="insertTab">Insert</button>
            <button class="ribbon-tab" id="pageLayoutTab">Page Layout</button>
            <button class="ribbon-tab" id="viewTab">View</button>
            <button class="ribbon-tab" id="formatTab">Format</button>
        </div>

        <div class="ribbon-content" id="homeContent">
            <!-- Clipboard Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">Clipboard</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="undo" title="Undo (Ctrl+Z)">↶</button>
                    <button class="ribbon-button" id="redo" title="Redo (Ctrl+Y)">↷</button>
                </div>
            </div>

            <!-- Font Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">Font</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="bold" title="Bold (Ctrl+B)"><b>B</b></button>
                    <button class="ribbon-button" id="italic" title="Italic (Ctrl+I)"><i>I</i></button>
                    <button class="ribbon-button" id="underline" title="Underline (Ctrl+U)"><u>U</u></button>
                    <button class="ribbon-button" id="strikethrough" title="Strikethrough"><s>S</s></button>
                    <select class="ribbon-select" id="fontSize" title="Font Size">
                        <option value="8">8</option>
                        <option value="9">9</option>
                        <option value="10">10</option>
                        <option value="11" selected>11</option>
                        <option value="12">12</option>
                        <option value="14">14</option>
                        <option value="16">16</option>
                        <option value="18">18</option>
                        <option value="20">20</option>
                        <option value="24">24</option>
                    </select>
                </div>
            </div>

            <!-- Paragraph Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">Paragraph</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="alignLeft" title="Align Left">⬅</button>
                    <button class="ribbon-button" id="alignCenter" title="Align Center">⬆</button>
                    <button class="ribbon-button" id="alignRight" title="Align Right">➡</button>
                    <button class="ribbon-button" id="indent" title="Increase Indent">⤇</button>
                    <button class="ribbon-button" id="outdent" title="Decrease Indent">⤆</button>
                </div>
            </div>

            <!-- Lists Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">Lists</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="bulletList" title="Bullet List">•</button>
                    <button class="ribbon-button" id="numberList" title="Numbered List">1.</button>
                </div>
            </div>

            <!-- Styles Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">Styles</div>
                <div class="ribbon-group-content">
                    <select class="ribbon-select" id="heading" title="Heading Level">
                        <option value="p">Normal</option>
                        <option value="h1">Heading 1</option>
                        <option value="h2">Heading 2</option>
                        <option value="h3">Heading 3</option>
                    </select>
                    <button class="ribbon-button" id="blockquote" title="Blockquote">"</button>
                </div>
            </div>

            <!-- File Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">File</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="importDocx" title="Import DOCX" ${isWeb ? 'disabled' : ''}>📁</button>
                    <button class="ribbon-button" id="exportDocx" title="Export DOCX" ${isWeb ? 'disabled' : ''}>💾</button>
                </div>
            </div>
        </div>

        <!-- Insert Tab (hidden by default) -->
        <div class="ribbon-content" id="insertContent" style="display: none;">
            <!-- Similar to Home tab but with Insert features -->
        </div>

        <!-- Other tabs hidden by default -->
        <div class="ribbon-content" id="pageLayoutContent" style="display: none;"></div>
        <div class="ribbon-content" id="viewContent" style="display: none;"></div>
        <div class="ribbon-content" id="formatContent" style="display: none;"></div>
    </div>

    <!-- Editor Container with Canvas-based Rulers/Margins -->
    <div class="editor-container">
        <canvas class="editor-canvas-layer" id="editorCanvas"></canvas>
        <canvas class="ruler-top" id="rulerCanvas"></canvas>
        <canvas class="margin-left" id="marginCanvas"></canvas>
        <div class="margin-indicator margin-left-indicator" id="leftMarginIndicator"></div>
        <div class="margin-indicator margin-right-indicator" id="rightMarginIndicator"></div>
        <div class="margin-handle margin-handle-left" id="leftMarginHandle"></div>
        <div class="margin-handle margin-handle-right" id="rightMarginHandle"></div>
        <div class="editor-wrapper" id="editorWrapper">
            <div class="editor" id="editor" contenteditable="true"></div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const editor = document.getElementById('editor');
        const documentType = '${documentType}';

        // Notify extension that webview is ready
        vscode.postMessage({ type: 'ready' });

        // Ribbon tab switching
        document.querySelectorAll('.ribbon-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                // Hide all content
                document.querySelectorAll('.ribbon-content').forEach(c => c.style.display = 'none');
                document.querySelectorAll('.ribbon-tab').forEach(t => t.classList.remove('active'));

                // Show selected content
                tab.classList.add('active');
                const contentId = tab.id.replace('Tab', 'Content');
                const content = document.getElementById(contentId);
                if (content) content.style.display = 'flex';
            });
        });

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;

            switch (message.type) {
                case 'set-content':
                    if (message.isHtml) {
                        editor.innerHTML = message.content;
                    } else {
                        editor.textContent = message.content;
                    }
                    break;
            }
        });

        // Toolbar button handlers
        document.getElementById('bold').addEventListener('click', () => document.execCommand('bold'));
        document.getElementById('italic').addEventListener('click', () => document.execCommand('italic'));
        document.getElementById('underline').addEventListener('click', () => document.execCommand('underline'));
        document.getElementById('strikethrough').addEventListener('click', () => document.execCommand('strikeThrough'));
        document.getElementById('undo').addEventListener('click', () => document.execCommand('undo'));
        document.getElementById('redo').addEventListener('click', () => document.execCommand('redo'));

        document.getElementById('alignLeft').addEventListener('click', () => document.execCommand('justifyLeft'));
        document.getElementById('alignCenter').addEventListener('click', () => document.execCommand('justifyCenter'));
        document.getElementById('alignRight').addEventListener('click', () => document.execCommand('justifyRight'));
        document.getElementById('indent').addEventListener('click', () => document.execCommand('indent'));
        document.getElementById('outdent').addEventListener('click', () => document.execCommand('outdent'));

        document.getElementById('bulletList').addEventListener('click', () => document.execCommand('insertUnorderedList'));
        document.getElementById('numberList').addEventListener('click', () => document.execCommand('insertOrderedList'));
        document.getElementById('blockquote').addEventListener('click', () => document.execCommand('formatBlock', false, 'blockquote'));

        document.getElementById('heading').addEventListener('change', (e) => {
            document.execCommand('formatBlock', false, e.target.value);
        });

        document.getElementById('fontSize').addEventListener('change', (e) => {
            document.execCommand('fontSize', false, '7');
            const selection = window.getSelection();
            if (selection) {
                const fontElements = selection.anchorNode.parentElement.querySelectorAll('font[size="7"]');
                fontElements.forEach(el => el.removeAttribute('size') && (el.style.fontSize = e.target.value + 'pt'));
            }
        });

        document.getElementById('exportDocx').addEventListener('click', () => {
            vscode.postMessage({
                type: 'request-export-docx',
                html: editor.innerHTML
            });
        });

        document.getElementById('importDocx').addEventListener('click', () => {
            vscode.postMessage({ type: 'request-import-docx' });
        });

        // Track content changes
        editor.addEventListener('input', () => {
            vscode.postMessage({
                type: 'content-updated',
                html: editor.innerHTML
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'b') {
                    e.preventDefault();
                    document.execCommand('bold');
                } else if (e.key === 'i') {
                    e.preventDefault();
                    document.execCommand('italic');
                } else if (e.key === 'u') {
                    e.preventDefault();
                    document.execCommand('underline');
                }
            }
        });

        // Canvas rendering (simplified for now)
        function drawRuler() {
            const canvas = document.getElementById('rulerCanvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;

            ctx.fillStyle = '#fafafa';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.strokeStyle = '#999';
            ctx.lineWidth = 1;

            // Draw ruler marks
            for (let i = 0; i < canvas.width; i += 10) {
                const height = i % 100 === 0 ? 12 : (i % 50 === 0 ? 8 : 4);
                ctx.beginPath();
                ctx.moveTo(i, canvas.height - height);
                ctx.lineTo(i, canvas.height);
                ctx.stroke();
            }
        }

        window.addEventListener('resize', drawRuler);
        setTimeout(drawRuler, 100);
    </script>
</body>
</html>`;
}

