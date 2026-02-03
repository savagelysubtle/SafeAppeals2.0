# Email Dashboard Enhancement - Project Tasks

**Goal**: Enhance the email dashboard with analytics, quick actions, classification, inline draft editing, conversation threading, and eventually live Gmail/Outlook integration with send capability.

**Created**: 2026-01-28
**Status**: in_progress

---

## Phase 1: Quick Wins (Low Effort, High Impact)

**Status**: ✅ COMPLETED
**Prerequisites**: None
**Estimated Effort**: ~1 day
**Completed**: 2026-01-28

### Tasks

- [x] **1.1 Dashboard Analytics Widget**
  - Description: Add a stats bar at the top of EmailDashboard showing email counts, draft counts, cases, and "needs reply" count
  - Files: 
    - `src/vs/workbench/contrib/void/browser/react/src/email-dashboard-tsx/EmailStats.tsx` (NEW ✓)
    - `src/vs/workbench/contrib/void/browser/react/src/email-dashboard-tsx/EmailDashboard.tsx` (modified ✓)
  - Status: ✅ completed
  - Notes: Stats bar displays Total Emails, Drafts, Cases, and Needs Reply (placeholder)

- [x] **1.2 Quick Actions Toolbar - Add to Timeline**
  - Description: Add "Add to Timeline" button to EmailCard that creates a timeline event from the email
  - Files:
    - `src/vs/workbench/contrib/void/browser/react/src/email-dashboard-tsx/EmailCard.tsx` (modified ✓)
  - Status: ✅ completed
  - Notes: Calendar icon button in both compact and list views, uses ITimelineService

- [x] **1.3 Quick Actions Toolbar - Flag/Star Email**
  - Description: Add flag/star toggle to emails for marking importance
  - Files:
    - `src/vs/workbench/contrib/void/browser/react/src/email-dashboard-tsx/EmailCard.tsx` (modified ✓)
    - `src/vs/workbench/contrib/void/common/emailService.ts` (added isStarred field ✓)
    - `src/vs/workbench/contrib/void/browser/emailService.ts` (added toggleStar method ✓)
    - `src/vs/workbench/contrib/void/electron-main/email/emailIndexService.ts` (added is_starred column ✓)
  - Status: ✅ completed
  - Notes: Star icon always visible, yellow when starred, optimistic UI updates

- [x] **1.4 Quick Actions Toolbar - Set Reminder**
  - Description: Add reminder button that stores a reminder date for follow-up
  - Files:
    - `src/vs/workbench/contrib/void/browser/react/src/email-dashboard-tsx/EmailCard.tsx` (modified ✓)
    - `src/vs/workbench/contrib/void/browser/react/src/email-dashboard-tsx/ReminderPicker.tsx` (NEW ✓)
    - `src/vs/workbench/contrib/void/common/emailService.ts` (added reminderDate field ✓)
  - Status: ✅ completed
  - Notes: Bell icon with dropdown picker, quick options (Tomorrow, Next Week, Next Month) + custom date

- [x] **1.5 Email Classification - Add Category Field**
  - Description: Extend Email type with category and priority fields, add to database schema
  - Files:
    - `src/vs/workbench/contrib/void/common/emailService.ts` (added EmailCategory, EmailPriority, EmailClassification ✓)
    - `src/vs/workbench/contrib/void/browser/emailService.ts` (added updateClassification, getEmailsByCategory ✓)
    - `src/vs/workbench/contrib/void/electron-main/email/emailIndexService.ts` (added category, priority, extracted_deadline columns ✓)
  - Status: ✅ completed
  - Notes: 6 categories (deadline, info-request, decision, scheduling, evidence, general) and 3 priorities (urgent, normal, low)

- [x] **1.6 Email Classification - Auto-Classify on Import**
  - Description: Use LLM to classify emails when imported (deadline, info-request, decision, scheduling, general)
  - Files:
    - `src/vs/workbench/contrib/void/browser/emailClassifier.ts` (NEW ✓)
    - `src/vs/workbench/contrib/void/browser/emailService.ts` (integrated classifier ✓)
    - `src/vs/workbench/contrib/void/browser/void.contribution.ts` (registered wiring contribution ✓)
  - Status: ✅ completed
  - Notes: Uses CloudLLMRouterService which prioritizes SafeAppeals Cloud (if signed in) over BYOK keys. Graceful fallback to 'general' if no LLM available. Updated 2026-01-29 to use cloud routing.

- [x] **1.6b Background Classification Polling**
  - Description: Periodic background check for unclassified emails (every 5 minutes)
  - Files:
    - `src/vs/workbench/contrib/void/browser/emailClassifier.ts` (added polling ✓)
    - `src/vs/workbench/contrib/void/common/emailService.ts` (added getUnclassifiedEmails ✓)
    - `src/vs/workbench/contrib/void/browser/emailService.ts` (implemented getUnclassifiedEmails ✓)
    - `src/vs/workbench/contrib/void/electron-main/email/emailIndexService.ts` (added query ✓)
    - `src/vs/workbench/contrib/void/electron-main/emailMainChannel.ts` (added IPC handler ✓)
  - Status: ✅ completed
  - Notes: Polls every 5 minutes, processes up to 5 emails per cycle, prevents overlapping polls, graceful handling when LLM not available

- [x] **1.7 Email Classification - Filter UI**
  - Description: Add category filter dropdown to EmailToolbar
  - Files:
    - `src/vs/workbench/contrib/void/browser/react/src/email-dashboard-tsx/EmailToolbar.tsx` (added filter dropdowns ✓)
    - `src/vs/workbench/contrib/void/browser/react/src/email-dashboard-tsx/EmailDashboard.tsx` (added filter state ✓)
    - `src/vs/workbench/contrib/void/browser/react/src/email-dashboard-tsx/EmailCard.tsx` (added category/priority badges ✓)
  - Status: ✅ completed
  - Notes: Category and Priority dropdowns with emojis, Clear Filters button, badges on EmailCard

### Acceptance Criteria
- [x] Stats widget shows total emails, drafts, cases, and "needs reply" count
- [x] Can add email to timeline with one click
- [x] Can star/flag emails (filter by starred pending - basic toggle complete)
- [x] Can set reminder on email
- [x] Emails are auto-classified on import
- [x] Can filter emails by category and priority

---

## Phase 2: Core UX Improvements (Medium Effort, Very High Impact)

**Status**: ✅ COMPLETED
**Prerequisites**: Phase 1 complete ✅
**Estimated Effort**: ~2-3 days
**Completed**: 2026-01-29

### Tasks

- [x] **2.1 In-Extension Draft Editor - Draft Storage Schema**
  - Description: Create database schema for storing drafts with versioning
  - Files:
    - `src/vs/workbench/contrib/void/common/emailService.ts` (add EmailDraft interface) ✓
    - `src/vs/workbench/contrib/void/browser/emailDraftService.ts` (add draft storage methods) ✓
    - `src/vs/workbench/contrib/void/electron-main/email/emailIndexService.ts` (email_drafts table) ✓
    - `src/vs/workbench/contrib/void/electron-main/email/emailMainService.ts` (draft methods) ✓
    - `src/vs/workbench/contrib/void/electron-main/emailMainChannel.ts` (IPC handlers) ✓
  - Status: ✅ completed
  - Blocked by: None
  - Notes: Schema: id, email_id, content, version, status (draft/reviewed/ready/sent), timestamps. Full IPC channel integration complete.

- [x] **2.2 In-Extension Draft Editor - DraftEditor Component**
  - Description: Create inline rich text editor component using Tiptap (reuse from docxViewer)
  - Files:
    - `src/vs/workbench/contrib/void/browser/react/src/email-dashboard-tsx/DraftEditor.tsx` (NEW ✓)
    - `src/vs/workbench/contrib/void/browser/react/src/email-dashboard-tsx/DraftEditor.css` (NEW ✓)
  - Status: ✅ completed
  - Completed: 2026-01-28
  - Blocked by: 2.1
  - Notes: Import Tiptap config from existing docxViewerTiptap.js. Component includes rich text toolbar, auto-save (2s debounce), manual save button, and full IEmailDraftService integration.

- [x] **2.3 In-Extension Draft Editor - Integrate into EmailCard**
  - Description: Add expandable draft section to EmailCard with inline editor
  - Files:
    - `src/vs/workbench/contrib/void/browser/react/src/email-dashboard-tsx/EmailCard.tsx` (modified ✓)
  - Status: ✅ completed
  - Completed: 2026-01-29
  - Blocked by: 2.2
  - Notes: Added Draft button to both compact and list views. Draft editor loads existing draft or starts empty. Expandable section below email content with clear visual separation.

- [x] **2.4 In-Extension Draft Editor - Version History**
  - Description: Show draft version history with ability to view/restore previous versions
  - Files:
    - `src/vs/workbench/contrib/void/browser/react/src/email-dashboard-tsx/DraftVersionHistory.tsx` (NEW ✓)
    - `src/vs/workbench/contrib/void/browser/react/src/email-dashboard-tsx/DraftEditor.tsx` (modified ✓)
    - `src/vs/workbench/contrib/void/browser/react/src/email-dashboard-tsx/DraftEditor.css` (modified ✓)
  - Status: ✅ completed
  - Completed: 2026-01-29
  - Blocked by: 2.3
  - Notes: Created version history panel with slide-out design showing all draft versions. Features include: version list with timestamps and previews, full content preview area, restore functionality with confirmation dialog, and History button in toolbar. Panel displays as 600px overlay on right side with split view (version list + preview).

- [x] **2.5 In-Extension Draft Editor - Status Workflow**
  - Description: Add draft status (Draft → Reviewed → Ready to Send) with visual indicators
  - Files:
    - `src/vs/workbench/contrib/void/browser/react/src/email-dashboard-tsx/DraftEditor.tsx` (modified ✓)
    - `src/vs/workbench/contrib/void/browser/react/src/email-dashboard-tsx/DraftStatusBadge.tsx` (NEW ✓)
    - `src/vs/workbench/contrib/void/browser/react/src/email-dashboard-tsx/EmailCard.tsx` (modified ✓)
  - Status: ✅ completed
  - Completed: 2026-01-29
  - Blocked by: 2.3
  - Notes: Created DraftStatusBadge component with dropdown status selector. DraftEditor shows status badge in header and "Next Status" button for progression (draft → reviewed → ready). EmailCard shows small status indicator when draft exists. Status persists via IEmailDraftService.updateDraftStatus().

- [x] **2.6 Conversation Threading - Parse Email Headers**
  - Description: Extract Message-ID, In-Reply-To, References from .eml files during parsing
  - Files:
    - `src/vs/workbench/contrib/void/common/emailService.ts` (extend Email interface with threading fields ✓)
    - `src/vs/workbench/contrib/void/electron-main/email/emailMainService.ts` (updated parser ✓)
    - `src/vs/workbench/contrib/void/electron-main/email/emailIndexService.ts` (database schema updated ✓)
    - `src/vs/workbench/contrib/void/browser/emailService.ts` (type conversion updated ✓)
  - Status: ✅ completed
  - Completed: 2026-01-28
  - Notes: Added messageId, inReplyTo, references[], and threadId fields. Parser extracts headers from .eml files, computes threadId from References chain. Database migration adds 4 new columns with indexes.

- [x] **2.7 Conversation Threading - Thread Grouping Logic**
  - Description: Create service to group emails by thread using message IDs and references
  - Files:
    - `src/vs/workbench/contrib/void/browser/emailThreadService.ts` (NEW ✓)
    - `src/vs/workbench/contrib/void/electron-main/email/emailIndexService.ts` (modified ✓)
    - `src/vs/workbench/contrib/void/electron-main/email/emailMainService.ts` (modified ✓)
    - `src/vs/workbench/contrib/void/electron-main/emailMainChannel.ts` (modified ✓)
    - `src/vs/workbench/contrib/void/browser/void.contribution.ts` (modified ✓)
  - Status: ✅ completed
  - Completed: 2026-01-28
  - Notes: Created IEmailThreadService with getThreads(), getThreadById(), and getEmailsInThread(). Added database queries to get distinct thread IDs and emails by thread. Full IPC channel integration complete.

- [x] **2.8 Conversation Threading - Thread UI Component**
  - Description: Create collapsible thread view showing grouped emails
  - Files:
    - `src/vs/workbench/contrib/void/browser/react/src/email-dashboard-tsx/EmailThread.tsx` (NEW ✓)
    - `src/vs/workbench/contrib/void/browser/react/src/email-dashboard-tsx/EmailDashboard.tsx` (modified ✓)
    - `src/vs/workbench/contrib/void/browser/react/src/email-dashboard-tsx/EmailToolbar.tsx` (modified ✓)
  - Status: ✅ completed
  - Completed: 2026-01-28
  - Notes: Created EmailThread component with collapsible UI, participant avatars, email count badge, visual connectors for thread chain, and highlight for latest email. Added Display toggle (Emails/Threads) to EmailToolbar. Thread view shows threads sorted by latest date with full filtering support.

- [x] **2.9 Conversation Threading - Thread Status**
  - Description: Track thread status (needs-reply, awaiting-response, resolved) based on latest email
  - Files:
    - `src/vs/workbench/contrib/void/browser/emailThreadService.ts` (add status logic ✓)
    - `src/vs/workbench/contrib/void/browser/react/src/email-dashboard-tsx/EmailThread.tsx` (status display ✓)
    - `src/vs/workbench/contrib/void/electron-main/email/emailIndexService.ts` (database schema ✓)
    - `src/vs/workbench/contrib/void/electron-main/email/emailMainService.ts` (status determination ✓)
    - `src/vs/workbench/contrib/void/electron-main/emailMainChannel.ts` (IPC handler ✓)
    - `src/vs/workbench/contrib/void/browser/react/src/email-dashboard-tsx/EmailDashboard.tsx` (status handler ✓)
  - Status: ✅ completed
  - Completed: 2026-01-29
  - Notes: Added thread_status column to database with index. Implemented automatic status determination (needs-reply/awaiting-response) based on latest email sender with heuristic logic. Added manual status override (needs-reply, awaiting-response, resolved, active) with clickable status badge UI. Status badge shows color-coded icon (red for needs-reply, orange for awaiting-response, green for resolved, blue for active). Dropdown menu allows quick status changes. Full IPC integration complete.

### Acceptance Criteria
- [x] Drafts are stored in database with versioning
- [x] Can edit drafts inline without opening separate DOCX file
- [x] Can view and restore previous draft versions
- [x] Drafts have visual status indicators
- [x] Emails are grouped by conversation thread
- [x] Thread view is collapsible
- [x] Thread status is visible (needs reply, awaiting, resolved)

---

## Phase 3: Full Integration (Higher Effort, Transformational)

**Status**: pending
**Prerequisites**: Phase 2 complete ✅ (draft system and threading needed for full value)
**Estimated Effort**: ~3-4 days

### Tasks

- [ ] **3.1 Gmail Integration - Extend OAuth Scopes**
  - Description: Add Gmail API scope to existing Google OAuth flow
  - Files:
    - `src/vs/workbench/contrib/void/browser/voidCloudAuthProvider.ts` (modify scopes)
    - `src/vs/workbench/contrib/void/common/voidCloudTypes.ts` (add Gmail scope constant)
  - Status: pending
  - Blocked by: None
  - Notes: Scope needed: `https://www.googleapis.com/auth/gmail.modify`

- [ ] **3.2 Gmail Integration - Gmail API Client**
  - Description: Create Gmail API client for fetching emails
  - Files:
    - `src/vs/workbench/contrib/void/electron-main/emailProviders/gmailProvider.ts` (NEW)
    - `src/vs/workbench/contrib/void/electron-main/emailProviders/types.ts` (NEW)
  - Status: pending
  - Blocked by: 3.1

- [ ] **3.3 Gmail Integration - Sync Service**
  - Description: Background service to sync Gmail inbox to local database
  - Files:
    - `src/vs/workbench/contrib/void/browser/emailSyncService.ts` (NEW)
    - `src/vs/workbench/contrib/void/electron-main/emailSyncChannel.ts` (NEW)
  - Status: pending
  - Blocked by: 3.2

- [ ] **3.4 Gmail Integration - Settings UI**
  - Description: Add "Connect Gmail" button and connected accounts display in settings
  - Files:
    - `src/vs/workbench/contrib/void/browser/react/src/email-dashboard-tsx/ConnectedAccounts.tsx` (NEW)
    - `src/vs/workbench/contrib/void/browser/react/src/void-settings-tsx/EmailIntegrationSection.tsx` (NEW)
  - Status: pending
  - Blocked by: 3.3

- [ ] **3.5 Outlook Integration - Microsoft OAuth Provider**
  - Description: Add Microsoft Graph OAuth for Outlook/Office 365 access
  - Files:
    - `src/vs/workbench/contrib/void/browser/microsoftAuthProvider.ts` (NEW)
    - `src/vs/workbench/contrib/void/common/outlookTypes.ts` (NEW)
  - Status: pending
  - Blocked by: 3.4 (pattern from Gmail)
  - Notes: Requires Azure AD app registration

- [ ] **3.6 Outlook Integration - Graph API Client**
  - Description: Create Microsoft Graph API client for Outlook email access
  - Files:
    - `src/vs/workbench/contrib/void/electron-main/emailProviders/outlookProvider.ts` (NEW)
  - Status: pending
  - Blocked by: 3.5

- [ ] **3.7 Outlook Integration - Sync Service Extension**
  - Description: Extend sync service to support Outlook alongside Gmail
  - Files:
    - `src/vs/workbench/contrib/void/browser/emailSyncService.ts` (modify)
    - `src/vs/workbench/contrib/void/electron-main/emailSyncChannel.ts` (modify)
  - Status: pending
  - Blocked by: 3.6

- [ ] **3.8 Outlook Integration - Settings UI Extension**
  - Description: Add "Connect Outlook" to connected accounts UI
  - Files:
    - `src/vs/workbench/contrib/void/browser/react/src/email-dashboard-tsx/ConnectedAccounts.tsx` (modify)
  - Status: pending
  - Blocked by: 3.7

- [ ] **3.9 Send Email - Gmail Send**
  - Description: Implement send email via Gmail API
  - Files:
    - `src/vs/workbench/contrib/void/electron-main/emailProviders/gmailProvider.ts` (add sendEmail method)
    - `src/vs/workbench/contrib/void/browser/emailDraftService.ts` (add sendDraft method)
  - Status: pending
  - Blocked by: 3.4

- [ ] **3.10 Send Email - Outlook Send**
  - Description: Implement send email via Microsoft Graph API
  - Files:
    - `src/vs/workbench/contrib/void/electron-main/emailProviders/outlookProvider.ts` (add sendEmail method)
  - Status: pending
  - Blocked by: 3.8

- [ ] **3.11 Send Email - UI Integration**
  - Description: Add "Send via Gmail/Outlook" button to draft editor
  - Files:
    - `src/vs/workbench/contrib/void/browser/react/src/email-dashboard-tsx/DraftEditor.tsx` (modify)
  - Status: pending
  - Blocked by: 2.3, 3.9, 3.10

### Acceptance Criteria
- [ ] Can connect Gmail account from settings
- [ ] Gmail emails sync automatically to dashboard
- [ ] Can connect Outlook/Office 365 account
- [ ] Outlook emails sync automatically
- [ ] Can send drafts via Gmail
- [ ] Can send drafts via Outlook
- [ ] Sent emails are tracked in the system

---

## Notes

### Architecture Decisions
- Email providers follow adapter pattern: `IEmailProvider` interface with `GmailProvider`, `OutlookProvider`, `LocalFileProvider` implementations
- All API calls happen in `electron-main` process to avoid CSP issues
- Sync uses background worker with configurable interval (default: 5 minutes)
- Draft versioning uses append-only log for history

### Dependencies
- Gmail API requires: `googleapis` package (already available via OAuth)
- Outlook requires: `@azure/msal-node` for authentication, `@microsoft/microsoft-graph-client` for API
- Tiptap already available from docxViewer

### Risk Mitigations
- OAuth token refresh handled automatically by existing Void Cloud infrastructure
- Gmail API quota: Use batch requests, cache aggressively
- Offline support: Sync to local SQLite, work offline, sync changes when online

### Open Questions
- Should sent emails be stored locally or just marked as sent?
- How to handle attachments from Gmail/Outlook (download on demand vs sync all)?
- Rate limiting strategy for API calls?
