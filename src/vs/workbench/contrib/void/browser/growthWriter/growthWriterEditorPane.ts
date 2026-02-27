import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js'
import { EditorPane } from '../../../../browser/parts/editor/editorPane.js'
import { IEditorGroup } from '../../../../services/editor/common/editorGroupsService.js'
import { IEditorService } from '../../../../services/editor/common/editorService.js'
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js'
import { IThemeService } from '../../../../../platform/theme/common/themeService.js'
import { IStorageService } from '../../../../../platform/storage/common/storage.js'
import { IMainProcessService } from '../../../../../platform/ipc/common/mainProcessService.js'
import { Dimension } from '../../../../../base/browser/dom.js'
import { toDisposable } from '../../../../../base/common/lifecycle.js'
import { IEditorOptions } from '../../../../../platform/editor/common/editor.js'
import { IEditorOpenContext } from '../../../../common/editor.js'
import { CancellationToken } from '../../../../../base/common/cancellation.js'
import { mountGrowthWriterEditor } from '../react/out/growth-writer-editor-tsx/index.js'
import { GrowthWriterEditorInput, GrowthWriterViewType } from './growthWriterEditorInput.js'

export class GrowthWriterEditorPane extends EditorPane {
	static readonly ID = 'void.growthWriterEditor'

	private container: HTMLElement | undefined
	private reactMount: { rerender: (props?: any) => void; dispose: () => void } | undefined

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IMainProcessService private readonly mainProcessService: IMainProcessService,
		@IEditorService private readonly editorService: IEditorService,
	) {
		super(GrowthWriterEditorPane.ID, group, telemetryService, themeService, storageService)
	}

	protected createEditor(parent: HTMLElement): void {
		parent.style.height = '100%'
		parent.style.width = '100%'

		this.container = document.createElement('div')
		this.container.style.height = '100%'
		this.container.style.width = '100%'
		parent.appendChild(this.container)
	}

	override async setInput(input: GrowthWriterEditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token)
		if (!this.container) return

		const channel = this.mainProcessService.getChannel('void-channel-growth-writer')

		const openView = (viewType: GrowthWriterViewType, viewData?: Record<string, string>) => {
			const newInput = this.instantiationService.createInstance(GrowthWriterEditorInput, viewType, viewData)
			this.editorService.openEditor(newInput)
		}

		const props = {
			viewType: input.viewType,
			viewData: input.viewData,
			openView,
			channel,
		}

		if (this.reactMount) {
			this.reactMount.rerender(props)
		} else {
			this.instantiationService.invokeFunction(accessor => {
				this.reactMount = mountGrowthWriterEditor(this.container!, accessor, props)
				if (this.reactMount) {
					this._register(toDisposable(() => this.reactMount?.dispose()))
				}
			})
		}
	}

	layout(dimension: Dimension): void {
		if (this.container) {
			this.container.style.height = `${dimension.height}px`
			this.container.style.width = `${dimension.width}px`
		}
	}

	override get minimumWidth() { return 400 }
}
