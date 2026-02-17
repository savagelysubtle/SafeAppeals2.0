/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../../browser/editor.js';
import { EditorExtensions, EditorExtensions as EditorFactoryExtensions, IEditorFactoryRegistry } from '../../../../common/editor.js';
import { DOCXViewerEditor } from './docxViewer/docxViewerEditor.js';
import { DOCXViewerInput } from './docxViewer/docxViewerInput.js';
import { DOCXViewerInputSerializer } from './docxViewer/docxViewerInputSerializer.js';
import { PDFViewerEditor } from './pdfViewer/pdfViewerEditor.js';
import { PDFViewerInput } from './pdfViewer/pdfViewerInput.js';
import { PDFViewerInputSerializer } from './pdfViewer/pdfViewerInputSerializer.js';
import { XLSXRustViewerEditor } from './xlsxRustViewer/xlsxRustViewerEditor.js';
import { XLSXRustViewerInput } from './xlsxRustViewer/xlsxRustViewerInput.js';
import { XLSXRustViewerInputSerializer } from './xlsxRustViewer/xlsxRustViewerInputSerializer.js';
// Import PDF Quick Edit actions (registers Ctrl+K handler)
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../../base/common/network.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IEditorResolverService, RegisteredEditorPriority } from '../../../../services/editor/common/editorResolverService.js';
import { IDocumentViewerService } from '../../common/documentViewerService.js';
import { DOCXContentExtractor } from './docxViewer/docxContentExtractor.js';
import { PDFContentExtractor } from './pdfViewer/pdfContentExtractor.js';
import './pdfViewer/pdfQuickEditActions.js';
// Import PDF Annotation Service (registers the singleton)
import './pdfViewer/pdfAnnotationService.js';
// XLSX content extractor (still used for AI text extraction, viewer code lives in xlsxViewerAbandoned/)
import { XLSXContentExtractor } from './xlsxViewerAbandoned/xlsxContentExtractor.js';

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

// Register DOCX Viewer Editor Pane
Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane)
	.registerEditorPane(
		EditorPaneDescriptor.create(
			DOCXViewerEditor,
			DOCXViewerEditor.ID,
			'DOCX Viewer'
		),
		[new SyncDescriptor(DOCXViewerInput)]
	);

// Register DOCX Viewer Input Serializer
Registry.as<IEditorFactoryRegistry>(EditorFactoryExtensions.EditorFactory)
	.registerEditorSerializer(
		DOCXViewerInputSerializer.ID,
		DOCXViewerInputSerializer
	);

// Register XLSX Viewer Editor Pane
Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane)
	.registerEditorPane(
		EditorPaneDescriptor.create(
			XLSXRustViewerEditor,
			XLSXRustViewerEditor.ID,
			'XLSX Viewer'
		),
		[new SyncDescriptor(XLSXRustViewerInput)]
	);

// Register XLSX Rust Viewer Input Serializer
Registry.as<IEditorFactoryRegistry>(EditorFactoryExtensions.EditorFactory)
	.registerEditorSerializer(
		XLSXRustViewerInputSerializer.ID,
		XLSXRustViewerInputSerializer
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

		// Register PDF editor as exclusive (no text editor option)
		this._register(editorResolverService.registerEditor(
			`**/*.pdf`,
			{
				id: PDFViewerEditor.ID,
				label: 'PDF Viewer',
				priority: RegisteredEditorPriority.exclusive
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

// Register DOCX editor resolver
class DOCXResolverContribution extends Disposable {
	constructor(
		@IEditorResolverService editorResolverService: IEditorResolverService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IDocumentViewerService documentViewerService: IDocumentViewerService
	) {
		super();

		// Register DOCX content extractor
		const docxExtractor = instantiationService.createInstance(DOCXContentExtractor);
		documentViewerService.registerExtractor(['docx'], docxExtractor);

		// Register DOCX editor as exclusive (no text editor option)
		this._register(editorResolverService.registerEditor(
			`**/*.docx`,
			{
				id: DOCXViewerEditor.ID,
				label: 'DOCX Viewer',
				priority: RegisteredEditorPriority.exclusive
			},
			{
				singlePerResource: false,
				canSupportResource: resource =>
					resource.scheme === Schemas.file && resource.path.toLowerCase().endsWith('.docx')
			},
			{
				createEditorInput: ({ resource }) => {
					const editor = instantiationService.createInstance(DOCXViewerInput, resource);
					return { editor };
				}
			}
		));
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(DOCXResolverContribution, LifecyclePhase.Restored);

// Register XLSX editor resolver (Rust-based viewer, sole handler for xlsx/xls)
class XLSXResolverContribution extends Disposable {
	constructor(
		@IEditorResolverService editorResolverService: IEditorResolverService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IDocumentViewerService documentViewerService: IDocumentViewerService
	) {
		super();

		// Register XLSX content extractor (for AI text extraction)
		const xlsxExtractor = instantiationService.createInstance(XLSXContentExtractor);
		documentViewerService.registerExtractor(['xlsx', 'xls'], xlsxExtractor);

		// Register XLSX editor as exclusive
		this._register(editorResolverService.registerEditor(
			`**/*.{xlsx,xls}`,
			{
				id: XLSXRustViewerEditor.ID,
				label: 'XLSX Viewer',
				priority: RegisteredEditorPriority.exclusive
			},
			{
				singlePerResource: false,
				canSupportResource: resource => {
					if (resource.scheme !== Schemas.file) {
						return false;
					}
					const lowerPath = resource.path.toLowerCase();
					return lowerPath.endsWith('.xlsx') || lowerPath.endsWith('.xls');
				}
			},
			{
				createEditorInput: ({ resource }) => {
					const editor = instantiationService.createInstance(XLSXRustViewerInput, resource);
					return { editor };
				}
			}
		));
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(XLSXResolverContribution, LifecyclePhase.Restored);

// --- Image Viewer Registration ---
import { ImageViewerEditor } from './imageViewer/imageViewerEditor.js';
import { ImageViewerInput } from './imageViewer/imageViewerInput.js';
import { ImageViewerInputSerializer } from './imageViewer/imageViewerInputSerializer.js';

// Register Image Viewer Editor Pane
Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane)
	.registerEditorPane(
		EditorPaneDescriptor.create(
			ImageViewerEditor,
			ImageViewerEditor.ID,
			'Image Viewer'
		),
		[new SyncDescriptor(ImageViewerInput)]
	);

// Register Image Viewer Input Serializer
Registry.as<IEditorFactoryRegistry>(EditorFactoryExtensions.EditorFactory)
	.registerEditorSerializer(
		ImageViewerInputSerializer.ID,
		ImageViewerInputSerializer
	);

// Register Image editor resolver
class ImageResolverContribution extends Disposable {
	constructor(
		@IEditorResolverService editorResolverService: IEditorResolverService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super();

		// Register Image editor as exclusive
		this._register(editorResolverService.registerEditor(
			`**/*.{jpg,jpeg,png,gif,webp,svg}`,
			{
				id: ImageViewerEditor.ID,
				label: 'Image Viewer',
				priority: RegisteredEditorPriority.exclusive
			},
			{
				singlePerResource: false,
				canSupportResource: resource => {
					if (resource.scheme !== Schemas.file) {
						return false;
					}
					const lowerPath = resource.path.toLowerCase();
					return lowerPath.endsWith('.jpg') ||
						lowerPath.endsWith('.jpeg') ||
						lowerPath.endsWith('.png') ||
						lowerPath.endsWith('.gif') ||
						lowerPath.endsWith('.webp') ||
						lowerPath.endsWith('.svg');
				}
			},
			{
				createEditorInput: ({ resource }) => {
					const editor = instantiationService.createInstance(ImageViewerInput, resource);
					return { editor };
				}
			}
		));
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(ImageResolverContribution, LifecyclePhase.Restored);

