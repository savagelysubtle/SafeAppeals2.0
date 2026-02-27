import { toDisposable } from '../../../../../base/common/lifecycle.js'
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js'
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js'
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js'
import { IHoverService } from '../../../../../platform/hover/browser/hover.js'
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js'
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js'
import { IOpenerService } from '../../../../../platform/opener/common/opener.js'
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js'
import { IThemeService } from '../../../../../platform/theme/common/themeService.js'
import { IViewPaneOptions, ViewPane } from '../../../../browser/parts/views/viewPane.js'
import { IViewDescriptorService } from '../../../../common/views.js'
import { IEditorService } from '../../../../services/editor/common/editorService.js'
import { IMainProcessService } from '../../../../../platform/ipc/common/mainProcessService.js'
import { mountGrowthWriterSidebar } from '../react/out/growth-writer-sidebar-tsx/index.js'
import { GrowthWriterEditorInput, GrowthWriterViewType } from './growthWriterEditorInput.js'

export class GrowthWriterPane extends ViewPane {

	static readonly ID = 'void.growthWriterPane'
	static readonly TITLE = 'Growth Writer'

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
		@IEditorService private readonly editorService: IEditorService,
		@IMainProcessService private readonly mainProcessService: IMainProcessService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService)
	}

	protected override renderBody(parent: HTMLElement): void {
		super.renderBody(parent)
		parent.style.overflow = 'auto'
		parent.style.userSelect = 'text'

		const channel = this.mainProcessService.getChannel('void-channel-growth-writer')

		const openView = (viewType: GrowthWriterViewType, viewData?: Record<string, string>) => {
			const input = this.instantiationService.createInstance(GrowthWriterEditorInput, viewType, viewData)
			this.editorService.openEditor(input)
		}

		this.instantiationService.invokeFunction(accessor => {
			const disposeFn = mountGrowthWriterSidebar(parent, accessor, { openView, channel })?.dispose
			this._register(toDisposable(() => disposeFn?.()))
		})
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width)
		this.element.style.height = `${height}px`
		this.element.style.width = `${width}px`
	}
}
