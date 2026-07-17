/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';

export const BottomChildren = ({
  children,
  title



}: {children: React.ReactNode;title: string;}) => {
  const [isOpen, setIsOpen] = useState(false);
  if (!children) return null;
  return (
    <div className="void-w-full void-px-2 void-mt-0.5">
			<div
        className={`void-flex void-items-center void-cursor-pointer void-select-none void-transition-colors void-duration-150 void-pl-0 void-py-0.5 void-rounded void-group`}
        onClick={() => setIsOpen((o) => !o)}
        style={{ background: "none" }}>
        
				<ChevronRight
          className={`void-mr-1 void-h-3 void-w-3 void-flex-shrink-0 void-transition-transform void-duration-100 void-text-void-fg-4 group-hover:void-text-void-fg-3 ${
          isOpen ? "void-rotate-90" : ""}`} />

        
				<span className="void-font-medium void-text-void-fg-4 group-hover:void-text-void-fg-3 void-text-xs">
					{title}
				</span>
			</div>
			<div
        className={`void-overflow-hidden void-transition-all void-duration-200 void-ease-in-out ${
        isOpen ? "void-opacity-100" : "void-max-h-0 void-opacity-0"} void-text-xs void-pl-4`}>

        
				<div className="void-overflow-x-auto void-text-void-fg-4 void-opacity-90 void-border-l-2 void-border-void-warning void-px-2 void-py-0.5">
					{children}
				</div>
			</div>
		</div>);

};

export const ToolChildrenWrapper = ({
  children,
  className



}: {children: React.ReactNode;className?: string;}) => {
  return (
    <div className={`${className ? className : ""} void-cursor-default void-select-none`}>
			<div className="void-px-2 void-min-w-full void-overflow-hidden">{children}</div>
		</div>);

};

export const CodeChildren = ({
  children,
  className



}: {children: React.ReactNode;className?: string;}) => {
  return (
    <div className={`${className ?? ""} void-p-1 void-rounded-sm void-overflow-auto void-text-sm`}>
			<div className="!void-select-text void-cursor-auto">{children}</div>
		</div>);

};

export const ListableToolItem = ({
  name,
  onClick,
  isSmall,
  className,
  showDot






}: {name: React.ReactNode;onClick?: () => void;isSmall?: boolean;className?: string;showDot?: boolean;}) => {
  return (
    <div
      className={` ${

      onClick ? "hover:void-brightness-125 hover:void-cursor-pointer void-transition-all void-duration-200 " : ""} void-flex void-items-center void-flex-nowrap void-whitespace-nowrap ${




      className ? className : ""} `}

      onClick={onClick}>
      
			{showDot === false ? null :
      <div className="void-flex-shrink-0">
					<svg
          className="void-w-1 void-h-1 void-opacity-60 void-mr-1.5 void-fill-current"
          viewBox="0 0 100 40">
          
						<rect x="0" y="15" width="100" height="10" />
					</svg>
				</div>
      }
			<div
        className={`${
        isSmall ? "void-italic void-text-void-fg-4 void-flex void-items-center" : ""}`}>

        
				{name}
			</div>
		</div>);

};