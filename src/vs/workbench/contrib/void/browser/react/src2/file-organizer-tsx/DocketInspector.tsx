/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DocketItem, EntityMatch, Tag } from '../../../fileOrganizer/types.js';

/** A single feedback message in the review chat */
export interface ReviewMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
  action?: 'approve' | 'reject' | 'feedback';
}

/** Common preset tags for quick selection */
const PRESET_TAGS = [
{ name: 'medical-report', type: 'category' as const },
{ name: 'legal-document', type: 'category' as const },
{ name: 'correspondence', type: 'category' as const },
{ name: 'evidence', type: 'category' as const },
{ name: 'timeline-critical', type: 'category' as const },
{ name: 'needs-review', type: 'category' as const },
{ name: 'important', type: 'category' as const },
{ name: 'reference', type: 'category' as const }];


interface DocketInspectorProps {
  item?: DocketItem;
  onUpdate: (updates: Partial<DocketItem>) => void;
  onProcess: (item: DocketItem) => void;
  onAnalyze?: (item: DocketItem) => void;
  /** Called when user submits feedback for reclassification */
  onResubmitWithFeedback?: (item: DocketItem, feedback: string) => void;
  /** Review chat history for current item */
  reviewMessages?: ReviewMessage[];
}

export const DocketInspector: React.FC<DocketInspectorProps> = ({
  item,
  onUpdate,
  onProcess,
  onAnalyze,
  onResubmitWithFeedback,
  reviewMessages = []
}) => {
  const [feedbackText, setFeedbackText] = useState('');
  const [showReviewChat, setShowReviewChat] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTagText, setNewTagText] = useState('');
  const [showPresets, setShowPresets] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Focus the tag input when it becomes visible
  useEffect(() => {
    if (showTagInput && tagInputRef.current) {
      tagInputRef.current.focus();
    }
  }, [showTagInput]);

  const handleAddTag = useCallback((tagName: string) => {
    if (!item || !tagName.trim()) return;
    const newTag: Tag = {
      id: `custom-${Date.now()}`,
      name: tagName.trim().toLowerCase().replace(/\s+/g, '-'),
      type: 'custom'
    };
    onUpdate({ suggestedTags: [...(item.suggestedTags || []), newTag] });
    setNewTagText('');
    setShowTagInput(false);
    setShowPresets(false);
  }, [item, onUpdate]);

  const handleAddPresetTag = useCallback((preset: typeof PRESET_TAGS[0]) => {
    if (!item) return;
    // Check if tag already exists
    const exists = item.suggestedTags?.some((t) => t.name === preset.name);
    if (exists) return;

    const newTag: Tag = {
      id: `preset-${Date.now()}`,
      name: preset.name,
      type: preset.type
    };
    onUpdate({ suggestedTags: [...(item.suggestedTags || []), newTag] });
  }, [item, onUpdate]);

  const handleApprove = useCallback(() => {
    if (!item) return;
    // Just proceed to file
    onProcess(item);
  }, [item, onProcess]);

  const handleReject = useCallback(() => {
    // Open the review chat to provide feedback
    setShowReviewChat(true);
  }, []);

  const handleSubmitFeedback = useCallback(() => {
    if (!item || !feedbackText.trim()) return;
    onResubmitWithFeedback?.(item, feedbackText.trim());
    setFeedbackText('');
  }, [item, feedbackText, onResubmitWithFeedback]);
  // Styles
  const columnStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: 'var(--vscode-editor-background)',
    borderRight: '1px solid var(--vscode-panel-border)'
  };

  const headerStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderBottom: '1px solid var(--vscode-panel-border)',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: 'var(--vscode-descriptionForeground)',
    letterSpacing: '0.5px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    padding: '16px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  };

  const emptyStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--vscode-descriptionForeground)',
    textAlign: 'center',
    opacity: 0.7
  };

  const cardStyle: React.CSSProperties = {
    background: 'var(--vscode-editor-inactiveSelectionBackground)',
    border: '1px solid var(--vscode-panel-border)',
    borderRadius: '6px',
    padding: '14px',
    position: 'relative',
    borderLeft: '3px solid var(--vscode-charts-purple, #a855f7)'
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 10px',
    backgroundColor: 'var(--vscode-input-background)',
    border: '1px solid var(--vscode-input-border)',
    color: 'var(--vscode-input-foreground)',
    borderRadius: '3px',
    fontSize: '13px',
    boxSizing: 'border-box'
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--vscode-descriptionForeground)',
    textTransform: 'uppercase',
    marginBottom: '6px'
  };

  const tagStyle = (type: string): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    backgroundColor: type === 'entity' ? 'rgba(100, 149, 237, 0.2)' : 'rgba(60, 179, 113, 0.2)',
    color: type === 'entity' ? '#6495ED' : '#3CB371',
    border: `1px solid ${type === 'entity' ? 'rgba(100, 149, 237, 0.3)' : 'rgba(60, 179, 113, 0.3)'}`,
    marginRight: '6px',
    marginBottom: '6px'
  });

  const buttonPrimaryStyle: React.CSSProperties = {
    padding: '8px 16px',
    backgroundColor: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
    border: 'none',
    borderRadius: '3px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px'
  };

  if (!item) {
    return (
      <div style={columnStyle}>
				<div style={headerStyle}>
					<span>Inspector</span>
				</div>
				<div style={emptyStyle}>
					<div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.5 }}>👈</div>
					<div>Select a file to inspect</div>
				</div>
			</div>);

  }

  const isReady = item.docketStatus === 'ready';
  const isAnalyzing = item.docketStatus === 'analyzing';
  const isNew = item.docketStatus === 'new';

  return (
    <div style={columnStyle}>
			<div style={headerStyle}>
				<span>Inspector</span>
				{item.docketStatus === 'error' &&
        <span style={{ color: 'var(--vscode-errorForeground)', fontSize: '11px' }}>⚠️ Error</span>
        }
			</div>

			<div style={contentStyle} className="void-void-scrollbar">
				{/* AI Analysis Card */}
				{isReady &&
        <div style={cardStyle}>
						<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
							<span style={{
              backgroundColor: 'var(--vscode-charts-purple, #a855f7)',
              color: 'white',
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '11px',
              fontWeight: 600
            }}>
								{Math.round((item.aiConfidence || 0) * 100)}%
							</span>
							<span style={{ fontSize: '12px', fontWeight: 500 }}>
								{item.classification === 'YourSide' ? '👤 Your Side' :
              item.classification === 'TheirSide' ? '🏢 Their Side' : '📄 Document'}
							</span>
						</div>

						<div style={{ fontSize: '12px', lineHeight: 1.5, opacity: 0.9 }}>
							AI suggests: <strong>{item.suggestedTags?.[0]?.name || item.suggestedFolder || 'Unknown'}</strong>
						</div>

						{/* Entity Matches */}
						{item.entityMatches && item.entityMatches.length > 0 &&
          <div style={{ marginTop: '12px' }}>
								<div style={labelStyle}>Detected Entities</div>
								<div style={{ display: 'flex', flexWrap: 'wrap' }}>
									{item.entityMatches.map((entity: EntityMatch, idx: number) =>
              <span
                key={idx}
                style={tagStyle('entity')}
                title={`${entity.entityType} (${Math.round(entity.confidence * 100)}%)`}>
                
											{entity.side === 'YourSide' ? '👤' : '🏢'} {entity.entityName}
										</span>
              )}
								</div>
							</div>
          }
					</div>
        }

				{isAnalyzing &&
        <div style={{ ...cardStyle, textAlign: 'center', padding: '30px' }}>
						<div style={{ fontSize: '20px', marginBottom: '10px' }}>⏳</div>
						<div style={{ fontSize: '12px' }}>Analyzing document...</div>
					</div>
        }

				{isNew &&
        <div style={{ display: 'flex', gap: '10px' }}>
						{/* AI Analysis Option */}
						<div
            style={{
              ...cardStyle,
              flex: 1,
              textAlign: 'center',
              padding: '16px',
              borderLeftColor: 'var(--vscode-charts-blue, #3794ff)',
              cursor: 'pointer',
              transition: 'background 0.15s ease'
            }}
            onClick={() => onAnalyze?.(item)}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'var(--vscode-list-hoverBackground)';
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'var(--vscode-editor-inactiveSelectionBackground)';
            }}>
            
							<div style={{ fontSize: '20px', marginBottom: '6px' }}>🤖</div>
							<div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--vscode-textLink-foreground)' }}>
								AI Analysis
							</div>
							<div style={{ fontSize: '10px', color: 'var(--vscode-descriptionForeground)', marginTop: '3px' }}>
								Auto-classify
							</div>
						</div>

						{/* Manual Classification Option */}
						<div
            style={{
              ...cardStyle,
              flex: 1,
              textAlign: 'center',
              padding: '16px',
              borderLeftColor: 'var(--vscode-charts-yellow, #FFC107)',
              cursor: 'pointer',
              transition: 'background 0.15s ease'
            }}
            onClick={() => {
              // Mark as ready for manual classification
              onUpdate({
                docketStatus: 'ready',
                classificationMethod: 'manual',
                aiConfidence: undefined
              });
            }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'var(--vscode-list-hoverBackground)';
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'var(--vscode-editor-inactiveSelectionBackground)';
            }}>
            
							<div style={{ fontSize: '20px', marginBottom: '6px' }}>✏️</div>
							<div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--vscode-textLink-foreground)' }}>
								Manual
							</div>
							<div style={{ fontSize: '10px', color: 'var(--vscode-descriptionForeground)', marginTop: '3px' }}>
								I'll classify it
							</div>
						</div>
					</div>
        }

				{/* File Details Form */}
				<div>
					<div style={labelStyle}>Filename</div>
					<input
            type="text"
            style={inputStyle}
            value={item.name}
            onChange={(e) => onUpdate({ name: e.target.value })} />
          
				</div>

				<div>
					<div style={labelStyle}>Destination Folder</div>
					<input
            type="text"
            style={{ ...inputStyle, fontFamily: 'monospace' }}
            value={item.suggestedFolder || ''}
            onChange={(e) => onUpdate({ suggestedFolder: e.target.value })}
            placeholder="e.g. Medical/Reports" />
          
				</div>

				{/* Manual Classification */}
				<div>
					<div style={labelStyle}>Classification</div>
					<div style={{ display: 'flex', gap: '6px' }}>
						{(['YourSide', 'TheirSide', 'Unknown'] as const).map((side) => {
              const isSelected = item.classification === side;
              const sideConfig = {
                YourSide: { label: '👤 Your Side', color: '#3CB371' },
                TheirSide: { label: '🏢 Their Side', color: '#dc3545' },
                Unknown: { label: '📄 Neutral', color: '#6c757d' }
              };
              const config = sideConfig[side];
              return (
                <button
                  key={side}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: '11px',
                    fontWeight: isSelected ? 600 : 400,
                    backgroundColor: isSelected ? `${config.color}20` : 'transparent',
                    color: isSelected ? config.color : 'var(--vscode-foreground)',
                    border: `1px solid ${isSelected ? config.color : 'var(--vscode-panel-border)'}`,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onClick={() => {
                    onUpdate({
                      classification: side,
                      classificationMethod: 'manual',
                      docketStatus: 'ready' // Mark as ready when manually classified
                    });
                  }}>
                  
									{config.label}
								</button>);

            })}
					</div>
					{item.classificationMethod === 'manual' &&
          <div style={{
            fontSize: '10px',
            color: 'var(--vscode-descriptionForeground)',
            marginTop: '4px',
            fontStyle: 'italic'
          }}>
							✏️ Manually classified
						</div>
          }
					{item.classificationMethod === 'ai' &&
          <div style={{
            fontSize: '10px',
            color: 'var(--vscode-descriptionForeground)',
            marginTop: '4px',
            fontStyle: 'italic'
          }}>
							🤖 AI classified ({Math.round((item.aiConfidence || 0) * 100)}% confidence)
						</div>
          }
				</div>

				<div>
					<div style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
						<span>Tags</span>
						<div style={{ display: 'flex', gap: '4px' }}>
							<button
                style={{
                  padding: '2px 6px',
                  fontSize: '9px',
                  backgroundColor: showPresets ? 'var(--vscode-button-background)' : 'transparent',
                  color: showPresets ? 'var(--vscode-button-foreground)' : 'var(--vscode-descriptionForeground)',
                  border: '1px solid var(--vscode-panel-border)',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  setShowPresets(!showPresets);
                  setShowTagInput(false);
                }}
                title="Show preset tags">
                
								📋 Presets
							</button>
							<button
                style={{
                  padding: '2px 6px',
                  fontSize: '9px',
                  backgroundColor: showTagInput ? 'var(--vscode-button-background)' : 'transparent',
                  color: showTagInput ? 'var(--vscode-button-foreground)' : 'var(--vscode-descriptionForeground)',
                  border: '1px solid var(--vscode-panel-border)',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  setShowTagInput(!showTagInput);
                  setShowPresets(false);
                }}
                title="Add custom tag">
                
								✏️ Custom
							</button>
						</div>
					</div>

					{/* Existing Tags */}
					<div style={{ display: 'flex', flexWrap: 'wrap', marginTop: '6px' }}>
						{item.suggestedTags?.map((tag: Tag, idx: number) =>
            <span
              key={idx}
              style={{
                ...tagStyle(tag.type === 'entity' ? 'entity' : 'category'),
                backgroundColor: tag.type === 'custom' ?
                'rgba(255, 193, 7, 0.2)' :
                tag.type === 'entity' ?
                'rgba(100, 149, 237, 0.2)' :
                'rgba(60, 179, 113, 0.2)',
                color: tag.type === 'custom' ?
                '#FFC107' :
                tag.type === 'entity' ?
                '#6495ED' :
                '#3CB371',
                border: `1px solid ${tag.type === 'custom' ?
                'rgba(255, 193, 7, 0.3)' :
                tag.type === 'entity' ?
                'rgba(100, 149, 237, 0.3)' :
                'rgba(60, 179, 113, 0.3)'}`
              }}
              title={tag.type === 'custom' ? 'Custom tag' : tag.type === 'entity' ? 'Entity' : 'AI suggested'}>
              
								{tag.type === 'custom' && '✏️ '}
								{tag.name}
								<button
                style={{
                  marginLeft: '4px',
                  background: 'none',
                  border: 'none',
                  color: 'currentColor',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: '10px'
                }}
                onClick={() => {
                  const newTags = [...(item.suggestedTags || [])];
                  newTags.splice(idx, 1);
                  onUpdate({ suggestedTags: newTags });
                }}>
                
									×
								</button>
							</span>
            )}
						{(!item.suggestedTags || item.suggestedTags.length === 0) &&
            <span style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', fontStyle: 'italic' }}>
								No tags yet - add your own or use AI
							</span>
            }
					</div>

					{/* Preset Tags Dropdown */}
					{showPresets &&
          <div style={{
            marginTop: '8px',
            padding: '8px',
            backgroundColor: 'var(--vscode-input-background)',
            borderRadius: '4px',
            border: '1px solid var(--vscode-panel-border)'
          }}>
							<div style={{ fontSize: '10px', color: 'var(--vscode-descriptionForeground)', marginBottom: '6px' }}>
								Click to add preset tags:
							</div>
							<div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
								{PRESET_TAGS.map((preset, idx) => {
                const isAdded = item.suggestedTags?.some((t) => t.name === preset.name);
                return (
                  <button
                    key={idx}
                    style={{
                      padding: '3px 8px',
                      fontSize: '10px',
                      backgroundColor: isAdded ? 'var(--vscode-button-secondaryBackground)' : 'transparent',
                      color: isAdded ? 'var(--vscode-descriptionForeground)' : 'var(--vscode-foreground)',
                      border: '1px solid var(--vscode-panel-border)',
                      borderRadius: '10px',
                      cursor: isAdded ? 'default' : 'pointer',
                      opacity: isAdded ? 0.5 : 1
                    }}
                    onClick={() => !isAdded && handleAddPresetTag(preset)}
                    disabled={isAdded}>
                    
											{isAdded ? '✓ ' : '+ '}{preset.name}
										</button>);

              })}
							</div>
						</div>
          }

					{/* Custom Tag Input */}
					{showTagInput &&
          <div style={{
            marginTop: '8px',
            display: 'flex',
            gap: '6px'
          }}>
							<input
              ref={tagInputRef}
              type="text"
              style={{
                ...inputStyle,
                flex: 1,
                fontSize: '12px'
              }}
              placeholder="Enter tag name..."
              value={newTagText}
              onChange={(e) => setNewTagText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTagText.trim()) {
                  handleAddTag(newTagText);
                } else if (e.key === 'Escape') {
                  setShowTagInput(false);
                  setNewTagText('');
                }
              }} />
            
							<button
              style={{
                padding: '6px 12px',
                fontSize: '11px',
                backgroundColor: 'var(--vscode-button-background)',
                color: 'var(--vscode-button-foreground)',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
              onClick={() => handleAddTag(newTagText)}
              disabled={!newTagText.trim()}>
              
								Add
							</button>
							<button
              style={{
                padding: '6px 8px',
                fontSize: '11px',
                backgroundColor: 'transparent',
                color: 'var(--vscode-descriptionForeground)',
                border: '1px solid var(--vscode-panel-border)',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
              onClick={() => {
                setShowTagInput(false);
                setNewTagText('');
              }}>
              
								✕
							</button>
						</div>
          }
				</div>

				{/* Review Chat Section */}
				{isReady &&
        <div style={{
          borderTop: '1px solid var(--vscode-panel-border)',
          paddingTop: '12px',
          marginTop: '8px'
        }}>
						<div style={{
            ...labelStyle,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
							<span>📝 Review Classification</span>
							{!showReviewChat &&
            <div style={{ display: 'flex', gap: '6px' }}>
									<button
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  backgroundColor: 'var(--vscode-charts-green, #3cb371)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
                onClick={handleApprove}
                title="Accept classification and file">
                
										✓ Accept
									</button>
									<button
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  backgroundColor: 'var(--vscode-charts-red, #dc3545)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
                onClick={handleReject}
                title="Reject and provide feedback">
                
										✗ Reject
									</button>
								</div>
            }
						</div>

						{/* Review Chat Messages */}
						{(showReviewChat || reviewMessages.length > 0) &&
          <div style={{
            backgroundColor: 'var(--vscode-input-background)',
            borderRadius: '6px',
            padding: '8px',
            marginBottom: '8px',
            maxHeight: '150px',
            overflowY: 'auto'
          }} className="void-void-scrollbar">
								{reviewMessages.length === 0 && showReviewChat &&
            <div style={{
              fontSize: '11px',
              color: 'var(--vscode-descriptionForeground)',
              fontStyle: 'italic',
              padding: '4px'
            }}>
										Tell the AI why this classification is wrong...
									</div>
            }
								{reviewMessages.map((msg) =>
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: '8px'
              }}>
              
										<div style={{
                maxWidth: '85%',
                padding: '6px 10px',
                borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                backgroundColor: msg.role === 'user' ?
                'var(--vscode-button-background)' :
                'var(--vscode-editor-inactiveSelectionBackground)',
                color: msg.role === 'user' ?
                'var(--vscode-button-foreground)' :
                'var(--vscode-foreground)',
                fontSize: '12px'
              }}>
											{msg.content}
										</div>
										<span style={{
                fontSize: '9px',
                color: 'var(--vscode-descriptionForeground)',
                marginTop: '2px'
              }}>
											{msg.role === 'user' ? 'You' : 'AI'} • {new Date(msg.timestamp).toLocaleTimeString()}
										</span>
									</div>
            )}
							</div>
          }

						{/* Feedback Input */}
						{showReviewChat &&
          <div style={{ display: 'flex', gap: '6px' }}>
								<input
              type="text"
              style={{
                ...inputStyle,
                flex: 1,
                fontSize: '12px'
              }}
              placeholder="e.g., Dr. Kotze is an IME doctor, not treating..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && feedbackText.trim()) {
                  handleSubmitFeedback();
                }
              }} />
            
								<button
              style={{
                ...buttonPrimaryStyle,
                padding: '6px 12px',
                fontSize: '11px'
              }}
              onClick={handleSubmitFeedback}
              disabled={!feedbackText.trim()}>
              
									↻ Retry
								</button>
							</div>
          }

						{showReviewChat &&
          <button
            style={{
              marginTop: '8px',
              padding: '4px 8px',
              fontSize: '10px',
              backgroundColor: 'transparent',
              color: 'var(--vscode-descriptionForeground)',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
            onClick={() => setShowReviewChat(false)}>
            
								Cancel
							</button>
          }
					</div>
        }

				{/* Actions */}
				<div style={{ marginTop: 'auto', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
					<button
            style={{
              ...buttonPrimaryStyle,
              backgroundColor: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)'
            }}>
            
						🗑️ Skip
					</button>
					<button
            style={{
              ...buttonPrimaryStyle,
              opacity: item.suggestedFolder ? 1 : 0.5
            }}
            disabled={!item.suggestedFolder}
            onClick={() => onProcess(item)}>
            
						✅ File It
					</button>
				</div>
			</div>
		</div>);

};