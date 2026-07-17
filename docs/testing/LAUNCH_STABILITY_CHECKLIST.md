# Launch Stability Checklist

Pre-launch testing protocol for SafeAppeals Navigator v1.0

## Status Overview

| Area                  | Status                   |
| --------------------- | ------------------------ |
| Full Workflow Test    | 🔄 In Progress           |
| Fresh Windows Install | ⏳ Pending (separate PC) |
| Cloud Credits Flow    | ✅ Complete              |

---

## 1. Full Workflow Test

### Test Case: "Smith v. Employer - Workers' Comp Claim"

Run through this complete scenario to verify all features work together.

---

### Step 1: Create New Case Workspace

**Actions:**

- [ ] Create new folder: `C:\Cases\Smith_v_Employer_2025`
- [ ] Open folder in SafeAppeals Navigator
- [ ] Verify `policy-manuals/` folder auto-created
- [ ] Verify `tosort/` folder auto-created (if enabled)

**Expected:**

- Both folders appear in Explorer
- No errors in console (`Help > Toggle Developer Tools`)

**Notes:**

```
Pass: [x ] Fail: [ ]
Issues:
```

---

### Step 2: Set Up Case Structure

**Actions:**

- [ ] Create folder structure:
  ```
  Smith_v_Employer_2025/
  ├── Medical_Reports/
  ├── Correspondence/
  ├── Decisions_and_Orders/
  ├── Evidence/
  └── tosort/
  ```
- [ ] Or use File Organizer to create structure

**Expected:**

- Folders created successfully
- No permission errors

**Notes:**

```
Pass: [ x] Fail: [ ]
Issues:
```

---

### Step 3: Import Test Documents to `tosort/`

**Test Files Needed:**

- [x ] 1x PDF (medical report, 5-10 pages)
- [x ] 1x PDF (large, 50+ pages) - for memory test
- [x ] 1x DOCX (letter/correspondence)
- [x ] 1x XLSX (expense tracking)
- [x ] 1x EML file (if available) or PDF email
- [x ] 1x Image (JPG/PNG of document scan)

**Actions:**

- [x ] Copy all test files to `tosort/` folder

**Expected:**

- Files visible in Explorer
- No issues with file sizes

**Notes:**

```
Pass: [ x] Fail: [ ]
Issues:
```

---

### Step 4: File Organizer - Classify & Move

**Actions:**

- [ ] Open File Organizer (`Ctrl+Shift+O`)
- [ ] Click "Select Files" or use wizard
- [ ] Select files from `tosort/`
- [ ] Verify AI classification runs (or manual classify)
- [ ] Review proposed destinations
- [ ] Apply changes

**Expected:**

- [ ] Files classified correctly (or reasonable suggestions)
- [ ] Preview shows correct destinations
- [ ] Files moved to appropriate folders
- [ ] `.meta` files created (if enabled)
- [ ] No files lost or corrupted

**Notes:**

```
Pass: [x ] Fail: [ ]
Issues:
```

---

### Step 5: Document Viewers - Open Each Type

**Actions:**

- [ ] Open PDF file → verify PDF viewer loads
  - [ ] Zoom in/out works
  - [ ] Navigate pages
  - [ ] Text selection works
- [ ] Open DOCX file → verify DOCX viewer loads
  - [ ] Formatting preserved
  - [ ] Edit mode available
- [ ] Open XLSX file → verify spreadsheet viewer
  - [ ] Multiple sheets visible
  - [ ] Cell editing works
- [ ] Open Image file → verify image viewer
  - [ ] Zoom/pan works (`+`/`-`/drag)
  - [ ] Rotate works (`L`/`R`)

**Expected:**

- All viewers open without errors
- Content displays correctly
- No white screens or crashes

**Notes:**

```
PDF:   Pass: [ x] Fail: [ ]
DOCX:  Pass: [ x] Fail: [ ]
XLSX:  Pass: [ x] Fail: [ ]
Image: Pass: [ x] Fail: [ ]
Issues:
```

---

### Step 6: RAG Indexing - Add Policy Manual

**Actions:**

- [ ] Copy a PDF to `policy-manuals/` folder
- [ ] Wait 30 seconds (or right-click → "Index as Policy Manual")
- [ ] Open Void Chat
- [ ] Ask: "What does the policy manual say about [topic in PDF]?"

**Expected:**

- [ ] Document auto-indexed (check console for "RAG: Indexed...")
- [ ] Chat returns relevant answer with attribution
- [ ] No embedding errors

**Notes:**

```
Pass: [x ] Fail: [ ]
Issues:
```

---

### Step 7: Timeline - Create Events

**Actions:**

- [ ] Open Timeline (`Ctrl+Shift+T`)
- [ ] Set jurisdiction (e.g., "BC WCB")
- [ ] Add Injury event:
  - Date: 2024-06-15
  - Title: "Workplace Injury - Back Strain"
  - Category: Injury
- [ ] Add Medical event:
  - Date: 2024-06-20
  - Title: "Initial Doctor Visit"
  - Category: Medical
- [ ] Add Decision event:
  - Date: 2024-09-01
  - Title: "WCB Initial Decision"
  - Category: Decision
  - Mark as deadline: Yes
- [ ] Verify deadline auto-generated (appeal deadline)

**Expected:**

- [ ] Events appear on timeline
- [ ] Deadline warnings show
- [ ] Statute of limitations calculated

**Notes:**

```
Pass: [x ] Fail: [ ]
Issues:
```

---

### Step 8: Email Dashboard - Import & View

**Actions:**

- [ ] Open Email Dashboard (`Ctrl+Shift+E`)
- [ ] Click "Import Emails"
- [ ] Select test EML or PDF email file
- [ ] Verify email appears in list
- [ ] Click email to open in viewer
- [ ] Test search functionality

**Expected:**

- [ ] Email parsed correctly (from, to, subject, body)
- [ ] Email displays in viewer
- [ ] Search returns results

**Notes:**

```
Pass: [x ] Fail: [ ]
Issues:
```

---

### Step 9: Email Draft Reply (RAG Integration)

**Actions:**

- [ ] In Email Viewer, click "Draft Reply"
- [ ] Wait for RAG context retrieval
- [ ] Verify draft generated

**Expected:**

- [ ] Progress indicators show
- [ ] Draft contains relevant context (if indexed docs exist)
- [ ] DOCX file created in `replies/` folder

**Notes:**

```
Pass: [x] Fail: [ ]
Issues:
```

---

### Step 10: Timeline PDF Export

**Actions:**

- [ ] Open Timeline
- [ ] Click "Export to PDF" button
- [ ] Choose save location
- [ ] Open generated PDF

**Expected:**

- [ ] PDF created with correct filename
- [ ] All events visible in PDF
- [ ] Formatting looks professional

**Notes:**

```
Pass: [x ] Fail: [ ]
Issues:
```

---

### Step 11: Case Organizer Agent (Optional)

**Actions:**

- [ ] Run "Void: Initialize Case Organizer" command
- [ ] Select "Full Auto" mode
- [ ] Let agent organize remaining files

**Expected:**

- [ ] Agent runs without errors
- [ ] Files organized appropriately
- [ ] Undo plan created

**Notes:**

```
Pass: [x ] Fail: [ ]
Issues:
```

---

### Step 12: Memory & Performance

**Actions:**

- [ ] Open Task Manager
- [ ] Note initial memory usage
- [ ] Open the 50+ page PDF
- [ ] Index it with RAG
- [ ] Note peak memory usage
- [ ] Close PDF
- [ ] Note memory after close

**Expected:**

- Memory usage < 2GB during indexing
- Memory returns close to baseline after operations

**Measurements:**

```
Initial:     __.1__ MB
Peak:        _22___ MB
After close: ____ MB
Pass: [x ] Fail: [ ]
```

---

### Step 13: Error Handling - Edge Cases

**Test each scenario:**

| Scenario           | Test                                 | Expected              | Pass/Fail |
| ------------------ | ------------------------------------ | --------------------- | --------- |
| Corrupt PDF        | Open malformed PDF                   | Error toast, no crash | [ ]       |
| Missing file       | Delete file, try to open from recent | Graceful error        | [ ]       |
| Network offline    | Disable network, use cloud LLM       | Clear error message   | [ ]       |
| Empty search       | Search with no results               | "No results" message  | [ ]       |
| Very long filename | Import file with 200+ char name      | Truncated or handled  | [ ]       |

**Notes:**

```
Issues:
```

---

## Summary

| Step | Feature          | Status |
| ---- | ---------------- | ------ |
| 1    | Create Workspace |        |
| 2    | Folder Structure |        |
| 3    | Import Documents |        |
| 4    | File Organizer   |        |
| 5    | Document Viewers |        |
| 6    | RAG Indexing     |        |
| 7    | Timeline Events  |        |
| 8    | Email Import     |        |
| 9    | Email Draft      |        |
| 10   | Timeline Export  |        |
| 11   | Case Organizer   |        |
| 12   | Memory Test      |        |
| 13   | Error Handling   |        |

**Overall Result:** [x ] PASS / [ ] FAIL

**Critical Issues Found:**

```

```

**Minor Issues (can ship with):**

```

```

**Tested By:** **\*\***\_\_\_**\*\***
**Date:** **\*\***\_\_\_**\*\***
**Version:** 1.99.6

---

## Fresh Windows Install Test (Separate PC)

To be done on clean Windows 10/11 machine:

- [ ] Download installer/portable
- [ ] Run without admin (if possible)
- [ ] Verify all native modules load (sqlite3, etc.)
- [ ] Run abbreviated workflow test (Steps 1-6)
- [ ] Check for missing DLL errors
- [ ] Verify fonts render correctly
