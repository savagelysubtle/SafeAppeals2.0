/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';
import { useAccessor } from '../../util/services.js';

export const getRelative = (
uri: URI | undefined,
accessor: ReturnType<typeof useAccessor>)
: string | undefined => {
  // Handle undefined URI
  if (!uri || !uri.fsPath) return undefined;

  const workspaceContextService = accessor.get("IWorkspaceContextService");
  let path: string;
  const isInside = workspaceContextService.isInsideWorkspace(uri);
  if (isInside) {
    const f = workspaceContextService.
    getWorkspace().
    folders.find((f) => uri.fsPath?.startsWith(f.uri.fsPath));
    if (f) {
      path = uri.fsPath.replace(f.uri.fsPath, "");
    } else {
      path = uri.fsPath;
    }
  } else {
    path = uri.fsPath;
  }
  return path || undefined;
};

export const getFolderName = (pathStr: string | undefined): string => {
  // Handle undefined or empty path
  if (!pathStr) return '/';
  // 'unixify' path
  pathStr = pathStr.replace(/[/\\]+/g, "/"); // replace any / or \ or \\ with /
  const parts = pathStr.split("/"); // split on /
  // Filter out empty parts (the last element will be empty if path ends with /)
  const nonEmptyParts = parts.filter((part) => part.length > 0);
  if (nonEmptyParts.length === 0) return "/"; // Root directory
  if (nonEmptyParts.length === 1) return nonEmptyParts[0] + "/"; // Only one folder
  // Get the last two parts
  const lastTwo = nonEmptyParts.slice(-2);
  return lastTwo.join("/") + "/";
};

export const getBasename = (pathStr: string | undefined, parts: number = 1): string => {
  // Handle undefined or empty path
  if (!pathStr) return 'unknown';
  // 'unixify' path
  pathStr = pathStr.replace(/[/\\]+/g, "/"); // replace any / or \ or \\ with /
  const allParts = pathStr.split("/"); // split on /
  if (allParts.length === 0) return pathStr;
  return allParts.slice(-parts).join("/");
};