/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useMemo } from "react";
import { ORGANIZATION_TEMPLATES } from "../../../fileOrganizer/templates/organizationTemplates.js";
import { useAccessor } from "../util/services.js";

// Map codicons to emoji for display
const iconMap: Record<string, string> = {
  "$(law)": "⚖️",
  "$(pulse)": "🏥",
  "$(briefcase)": "💼",
  "$(mail)": "✉️",
  "$(symbol-namespace)": "🔄",
  "$(calendar)": "📅",
  "$(sparkle)": "✨",
  "$(edit)": "✏️"
};

interface TemplateSelectorProps {
  selectedTemplate: any | null;
  selectedFiles: any[];
  onTemplateSelect: (template: any) => void;
  onFilesSelect: (files: any[]) => void;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  selectedTemplate,
  selectedFiles,
  onTemplateSelect,
  onFilesSelect
}) => {
  const accessor = useAccessor();

  // Get the service immediately on mount (synchronously) to avoid accessor expiration
  const fileOrganizerService = useMemo(() => {
    try {
      return accessor.get("IFileOrganizerService");
    } catch (error) {
      console.error(
        "[TemplateSelector] Failed to get FileOrganizerService:",
        error
      );
      return null;
    }
  }, [accessor]);

  const handleSelectFiles = useCallback(async (classification: 'YourSide' | 'TheirSide') => {
    if (!fileOrganizerService) {
      alert(
        "File Organizer Service is not available. Please refresh the page."
      );
      return;
    }

    try {
      console.log(`[FileOrganizer] Starting file selection for ${classification}...`);

      const files = await fileOrganizerService.selectFiles();
      console.log("[FileOrganizer] Files selected:", files);

      // Handle case where user cancels or no files selected
      if (!files || files.length === 0) {
        console.log(
          "[FileOrganizer] No files selected (user may have cancelled)"
        );
        return;
      }

      console.log("[FileOrganizer] Analyzing files...");
      const metadata = await fileOrganizerService.analyzeFiles(files);
      console.log("[FileOrganizer] Metadata obtained:", metadata);

      // Mark all files with the selected classification
      const classifiedMetadata = metadata.map((file: any) => ({
        ...file,
        classification,
        classificationMethod: 'manual'
      }));

      // Merge with existing files
      const updatedFiles = [...selectedFiles, ...classifiedMetadata];
      onFilesSelect(updatedFiles);
    } catch (error) {
      console.error("[FileOrganizer] Failed to select files:", error);
      console.error(
        "[FileOrganizer] Error stack:",
        error instanceof Error ? error.stack : "No stack trace"
      );
      // Show error notification to user
      alert(
        `Failed to open file dialog: ${
        error instanceof Error ? error.message : String(error)}\n\nCheck the console (F12) for more details.`

      );
    }
  }, [fileOrganizerService, onFilesSelect, selectedFiles]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "24px"
      }}>
      
			{/* File Selection - Dual Buttons */}
			<div>
				<h3
          style={{
            margin: "0 0 16px 0",
            fontSize: "16px",
            fontWeight: 600
          }}>
          
					Select Files by Source
				</h3>
				<div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          marginBottom: '16px'
        }}>
					{/* Your Side Button */}
					<div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '16px',
            backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground)',
            borderRadius: '6px',
            border: '1px solid var(--vscode-panel-border)'
          }}>
						<div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '4px'
            }}>
							<span style={{ fontSize: '18px' }}>👤</span>
							<h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
								Your Side Documents
							</h4>
						</div>
						<p style={{
              margin: '0 0 8px 0',
              fontSize: '13px',
              color: 'var(--vscode-descriptionForeground)',
              lineHeight: '1.4'
            }}>
							Select files from you, your lawyer, treating physicians, or personal records
						</p>
						<button
              onClick={() => handleSelectFiles('YourSide')}
              style={{
                padding: "10px 20px",
                backgroundColor: "var(--vscode-button-background)",
                color: "var(--vscode-button-foreground)",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 500,
                alignSelf: 'flex-start'
              }}>
              
							📂 Choose Your Side Files
						</button>
						{selectedFiles.filter((f: any) => f.classification === 'YourSide').length > 0 &&
            <div style={{
              fontSize: '13px',
              color: 'var(--vscode-textLink-foreground)',
              marginTop: '4px'
            }}>
								✓ {selectedFiles.filter((f: any) => f.classification === 'YourSide').length} files selected
							</div>
            }
					</div>

					{/* Their Side Button */}
					<div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '16px',
            backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground)',
            borderRadius: '6px',
            border: '1px solid var(--vscode-panel-border)'
          }}>
						<div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '4px'
            }}>
							<span style={{ fontSize: '18px' }}>🏢</span>
							<h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
								Their Side Documents
							</h4>
						</div>
						<p style={{
              margin: '0 0 8px 0',
              fontSize: '13px',
              color: 'var(--vscode-descriptionForeground)',
              lineHeight: '1.4'
            }}>
							Select files from employer, WCB, IME doctors, defense, or review officers
						</p>
						<button
              onClick={() => handleSelectFiles('TheirSide')}
              style={{
                padding: "10px 20px",
                backgroundColor: "var(--vscode-button-background)",
                color: "var(--vscode-button-foreground)",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 500,
                alignSelf: 'flex-start'
              }}>
              
							📂 Choose Their Side Files
						</button>
						{selectedFiles.filter((f: any) => f.classification === 'TheirSide').length > 0 &&
            <div style={{
              fontSize: '13px',
              color: 'var(--vscode-textLink-foreground)',
              marginTop: '4px'
            }}>
								✓ {selectedFiles.filter((f: any) => f.classification === 'TheirSide').length} files selected
							</div>
            }
					</div>
				</div>

				{/* Total files summary */}
				{selectedFiles.length > 0 &&
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: "var(--vscode-inputValidation-infoBackground)",
            border: "1px solid var(--vscode-inputValidation-infoBorder)",
            borderRadius: "4px",
            fontSize: "13px",
            color: "var(--vscode-foreground)"
          }}>
          
						<strong>Total: {selectedFiles.length} files selected</strong>
						<div style={{ marginTop: '4px', fontSize: '12px', opacity: 0.8 }}>
							💡 Tip: You can select entire folders to process all files at once, or select files multiple times from different locations
						</div>
					</div>
        }
			</div>

			{/* Template Selection */}
			<div>
				<h3
          style={{
            margin: "0 0 16px 0",
            fontSize: "16px",
            fontWeight: 600
          }}>
          
					Choose a Template
				</h3>
				<div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "16px"
          }}>
          
					{ORGANIZATION_TEMPLATES.map((template) =>
          <button
            key={template.id}
            onClick={() => onTemplateSelect(template)}
            style={{
              padding: "20px",
              backgroundColor:
              selectedTemplate?.id === template.id ?
              "var(--vscode-button-background)" :
              "var(--vscode-input-background)",
              color:
              selectedTemplate?.id === template.id ?
              "var(--vscode-button-foreground)" :
              "var(--vscode-foreground)",
              border:
              selectedTemplate?.id === template.id ?
              "2px solid var(--vscode-focusBorder)" :
              "1px solid var(--vscode-panel-border)",
              borderRadius: "4px",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.2s"
            }}>
            
							<div
              style={{
                fontSize: "32px",
                marginBottom: "12px"
              }}>
              
								{iconMap[template.icon] || template.icon}
							</div>
							<div
              style={{
                fontWeight: 600,
                marginBottom: "8px",
                fontSize: "14px"
              }}>
              
								{template.name}
							</div>
							<div
              style={{
                fontSize: "12px",
                color: "var(--vscode-descriptionForeground)",
                lineHeight: "1.4"
              }}>
              
								{template.description}
							</div>
						</button>
          )}
				</div>
			</div>
		</div>);

};