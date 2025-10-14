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

        <!-- Page Layout Tab -->
        <div class="ribbon-content" id="pageLayoutContent" style="display: none;">
            <div class="ribbon-group">
                <div class="ribbon-group-title">Page Setup</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="margins" title="Margins">📏</button>
                    <button class="ribbon-button" id="orientation" title="Orientation">🔄</button>
                    <button class="ribbon-button" id="pageSize" title="Page Size">📄</button>
                </div>
            </div>
            <div class="ribbon-group">
                <div class="ribbon-group-title">View</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="xmlView" title="Show XML">🔍</button>
                    <button class="ribbon-button" id="normalView" title="Normal View">📝</button>
                </div>
            </div>
        </div>

        <!-- View Tab -->
        <div class="ribbon-content" id="viewContent" style="display: none;">
            <div class="ribbon-group">
                <div class="ribbon-group-title">Zoom</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="zoomIn" title="Zoom In">🔍+</button>
                    <button class="ribbon-button" id="zoomOut" title="Zoom Out">🔍-</button>
                    <button class="ribbon-button" id="zoomReset" title="Zoom Reset">🔍</button>
                </div>
            </div>
            <div class="ribbon-group">
                <div class="ribbon-group-title">Display</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="showRulers" title="Show Rulers">📏</button>
                    <button class="ribbon-button" id="showMargins" title="Show Margins">📐</button>
                </div>
            </div>
        </div>

        <!-- Format Tab -->
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

                    // Apply page layout if provided
                    if (message.pageLayout) {
                        applyPageLayout(message.pageLayout);
                    }

                    // Redraw canvases after content is set
                    setTimeout(redrawCanvases, 50);
                    setTimeout(redrawCanvases, 200); // Backup
                    break;
                case 'set-xml-content':
                    editor.innerHTML = '<pre style="font-family: monospace; font-size: 12px; line-height: 1.4; white-space: pre-wrap; word-wrap: break-word;">' +
                        escapeHtml(message.content) + '</pre>';
                    break;
                case 'page-layout-changed':
                    // Handle page layout updates from MarginController
                    if (message.pageLayout) {
                        applyPageLayout(message.pageLayout);
                        redrawCanvases();
                    }
                    break;
            }
        });

        // Apply page layout to editor
        function applyPageLayout(pageLayout) {
            if (!pageLayout) return;

            // Margins are already in pixels from MarginController
            const margins = pageLayout.margins;

            // Update margin indicators
            const leftIndicator = document.getElementById('leftMarginIndicator');
            const rightIndicator = document.getElementById('rightMarginIndicator');
            const leftHandle = document.getElementById('leftMarginHandle');
            const rightHandle = document.getElementById('rightMarginHandle');

            if (leftIndicator) {
                leftIndicator.style.left = (60 + margins.left) + 'px';
            }
            if (rightIndicator) {
                rightIndicator.style.right = margins.right + 'px';
            }

            // Update margin handles to match indicators
            if (leftHandle) {
                leftHandle.style.left = (60 + margins.left - 6) + 'px';
            }
            if (rightHandle) {
                rightHandle.style.right = (margins.right - 6) + 'px';
            }

            // Update editor padding
            editor.style.paddingLeft = margins.left + 'px';
            editor.style.paddingRight = margins.right + 'px';
            editor.style.paddingTop = margins.top + 'px';
            editor.style.paddingBottom = margins.bottom + 'px';

            // Apply zoom if provided
            if (pageLayout.zoom !== undefined && pageLayout.zoom !== 1.0) {
                editor.style.transform = \`scale(\${pageLayout.zoom})\`;
                editor.style.transformOrigin = 'top left';
            } else {
                editor.style.transform = 'scale(1)';
            }

            console.log('Applied page layout:', pageLayout);
        }

        // Escape HTML for XML display
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Unified command system - all buttons use the same command dispatch
        function executeCommand(commandId, args = []) {
            vscode.postMessage({
                type: 'execute-command',
                data: { command: commandId, args }
            });
        }

        // Format commands
        document.getElementById('bold').addEventListener('click', () => executeCommand('txtRich.format.bold'));
        document.getElementById('italic').addEventListener('click', () => executeCommand('txtRich.format.italic'));
        document.getElementById('underline').addEventListener('click', () => executeCommand('txtRich.format.underline'));
        document.getElementById('strikethrough').addEventListener('click', () => executeCommand('txtRich.format.strikethrough'));

        // Undo/Redo commands
        document.getElementById('undo').addEventListener('click', () => executeCommand('txtRich.undo'));
        document.getElementById('redo').addEventListener('click', () => executeCommand('txtRich.redo'));

        // Paragraph alignment commands
        document.getElementById('alignLeft').addEventListener('click', () => executeCommand('txtRich.paragraph.alignLeft'));
        document.getElementById('alignCenter').addEventListener('click', () => executeCommand('txtRich.paragraph.alignCenter'));
        document.getElementById('alignRight').addEventListener('click', () => executeCommand('txtRich.paragraph.alignRight'));
        document.getElementById('indent').addEventListener('click', () => executeCommand('txtRich.paragraph.indent'));
        document.getElementById('outdent').addEventListener('click', () => executeCommand('txtRich.paragraph.outdent'));

        // List commands
        document.getElementById('bulletList').addEventListener('click', () => executeCommand('txtRich.list.bullet'));
        document.getElementById('numberList').addEventListener('click', () => executeCommand('txtRich.list.numbered'));

        // Style commands
        document.getElementById('heading').addEventListener('change', (e) => {
            const value = e.target.value;
            if (value === 'h1') executeCommand('txtRich.style.heading1');
            else if (value === 'h2') executeCommand('txtRich.style.heading2');
            else if (value === 'h3') executeCommand('txtRich.style.heading3');
            else executeCommand('txtRich.style.normal');
        });

        document.getElementById('blockquote').addEventListener('click', () => executeCommand('txtRich.style.blockquote'));

        // Font size command
        document.getElementById('fontSize').addEventListener('change', (e) => {
            executeCommand('txtRich.format.fontSize', [e.target.value]);
        });

        // File commands
        document.getElementById('exportDocx').addEventListener('click', () => executeCommand('txtRich.exportDocx'));
        document.getElementById('importDocx').addEventListener('click', () => executeCommand('txtRich.importDocx'));

        // Page Layout commands
        document.getElementById('margins').addEventListener('click', () => executeCommand('txtRich.page.margins'));
        document.getElementById('orientation').addEventListener('click', () => executeCommand('txtRich.page.orientation'));
        document.getElementById('pageSize').addEventListener('click', () => executeCommand('txtRich.page.size'));

        // View commands
        document.getElementById('xmlView').addEventListener('click', () => executeCommand('txtRich.view.xmlView'));
        document.getElementById('normalView').addEventListener('click', () => executeCommand('txtRich.view.normalView'));
        document.getElementById('zoomIn').addEventListener('click', () => executeCommand('txtRich.view.zoomIn'));
        document.getElementById('zoomOut').addEventListener('click', () => executeCommand('txtRich.view.zoomOut'));
        document.getElementById('zoomReset').addEventListener('click', () => executeCommand('txtRich.view.zoomReset'));
        document.getElementById('showRulers').addEventListener('click', () => executeCommand('txtRich.view.showRulers'));
        document.getElementById('showMargins').addEventListener('click', () => executeCommand('txtRich.view.showMargins'));

        // Track content changes
        editor.addEventListener('input', () => {
            vscode.postMessage({
                type: 'content-updated',
                html: editor.innerHTML
            });
        });

        // Keyboard shortcuts - unified with command system
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'b':
                        e.preventDefault();
                        executeCommand('txtRich.format.bold');
                        break;
                    case 'i':
                        e.preventDefault();
                        executeCommand('txtRich.format.italic');
                        break;
                    case 'u':
                        e.preventDefault();
                        executeCommand('txtRich.format.underline');
                        break;
                    case 'z':
                        e.preventDefault();
                        if (e.shiftKey) {
                            executeCommand('txtRich.redo');
                        } else {
                            executeCommand('txtRich.undo');
                        }
                        break;
                    case 'y':
                        e.preventDefault();
                        executeCommand('txtRich.redo');
                        break;
                    case 's':
                        e.preventDefault();
                        executeCommand('txtRich.saveDoc');
                        break;
                    case '=':
                    case '+':
                        e.preventDefault();
                        executeCommand('txtRich.view.zoomIn');
                        break;
                    case '-':
                        e.preventDefault();
                        executeCommand('txtRich.view.zoomOut');
                        break;
                    case '0':
                        e.preventDefault();
                        executeCommand('txtRich.view.zoomReset');
                        break;
                }
            }
        });

        // Canvas rendering for rulers
        function drawRuler() {
            const canvas = document.getElementById('rulerCanvas');
            if (!canvas) {
                console.warn('Ruler canvas not found');
                return;
            }
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.warn('Canvas context not available');
                return;
            }

            // Get actual dimensions
            const rect = canvas.getBoundingClientRect();
            const width = rect.width || canvas.offsetWidth || canvas.clientWidth;
            const height = rect.height || canvas.offsetHeight || canvas.clientHeight;

            if (width === 0 || height === 0) {
                console.warn('Canvas dimensions are zero, retrying...');
                setTimeout(drawRuler, 100);
                return;
            }

            // Set canvas dimensions (important for proper rendering)
            canvas.width = width;
            canvas.height = height;

            // Clear canvas
            ctx.clearRect(0, 0, width, height);

            // Background
            ctx.fillStyle = '#fafafa';
            ctx.fillRect(0, 0, width, height);

            // Draw ruler marks
            ctx.strokeStyle = '#999';
            ctx.lineWidth = 1;

            for (let i = 0; i < width; i += 10) {
                const markHeight = i % 100 === 0 ? 12 : (i % 50 === 0 ? 8 : 4);
                ctx.beginPath();
                ctx.moveTo(i, height - markHeight);
                ctx.lineTo(i, height);
                ctx.stroke();
            }

            console.log('Ruler drawn successfully:', width, 'x', height);
        }

        // Draw margin canvas
        function drawMargin() {
            const canvas = document.getElementById('marginCanvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const rect = canvas.getBoundingClientRect();
            const width = rect.width || canvas.offsetWidth || canvas.clientWidth;
            const height = rect.height || canvas.offsetHeight || canvas.clientHeight;

            if (width === 0 || height === 0) {
                setTimeout(drawMargin, 100);
                return;
            }

            canvas.width = width;
            canvas.height = height;

            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = '#fafafa';
            ctx.fillRect(0, 0, width, height);
        }

        // Redraw all canvases
        function redrawCanvases() {
            drawRuler();
            drawMargin();
        }

        // Listen for resize events
        window.addEventListener('resize', redrawCanvases);

        // Initial draw
        setTimeout(redrawCanvases, 100);
        setTimeout(redrawCanvases, 500); // Backup in case first attempt fails

        // === MARGIN DRAG HANDLERS ===
        let isDraggingMargin = false;
        let draggedHandle = null;
        let currentMargins = { top: 96, right: 96, bottom: 96, left: 96 };

        // Initialize margin handles
        const leftMarginHandle = document.getElementById('leftMarginHandle');
        const rightMarginHandle = document.getElementById('rightMarginHandle');

        function startMarginDrag(e, handle) {
            isDraggingMargin = true;
            draggedHandle = handle;
            e.preventDefault();
            e.stopPropagation();
        }

        function onMarginDrag(e) {
            if (!isDraggingMargin || !draggedHandle) return;

            const editorWrapper = document.getElementById('editorWrapper');
            if (!editorWrapper) return;

            const rect = editorWrapper.getBoundingClientRect();

            if (draggedHandle === 'left') {
                // Left margin drag
                const newLeft = Math.max(20, Math.min(200, e.clientX - rect.left - 60));
                currentMargins.left = newLeft;
            } else if (draggedHandle === 'right') {
                // Right margin drag
                const newRight = Math.max(20, Math.min(200, rect.right - e.clientX));
                currentMargins.right = newRight;
            }

            // Apply changes immediately for smooth dragging
            applyPageLayout({ margins: currentMargins });
        }

        function endMarginDrag(e) {
            if (!isDraggingMargin) return;

            isDraggingMargin = false;
            const handle = draggedHandle;
            draggedHandle = null;

            // Send update to extension
            if (handle) {
                vscode.postMessage({
                    type: 'page-layout-update',
                    data: {
                        margins: currentMargins
                    }
                });
            }
        }

        // Attach event listeners to margin handles
        if (leftMarginHandle) {
            leftMarginHandle.addEventListener('mousedown', (e) => startMarginDrag(e, 'left'));
        }
        if (rightMarginHandle) {
            rightMarginHandle.addEventListener('mousedown', (e) => startMarginDrag(e, 'right'));
        }

        // Global drag and release handlers
        document.addEventListener('mousemove', onMarginDrag);
        document.addEventListener('mouseup', endMarginDrag);

        // Request initial layout from extension
        vscode.postMessage({ type: 'request-page-layout' });
    </script>
</body>
</html>`;
}

