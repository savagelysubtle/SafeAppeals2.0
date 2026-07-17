/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from "react";

interface ConversionResult {
  success: boolean;
  output_path?: string;
  duration?: number;
  error?: string;
  error_type?: string;
}

interface HistoryItem {
  id: string;
  input: string;
  output: string;
  type: string;
  status: "pending" | "converting" | "success" | "error";
  result?: ConversionResult;
  timestamp: Date;
}

interface ConversionHistoryProps {
  history: HistoryItem[];
  onOpen: (path: string) => void;
  onReveal: (path: string) => void;
}

const getFileName = (path: string): string => {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
};

const formatTimestamp = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
};

export const ConversionHistory: React.FC<ConversionHistoryProps> = ({ history, onOpen, onReveal }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  if (history.length === 0) return null;

  return (
    <div className="void-flex void-flex-col void-h-full">
			<button
        onClick={() => setIsExpanded(!isExpanded)}
        className="void-shrink-0 void-w-full void-p-3 void-flex void-items-center void-justify-between void-bg-void-bg-2 hover:void-bg-void-bg-1 void-transition-colors void-border-b void-border-void-border-2">
        
				<span className="void-text-xs void-font-bold void-uppercase void-tracking-wider void-text-void-fg-3">Recent Activity ({history.length})</span>
				<span className="void-text-void-fg-3">{isExpanded ? '▼' : '▶'}</span>
			</button>
			{isExpanded &&
      <div className="void-flex-1 void-overflow-y-auto void-bg-void-bg-1">
					{history.map((item) =>
        <div key={item.id} className="void-group void-p-3 void-border-b void-border-void-border-3 hover:void-bg-void-bg-2 void-transition-colors">
							<div className="void-flex void-items-start void-justify-between void-gap-3 void-mb-2">
								<div className="void-flex-1 void-min-w-0">
									<div className="void-flex void-items-center void-gap-2">
										<span className={item.status === 'success' ? "void-text-green-500" : item.status === 'error' ? "void-text-red-500" : "void-text-blue-500"}>
											{item.status === 'success' ? '✓' : item.status === 'error' ? '✗' : '⟳'}
										</span>
										<span className="void-text-sm void-font-medium void-text-void-fg-1 void-truncate" title={item.output}>{getFileName(item.output)}</span>
									</div>
									<div className="void-text-xs void-text-void-fg-3 void-ml-6">{item.type} • {formatTimestamp(item.timestamp)}</div>
								</div>
							</div>
							{item.status === 'success' && item.result?.output_path &&
          <div className="void-flex void-gap-2 void-ml-6 void-opacity-0 group-hover:void-opacity-100 void-transition-opacity">
									<button
              onClick={() => onOpen(item.result!.output_path!)}
              className="void-p-1.5 void-bg-void-bg-2 void-rounded hover:void-bg-void-bg-2-hover void-text-void-fg-3 void-text-xs void-flex void-items-center void-gap-1"
              title="Open File">
              
										<span>👁</span> Open
									</button>
									<button
              onClick={() => onReveal(item.result!.output_path!)}
              className="void-p-1.5 void-bg-void-bg-2 void-rounded hover:void-bg-void-bg-2-hover void-text-void-fg-3 void-text-xs void-flex void-items-center void-gap-1"
              title="Show in Folder">
              
										<span>📁</span> Folder
									</button>
								</div>
          }
							{item.status === 'error' &&
          <div className="void-ml-6 void-mt-1 void-text-xs void-text-red-400">{item.result?.error || "Conversion failed"}</div>
          }
						</div>
        )}
				</div>
      }
		</div>);

};