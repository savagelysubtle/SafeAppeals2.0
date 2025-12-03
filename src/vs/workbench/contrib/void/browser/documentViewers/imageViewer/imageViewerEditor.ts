/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as DOM from '../../../../../../base/browser/dom.js';
import { Dimension } from '../../../../../../base/browser/dom.js';
import { CodeWindow } from '../../../../../../base/browser/window.js';
import { CancellationToken } from '../../../../../../base/common/cancellation.js';
import { URI } from '../../../../../../base/common/uri.js';
import { IEditorOptions } from '../../../../../../platform/editor/common/editor.js';
import { IStorageService } from '../../../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../../../platform/theme/common/themeService.js';
import { EditorPane } from '../../../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../../../common/editor.js';
import { EditorInput } from '../../../../../common/editor/editorInput.js';
import { IEditorGroup } from '../../../../../services/editor/common/editorGroupsService.js';
import { IOverlayWebview, IWebviewService } from '../../../../webview/browser/webview.js';
import { asWebviewUri } from '../../../../webview/common/webview.js';
import { ImageViewerInput } from './imageViewerInput.js';

export class ImageViewerEditor extends EditorPane {
	static readonly ID = 'void.imageViewer';

	private _element?: HTMLElement;
	private _dimension?: Dimension;
	private webview?: IOverlayWebview;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IWebviewService private readonly webviewService: IWebviewService
	) {
		super(ImageViewerEditor.ID, group, telemetryService, themeService, storageService);
	}

	protected override createEditor(parent: HTMLElement): void {
		this._element = DOM.append(parent, DOM.$('div.image-viewer-container'));
		this._element.style.width = '100%';
		this._element.style.height = '100%';
		this._element.style.position = 'relative';
		this._element.style.display = 'flex';
		this._element.style.justifyContent = 'center';
		this._element.style.alignItems = 'center';
		this._element.style.backgroundColor = 'var(--vscode-editor-background)';
	}

	override async setInput(input: EditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);

		if (token.isCancellationRequested || !(input instanceof ImageViewerInput)) {
			return;
		}

		if (!this.webview && this._element) {
			// Allow access to the file's directory
			const fileDir = URI.joinPath(input.resource, '..');

			this.webview = this.webviewService.createWebviewOverlay({
				title: 'Image Viewer',
				providedViewType: 'void.imageViewer',
				options: {
					enableFindWidget: false,
					retainContextWhenHidden: true
				},
				contentOptions: {
					allowScripts: true,
					localResourceRoots: [fileDir]
				},
				extension: undefined
			});

			const targetWindow = DOM.getWindow(this._element);
			this.webview.claim(this, targetWindow as CodeWindow, undefined);
			this.webview.layoutWebviewOverElement(this._element);

			if (this._dimension) {
				this.webview.layoutWebviewOverElement(this._element, this._dimension);
			}
		}

		if (this.webview) {
			// Update localResourceRoots for the new input if needed
			const fileDir = URI.joinPath(input.resource, '..');
			this.webview.contentOptions = {
				allowScripts: true,
				localResourceRoots: [fileDir]
			};

			this.webview.setHtml(this.getWebviewHTML(input));
		}
	}

	override layout(dimension: Dimension): void {
		this._dimension = dimension;
		if (this.webview && this._element) {
			this.webview.layoutWebviewOverElement(this._element, dimension);
		}
	}

	protected override setEditorVisible(visible: boolean): void {
		if (this.webview && this._element) {
			const targetWindow = DOM.getWindow(this._element);
			if (visible) {
				this.webview.claim(this, targetWindow as CodeWindow, undefined);
			} else {
				this.webview.release(this);
			}
		}
		super.setEditorVisible(visible);
	}

	override clearInput(): void {
		if (this.webview) {
			this.webview.setHtml('');
		}
		super.clearInput();
	}

	override dispose(): void {
		if (this.webview) {
			this.webview.release(this);
		}
		super.dispose();
	}

	private getWebviewHTML(input: ImageViewerInput): string {
		const imageUri = asWebviewUri(input.resource);
		// cspSource might not be available on IOverlayWebview, using standard schemes

		console.log('[ImageViewer] Loading image:', input.resource.toString());
		console.log('[ImageViewer] Webview URI:', imageUri.toString());

		return `<!DOCTYPE html>
		<html>
		<head>
			<meta charset="UTF-8">
			<meta http-equiv="Content-Security-Policy"
				content="default-src 'none';
				img-src vscode-resource: https: data:;
				script-src 'unsafe-inline';
				style-src 'unsafe-inline';">
			<style>
				* { box-sizing: border-box; }
				body {
					margin: 0;
					padding: 0;
					width: 100%;
					height: 100vh;
					display: flex;
					flex-direction: column;
					background-color: var(--vscode-editor-background);
					overflow: hidden;
					font-family: var(--vscode-font-family);
					color: var(--vscode-foreground);
				}
				.toolbar {
					display: flex;
					align-items: center;
					gap: 8px;
					padding: 8px 12px;
					background-color: var(--vscode-editorWidget-background);
					border-bottom: 1px solid var(--vscode-editorWidget-border);
					flex-shrink: 0;
				}
				.toolbar button {
					padding: 4px 12px;
					background-color: var(--vscode-button-secondaryBackground);
					color: var(--vscode-button-secondaryForeground);
					border: none;
					border-radius: 4px;
					cursor: pointer;
					font-size: 13px;
				}
				.toolbar button:hover {
					background-color: var(--vscode-button-secondaryHoverBackground);
				}
				.toolbar button.active {
					background-color: var(--vscode-button-background);
					color: var(--vscode-button-foreground);
				}
				.zoom-controls {
					display: flex;
					align-items: center;
					gap: 4px;
				}
				.zoom-slider {
					width: 120px;
					accent-color: var(--vscode-focusBorder);
				}
				.zoom-value {
					min-width: 50px;
					text-align: center;
					font-variant-numeric: tabular-nums;
					font-size: 12px;
				}
				.separator {
					width: 1px;
					height: 20px;
					background-color: var(--vscode-editorWidget-border);
					margin: 0 4px;
				}
				.info-text {
					margin-left: auto;
					font-size: 11px;
					color: var(--vscode-descriptionForeground);
				}
				.image-container {
					flex: 1;
					overflow: hidden;
					position: relative;
					display: flex;
					justify-content: center;
					align-items: center;
					/* Checkerboard background for transparency */
					background-image:
						linear-gradient(45deg, #2a2a2a 25%, transparent 25%),
						linear-gradient(-45deg, #2a2a2a 25%, transparent 25%),
						linear-gradient(45deg, transparent 75%, #2a2a2a 75%),
						linear-gradient(-45deg, transparent 75%, #2a2a2a 75%);
					background-size: 20px 20px;
					background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
					background-color: #1e1e1e;
				}
				.image-wrapper {
					position: absolute;
					transform-origin: center center;
					cursor: grab;
					transition: transform 0.1s ease-out;
				}
				.image-wrapper.dragging {
					cursor: grabbing;
					transition: none;
				}
				.image-wrapper img {
					display: block;
					box-shadow: 0 0 20px rgba(0,0,0,0.5);
					max-width: none;
					max-height: none;
				}
				.error {
					color: var(--vscode-errorForeground);
					font-size: 14px;
					text-align: center;
					padding: 20px;
				}
			</style>
		</head>
		<body>
			<div class="toolbar">
				<button id="fit-btn" title="Fit to window (F)">Fit</button>
				<button id="actual-btn" title="Actual size (1)">100%</button>
				<div class="separator"></div>
				<div class="zoom-controls">
					<button id="zoom-out-btn" title="Zoom out (-)">−</button>
					<input type="range" id="zoom-slider" class="zoom-slider" min="10" max="500" value="100">
					<span id="zoom-value" class="zoom-value">100%</span>
					<button id="zoom-in-btn" title="Zoom in (+)">+</button>
				</div>
				<div class="separator"></div>
				<button id="rotate-ccw-btn" title="Rotate left (L)">↺</button>
				<button id="rotate-cw-btn" title="Rotate right (R)">↻</button>
				<div class="separator"></div>
				<button id="reset-btn" title="Reset view (0)">Reset</button>
				<span id="info-text" class="info-text">Loading...</span>
			</div>
			<div class="image-container" id="container">
				<div class="image-wrapper" id="wrapper">
					<img id="image" src="${imageUri.toString()}" alt="${input.getName()}">
				</div>
			</div>
			<script>
				(function() {
					const image = document.getElementById('image');
					const wrapper = document.getElementById('wrapper');
					const container = document.getElementById('container');
					const zoomSlider = document.getElementById('zoom-slider');
					const zoomValue = document.getElementById('zoom-value');
					const infoText = document.getElementById('info-text');

					let scale = 1;
					let rotation = 0;
					let translateX = 0;
					let translateY = 0;
					let isDragging = false;
					let dragStart = { x: 0, y: 0 };
					let naturalWidth = 0;
					let naturalHeight = 0;

					// Update transform
					function updateTransform() {
						wrapper.style.transform = \`translate(\${translateX}px, \${translateY}px) scale(\${scale}) rotate(\${rotation}deg)\`;
						zoomSlider.value = Math.round(scale * 100);
						zoomValue.textContent = Math.round(scale * 100) + '%';
					}

					// Fit image to container
					function fitToWindow() {
						if (!naturalWidth || !naturalHeight) return;
						const containerRect = container.getBoundingClientRect();
						const scaleX = (containerRect.width - 40) / naturalWidth;
						const scaleY = (containerRect.height - 40) / naturalHeight;
						scale = Math.min(scaleX, scaleY, 1); // Don't upscale
						translateX = 0;
						translateY = 0;
						updateTransform();
					}

					// Reset view
					function resetView() {
						scale = 1;
						rotation = 0;
						translateX = 0;
						translateY = 0;
						updateTransform();
					}

					// Zoom at point
					function zoomAtPoint(newScale, clientX, clientY) {
						const containerRect = container.getBoundingClientRect();
						const centerX = containerRect.width / 2;
						const centerY = containerRect.height / 2;

						// Calculate offset from center
						const offsetX = clientX - containerRect.left - centerX;
						const offsetY = clientY - containerRect.top - centerY;

						// Adjust translation to zoom at point
						const scaleDelta = newScale / scale;
						translateX = translateX * scaleDelta - offsetX * (scaleDelta - 1);
						translateY = translateY * scaleDelta - offsetY * (scaleDelta - 1);

						scale = Math.max(0.1, Math.min(5, newScale));
						updateTransform();
					}

					// Image load handler
					image.onload = function() {
						naturalWidth = image.naturalWidth;
						naturalHeight = image.naturalHeight;
						infoText.textContent = naturalWidth + ' × ' + naturalHeight + ' px';
						fitToWindow();
					};

					image.onerror = function() {
						container.innerHTML = '<div class="error">Failed to load image</div>';
					};

					// Button handlers
					document.getElementById('fit-btn').addEventListener('click', fitToWindow);
					document.getElementById('actual-btn').addEventListener('click', () => {
						scale = 1;
						translateX = 0;
						translateY = 0;
						updateTransform();
					});
					document.getElementById('zoom-in-btn').addEventListener('click', () => {
						scale = Math.min(5, scale * 1.25);
						updateTransform();
					});
					document.getElementById('zoom-out-btn').addEventListener('click', () => {
						scale = Math.max(0.1, scale / 1.25);
						updateTransform();
					});
					document.getElementById('rotate-ccw-btn').addEventListener('click', () => {
						rotation -= 90;
						updateTransform();
					});
					document.getElementById('rotate-cw-btn').addEventListener('click', () => {
						rotation += 90;
						updateTransform();
					});
					document.getElementById('reset-btn').addEventListener('click', resetView);

					// Zoom slider
					zoomSlider.addEventListener('input', (e) => {
						scale = parseInt(e.target.value) / 100;
						updateTransform();
					});

					// Mouse wheel zoom
					container.addEventListener('wheel', (e) => {
						e.preventDefault();
						const delta = e.deltaY > 0 ? 0.9 : 1.1;
						zoomAtPoint(scale * delta, e.clientX, e.clientY);
					}, { passive: false });

					// Pan with mouse drag
					wrapper.addEventListener('mousedown', (e) => {
						if (e.button !== 0) return;
						isDragging = true;
						dragStart = { x: e.clientX - translateX, y: e.clientY - translateY };
						wrapper.classList.add('dragging');
						e.preventDefault();
					});

					document.addEventListener('mousemove', (e) => {
						if (!isDragging) return;
						translateX = e.clientX - dragStart.x;
						translateY = e.clientY - dragStart.y;
						updateTransform();
					});

					document.addEventListener('mouseup', () => {
						isDragging = false;
						wrapper.classList.remove('dragging');
					});

					// Double-click to toggle fit/actual
					wrapper.addEventListener('dblclick', () => {
						if (Math.abs(scale - 1) < 0.01) {
							fitToWindow();
						} else {
							scale = 1;
							translateX = 0;
							translateY = 0;
							updateTransform();
						}
					});

					// Keyboard shortcuts
					document.addEventListener('keydown', (e) => {
						switch(e.key.toLowerCase()) {
							case 'f': fitToWindow(); break;
							case '1': scale = 1; translateX = 0; translateY = 0; updateTransform(); break;
							case '0': resetView(); break;
							case '+': case '=': scale = Math.min(5, scale * 1.25); updateTransform(); break;
							case '-': scale = Math.max(0.1, scale / 1.25); updateTransform(); break;
							case 'l': rotation -= 90; updateTransform(); break;
							case 'r': rotation += 90; updateTransform(); break;
						}
					});

					console.log('Image Viewer loaded for: ${imageUri.toString()}');
				})();
			</script>
		</body>
		</html>`;
	}
}
