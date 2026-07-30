/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, clearNode, h } from '../../../../base/browser/dom.js';
import { KeybindingLabel } from '../../../../base/browser/ui/keybindingLabel/keybindingLabel.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { isWeb, OS } from '../../../../base/common/platform.js';
import { localize } from '../../../../nls.js';
import { MenuId, MenuRegistry } from '../../../../platform/actions/common/actions.js';
import { HiddenItemStrategy, MenuWorkbenchToolBar } from '../../../../platform/actions/browser/toolbar.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr, ContextKeyExpression, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { defaultKeybindingLabelStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { WorkspaceFolderCountContext } from '../../../common/contextkeys.js';

interface WatermarkEntry {
	readonly id: string;
	readonly text: string;
	readonly when?: {
		native?: ContextKeyExpression;
		web?: ContextKeyExpression;
	};
}

const showChatContextKey = ContextKeyExpr.and(ContextKeyExpr.equals('chatSetupHidden', false), ContextKeyExpr.equals('chatSetupDisabledInWorkspace', false));
// SafeAppeals: initCase needs an open folder (matches T10 checklist `workspaceFolderCount > 0`).
const hasWorkspaceFolder = ContextKeyExpr.greater(WorkspaceFolderCountContext.key, 0);

// SafeAppeals: case-language watermark tips (replaces upstream developer shortcuts).
const showChat: WatermarkEntry = { text: localize('watermark.showChat', "Show Chat"), id: 'workbench.action.chat.open', when: { native: showChatContextKey, web: showChatContextKey } };
const newCase: WatermarkEntry = { text: localize('watermark.newCase', "New Case"), id: 'safeappeals-case.initCase', when: { native: hasWorkspaceFolder, web: hasWorkspaceFolder } };
const openCaseFolder: WatermarkEntry = { text: localize('watermark.openCaseFolder', "Open Case Folder"), id: 'workbench.action.files.openFolder' };
const takeTour: WatermarkEntry = { text: localize('watermark.takeTour', "Take the Tour"), id: 'safeappeals-case.takeTour' };

// SafeAppeals: one tip list for empty window and workspace (New Case is gated by when, not by list).
const caseEntries: WatermarkEntry[] = [
	showChat,
	newCase,
	openCaseFolder,
	takeTour,
];

export class EditorGroupWatermark extends Disposable {

	private static readonly SETTINGS_KEY = 'workbench.tips.enabled';

	/** Context keys referenced by tip `when` clauses — used to avoid re-render storms. */
	private static readonly WHEN_CONTEXT_KEYS = new Set<string>([
		'chatSetupHidden',
		'chatSetupDisabledInWorkspace',
		WorkspaceFolderCountContext.key,
	]);

	private static readonly TIP_COMMAND_IDS = new Set(caseEntries.map(entry => entry.id));

	private readonly shortcuts: HTMLElement;
	private readonly toolbarContainer: HTMLElement;
	private readonly transientDisposables = this._register(new DisposableStore());
	private readonly keybindingLabels = this._register(new DisposableStore());

	private enabled = false;
	/** Joined command ids currently painted — skip DOM work when the filtered set is unchanged. */
	private renderedEntryKey: string | undefined;

	constructor(
		container: HTMLElement,
		@IKeybindingService private readonly keybindingService: IKeybindingService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super();

		const elements = h('.editor-group-watermark-wrapper', [
			h('.editor-group-watermark-toolbar-container@toolbarContainer'),
			h('.editor-group-watermark', [
				h('.watermark-container', [
					h('.letterpress'),
					h('.shortcuts@shortcuts'),
				])
			])
		]);

		append(container, elements.root);
		this.shortcuts = elements.shortcuts;
		this.toolbarContainer = elements.toolbarContainer;

		this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, this.toolbarContainer, MenuId.EditorGroupWatermarkToolbar, {
			hiddenItemStrategy: HiddenItemStrategy.NoHide,
			highlightToggledItems: true,
			menuOptions: { shouldForwardArgs: true }
		}));

		this.registerListeners();

		this.refreshEntriesIfChanged();
	}

	private registerListeners(): void {
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(EditorGroupWatermark.SETTINGS_KEY)) {
				this.refreshEntriesIfChanged();
			}
		}));

		// SafeAppeals: New Case tip is gated on workspaceFolderCount.
		this._register(this.contextService.onDidChangeWorkspaceFolders(() => this.refreshEntriesIfChanged()));
		this._register(this.contextService.onDidChangeWorkbenchState(() => this.refreshEntriesIfChanged()));

		// SafeAppeals: contributes.commands reach MenuRegistry after first paint.
		this._register(MenuRegistry.onDidChangeMenu(e => {
			if (e.has(MenuId.CommandPalette)) {
				this.refreshEntriesIfChanged();
			}
		}));
		this._register(CommandsRegistry.onDidRegisterCommand(id => {
			if (EditorGroupWatermark.TIP_COMMAND_IDS.has(id)) {
				this.refreshEntriesIfChanged();
			}
		}));

		// SafeAppeals: replace upstream cachedWhen — re-evaluate when tip `when` keys settle.
		this._register(this.contextKeyService.onDidChangeContext(e => {
			if (e.affectsSome(EditorGroupWatermark.WHEN_CONTEXT_KEYS)) {
				this.refreshEntriesIfChanged();
			}
		}));
	}

	/**
	 * Recomputes the visible tip set and rebuilds the DOM only when that set
	 * (or the tips-enabled flag) actually changed. Cheap to call from noisy
	 * startup events; avoids render storms without a debounce timer.
	 */
	private refreshEntriesIfChanged(): void {
		const enabled = this.configurationService.getValue<boolean>(EditorGroupWatermark.SETTINGS_KEY);
		if (!enabled) {
			if (this.enabled || this.renderedEntryKey !== undefined) {
				this.enabled = false;
				this.renderedEntryKey = undefined;
				clearNode(this.shortcuts);
				this.transientDisposables.clear();
			}
			return;
		}

		const entries = this.filterEntries(caseEntries);
		const entryKey = entries.map(entry => entry.id).join('\0');
		if (this.enabled && this.renderedEntryKey === entryKey) {
			return;
		}

		this.enabled = true;
		this.renderedEntryKey = entryKey;
		this.renderEntries(entries);
	}

	private renderEntries(entries: WatermarkEntry[]): void {
		clearNode(this.shortcuts);
		this.transientDisposables.clear();

		const box = append(this.shortcuts, $('.watermark-box'));

		const update = () => {
			clearNode(box);
			this.keybindingLabels.clear();

			for (const entry of entries) {
				const keys = this.keybindingService.lookupKeybinding(entry.id);

				const dl = append(box, $('dl'));
				const dt = append(dl, $('dt'));
				dt.textContent = entry.text;

				// SafeAppeals: never render the "Unbound" key chip — tip label alone when no shortcut.
				if (keys) {
					const dd = append(dl, $('dd'));
					const label = this.keybindingLabels.add(new KeybindingLabel(dd, OS, { ...defaultKeybindingLabelStyles }));
					label.set(keys);
				}
			}
		};

		update();
		this.transientDisposables.add(this.keybindingService.onDidUpdateKeybindings(update));
	}

	private filterEntries(entries: WatermarkEntry[]): WatermarkEntry[] {
		return entries
			.filter(entry => {
				const contextKey = isWeb ? entry.when?.web : entry.when?.native;
				if (!contextKey) {
					return true;
				}
				// SafeAppeals: live when only (no prior-session cache) so New Case
				// disappears immediately in an empty window.
				return this.contextKeyService.contextMatchesRules(contextKey);
			})
			// SafeAppeals: extension `contributes.commands` lands in MenuRegistry before
			// activation; CommandsRegistry only gets a handler when activate() calls
			// registerCommand. Prefer MenuRegistry so tips appear without forcing activation.
			.filter(entry => !!MenuRegistry.getCommand(entry.id) || !!CommandsRegistry.getCommand(entry.id));
	}
}
