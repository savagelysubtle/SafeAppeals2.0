/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Safe Appeals Team. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for information.
 *--------------------------------------------------------------------------------------*/

// SafeAppeals workbench contribution hub.
//
// This is the single entry point for all SafeAppeals features, imported from
// workbench.common.main.ts. Features register themselves via side-effect
// imports below as they are migrated from void-reference/ (see
// .cursor/plans/upstream_vs_code_merge_spike_2245beba.plan.md).
//
// Layout:
//   browser/integration/  — bolt-on into upstream AI stack (LM providers,
//                           chat agent, inline completions, LM tools)
//   browser/<feature>/    — domain features (viewers, rag, email, timeline,
//                           calendar, docuSign, caseInfo, fileOrganizer, ...)
//   common/               — process-agnostic services and types
//   electron-main/        — main-process services + IPC channels (wired in
//                           src/vs/code/electron-main/app.ts)

// Phase 2 — AI integration layer (uncomment as implemented):
// import './integration/safeappealsLMProviders.js';
// import './integration/safeappealsChatAgent.js';
// import './integration/safeappealsCompletions.js';
// import './integration/safeappealsTools.js';

// Phase 3 — domain features (uncomment as migrated):
// import './documentViewers/documentViewer.contribution.js';
// import './rag/rag.contribution.js';
// import './emailDashboard/emailDashboard.contribution.js';
// import './timeline/timeline.contribution.js';
// import './calendar/calendar.contribution.js';
// import './caseInfo/caseInfo.contribution.js';
// import './fileOrganizer/fileOrganizer.contribution.js';
// import './fileConverter/fileConverter.contribution.js';
// import './docuSign/docuSign.contribution.js';
// import './audioRecorder/audioRecorder.contribution.js';
// import './cloud/safeappealsCloud.contribution.js';
