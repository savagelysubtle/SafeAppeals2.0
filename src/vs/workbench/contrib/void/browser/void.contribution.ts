/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Registry } from '../../../../platform/registry/common/platform.js';

// register inline diffs
import './editCodeService.js';

// register Sidebar pane, state, actions (keybinds, menus) (Ctrl+L)
import './sidebarActions.js';
import './sidebarPane.js';
import './voidExtensionApi.js';

// register quick edit (Ctrl+K)
import './quickEditActions.js';


// register Autocomplete
import './autocompleteService.js';

// register Context services
// import './contextGatheringService.js'
// import './contextUserChangesService.js'

// settings pane
import './voidSettingsPane.js';

// register css
// TEMPORARILY DISABLED: CSS imports cause module loading errors
// import './media/void.css';

// update (frontend part, also see platform/)
import './voidUpdateActions.js';

import './convertToLLMMessageWorkbenchContrib.js';

// tools
import './tools/terminalToolService.js';
import './tools/toolsService.js';

// register Thread History
import './chatThreadService.js';

// ping
import './metricsPollService.js';

// helper services
import './helperServices/consistentItemService.js';

// register selection helper
import './voidSelectionHelperWidget.js';

// register tooltip service
import './tooltipService.js';

// register onboarding service
import './voidOnboardingService.js';

// register misc service
import './miscWokrbenchContrib.js';

// register file service (for explorer context menu)
import './fileService.js';

// register source control management
import './voidSCMService.js';

// register file organizer
import './fileOrganizer/fileOrganizerContribution.js';
import './fileOrgContextService.js';

// register case info panel
import './caseInfo/caseInfo.contribution.js';

// register email dashboard - FULLY DISABLED FOR DEBUGGING
// import '../common/emailService.js';
// import './emailService.js';
// import './emailDraftService.js';
// import './emailWorkspaceService.js';
// import './emailDashboard/emailDashboardContribution.js';
// import './emailViewers/emailViewer.contribution.js';

// ---------- common (unclear if these actually need to be imported, because they're already imported wherever they're used) ----------

// llmMessage
import '../common/sendLLMMessageService.js';

// voidSettings
import '../common/voidSettingsService.js';

// refreshModel
import '../common/refreshModelService.js';

// metrics
import '../common/metricsService.js';

// context tracking for chat context window management
import '../common/contextTrackingService.js';

// updates
import '../common/voidUpdateService.js';

// model service
import '../common/voidModelService.js';

// case profile service
import '../common/caseProfileService.js';

// RAG services
import '../common/ragContextService.js';
import '../common/ragPathService.js';
import '../common/ragService.js';

// RAG workspace service
import './ragWorkspaceService.js';
import { IRAGWorkspaceService } from './ragWorkspaceService.js';

// RAG actions
import './ragActions.js';

// Web Search actions
import './webSearchActions.js';

// Document viewer service
import '../common/documentViewerService.js';

// PDF viewer components
import './documentViewers/documentViewer.contribution.js';

// Document file creation handler (for DOCX/XLSX auto-population)
import './documentCreatorService.js';
import './documentFileCreation.contribution.js';

// Void Cloud service, URL handler, and auth provider
import './voidCloudService.js';
import { VoidCloudUrlHandler } from './voidCloudUrlHandler.js';
import { SafeAppealsCloudAuthProvider } from './voidCloudAuthProvider.js';

// Ensure RAG workspace service starts
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';

class RAGWorkspaceContribution {
	constructor(
		@IRAGWorkspaceService _ragWorkspaceService: IRAGWorkspaceService
	) {
		// Just injecting the service causes it to instantiate
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(RAGWorkspaceContribution, LifecyclePhase.Restored);

// Register Void Cloud URL handler for OAuth callback
Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(VoidCloudUrlHandler, LifecyclePhase.Restored);

// Register SafeAppeals Cloud authentication provider
Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(SafeAppealsCloudAuthProvider, LifecyclePhase.Restored);
