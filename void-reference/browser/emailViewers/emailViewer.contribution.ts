/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../../base/common/network.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../../browser/editor.js';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../../common/contributions.js';
import { EditorExtensions, EditorExtensions as EditorFactoryExtensions, IEditorFactoryRegistry } from '../../../../common/editor.js';
import { IEditorResolverService, RegisteredEditorPriority } from '../../../../services/editor/common/editorResolverService.js';
import { LifecyclePhase } from '../../../../services/lifecycle/common/lifecycle.js';
import { EmailViewerEditor } from './emailViewerEditor.js';
import { EmailViewerInput } from './emailViewerInput.js';
import { EmailViewerInputSerializer } from './emailViewerInputSerializer.js';
import { IEmailService } from '../../common/emailService.js';
import { URI } from '../../../../../base/common/uri.js';

// Register Email Viewer Editor Pane
Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane)
	.registerEditorPane(
		EditorPaneDescriptor.create(
			EmailViewerEditor,
			EmailViewerEditor.ID,
			'Email Viewer'
		),
		[new SyncDescriptor(EmailViewerInput)]
	);

// Register Email Viewer Input Serializer
Registry.as<IEditorFactoryRegistry>(EditorFactoryExtensions.EditorFactory)
	.registerEditorSerializer(
		EmailViewerInputSerializer.ID,
		EmailViewerInputSerializer
	);

// Register EML editor resolver
class EMLResolverContribution extends Disposable {
	constructor(
		@IEditorResolverService editorResolverService: IEditorResolverService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IEmailService emailService: IEmailService
	) {
		super();

		// Register EML editor as exclusive
		this._register(editorResolverService.registerEditor(
			`**/*.eml`,
			{
				id: EmailViewerEditor.ID,
				label: 'Email Viewer',
				priority: RegisteredEditorPriority.exclusive
			},
			{
				singlePerResource: false,
				canSupportResource: (resource: URI) =>
					resource.scheme === Schemas.file && resource.path.toLowerCase().endsWith('.eml')
			},
			{
				createEditorInput: async ({ resource }: { resource: URI }) => {
					// Parse and store the email
					const email = await emailService.parseEmail(resource);

					// Create the editor input
					const editor = instantiationService.createInstance(EmailViewerInput, resource, email.id);
					editor.setEmail(email);

					return { editor };
				}
			}
		));
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(EMLResolverContribution, LifecyclePhase.Restored);

