/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';

export const SmallProseWrapper = ({ children }: {children: React.ReactNode;}) => {
  return (
    <div
      className=" void-text-void-fg-4 void-prose void-prose-sm void-break-words void-max-w-none void-leading-snug void-text-[13px] [&>:first-child]:!void-mt-0 [&>:last-child]:!void-mb-0 prose-h1:void-text-[14px] prose-h1:void-my-4 prose-h2:void-text-[13px] prose-h2:void-my-4 prose-h3:void-text-[13px] prose-h3:void-my-3 prose-h4:void-text-[13px] prose-h4:void-my-2 prose-p:void-my-2 prose-p:void-leading-snug prose-hr:void-my-2 prose-ul:void-my-2 prose-ul:void-pl-4 prose-ul:void-list-outside prose-ul:void-list-disc prose-ul:void-leading-snug prose-ol:void-my-2 prose-ol:void-pl-4 prose-ol:void-list-outside prose-ol:void-list-decimal prose-ol:void-leading-snug marker:void-text-inherit prose-blockquote:void-pl-2 prose-blockquote:void-my-2 prose-code:void-text-void-fg-3 prose-code:void-text-[12px] prose-code:before:void-content-none prose-code:after:void-content-none prose-pre:void-text-[12px] prose-pre:void-p-2 prose-pre:void-my-2 prose-table:void-text-[13px] ">
























































      
			{children}
		</div>);

};

export const ProseWrapper = ({ children }: {children: React.ReactNode;}) => {
  return (
    <div
      className=" void-text-void-fg-2 void-prose void-prose-sm void-break-words prose-p:void-block prose-hr:void-my-4 prose-pre:void-my-2 marker:void-text-inherit prose-ol:void-list-outside prose-ol:void-list-decimal prose-ul:void-list-outside prose-ul:void-list-disc prose-li:void-my-0 prose-code:before:void-content-none prose-code:after:void-content-none prose-headings:void-prose-sm prose-headings:void-font-bold prose-p:void-leading-normal prose-ol:void-leading-normal prose-ul:void-leading-normal void-max-w-none ">
























      
			{children}
		</div>);

};