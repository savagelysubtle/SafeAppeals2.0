/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from 'react';
import { AlertTriangle, Ban, ChevronRight, CircleEllipsis } from 'lucide-react';

export type ToolHeaderParams = {
  icon?: React.ReactNode;
  title: React.ReactNode;
  desc1: React.ReactNode;
  desc1OnClick?: () => void;
  desc2?: React.ReactNode;
  isError?: boolean;
  info?: string;
  desc1Info?: string;
  isRejected?: boolean;
  numResults?: number;
  hasNextPage?: boolean;
  children?: React.ReactNode;
  bottomChildren?: React.ReactNode;
  onClick?: () => void;
  desc2OnClick?: () => void;
  isOpen?: boolean;
  className?: string;
};

export const SimplifiedToolHeader = ({
  title,
  children



}: {title: string;children?: React.ReactNode;}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isDropdown = children !== undefined;
  return (
    <div>
			<div className="void-w-full">
				{/* header */}
				<div
          className={`void-select-none void-flex void-items-center void-min-h-[24px] ${
          isDropdown ? "void-cursor-pointer" : ""}`}

          onClick={() => {
            if (isDropdown) {
              setIsOpen((v) => !v);
            }
          }}>
          
					{isDropdown &&
          <ChevronRight
            className={`void-text-void-fg-3 void-mr-0.5 void-h-4 void-w-4 void-flex-shrink-0 void-transition-transform void-duration-100 void-ease-[cubic-bezier(0.4,0,0.2,1)] ${
            isOpen ? "void-rotate-90" : ""}`} />


          }
					<div className="void-flex void-items-center void-w-full void-overflow-hidden">
						<span className="void-text-void-fg-3">{title}</span>
					</div>
				</div>
				{/* children */}
				{
        <div
          className={`void-overflow-hidden void-transition-all void-duration-200 void-ease-in-out ${
          isOpen ? "void-opacity-100" : "void-max-h-0 void-opacity-0"} void-text-void-fg-4`}>

          
						{children}
					</div>
        }
			</div>
		</div>);

};

export const ToolHeaderWrapper = ({
  icon,
  title,
  desc1,
  desc1OnClick,
  desc1Info,
  desc2,
  numResults,
  hasNextPage,
  children,
  info,
  bottomChildren,
  isError,
  onClick,
  desc2OnClick,
  isOpen,
  isRejected,
  className // applies to the main content
}: ToolHeaderParams) => {
  const [isOpen_, setIsOpen] = useState(false);
  const isExpanded = isOpen !== undefined ? isOpen : isOpen_;

  const isDropdown = children !== undefined; // null ALLOWS dropdown
  const isClickable = !!(isDropdown || onClick);

  const isDesc1Clickable = !!desc1OnClick;

  const desc1HTML =
  <span
    className={`void-text-void-fg-4 void-text-xs void-italic void-truncate void-ml-2 ${

    isDesc1Clickable ? "void-cursor-pointer hover:void-brightness-125 void-transition-all void-duration-150" : ""} `}




    onClick={desc1OnClick}
    {...desc1Info ?
    {
      "data-tooltip-id": "void-tooltip",
      "data-tooltip-content": desc1Info,
      "data-tooltip-place": "top",
      "data-tooltip-delay-show": 1000
    } :
    {}}>
    
			{desc1}
		</span>;


  return (
    <div className="">
			<div
        className={`void-w-full void-border void-border-void-border-3 void-rounded void-px-2 void-py-1 void-bg-void-bg-3 void-overflow-hidden ${className}`}>
        
				{/* header */}
				<div className={`void-select-none void-flex void-items-center void-min-h-[24px]`}>
					<div
            className={`void-flex void-items-center void-w-full void-gap-x-2 void-overflow-hidden void-justify-between ${
            isRejected ? "void-line-through" : ""}`}>

            
						{/* left */}
						<div // container for if desc1 is clickable
            className="void-ml-1 void-flex void-items-center void-overflow-hidden">
              
							{/* title eg "> Edited File" */}
							<div
                className={` void-flex void-items-center void-min-w-0 void-overflow-hidden void-grow ${


                isClickable ? "void-cursor-pointer hover:void-brightness-125 void-transition-all void-duration-150" : ""} `}




                onClick={() => {
                  if (isDropdown) {
                    setIsOpen((v) => !v);
                  }
                  if (onClick) {
                    onClick();
                  }
                }}>
                
								{isDropdown &&
                <ChevronRight
                  className={` void-text-void-fg-3 void-mr-0.5 void-h-4 void-w-4 void-flex-shrink-0 void-transition-transform void-duration-100 void-ease-[cubic-bezier(0.4,0,0.2,1)] ${

                  isExpanded ? "void-rotate-90" : ""} `} />


                }
								<span className="void-text-void-fg-3 void-flex-shrink-0">{title}</span>

								{!isDesc1Clickable && desc1HTML}
							</div>
							{isDesc1Clickable && desc1HTML}
						</div>

						{/* right */}
						<div className="void-flex void-items-center void-gap-x-2 void-flex-shrink-0">
							{info &&
              <CircleEllipsis
                className="void-ml-2 void-text-void-fg-4 void-opacity-60 void-flex-shrink-0"
                size={14}
                data-tooltip-id="void-tooltip"
                data-tooltip-content={info}
                data-tooltip-place="top-end" />

              }

							{isError &&
              <AlertTriangle
                className="void-text-void-warning void-opacity-90 void-flex-shrink-0"
                size={14}
                data-tooltip-id="void-tooltip"
                data-tooltip-content={"Error running tool"}
                data-tooltip-place="top" />

              }
							{isRejected &&
              <Ban
                className="void-text-void-fg-4 void-opacity-90 void-flex-shrink-0"
                size={14}
                data-tooltip-id="void-tooltip"
                data-tooltip-content={"Canceled"}
                data-tooltip-place="top" />

              }
							{desc2 &&
              <span className="void-text-void-fg-4 void-text-xs" onClick={desc2OnClick}>
									{desc2}
								</span>
              }
							{numResults !== undefined &&
              <span className="void-text-void-fg-4 void-text-xs void-ml-auto void-mr-1">
									{`${numResults}${hasNextPage ? "+" : ""} result${
                numResults !== 1 ? "s" : ""}`
                }
								</span>
              }
						</div>
					</div>
				</div>
				{/* children */}
				{
        <div
          className={`void-overflow-hidden void-transition-all void-duration-200 void-ease-in-out ${
          isExpanded ? "void-opacity-100 void-py-1" : "void-max-h-0 void-opacity-0"} void-text-void-fg-4 void-rounded-sm void-overflow-x-auto `}>



          
						{children}
					</div>
        }
			</div>
			{bottomChildren}
		</div>);

};