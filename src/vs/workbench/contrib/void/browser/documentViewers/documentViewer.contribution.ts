/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Registry } from '../../../../../platform/registry/common/platform.js';
import { IEditorPaneRegistry, EditorPaneDescriptor } from '../../../../browser/editor.js';
import { EditorExtensions } from '../../../../common/editor.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { PDFViewerEditor } from './pdfViewer/pdfViewerEditor.js';
import { PDFViewerInput } from './pdfViewer/pdfViewerInput.js';
import { IEditorFactoryRegistry, EditorExtensions as EditorFactoryExtensions } from '../../../../common/editor.js';
import { PDFViewerInputSerializer } from './pdfViewer/pdfViewerInputSerializer.js';
// Import PDF Quick Edit actions (registers Ctrl+K handler)
import './pdfViewer/pdfQuickEditActions.js';
import { IEditorResolverService, RegisteredEditorPriority } from '../../../../services/editor/common/editorResolverService.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IDocumentViewerService } from '../../common/documentViewerService.js';
import { PDFContentExtractor } from './pdfViewer/pdfContentExtractor.js';
import { Schemas } from '../../../../../base/common/network.js';

// Register PDF Viewer Editor Pane
Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane)
	.registerEditorPane(
		EditorPaneDescriptor.create(
			PDFViewerEditor,
			PDFViewerEditor.ID,
			'PDF Viewer'
		),
		[new SyncDescriptor(PDFViewerInput)]
	);

// Register PDF Viewer Input Serializer
Registry.as<IEditorFactoryRegistry>(EditorFactoryExtensions.EditorFactory)
	.registerEditorSerializer(
		PDFViewerInputSerializer.ID,
		PDFViewerInputSerializer
	);

// Register PDF editor resolver
class PDFResolverContribution extends Disposable {
	constructor(
		@IEditorResolverService editorResolverService: IEditorResolverService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IDocumentViewerService documentViewerService: IDocumentViewerService
	) {
		super();

		// Register PDF content extractor
		const pdfExtractor = instantiationService.createInstance(PDFContentExtractor);
		documentViewerService.registerExtractor(['pdf'], pdfExtractor);

		// Register PDF editor
		this._register(editorResolverService.registerEditor(
			`**/*.pdf`,
			{
				id: PDFViewerEditor.ID,
				label: 'PDF Viewer',
				priority: RegisteredEditorPriority.default
			},
			{
				singlePerResource: false,
				canSupportResource: resource =>
					resource.scheme === Schemas.file && resource.path.toLowerCase().endsWith('.pdf')
			},
			{
				createEditorInput: ({ resource }) => {
					const editor = instantiationService.createInstance(PDFViewerInput, resource);
					return { editor };
				}
			}
		));
	}
}

// Auto-instantiate the resolver contribution
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../../common/contributions.js';
import { LifecyclePhase } from '../../../../services/lifecycle/common/lifecycle.js';

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(PDFResolverContribution, LifecyclePhase.Restored);

