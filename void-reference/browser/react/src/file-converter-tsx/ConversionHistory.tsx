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
		<div className="flex flex-col h-full">
			<button
				onClick={() => setIsExpanded(!isExpanded)}
				className="shrink-0 w-full p-3 flex items-center justify-between bg-void-bg-2 hover:bg-void-bg-1 transition-colors border-b border-void-border-2"
			>
				<span className="text-xs font-bold uppercase tracking-wider text-void-fg-3">Recent Activity ({history.length})</span>
				<span className="text-void-fg-3">{isExpanded ? '▼' : '▶'}</span>
			</button>
			{isExpanded && (
				<div className="flex-1 overflow-y-auto bg-void-bg-1">
					{history.map((item) => (
						<div key={item.id} className="group p-3 border-b border-void-border-3 hover:bg-void-bg-2 transition-colors">
							<div className="flex items-start justify-between gap-3 mb-2">
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<span className={item.status === 'success' ? 'text-green-500' : item.status === 'error' ? 'text-red-500' : 'text-blue-500'}>
											{item.status === 'success' ? '✓' : item.status === 'error' ? '✗' : '⟳'}
										</span>
										<span className="text-sm font-medium text-void-fg-1 truncate" title={item.output}>{getFileName(item.output)}</span>
									</div>
									<div className="text-xs text-void-fg-3 ml-6">{item.type} • {formatTimestamp(item.timestamp)}</div>
								</div>
							</div>
							{item.status === 'success' && item.result?.output_path && (
								<div className="flex gap-2 ml-6 opacity-0 group-hover:opacity-100 transition-opacity">
									<button
										onClick={() => onOpen(item.result!.output_path!)}
										className="p-1.5 bg-void-bg-2 rounded hover:bg-void-bg-2-hover text-void-fg-3 text-xs flex items-center gap-1"
										title="Open File"
									>
										<span>👁</span> Open
									</button>
									<button
										onClick={() => onReveal(item.result!.output_path!)}
										className="p-1.5 bg-void-bg-2 rounded hover:bg-void-bg-2-hover text-void-fg-3 text-xs flex items-center gap-1"
										title="Show in Folder"
									>
										<span>📁</span> Folder
									</button>
								</div>
							)}
							{item.status === 'error' && (
								<div className="ml-6 mt-1 text-xs text-red-400">{item.result?.error || "Conversion failed"}</div>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
};
