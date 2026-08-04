/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { addDisposableListener, EventHelper, EventType } from '../../../../base/browser/dom.js';
import { IAccessibilityService } from '../../../../platform/accessibility/common/accessibility.js';
import { IMenuEntryActionViewItemOptions, MenuEntryActionViewItem } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { MenuItemAction } from '../../../../platform/actions/common/actions.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IDictationSession } from './dictationSession.js';

/**
 * ChatExecute mic control: hold (pointerdown) starts PTT dictation; release
 * (pointerup / leave / blur) stops. Click-toggle is intentionally disabled.
 * Window-level pointerup is also registered by the session as a backup.
 */
export class DictationHoldActionViewItem extends MenuEntryActionViewItem {

	constructor(
		action: MenuItemAction,
		options: IMenuEntryActionViewItemOptions | undefined,
		@IDictationSession private readonly dictationSession: IDictationSession,
		@IKeybindingService keybindingService: IKeybindingService,
		@INotificationService notificationService: INotificationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IThemeService themeService: IThemeService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IAccessibilityService accessibilityService: IAccessibilityService,
	) {
		super(action, options, keybindingService, notificationService, contextKeyService, themeService, contextMenuService, accessibilityService);
	}

	override render(container: HTMLElement): void {
		super.render(container);
		if (!this.element) {
			return;
		}

		this.element.classList.add('safeappeals-dictation-hold');

		this._register(addDisposableListener(this.element, EventType.POINTER_DOWN, (e: PointerEvent) => {
			if (e.button !== 0) {
				return;
			}
			EventHelper.stop(e, true);
			void this.dictationSession.start({ trackPointerRelease: true });
		}));

		this._register(addDisposableListener(this.element, EventType.POINTER_UP, (e: PointerEvent) => {
			if (e.button !== 0) {
				return;
			}
			EventHelper.stop(e, true);
			void this.dictationSession.stop();
		}));

		this._register(addDisposableListener(this.element, EventType.POINTER_LEAVE, () => {
			void this.dictationSession.stop();
		}));

		this._register(addDisposableListener(this.element, EventType.BLUR, () => {
			void this.dictationSession.stop();
		}, true));
	}

	override async onClick(event: MouseEvent): Promise<void> {
		// Hold gesture owns start/stop — ignore click so we never toggle.
		EventHelper.stop(event, true);
	}
}
