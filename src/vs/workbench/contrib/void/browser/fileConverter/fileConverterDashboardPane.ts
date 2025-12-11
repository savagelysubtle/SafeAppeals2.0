/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { toDisposable } from '../../../../../base/common/lifecycle.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { IViewPaneOptions, ViewPane } from '../../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../../common/views.js';
import { FILE_CONVERTER_VIEW_ID } from './fileConverterConstants.js';

export class FileConverterDashboardPane extends ViewPane {

	static readonly ID = FILE_CONVERTER_VIEW_ID;

	constructor(
		options: IViewPaneOptions,
		@IInstantiationService instantiationService: IInstantiationService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IThemeService themeService: IThemeService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IOpenerService openerService: IOpenerService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IHoverService hoverService: IHoverService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	protected override async renderBody(parent: HTMLElement): Promise<void> {
		super.renderBody(parent);
		parent.style.overflow = 'auto';
		parent.style.userSelect = 'text';

		// Dynamically import React component to avoid blocking startup
		try {
			const { mountFileConverter } = await import('../react/out/file-converter-tsx/index.js');
			this.instantiationService.invokeFunction(accessor => {
				const disposeFn: (() => void) | undefined = mountFileConverter(parent, accessor)?.dispose;
				this._register(toDisposable(() => disposeFn?.()));
			});
		} catch (error) {
			console.error('Failed to load File Converter Dashboard:', error);
			this.renderErrorState(parent);
		}
	}

	private renderErrorState(parent: HTMLElement): void {
		// Use DOM API instead of innerHTML to comply with TrustedHTML CSP
		const container = document.createElement('div');
		container.style.cssText = 'padding: 20px; font-family: var(--vscode-font-family);';

		const title = document.createElement('h3');
		title.style.color = 'var(--vscode-errorForeground)';
		title.textContent = 'Failed to load File Converter Dashboard';
		container.appendChild(title);

		const desc = document.createElement('p');
		desc.style.cssText = 'color: var(--vscode-foreground); margin-top: 10px;';
		desc.textContent = 'Please rebuild React components:';
		container.appendChild(desc);

		const pre = document.createElement('pre');
		pre.style.cssText = 'background: var(--vscode-textBlockQuote-background); padding: 10px; margin-top: 10px; border-radius: 4px;';
		pre.textContent = 'cd src/vs/workbench/contrib/void/browser/react\nbun run build';
		container.appendChild(pre);

		const hint = document.createElement('p');
		hint.style.cssText = 'color: var(--vscode-descriptionForeground); margin-top: 10px; font-size: 0.9em;';
		hint.textContent = 'Then reload the window (Ctrl+Shift+P → "Developer: Reload Window")';
		container.appendChild(hint);

		parent.appendChild(container);
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.element.style.height = `${height}px`;
		this.element.style.width = `${width}px`;
	}
}
