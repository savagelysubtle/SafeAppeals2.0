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

	override setEditorVisible(visible: boolean): void {
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
				body {
					margin: 0;
					padding: 0;
					width: 100%;
					height: 100vh;
					display: flex;
					justify-content: center;
					align-items: center;
					background-color: var(--vscode-editor-background);
					overflow: hidden;
				}
				img {
					max-width: 100%;
					max-height: 100%;
					object-fit: contain;
					box-shadow: 0 0 10px rgba(0,0,0,0.5);
				}
				.error {
					color: var(--vscode-errorForeground);
					font-family: var(--vscode-font-family);
					font-size: 14px;
				}
			</style>
		</head>
		<body>
			<img src="${imageUri.toString()}" alt="${input.getName()}" onerror="this.style.display='none'; document.body.innerHTML += '<div class=\\'error\\'>Failed to load image: ' + this.src + '</div>'; console.error('Image load error:', this.src);">
			<script>
				console.log('Image Viewer loaded for: ${imageUri.toString()}');
			</script>
		</body>
		</html>`;
	}
}
