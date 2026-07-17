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
    <div className="void-flex void-flex-col void-items-center void-justify-center void-h-full void-p-8">
			{/* Progress Ring */}
			<div className="void-relative void-w-32 void-h-32 void-mb-8">
				<svg className="void-w-full void-h-full" viewBox="0 0 100 100">
					<circle className="void-text-void-bg-2" strokeWidth="6" stroke="currentColor" fill="transparent" r="42" cx="50" cy="50" />
					<circle
            className="void-text-void-button-primary"
            strokeWidth="6"
            strokeDasharray={42 * 2 * Math.PI}
            strokeDashoffset={42 * 2 * Math.PI - progress.percent / 100 * (42 * 2 * Math.PI)}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r="42"
            cx="50"
            cy="50"
            style={{ transition: 'stroke-dashoffset 0.3s ease-out', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }} />
          
				</svg>
				<div className="void-absolute void-inset-0 void-flex void-flex-col void-items-center void-justify-center">
					<span className="void-text-3xl void-font-bold void-text-void-fg-1">{Math.round(progress.percent)}%</span>
				</div>
			</div>

			{/* Status */}
			<div className="void-text-center void-mb-8 void-max-w-md">
				<h3 className="void-text-lg void-font-semibold void-text-void-fg-1 void-mb-2">Converting File...</h3>
				<p className="void-text-void-fg-3 void-text-sm void-animate-pulse">{progress.message || "Processing..."}</p>
			</div>

			{/* File Details Card */}
			<div className="void-bg-void-bg-2 void-border void-border-void-border-2 void-rounded-lg void-p-4 void-w-full void-max-w-md void-space-y-3">
				<div className="void-flex void-items-center void-gap-3">
					<div className="void-w-8 void-h-8 void-bg-void-bg-1 void-rounded void-flex void-items-center void-justify-center">📄</div>
					<div className="void-flex-1 void-min-w-0">
						<div className="void-text-xs void-text-void-fg-3 void-mb-0.5">Input</div>
						<div className="void-text-sm void-font-medium void-text-void-fg-1 void-truncate" title={inputFile}>{getFileName(inputFile)}</div>
					</div>
				</div>
				<div className="void-flex void-justify-center"><span className="void-text-void-fg-4">↓</span></div>
				<div className="void-flex void-items-center void-gap-3">
					<div className="void-w-8 void-h-8 void-bg-void-bg-1 void-rounded void-flex void-items-center void-justify-center">📥</div>
					<div className="void-flex-1 void-min-w-0">
						<div className="void-text-xs void-text-void-fg-3 void-mb-0.5">Output</div>
						<div className="void-text-sm void-font-medium void-text-void-fg-1 void-truncate" title={outputFile}>{getFileName(outputFile)}</div>
					</div>
				</div>
			</div>
		</div>);

};