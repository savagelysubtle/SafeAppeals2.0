/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from "react";

interface ProgressInfo {
	percent: number;
	message: string;
	current_file?: string;
}

interface ConversionProgressProps {
	progress: ProgressInfo;
	inputFile: string;
	outputFile: string;
	conversionType: string;
}

const getFileName = (path: string): string => {
	const parts = path.replace(/\\/g, "/").split("/");
	return parts[parts.length - 1] || path;
};

export const ConversionProgress: React.FC<ConversionProgressProps> = ({ progress, inputFile, outputFile, conversionType }) => {
	return (
		<div className="flex flex-col items-center justify-center h-full p-8">
			{/* Progress Ring */}
			<div className="relative w-32 h-32 mb-8">
				<svg className="w-full h-full" viewBox="0 0 100 100">
					<circle className="text-void-bg-2" strokeWidth="6" stroke="currentColor" fill="transparent" r="42" cx="50" cy="50" />
					<circle
						className="text-void-button-primary"
						strokeWidth="6"
						strokeDasharray={42 * 2 * Math.PI}
						strokeDashoffset={(42 * 2 * Math.PI) - (progress.percent / 100) * (42 * 2 * Math.PI)}
						strokeLinecap="round"
						stroke="currentColor"
						fill="transparent"
						r="42"
						cx="50"
						cy="50"
						style={{ transition: 'stroke-dashoffset 0.3s ease-out', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
					/>
				</svg>
				<div className="absolute inset-0 flex flex-col items-center justify-center">
					<span className="text-3xl font-bold text-void-fg-1">{Math.round(progress.percent)}%</span>
				</div>
			</div>

			{/* Status */}
			<div className="text-center mb-8 max-w-md">
				<h3 className="text-lg font-semibold text-void-fg-1 mb-2">Converting File...</h3>
				<p className="text-void-fg-3 text-sm animate-pulse">{progress.message || "Processing..."}</p>
			</div>

			{/* File Details Card */}
			<div className="bg-void-bg-2 border border-void-border-2 rounded-lg p-4 w-full max-w-md space-y-3">
				<div className="flex items-center gap-3">
					<div className="w-8 h-8 bg-void-bg-1 rounded flex items-center justify-center">📄</div>
					<div className="flex-1 min-w-0">
						<div className="text-xs text-void-fg-3 mb-0.5">Input</div>
						<div className="text-sm font-medium text-void-fg-1 truncate" title={inputFile}>{getFileName(inputFile)}</div>
					</div>
				</div>
				<div className="flex justify-center"><span className="text-void-fg-4">↓</span></div>
				<div className="flex items-center gap-3">
					<div className="w-8 h-8 bg-void-bg-1 rounded flex items-center justify-center">📥</div>
					<div className="flex-1 min-w-0">
						<div className="text-xs text-void-fg-3 mb-0.5">Output</div>
						<div className="text-sm font-medium text-void-fg-1 truncate" title={outputFile}>{getFileName(outputFile)}</div>
					</div>
				</div>
			</div>
		</div>
	);
};
