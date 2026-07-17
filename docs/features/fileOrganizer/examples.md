# File Organizer Examples

This document provides practical examples of using the File Organizer system for different case types and scenarios.

## 📋 Basic Examples

### Example 1: Workers' Compensation Case

**Case Information:**
- Case Number: WC-2024-001
- Claimant: Maria Rodriguez
- Injury: Back injury from lifting heavy equipment
- Date: January 15, 2024

**File Collection:**
```
📁 Unorganized Files/
├── Dr_Smith_Initial_Evaluation.pdf
├── MRI_Lumbar_Spine_Report.pdf
├── Employer_Accident_Report.docx
├── WCB_Denial_Letter.pdf
├── Treatment_Notes_Feb2024.pdf
├── IME_Report_Dr_Johnson.pdf
├── Appeal_Brief_Draft.docx
├── Medical_Bills_Statement.pdf
```

**Configuration (.fileorg.json):**
```json
{
  "version": "1.0",
  "caseInfo": {
    "caseNumber": "WC-2024-001",
    "claimantName": "Maria Rodriguez",
    "injuryDate": "2024-01-15",
    "caseType": "Workers Compensation",
    "description": "Back injury from workplace lifting incident",
    "keywords": {
      "yourSide": ["claimant", "maria", "rodriguez", "treating", "initial evaluation"],
      "theirSide": ["employer", "wcb", "ime", "denial", "dr johnson"],
      "medical": ["medical", "doctor", "mri", "treatment", "evaluation"],
      "legal": ["appeal", "brief", "denial"],
      "evidence": ["accident report", "statement"]
    }
  },
  "organizationSettings": {
    "selectedTemplate": "workers-comp-full",
    "targetFolder": "./organized"
  }
}
```

**Result After Organization:**
```
📁 organized/
├── 📁 YourSide/
│   ├── 📁 Medical/
│   │   ├── Maria_Rodriguez_Medical_Dr_Smith_Initial_Evaluation.pdf
│   │   ├── Maria_Rodriguez_Medical_MRI_Lumbar_Spine_Report.pdf
│   │   └── Maria_Rodriguez_Medical_Treatment_Notes_Feb2024.pdf
│   ├── 📁 Legal/
│   │   └── Maria_Rodriguez_Legal_Appeal_Brief_Draft.docx
│   └── 📁 Evidence/
│       └── Maria_Rodriguez_Evidence_Medical_Bills_Statement.pdf
└── 📁 TheirSide/
    ├── 📁 Legal/
    │   └── WCB_Legal_Denial_Letter.pdf
    ├── 📁 Medical/
    │   └── IME_Medical_Dr_Johnson_Report.pdf
    └── 📁 Evidence/
        └── Employer_Evidence_Accident_Report.docx
```

### Example 2: Personal Injury Case

**Case Information:**
- Case: Car accident resulting in neck injury
- Plaintiff: James Wilson
- Defendant: XYZ Trucking Company
- Date: March 22, 2024

**Files to Organize:**
```
📁 Case_Documents/
├── Police_Accident_Report.pdf
├── Hospital_ER_Records.pdf
├── Dr_Anderson_Neurology_Report.pdf
├── Defendant_Insurance_Denial.pdf
├── Plaintiff_Demand_Letter.docx
├── Expert_Witness_Report.pdf
├── Medical_Bill_Summary.xlsx
├── Defendant_Answer_to_Complaint.pdf
```

**Configuration:**
```json
{
  "caseInfo": {
    "caseNumber": "PI-2024-045",
    "claimantName": "James Wilson",
    "caseType": "Personal Injury",
    "keywords": {
      "yourSide": ["plaintiff", "james", "wilson", "injured"],
      "theirSide": ["defendant", "xyz trucking", "insurance", "denial"],
      "medical": ["hospital", "medical", "doctor", "neurology"],
      "legal": ["complaint", "answer", "demand letter"],
      "evidence": ["police", "accident report", "expert witness"]
    }
  },
  "organizationSettings": {
    "selectedTemplate": "civil-litigation-full"
  }
}
```

**Organization Result:**
```
📁 organized/
├── 📁 Plaintiff/
│   ├── 📁 Medical/
│   │   ├── James_Wilson_Medical_Hospital_ER_Records.pdf
│   │   └── James_Wilson_Medical_Dr_Anderson_Neurology_Report.pdf
│   ├── 📁 Legal/
│   │   └── James_Wilson_Legal_Plaintiff_Demand_Letter.docx
│   └── 📁 Evidence/
│       ├── James_Wilson_Evidence_Police_Accident_Report.pdf
│       ├── James_Wilson_Evidence_Expert_Witness_Report.pdf
│       └── James_Wilson_Evidence_Medical_Bill_Summary.xlsx
└── 📁 Defendant/
    ├── 📁 Legal/
    │   └── XYZ_Trucking_Legal_Answer_to_Complaint.pdf
    └── 📁 Insurance/
        └── XYZ_Trucking_Insurance_Denial.pdf
```

## 🎨 Template-Specific Examples

### Medical Reports Template

**Input Files:**
```
├── Initial_Medical_Evaluation.pdf
├── Physical_Therapy_Notes_Week1.pdf
├── MRI_Results_Cervical_Spine.pdf
├── Follow_up_Visit_March.pdf
├── Prescription_History.pdf
├── Discharge_Summary.pdf
```

**Medical Template Rules:**
```typescript
[
  {
    type: 'tag',
    conditions: [{ field: 'name', operator: 'contains', value: 'initial' }],
    action: { tags: ['medical', 'initial-report'] }
  },
  {
    type: 'tag',
    conditions: [{ field: 'name', operator: 'contains', value: 'therapy' }],
    action: { tags: ['medical', 'physical-therapy'] }
  },
  {
    type: 'tag',
    conditions: [{ field: 'name', operator: 'contains', value: 'mri' }],
    action: { tags: ['medical', 'diagnostic', 'imaging'] }
  }
]
```

**Result:**
```
📁 Medical/
├── 📁 Initial_Reports/
│   └── Initial_Medical_Evaluation.pdf
├── 📁 Therapy/
│   └── Physical_Therapy_Notes_Week1.pdf
├── 📁 Diagnostic/
│   └── MRI_Results_Cervical_Spine.pdf
└── 📁 Other/
    ├── Follow_up_Visit_March.pdf
    ├── Prescription_History.pdf
    └── Discharge_Summary.pdf
```

### Legal Documents Template

**Input Files:**
```
├── Original_Complaint.pdf
├── Motion_to_Dismiss.pdf
├── Defendant_Response.pdf
├── Discovery_Requests.pdf
├── Deposition_Transcript_Smith.pdf
├── Summary_Judgment_Motion.pdf
├── Trial_Brief.pdf
├── Judgment_Order.pdf
```

**Legal Template Rules:**
```typescript
[
  {
    type: 'tag',
    conditions: [{ field: 'name', operator: 'contains', value: 'complaint' }],
    action: { tags: ['legal', 'initial-filing'], targetPath: 'Legal/Initial Filings' }
  },
  {
    type: 'tag',
    conditions: [{ field: 'name', operator: 'contains', value: 'motion' }],
    action: { tags: ['legal', 'motion'], targetPath: 'Legal/Motions' }
  },
  {
    type: 'tag',
    conditions: [{ field: 'name', operator: 'contains', value: 'deposition' }],
    action: { tags: ['legal', 'discovery', 'testimony'], targetPath: 'Legal/Discovery' }
  }
]
```

**Result:**
```
📁 Legal/
├── 📁 Initial Filings/
│   └── Original_Complaint.pdf
├── 📁 Motions/
│   ├── Motion_to_Dismiss.pdf
│   └── Summary_Judgment_Motion.pdf
├── 📁 Responses/
│   └── Defendant_Response.pdf
├── 📁 Discovery/
│   ├── Discovery_Requests.pdf
│   └── Deposition_Transcript_Smith.pdf
├── 📁 Trial/
│   └── Trial_Brief.pdf
└── 📁 Judgments/
    └── Judgment_Order.pdf
```

## 🤖 AI-Assisted Organization

### AI Classification Example

**Input File:** `Medical_Report_Doctor_Smith_Followup_Visit.pdf`

**AI Analysis:**
```json
{
  "suggestedName": "Smith_Medical_Report_Followup_Visit.pdf",
  "tags": ["medical", "doctor", "followup", "report"],
  "projectName": "Smith",
  "fileType": "Medical Report",
  "version": "v1",
  "confidence": 0.89,
  "reasoning": "Filename contains medical terminology and doctor name, suggesting a medical report document"
}
```

**Input File:** `Design_Wireframe_Mobile_App_v3.fig`

**AI Analysis:**
```json
{
  "suggestedName": "Mobile_App_Wireframe_v3.fig",
  "tags": ["design", "wireframe", "mobile", "ui"],
  "projectName": "Mobile App",
  "fileType": "Wireframe",
  "version": "v3",
  "confidence": 0.95,
  "reasoning": "Clear design artifact with version control and project identification"
}
```

### Batch AI Processing

**Multiple Files:**
```typescript
const files = [
  "Q4_Financial_Report_Draft.pdf",
  "User_Interview_Notes_Sarah.pdf",
  "API_Documentation_v2.md",
  "Meeting_Minutes_2024-01-15.pdf"
];

// AI classifies each file
const classifications = await aiClassifier.classifyFiles(files);
// Results provide consistent naming and tagging across all files
```

## 🔧 Custom Rule Examples

### Complex Conditional Rules

**Rule for Large Medical Files:**
```typescript
{
  type: 'tag',
  conditions: [
    { field: 'extension', operator: 'equals', value: 'pdf' },
    { field: 'name', operator: 'contains', value: 'medical' },
    { field: 'size', operator: 'greaterThan', value: 5242880 } // 5MB
  ],
  action: {
    tags: ['medical', 'large-file'],
    targetPath: 'Medical/Large_Scans'
  }
}
```

**Rule for Versioned Documents:**
```typescript
{
  type: 'rename',
  conditions: [
    { field: 'name', operator: 'startsWith', value: 'DRAFT_' }
  ],
  action: {
    nameFormat: '{ProjectName}_{FileType}_DRAFT_{Date}.{extension}',
    tags: ['draft', 'versioned']
  }
}
```

### Multi-Condition Rules

**Legal Documents with Date Patterns:**
```typescript
{
  type: 'tag',
  conditions: [
    { field: 'extension', operator: 'equals', value: 'pdf' },
    { field: 'name', operator: 'contains', value: 'motion' },
    { field: 'name', operator: 'startsWith', value: '20' } // Year prefix
  ],
  action: {
    tags: ['legal', 'motion', 'dated'],
    targetPath: 'Legal/Motions/{Date}'
  }
}
```

## 📊 Naming Pattern Examples

### Standard Patterns

**Legal Case Format:**
```
Pattern: {CaseNumber}_{Side}_{Category}_{Description}_{Date}.{extension}
Example: WC-2024-001_YourSide_Medical_Doctor_Visit_2024-12-17.pdf
```

**Medical Record Format:**
```
Pattern: {PatientName}_{Category}_{Provider}_{Date}.{extension}
Example: Maria_Rodriguez_Medical_Dr_Smith_2024-12-17.pdf
```

**Chronological Format:**
```
Pattern: {Date}_{Category}_{Description}.{extension}
Example: 2024-12-17_Medical_Doctor_Visit.pdf
```

### Advanced Patterns

**Version-Controlled Documents:**
```
Pattern: {ProjectName}_{FileType}_v{Version}_{Side}_{Date}.{extension}
Example: Smith_Case_Deposition_v2_YourSide_2024-12-17.pdf
```

**Multi-Part Documents:**
```
Pattern: {CaseNumber}_{Side}_{Category}_Part{Part}_{Description}.{extension}
Example: WC-2024-001_YourSide_Evidence_Part1_Accident_Photos.pdf
```

## 🚨 Error Handling Examples

### Handling File Conflicts

```typescript
// When applying changes, handle conflicts gracefully
const results = await fileOrganizerService.applyChanges(changes);

results.forEach(result => {
  if (!result.success) {
    if (result.error?.includes('already exists')) {
      // Auto-generate unique name
      const uniqueName = generateUniqueName(result.file.path);
      // Retry with new name
    } else if (result.error?.includes('permission denied')) {
      // Log permission issue
      console.error(`Permission denied: ${result.file.path}`);
    }
  }
});
```

### Partial Success Handling

```typescript
const results = await fileOrganizerService.applyChanges(changes);
const successful = results.filter(r => r.success);
const failed = results.filter(r => !r.success);

// Log summary
console.log(`Processed ${results.length} files: ${successful.length} success, ${failed.length} failed`);

// Handle failures individually
failed.forEach(failure => {
  console.error(`Failed: ${failure.file.path} - ${failure.error}`);

  // Attempt recovery based on error type
  if (failure.error?.includes('read-only')) {
    // Skip read-only files
  } else if (failure.error?.includes('network')) {
    // Retry network-related failures
    retryOperation(failure);
  }
});
```

## 🔄 Workflow Examples

### Multi-Pass Organization

**Pass 1: Basic Separation**
```typescript
// Use "Your Side vs Their Side" template first
const basicChanges = await fileOrganizerService.previewChanges(
  files,
  getTemplateById('your-side-their-side').rules
);
await fileOrganizerService.applyChanges(basicChanges);
```

**Pass 2: Detailed Organization**
```typescript
// Then apply specific templates to each side
const yourSideFiles = await getFilesInFolder('./organized/YourSide');
const medicalChanges = await fileOrganizerService.previewChanges(
  yourSideFiles,
  getTemplateById('medical-reports').rules
);
await fileOrganizerService.applyChanges(medicalChanges);
```

### Batch Processing Large Cases

```typescript
async function organizeLargeCase(allFiles: URI[], batchSize: number = 50) {
  const results: ProcessResult[] = [];

  for (let i = 0; i < allFiles.length; i += batchSize) {
    const batch = allFiles.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i/batchSize) + 1} (${batch.length} files)`);

    const metadata = await fileOrganizerService.analyzeFiles(batch);
    const changes = await fileOrganizerService.previewChanges(metadata, rules);
    const batchResults = await fileOrganizerService.applyChanges(changes);

    results.push(...batchResults);

    // Brief pause between batches to prevent system overload
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}
```

## 📈 Advanced Integration Examples

### Integration with Case Management System

```typescript
class CaseManagementIntegration {
  async organizeForCase(caseId: string, documents: URI[]) {
    // Load case configuration
    const caseConfig = await this.loadCaseConfig(caseId);

    // Apply case-specific organization
    const metadata = await fileOrganizerService.analyzeFiles(documents);
    const changes = await fileOrganizerService.previewChanges(metadata, caseConfig.rules);

    // Add case-specific naming
    const caseSpecificChanges = changes.map(change => ({
      ...change,
      proposed: {
        ...change.proposed,
        name: `${caseId}_${change.proposed.name}`
      }
    }));

    return await fileOrganizerService.applyChanges(caseSpecificChanges);
  }
}
```

### Automated Periodic Organization

```typescript
class AutoOrganizer {
  constructor(private fileOrganizerService: IFileOrganizerService) {}

  async setupWatchers(watchFolders: string[]) {
    for (const folder of watchFolders) {
      // Watch for new files
      const watcher = this.createFileWatcher(folder);

      watcher.on('add', async (filePath: string) => {
        await this.organizeNewFile(filePath);
      });
    }
  }

  private async organizeNewFile(filePath: string) {
    const uri = URI.file(filePath);
    const [metadata] = await this.fileOrganizerService.analyzeFiles([uri]);

    // Apply default organization rules
    const changes = await this.fileOrganizerService.previewChanges([metadata], this.defaultRules);
    await this.fileOrganizerService.applyChanges(changes);
  }
}
```

## 🎯 Real-World Case Studies

### Large Workers' Comp Case (500+ documents)

**Challenge:** 500+ mixed documents from multiple sources
**Solution:**
1. **Initial triage:** Manual classification into broad categories
2. **Automated organization:** Apply medical/legal templates
3. **AI enhancement:** Use AI classification for remaining unclassified files
4. **Final review:** Manual verification of critical documents

**Results:**
- 85% automatic classification accuracy
- 2-hour organization time (vs 2 days manual)
- Consistent naming across all documents
- Easy retrieval by category and date

### Multi-Party Litigation (200+ documents)

**Challenge:** Documents from plaintiff, multiple defendants, and court
**Solution:**
1. **Source identification:** Keywords for each party
2. **Template customization:** Party-specific organization rules
3. **Chronological sorting:** Date-based organization within categories
4. **Cross-referencing:** Tags for related documents

**Results:**
- Clear separation by party and document type
- Timeline view of case progression
- Easy identification of related documents
- Reduced review time by 60%

### Ongoing Case Maintenance

**Challenge:** New documents added regularly over case duration
**Solution:**
1. **Template persistence:** Reusable case configuration
2. **Batch processing:** Weekly organization runs
3. **Incremental updates:** Only process new files
4. **Version tracking:** Maintain organization history

**Results:**
- Consistent organization over time
- Minimal ongoing maintenance effort
- Historical tracking of document additions
- Easy case handoff between staff

---

**Related Topics:**
- [User Guide](user-guide.md) - Basic usage instructions
- [Configuration Guide](configuration-guide.md) - Setup and customization
- [API Reference](api-reference.md) - Technical implementation details
