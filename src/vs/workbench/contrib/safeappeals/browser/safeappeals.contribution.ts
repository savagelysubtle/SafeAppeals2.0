/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Safe Appeals Team. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for information.
 *--------------------------------------------------------------------------------------*/

// safeAppeals workbench contribution hub.
//
// This is the single entry point for all safeAppeals features, imported from
// workbench.common.main.ts. Features register themselves via side-effect
// imports below as they are migrated from void-reference/ (see
// .cursor/plans/upstream_vs_code_merge_spike_2245beba.plan.md).
//
// Layout:
//   browser/integration/  — bolt-on into upstream AI stack (LM providers,
//                           chat agent, inline completions, LM tools)
//   browser/<feature>/    — domain features kept in contrib (rag, timeline,
//                           caseInfo, fileOrganizer, fileConverter, audio,
//                           cloud, settings)
//   common/               — process-agnostic services and types
//   electron-main/        — main-process services + IPC channels (wired in
//                           src/vs/code/electron-main/app.ts)

// Phase 2 — AI integration layer (uncomment as implemented):
// import './integration/safeAppealsLMProviders.js';
// import './integration/safeAppealsChatAgent.js';
// import './integration/safeAppealsCompletions.js';
// import './integration/safeAppealsTools.js';

// Phase 3 — domain features rewritten in contrib (uncomment as migrated):
// import './rag/rag.contribution.js';
// import './timeline/timeline.contribution.js';
// import './caseInfo/caseInfo.contribution.js';
// import './fileOrganizer/fileOrganizer.contribution.js';
// import './fileConverter/fileConverter.contribution.js';
// import './audioRecorder/audioRecorder.contribution.js';
// import './cloud/safeAppealsCloud.contribution.js';
// import './settings/safeAppealsSettings.contribution.js';

// NOT here — written as built-in extensions instead (plan section D.2):
//   extensions/safeappeals-documents  (PDF/DOCX/XLSX custom editors + doc LM tools)
//   extensions/safeappeals-docusign   (OAuth via onUri, esign REST)
//   extensions/safeappeals-calendar   (Google Calendar sync)
//   extensions/safeappeals-email      (IMAP/SMTP, dashboard webview, classifier)
