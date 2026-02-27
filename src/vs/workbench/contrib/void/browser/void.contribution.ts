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

// register Chat Thread Storage (per-workspace SQLite via IPC)
import './chat/chatThreadStorageService.js';

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

// register file converter
import './fileConverter/fileConverter.contribution.js';

// register timeline & case management
import './timeline/timeline.contribution.js';

// register audio recorder
import './audioRecorder/audioRecorder.contribution.js';

// register calendar sync state service
import './calendar/calendarSyncStateService.js';

// register Google Calendar client service
import './calendar/googleCalendarClientService.js';

// register Outlook Calendar client service
import './calendar/outlookCalendarClientService.js';

// register email dashboard
import '../common/emailService.js';
import './emailClassifier.js';
import './emailDashboard/emailDashboard.contribution.js';
import './emailDraftService.js';
import './emailService.js';
import './emailThreadService.js';
import './emailViewers/emailViewer.contribution.js';

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
import '../common/rag/ragContextService.js';
import '../common/rag/ragPathService.js';
import '../common/rag/ragService.js';

// RAG workspace service
import './rag/ragWorkspaceService.js';
import { IRAGWorkspaceService } from './rag/ragWorkspaceService.js';

// RAG actions
import './rag/ragActions.js';

// Web Search actions
import './webSearchActions.js';

// Document viewer service
import '../common/documentViewerService.js';

// PDF viewer components
import './documentViewers/documentViewer.contribution.js';

// DOCX Quick Edit Actions (Ctrl+L/K for DOCX viewer)
import './documentViewers/docxViewer/docxQuickEditActions.js';

// Document file creation handler (for DOCX/XLSX auto-population)
import './documentCreatorService.js';
import './documentFileCreation.contribution.js';

// Void Cloud service, URL handler, and auth provider
import './voidCloudActions.js';
import { SafeAppealsCloudAuthProvider } from './voidCloudAuthProvider.js';
import './voidCloudService.js';
import { VoidCloudUrlHandler } from './voidCloudUrlHandler.js';

// DocuSign e-signature service
import './docuSign/docuSignActions.js';
import './docuSign/docuSignService.js';

// Growth Writer extension (marketing content engine)
import './growthWriter/growthWriterService.js';
import './growthWriter/redditMonitorService.js';
import './growthWriter/twitterService.js';
import './growthWriter/growthWriter.contribution.js';

// Ensure RAG workspace service starts
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { IEmailService } from '../common/emailService.js';
import { IEmailClassifierService } from './emailClassifier.js';
import { EmailService } from './emailService.js';

class RAGWorkspaceContribution {
	constructor(
		@IRAGWorkspaceService _ragWorkspaceService: IRAGWorkspaceService
	) {
		// Just injecting the service causes it to instantiate
	}
}

// Wire up email classifier to email service (avoid circular dependency)
class EmailClassifierWiringContribution {
	constructor(
		@IEmailService emailService: IEmailService,
		@IEmailClassifierService emailClassifierService: IEmailClassifierService
	) {
		// Wire up the classifier to the email service (for on-import classification)
		if (emailService instanceof EmailService) {
			(emailService as EmailService).setClassifierService(emailClassifierService);
		}

		// Wire up the email service to the classifier (for background polling)
		if ('setEmailService' in emailClassifierService) {
			(emailClassifierService as { setEmailService(service: IEmailService): void }).setEmailService(emailService);
		}
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(RAGWorkspaceContribution, LifecyclePhase.Restored);

// Register email classifier wiring (after services are available)
Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(EmailClassifierWiringContribution, LifecyclePhase.Restored);

// Register Void Cloud URL handler for OAuth callback
Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(VoidCloudUrlHandler, LifecyclePhase.Restored);

// Register SafeAppeals Cloud authentication provider
Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(SafeAppealsCloudAuthProvider, LifecyclePhase.Restored);
