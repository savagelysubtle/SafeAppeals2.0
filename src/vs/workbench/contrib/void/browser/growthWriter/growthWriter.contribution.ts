import { Registry } from '../../../../../platform/registry/common/platform.js'
import { IViewContainersRegistry, IViewsRegistry, Extensions as ViewExtensions, ViewContainerLocation } from '../../../../common/views.js'
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js'
import { ViewPaneContainer } from '../../../../browser/parts/views/viewPaneContainer.js'
import { Orientation } from '../../../../../base/browser/ui/sash/sash.js'
import { Codicon } from '../../../../../base/common/codicons.js'
import * as nls from '../../../../../nls.js'
import { GrowthWriterPane } from './growthWriterPane.js'
import { GrowthWriterEditorPane } from './growthWriterEditorPane.js'
import { GrowthWriterEditorInput, GrowthWriterViewType } from './growthWriterEditorInput.js'
import { Action2, registerAction2, MenuId } from '../../../../../platform/actions/common/actions.js'
import { ServicesAccessor } from '../../../../../editor/browser/editorExtensions.js'
import { IViewsService } from '../../../../services/views/common/viewsService.js'
import { IEditorService } from '../../../../services/editor/common/editorService.js'
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js'
import { EditorExtensions } from '../../../../common/editor.js'
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../../browser/editor.js'
import { KeyMod, KeyCode } from '../../../../../base/common/keyCodes.js'
import { KeybindingWeight } from '../../../../../platform/keybinding/common/keybindingsRegistry.js'

// ============================================================================
// View Container Registration
// ============================================================================

export const GROWTH_WRITER_VIEW_CONTAINER_ID = 'workbench.view.growthWriter'
export const GROWTH_WRITER_VIEW_ID = GROWTH_WRITER_VIEW_CONTAINER_ID

const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry)
const container = viewContainerRegistry.registerViewContainer({
	id: GROWTH_WRITER_VIEW_CONTAINER_ID,
	title: nls.localize2('growthWriterContainer', 'Growth Writer'),
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [GROWTH_WRITER_VIEW_CONTAINER_ID, {
		mergeViewWithContainerWhenSingleView: true,
		orientation: Orientation.HORIZONTAL,
	}]),
	hideIfEmpty: false,
	order: 8,
	rejectAddedViews: true,
	icon: Codicon.megaphone,
}, ViewContainerLocation.Sidebar, { doNotRegisterOpenCommand: false, isDefault: false })

const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry)
viewsRegistry.registerViews([{
	id: GROWTH_WRITER_VIEW_ID,
	hideByDefault: false,
	name: nls.localize2('growthWriter', 'Growth Writer'),
	ctorDescriptor: new SyncDescriptor(GrowthWriterPane),
	canToggleVisibility: true,
	canMoveView: true,
	weight: 100,
	order: 1,
}], container)

// ============================================================================
// Editor Pane Registration
// ============================================================================

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(GrowthWriterEditorPane, GrowthWriterEditorPane.ID, nls.localize('growthWriterEditor', 'Growth Writer Editor')),
	[new SyncDescriptor(GrowthWriterEditorInput)]
)

// ============================================================================
// Commands
// ============================================================================

function openGrowthWriterView(accessor: ServicesAccessor, viewType: GrowthWriterViewType, viewData?: Record<string, string>) {
	const editorService = accessor.get(IEditorService)
	const instantiationService = accessor.get(IInstantiationService)
	const input = instantiationService.createInstance(GrowthWriterEditorInput, viewType, viewData)
	return editorService.openEditor(input)
}

class OpenGrowthWriterAction extends Action2 {
	static readonly ID = 'void.openGrowthWriter'

	constructor() {
		super({
			id: OpenGrowthWriterAction.ID,
			title: nls.localize2('openGrowthWriter', 'Open Growth Writer'),
			icon: Codicon.megaphone,
			category: nls.localize2('void', 'SafeAppeals'),
			f1: true,
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyG,
				weight: KeybindingWeight.WorkbenchContrib,
			},
			menu: [{
				id: MenuId.CommandPalette,
				when: undefined,
			}],
		})
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const viewsService = accessor.get(IViewsService)
		await viewsService.openView(GROWTH_WRITER_VIEW_ID, true)
	}
}

registerAction2(OpenGrowthWriterAction)

class OpenGrowthWriterIdeasAction extends Action2 {
	static readonly ID = 'void.openGrowthWriterIdeas'

	constructor() {
		super({
			id: OpenGrowthWriterIdeasAction.ID,
			title: nls.localize2('openGrowthWriterIdeas', 'Growth Writer: Open Blog Ideas'),
			category: nls.localize2('void', 'SafeAppeals'),
			f1: true,
		})
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		await openGrowthWriterView(accessor, 'blog-ideas')
	}
}

registerAction2(OpenGrowthWriterIdeasAction)

class OpenGrowthWriterScheduleAction extends Action2 {
	static readonly ID = 'void.openGrowthWriterSchedule'

	constructor() {
		super({
			id: OpenGrowthWriterScheduleAction.ID,
			title: nls.localize2('openGrowthWriterSchedule', 'Growth Writer: Open Schedule'),
			category: nls.localize2('void', 'SafeAppeals'),
			f1: true,
		})
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		await openGrowthWriterView(accessor, 'schedule')
	}
}

registerAction2(OpenGrowthWriterScheduleAction)

class OpenGrowthWriterHistoryAction extends Action2 {
	static readonly ID = 'void.openGrowthWriterHistory'

	constructor() {
		super({
			id: OpenGrowthWriterHistoryAction.ID,
			title: nls.localize2('openGrowthWriterHistory', 'Growth Writer: Open History & Metrics'),
			category: nls.localize2('void', 'SafeAppeals'),
			f1: true,
		})
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		await openGrowthWriterView(accessor, 'history')
	}
}

registerAction2(OpenGrowthWriterHistoryAction)
