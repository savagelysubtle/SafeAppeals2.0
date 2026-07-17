/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';

export const BottomChildren = ({
	children,
	title,
}: {
	children: React.ReactNode;
	title: string;
}) => {
	const [isOpen, setIsOpen] = useState(false);
	if (!children) return null;
	return (
		<div className="w-full px-2 mt-0.5">
			<div
				className={`flex items-center cursor-pointer select-none transition-colors duration-150 pl-0 py-0.5 rounded group`}
				onClick={() => setIsOpen((o) => !o)}
				style={{ background: "none" }}
			>
				<ChevronRight
					className={`mr-1 h-3 w-3 flex-shrink-0 transition-transform duration-100 text-void-fg-4 group-hover:text-void-fg-3 ${
						isOpen ? "rotate-90" : ""
					}`}
				/>
				<span className="font-medium text-void-fg-4 group-hover:text-void-fg-3 text-xs">
					{title}
				</span>
			</div>
			<div
				className={`overflow-hidden transition-all duration-200 ease-in-out ${
					isOpen ? "opacity-100" : "max-h-0 opacity-0"
				} text-xs pl-4`}
			>
				<div className="overflow-x-auto text-void-fg-4 opacity-90 border-l-2 border-void-warning px-2 py-0.5">
					{children}
				</div>
			</div>
		</div>
	);
};

export const ToolChildrenWrapper = ({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) => {
	return (
		<div className={`${className ? className : ""} cursor-default select-none`}>
			<div className="px-2 min-w-full overflow-hidden">{children}</div>
		</div>
	);
};

export const CodeChildren = ({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) => {
	return (
		<div className={`${className ?? ""} p-1 rounded-sm overflow-auto text-sm`}>
			<div className="!select-text cursor-auto">{children}</div>
		</div>
	);
};

export const ListableToolItem = ({
	name,
	onClick,
	isSmall,
	className,
	showDot,
}: {
	name: React.ReactNode;
	onClick?: () => void;
	isSmall?: boolean;
	className?: string;
	showDot?: boolean;
}) => {
	return (
		<div
			className={`
			${
				onClick
					? "hover:brightness-125 hover:cursor-pointer transition-all duration-200 "
					: ""
			}
			flex items-center flex-nowrap whitespace-nowrap
			${className ? className : ""}
			`}
			onClick={onClick}
		>
			{showDot === false ? null : (
				<div className="flex-shrink-0">
					<svg
						className="w-1 h-1 opacity-60 mr-1.5 fill-current"
						viewBox="0 0 100 40"
					>
						<rect x="0" y="15" width="100" height="10" />
					</svg>
				</div>
			)}
			<div
				className={`${
					isSmall ? "italic text-void-fg-4 flex items-center" : ""
				}`}
			>
				{name}
			</div>
		</div>
	);
};
