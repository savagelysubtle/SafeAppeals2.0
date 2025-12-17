# File Organization Case Configuration System

## Overview

This system allows users to set up case-specific information that:
1. **Helps organize files** - Provides keywords and party names for smart classification
2. **Auto-loads into AI context** - Like `.voidrules`, the `.fileorg.json` file is automatically read and included in AI system prompts

## Components

### 1. Case Configuration File (`.fileorg.json`)

Created in your workspace root, this file stores:

```json
{
  "version": "1.0",
  "caseInfo": {
    "caseNumber": "39573881",
    "claimantName": "Steven Oatman",
    "injuryDate": "2024-06-14",
    "caseType": "Workers Compensation",
    "description": "Brief case description...",
    "parties": {
      "claimant": {
        "name": "Steven Oatman",
        "lawyers": ["John Smith"],
        "doctors": ["Dr. Treating"]
      },
      "employer": {
        "name": "ABC Corporation",
        "lawyers": ["Kotze"],
        "doctors": ["Dr. IME"]
      },
      "wcb": {
        "adjudicators": ["Heather"],
        "references": ["R0331814"]
      }
    },
    "keywords": {
      "yourSide": ["claimant", "treating", "personal", "oatman"],
      "theirSide": ["employer", "wcb", "ime", "defense", "kotze"],
      "medical": ["medical", "doctor", "physician", "diagnosis"],
      "legal": ["legal", "court", "decision", "appeal"],
      "evidence": ["evidence", "study", "research", "expert"]
    }
  },
  "organizationSettings": {
    "selectedTemplate": "workers-comp-full",
    "preserveOriginalNames": true,
    "createBackup": true,
    "targetFolder": "./organized"
  }
}
```

### 2. Case Onboarding Wizard (`CaseOnboarding.tsx`)

4-step wizard that collects:
- **Step 1: Basic Info** - Case number, claimant name, injury date, case type, description
- **Step 2: Your Side** - Your lawyers and treating physicians
- **Step 3: Their Side** - Employer, defense lawyers, IME doctors, WCB info
- **Step 4: Keywords** - Custom keywords for auto-classification

### 3. File Organizer Service (`fileOrganizerService.ts`)

Methods added:
- `saveCaseConfig(workspaceFolder, config)` - Saves to `.fileorg.json`
- `loadCaseConfig(workspaceFolder)` - Loads from `.fileorg.json`
- `caseConfigExists(workspaceFolder)` - Checks if file exists

### 4. Context Integration Service (`fileOrgContextService.ts`)

**NEW SERVICE** that:
- Auto-loads `.fileorg.json` on startup
- Watches for changes to `.fileorg.json`
- Generates AI context string using `generateAIContextString()`
- Provides `getCaseContext()` method for AI prompts

### 5. Updated Dashboard Flow

**With Existing Case Config:**
```
Files → Classify → Rules → Process
```

**Without Case Config:**
```
Case Setup → Files → Classify → Rules → Process
```

The dashboard automatically detects `.fileorg.json` and skips onboarding if it exists.

### 6. Smart Classification

Files are now classified using:
1. **Manual selection** (user explicitly chooses "Your Side" or "Their Side")
2. **Case keywords** (from `.fileorg.json`)
3. **Fallback keywords** (default patterns)

Priority: Manual > Case Keywords > Fallback

## Usage Flow

### First Time Setup

1. Open File Organizer dashboard
2. Complete Case Onboarding wizard (4 steps)
3. System saves `.fileorg.json` to workspace root
4. Proceed to file selection

### Subsequent Uses

1. Open File Organizer dashboard
2. System automatically loads `.fileorg.json`
3. Skip directly to file selection
4. Keywords from case config are used for auto-classification

### AI Integration

When you use Void's AI chat (Ctrl+L), the case information is automatically included in the system prompt:

```
# Case Information

**Case Number:** 39573881
**Claimant:** Steven Oatman
**Injury Date:** 2024-06-14
**Case Type:** Workers Compensation

## Parties Involved

### Claimant
- Name: Steven Oatman
- Lawyers: John Smith
- Treating Physicians: Dr. Treating

### Employer/Defendant
- Name: ABC Corporation
- Defense Lawyers: Kotze
- IME Doctors: Dr. IME

### WCB/Board
- Adjudicators: Heather
- Reference Numbers: R0331814

## Classification Keywords

**Your Side:** claimant, treating, personal, oatman
**Their Side:** employer, wcb, ime, defense, kotze
**Medical:** medical, doctor, physician, diagnosis, treatment, mri, xray
**Legal:** legal, court, decision, appeal, ruling, judgment
**Evidence:** evidence, study, research, expert, report
```

This helps the AI understand:
- Who's on which side
- Case-specific names and entities
- Document organization structure
- Context for file classification

## Future Enhancements

- [ ] AI-powered auto-classification using case context
- [ ] Multi-case support (switching between cases)
- [ ] Case template library
- [ ] Export/import case configurations
- [ ] Case notes and status tracking

## Files Modified/Created

**Created:**
- `src/vs/workbench/contrib/void/browser/fileOrganizer/caseConfig.ts`
- `src/vs/workbench/contrib/void/browser/react/src/file-organizer-tsx/CaseOnboarding.tsx`
- `src/vs/workbench/contrib/void/browser/fileOrgContextService.ts`

**Modified:**
- `src/vs/workbench/contrib/void/browser/fileOrganizer/fileOrganizerService.ts`
- `src/vs/workbench/contrib/void/browser/react/src/file-organizer-tsx/FileOrganizerDashboard.tsx`
- `src/vs/workbench/contrib/void/browser/void.contribution.ts`

