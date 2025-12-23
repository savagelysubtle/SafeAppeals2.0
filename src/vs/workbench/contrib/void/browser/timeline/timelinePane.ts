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

export class TimelinePane extends ViewPane {

	static readonly ID = 'void.timelinePane';
	static readonly TITLE = 'Case Timeline';

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
			const { mountTimeline } = await import('../react/out/timeline-tsx/index.js');
			this.instantiationService.invokeFunction(accessor => {
				const disposeFn: (() => void) | undefined = mountTimeline(parent, accessor)?.dispose;
				this._register(toDisposable(() => disposeFn?.()));
			});
		} catch (error) {
			console.error('[TimelinePane] Failed to load Timeline component:', error);
			parent.innerHTML = `
				<div style="padding: 20px; color: var(--vscode-foreground);">
					<h3>Timeline Loading...</h3>
					<p style="color: var(--vscode-descriptionForeground);">
						If this message persists, run <code>bun run buildreact</code> to build the React components.
					</p>
				</div>
			`;
		}
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.element.style.height = `${height}px`;
		this.element.style.width = `${width}px`;
	}
}

