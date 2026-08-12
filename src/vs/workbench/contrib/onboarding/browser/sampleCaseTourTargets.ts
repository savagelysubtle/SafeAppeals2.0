/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { mainWindow } from '../../../../base/browser/window.js';
import { Disposable, IDisposable, MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { IActionViewItemService } from '../../../../platform/actions/browser/actionViewItemService.js';
import { MenuEntryActionViewItem } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { MenuId, MenuItemAction } from '../../../../platform/actions/common/actions.js';
import { BrowserViewCommandId } from '../../../../platform/browserView/common/browserView.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { markOnboardingTarget } from './spotlight/onboardingTarget.js';
import { SAMPLE_CASE_TOUR_TARGETS } from './sampleCaseTour.js';

/** Status bar extension item id in safeappeals-rag (`createStatusBarItem('privateSearch', …)`). */
export const PRIVATE_SEARCH_STATUS_BAR_ITEM_ID = 'privateSearch';

/**
 * DOM `id` on the status bar container — `{publisher}.{extensionName}.{itemId}` per
 * ExtHostStatusBarEntry update.
 */
export const PRIVATE_SEARCH_STATUS_BAR_DOM_ID = 'safeappeals.safeappeals-rag.privateSearch';

const privateSearchMark = new MutableDisposable<IDisposable>();

/**
 * Marks the Private Search status bar item when present. Safe to call repeatedly
 * (e.g. from the tour contribution watcher and the privateSearch step onBeforeShow).
 */
export function ensurePrivateSearchStatusBarMarked(): boolean {
	if (privateSearchMark.value) {
		return true;
	}
	const item = mainWindow.document.getElementById(PRIVATE_SEARCH_STATUS_BAR_DOM_ID);
	if (!item) {
		return false;
	}
	privateSearchMark.value = markOnboardingTarget(item, SAMPLE_CASE_TOUR_TARGETS.privateSearch);
	return true;
}

/**
 * Watches the workbench until the Private Search status bar item exists, then marks it.
 * Keeps observing when `.statusbar` is not yet in the DOM at AfterRestored.
 */
export function watchPrivateSearchStatusBarTarget(layoutService: IWorkbenchLayoutService): IDisposable {
	if (ensurePrivateSearchStatusBarMarked()) {
		return Disposable.None;
	}

	const itemObserver = new MutationObserver(() => {
		if (ensurePrivateSearchStatusBarMarked()) {
			itemObserver.disconnect();
		}
	});

	const startItemObserver = (statusbar: Element): void => {
		itemObserver.observe(statusbar, { childList: true, subtree: true });
		ensurePrivateSearchStatusBarMarked();
	};

	const statusbar = findStatusbarElement(layoutService);
	if (statusbar) {
		startItemObserver(statusbar);
		return toDisposable(() => itemObserver.disconnect());
	}

	const workbench = layoutService.getContainer(mainWindow);
	const layoutObserver = new MutationObserver(() => {
		const bar = findStatusbarElement(layoutService);
		if (!bar) {
			return;
		}
		startItemObserver(bar);
		layoutObserver.disconnect();
	});
	layoutObserver.observe(workbench, { childList: true, subtree: true });

	return toDisposable(() => {
		layoutObserver.disconnect();
		itemObserver.disconnect();
	});
}

/**
 * Title-bar Integrated Browser control marked as the sample-case tour browser
 * target. Prefer the editor root when both are marked (largest-area wins in
 * {@link findOnboardingTarget}); this is a durable fallback when the editor
 * target is slow to appear or lives only as chrome after open.
 */
class BrowserTitleBarOnboardingActionViewItem extends MenuEntryActionViewItem {
	override render(container: HTMLElement): void {
		super.render(container);
		if (this.element) {
			this._register(markOnboardingTarget(this.element, SAMPLE_CASE_TOUR_TARGETS.browser));
		}
	}
}

/**
 * Registers the title-bar Browser action as an onboarding spotlight target.
 */
export function registerBrowserTitleBarOnboardingTarget(
	actionViewItemService: IActionViewItemService,
): IDisposable {
	return actionViewItemService.register(
		MenuId.TitleBar,
		BrowserViewCommandId.OpenOrList,
		(action, options, instantiationService) => {
			if (!(action instanceof MenuItemAction)) {
				return undefined;
			}
			return instantiationService.createInstance(BrowserTitleBarOnboardingActionViewItem, action, options);
		},
	);
}

function findStatusbarElement(layoutService: IWorkbenchLayoutService): Element | undefined {
	const inWorkbench = layoutService.getContainer(mainWindow).querySelector('.statusbar');
	if (inWorkbench) {
		return inWorkbench;
	}
	return mainWindow.document.querySelector('.statusbar') ?? undefined;
}
