# SafeAppeals Competitive Feature Roadmap

## Current Competitive Position

**Target Market**: Solo practitioners, small firms (1-5), privacy-conscious legal professionals, workers' compensation specialists

**Positioning**: AI-first legal case research and management platform with local-first architecture

### Competitive Strengths (Already Implemented)

- [x] Multi-workspace case isolation (folder = case)
- [x] 15+ AI provider support (including local models like Ollama)
- [x] RAG with hybrid search + reranking + query decomposition
- [x] Integrated DOCX/XLSX/PDF viewers with AI editing (Ctrl+L/K)
- [x] Timeline dashboard with deadline tracking + notifications
- [x] Timeline export to PDF for court submissions
- [x] Email dashboard with AI classification + inline reply
- [x] Case organizer with .caseinfo.json context injection
- [x] AI-powered file naming/categorization via file organizer
- [x] Per-workspace databases and embeddings (isolated)
- [x] Offline capability with local models
- [x] No per-seat pricing
- [x] Case summary generation (chat + document context)
- [x] Multiple chat modes (case_manager, research, drafting)
- [x] File converter with batch conversion + PDF merge
- [x] SCM/Git integration with AI commit messages
- [x] OCR support for scanned PDFs (Tesseract)
- [x] MCP tool integration for extensibility
- [x] **Google Calendar sync** (per-event sync with workspace isolation)
- [x] **Outlook Calendar sync** (per-event sync via Microsoft Graph API)
- [x] Calendar .ics export for manual import
- [x] Per-workspace calendar sync state tracking
- [x] **Calendar view in Timeline** (month/week view with event display)
- [x] **DocuSign e-signature integration** (JWT Grant auth, envelope creation/tracking)
- [x] **Time Tracker** (UTBMS codes, 6-min billing, LEDES export, per-workspace SQLite)

---

## Roadmap Phases

### Phase 1: Core Polish (Weeks 1-4)

**Goal**: Solidify existing features, improve reliability

| Priority | Feature                               | Effort | Impact | Status      |
| -------- | ------------------------------------- | ------ | ------ | ----------- |
| P0       | DOCX ribbon visual refresh            | Small  | High   | In Progress |
| P0       | Stabilize RAG indexing                | Medium | High   |             |
| P0       | Improve timeline UX                   | Small  | Medium |             |
| P1       | Better error handling across viewers  | Medium | High   |             |
| P1       | Onboarding flow polish                | Small  | Medium |             |
| P1       | Performance optimization (large docs) | Medium | High   |             |

**Exit Criteria**: Existing features work reliably, good first-run experience

---

### Phase 2: Calendar & Deadlines (Weeks 5-8)

**Goal**: Become the best at deadline management (key differentiator)

| Priority | Feature                               | Effort | Impact    | Competitors         | Status      |
| -------- | ------------------------------------- | ------ | --------- | ------------------- | ----------- |
| P0       | **Google Calendar sync** (per-event)  | Medium | High      | All have it         | ✅ COMPLETE |
| P0       | **Outlook Calendar sync** (per-event) | Medium | High      | All have it         | ✅ COMPLETE |
| P0       | **Statute of limitations tracker**    | Medium | Very High | CASEpeer, MerusCase |             |
| P1       | Jurisdiction-specific deadline rules  | Large  | Very High | MerusCase           |             |
| P1       | Recurring deadline templates          | Small  | Medium    | Most have it        |             |
| P2       | Calendar view in timeline             | Small  | Medium    | Nice to have        | ✅ COMPLETE |

**Implementation Notes**:

- ✅ Google Calendar: Per-event sync with workspace isolation, OAuth via Void Cloud or direct
- ✅ Outlook Calendar: Using Microsoft Graph API + MSAL Node, Azure AD app registration required
- Statute tracker: Database of jurisdiction rules + case type → deadline calculation
- Consider: Workers comp has specific statute rules by state

**Google Calendar Features Implemented**:

- Per-event sync (not bulk export)
- Workspace-isolated sync state (`.calendar-sync.json`)
- Hash-based change detection for incremental sync
- Unique event IDs: `safeappeals-{workspaceId}-{eventId}`
- Integrated with Void Cloud auth (single sign-on)
- Direct Google OAuth fallback if not using Void Cloud

**Outlook Calendar Features Implemented**:

- Per-event sync using Microsoft Graph API
- MSAL Node with PKCE flow for desktop OAuth
- Workspace-isolated sync (same `.calendar-sync.json` pattern)
- Extended properties for UID tracking
- Single reminder support (Outlook limitation)
- Azure AD multi-tenant or single-tenant support

**Calendar View Features Implemented**:

- Interactive calendar view within Timeline dashboard
- Month/week navigation with event display
- Click-to-view event details
- Visual indicators for deadlines and appointments
- Integrated with Google/Outlook sync (push events to external calendars)

**Exit Criteria**: Timeline connects to real calendars, auto-calculates jurisdiction deadlines

---

### Phase 3: Document Automation (Weeks 9-14)

**Goal**: Reduce manual document work

| Priority | Feature                                          | Effort | Impact    | Competitors      |
| -------- | ------------------------------------------------ | ------ | --------- | ---------------- | ----------- |
| P0       | **Court form auto-fill** (WCAB forms)            | Large  | Very High | MerusCase        |
| P0       | **Document templates** (merge fields)            | Medium | High      | Smokeball, Clio  |
| P1       | **E-signature integration** (DocuSign/HelloSign) | Medium | High      | Clio, Filevine   | ✅ COMPLETE |
| P1       | Template library (letters, motions)              | Medium | Medium    | Most have it     |
| P2       | Document comparison (redline)                    | Medium | Medium    | CoCounsel has it |

**Implementation Notes**:

- Court forms: Start with California WCAB (DWC-1, EAMS forms)
- Templates: Handlebars/Mustache syntax in DOCX, merge from .caseinfo.json
- ✅ E-sig: DocuSign JWT Grant integration complete (demo + production support)

**DocuSign Features Implemented**:

- JWT Grant authentication with RSA keypair (PKCS#8 format)
- Automatic PKCS#1 to PKCS#8 key conversion
- Secure private key storage via Electron safeStorage
- Envelope creation with document + signer/CC recipients
- Anchor-based signature placement (`/sig/` anchor string)
- Envelope status tracking and polling
- Document-to-envelope mapping for in-app tracking
- Demo and production environment support

**Exit Criteria**: Can generate and sign common legal documents without leaving app

---

### Phase 4: Client Communication (Weeks 15-20)

**Goal**: Enable client self-service (table stakes for practice management)

| Priority | Feature                           | Effort | Impact    | Competitors       |
| -------- | --------------------------------- | ------ | --------- | ----------------- |
| P0       | **Client portal** (web-based)     | Large  | Very High | Clio, MyCase, all |
| P1       | Secure document sharing           | Medium | High      | All have it       |
| P1       | Case status updates (client view) | Medium | High      | MyCase            |
| P2       | **Two-way SMS/texting**           | Medium | High      | MyCase, CASEpeer  |
| P2       | Appointment scheduling            | Medium | Medium    | Clio              |

**Implementation Notes**:

- Client portal: Simple web app, read-only view of case status + documents
- Could be separate repo, connects via API
- Consider: Supabase for quick auth/database for portal

**Exit Criteria**: Clients can check case status and download documents without calling

---

### Phase 5: Billing & Time (Weeks 21-28)

**Goal**: Complete practice management feature set

| Priority | Feature                                     | Effort | Impact    | Competitors | Status      |
| -------- | ------------------------------------------- | ------ | --------- | ----------- | ----------- |
| P0       | **Time tracking** (manual + timer)          | Medium | High      | All have it | ✅ COMPLETE |
| P0       | **Invoice generation**                      | Medium | High      | All have it |             |
| P1       | AI-assisted time entry (from chat/activity) | Medium | Very High | Unique!     |             |
| P1       | Expense tracking                            | Small  | Medium    | All have it |             |
| P2       | Payment processing (Stripe/LawPay)          | Medium | High      | Clio, most  |             |
| P2       | Trust accounting (IOLTA)                    | Large  | Medium    | CosmoLex    |             |

**Implementation Notes**:

- ✅ Time tracking: Full-featured timer with start/stop, manual entry, workspace isolation
- Unique angle: "AI watched you work, here's your time entries"
- LawPay is legal-specific payment processor

**Time Tracker Features Implemented**:

- Real-time timer with start/stop/toggle controls
- 6-minute billing increments (0.1 hour rounding, industry standard)
- UTBMS task and activity code support
- Matter/case association with client tracking
- Multiple billing rate tiers
- Per-workspace SQLite database (isolated like RAG)
- Export to CSV, JSON, and LEDES 1998B format
- Status bar integration showing live timer + today's hours
- Sidebar panel with entry management
- Delete entries with confirmation
- Start/stop times displayed on each entry
- Auto-save timer on window close
- Billable/non-billable tracking

**Exit Criteria**: Can track time, generate invoices, accept payments

---

### Phase 6: Advanced AI (Weeks 29-36)

**Goal**: Leapfrog competitors on AI capabilities

| Priority | Feature                                        | Effort | Impact    | Competitors   |
| -------- | ---------------------------------------------- | ------ | --------- | ------------- |
| P0       | **Case law citator** (is case still good law?) | Large  | Very High | Clio Library  |
| P0       | **Medical records indexer** (auto-categorize)  | Large  | Very High | CloudLex      |
| P1       | Multi-document analysis (patterns)             | Medium | High      | Harvey AI     |
| P1       | Deposition prep assistant                      | Medium | High      | Unique for WC |
| P2       | Opposing counsel research                      | Medium | Medium    | Clio          |
| P2       | Settlement value predictor                     | Large  | High      | Unique        |

**Implementation Notes**:

- Citator: Need access to case law database (expensive) OR partner with legal data provider
- Medical records: Train classifier on medical record types, extract treatment dates
- Settlement predictor: Train on historical case outcomes (need data)

**Exit Criteria**: AI provides unique legal insights competitors don't have

---

## Feature Comparison Matrix

| Feature                        | SafeAppeals | Clio | CASEpeer | CoCounsel | Harvey |
| ------------------------------ | ----------- | ---- | -------- | --------- | ------ |
| **AI Chat with Case Context**  | ✅          | ✅   | ❌       | ✅        | ✅     |
| **Multiple AI Providers**      | ✅ 15+      | ❌ 1 | ❌       | ❌ 1      | ❌ 1   |
| **Local/Offline Mode**         | ✅          | ❌   | ❌       | ❌        | ❌     |
| **In-App Doc Editing**         | ✅          | ❌   | ❌       | ❌        | ❌     |
| **RAG + Hybrid Search**        | ✅          | ❌   | ❌       | ❌        | ✅     |
| **Timeline/Chronology**        | ✅          | ❌   | ❌       | ✅        | ❌     |
| **Timeline PDF Export**        | ✅          | ❌   | ❌       | ✅        | ❌     |
| **Email AI Classification**    | ✅          | ❌   | ❌       | ❌        | ❌     |
| **Email Inline Reply/Draft**   | ✅          | ❌   | ❌       | ❌        | ❌     |
| **Multi-Workspace Isolation**  | ✅          | ❌   | ❌       | ❌        | ❌     |
| **No Per-Seat Pricing**        | ✅          | ❌   | ❌       | ❌        | ❌     |
| **File Converter + PDF Merge** | ✅          | ❌   | ❌       | ❌        | ❌     |
| **AI File Organization**       | ✅          | ❌   | ❌       | ❌        | ❌     |
| **Multiple Chat Modes**        | ✅ 3 modes  | ❌   | ❌       | ❌        | ❌     |
| **OCR for Scanned PDFs**       | ✅          | ❌   | ❌       | ❌        | ❌     |
| **Deadline Notifications**     | ✅          | ✅   | ✅       | ❌        | ❌     |
| **MCP Tool Extensibility**     | ✅          | ❌   | ❌       | ❌        | ❌     |
| Calendar Sync (Google)         | ✅          | ✅   | ✅       | ❌        | ❌     |
| Calendar Sync (Outlook)        | ✅          | ✅   | ✅       | ❌        | ❌     |
| E-Signature (DocuSign)         | ✅          | ✅   | ❌       | ❌        | ❌     |
| **Time Tracking + LEDES**      | ✅          | ✅   | ✅       | ❌        | ❌     |
| Client Portal                  | ❌ Phase 4  | ✅   | ✅       | ❌        | ❌     |
| Billing/Invoicing              | ❌ Phase 5  | ✅   | ✅       | ❌        | ❌     |
| Case Law Citator               | ❌ Phase 6  | ✅   | ❌       | ❌        | ❌     |

---

## Quick Wins - ALREADY IMPLEMENTED ✅

1. ✅ **Export timeline to PDF** - Timeline export to PDF for court submissions
2. ✅ **Case summary generator** - Chat with AI, dump docs into context for summaries
3. ✅ **Deadline warning notifications** - Timeline notification system warns of upcoming deadlines
4. ✅ **Document naming convention enforcer** - File organizer with AI-determined naming/categorization

## Actual Quick Wins (Can Ship This Week)

1. **One-click "Generate Case Summary Letter"** - Pre-formatted output for attorney correspondence
2. ✅ **Calendar .ics export** - Export deadlines as .ics file for manual calendar import (DONE - also have full Google sync now)
3. **Batch document rename** - Apply AI naming to entire folder at once
4. **Case snapshot export** - Export case info + timeline + key docs as single PDF package

---

## Recommended MVP for Launch

For a competitive v1.0 launch, you need:

### Must Have (Current + Phase 1-2)

- [x] All current features polished
- [x] Google Calendar sync (per-event, workspace-isolated)
- [x] Outlook Calendar sync (per-event, workspace-isolated)
- [ ] Statute of limitations tracker
- [ ] Basic document templates

### Should Have (Phase 3 partial)

- [ ] Court form auto-fill (California WCAB)
- [x] E-signature (DocuSign integration) ✅

### Nice to Have (Defer)

- Client portal
- Billing
- Citator

---

## Pricing Strategy Recommendation

| Tier         | Price        | Target             | Features                                       |
| ------------ | ------------ | ------------------ | ---------------------------------------------- |
| **Solo**     | $49/mo flat  | Solo practitioners | All AI features, 1 workspace active            |
| **Practice** | $99/mo flat  | Small firms        | Unlimited workspaces, calendar sync, templates |
| **Firm**     | $199/mo flat | 5+ people          | + Client portal, team features                 |

**Key differentiator**: Flat pricing, not per-seat. A 5-person firm pays $199 vs $595+ at CASEpeer.

---

## Success Metrics

### Phase 1-2 (Weeks 1-8)

- User can manage case from intake to deadline tracking
- 95% feature reliability
- < 3 second load times

### Phase 3-4 (Weeks 9-20)

- 80% of documents generated from templates
- Client portal adoption > 50%
- NPS > 40

### Phase 5-6 (Weeks 21-36)

- 90% of time entries AI-suggested
- Case law citations verified
- Settlement predictions within 20% of actual

---

## Risk Factors

| Risk                       | Mitigation                                                                  |
| -------------------------- | --------------------------------------------------------------------------- |
| Calendar API changes       | ✅ Abstracted behind IPC channel + service layer, supports Google + Outlook |
| Legal data licensing costs | Partner with legal data provider, start with free sources                   |
| E-sig provider lock-in     | Support multiple (DocuSign + HelloSign)                                     |
| Competition from Clio AI   | Move faster, stay niche (workers comp)                                      |

---

## Next Steps

1. ✅ Complete Phase 1 (polish existing features)
2. ✅ Google Calendar sync (COMPLETE - per-event sync with workspace isolation)
3. ✅ Outlook Calendar sync (COMPLETE - using Microsoft Graph API + MSAL Node)
4. Add statute of limitations tracker (unique value for workers comp)
5. Beta launch to 5-10 solo practitioners
6. Gather feedback, iterate

---

_Last updated: February 3, 2026_
