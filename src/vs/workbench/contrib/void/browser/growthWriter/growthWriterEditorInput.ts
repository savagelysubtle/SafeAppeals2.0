import { EditorInput } from '../../../../common/editor/editorInput.js'
import { URI } from '../../../../../base/common/uri.js'
import { IUntypedEditorInput } from '../../../../common/editor.js'
import { isEqual } from '../../../../../base/common/resources.js'
import { Codicon } from '../../../../../base/common/codicons.js'

export type GrowthWriterViewType =
	| 'blog-editor'
	| 'social-posts'
	| 'reddit-comment'
	| 'blog-ideas'
	| 'schedule'
	| 'history'
	| 'account-health'

const nameOfViewType: Record<GrowthWriterViewType, string> = {
	'blog-editor': 'Blog Editor',
	'social-posts': 'Social Posts',
	'reddit-comment': 'Reddit Comment',
	'blog-ideas': 'Blog Ideas',
	'schedule': 'Schedule',
	'history': 'History & Metrics',
	'account-health': 'Account Health',
}

export class GrowthWriterEditorInput extends EditorInput {
	static readonly TYPE_ID = 'workbench.input.growthWriter'
	static readonly EDITOR_ID = 'void.growthWriterEditor'

	readonly resource: URI

	constructor(
		readonly viewType: GrowthWriterViewType,
		readonly viewData: Record<string, string> | undefined,
	) {
		super()
		this.resource = URI.from({
			scheme: 'void',
			authority: 'growth-writer',
			path: `/${viewType}`,
			query: viewData ? new URLSearchParams(viewData).toString() : undefined,
		})
	}

	override get typeId(): string {
		return GrowthWriterEditorInput.TYPE_ID
	}

	override get editorId(): string {
		return GrowthWriterEditorInput.EDITOR_ID
	}

	override getName(): string {
		const baseName = nameOfViewType[this.viewType] || 'Growth Writer'
		const label = this.viewData?.label
		return label ? `${baseName} - ${label}` : baseName
	}

	override getIcon() {
		return Codicon.megaphone
	}

	override matches(otherInput: EditorInput | IUntypedEditorInput): boolean {
		if (otherInput instanceof GrowthWriterEditorInput) {
			return isEqual(this.resource, otherInput.resource)
		}
		return false
	}
}
