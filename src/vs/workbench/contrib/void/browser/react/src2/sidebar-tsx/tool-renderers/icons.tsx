/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useEffect, useState } from 'react';

export const IconLoading = ({ className = "" }: {className?: string;}) => {
  const [loadingText, setLoadingText] = useState(".");

  useEffect(() => {
    let intervalId;

    const toggleLoadingText = () => {
      if (loadingText === "...") {
        setLoadingText(".");
      } else {
        setLoadingText(loadingText + ".");
      }
    };

    intervalId = setInterval(toggleLoadingText, 300);

    return () => clearInterval(intervalId);
  }, [loadingText, setLoadingText]);

  return <div className={`${className}`}>{loadingText}</div>;
};