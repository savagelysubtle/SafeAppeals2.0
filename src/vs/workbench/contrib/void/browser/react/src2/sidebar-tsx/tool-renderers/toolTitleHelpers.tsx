/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { IconLoading } from './icons.js';
import { BuiltinToolName, BuiltinToolCallParams } from '../../../../common/tools/toolsServiceTypes.js';
import { builtinToolNames } from '../../../../common/prompt/prompts.js';
import { ChatMessage } from '../../../../common/chatThreadServiceTypes.js';
import { useAccessor } from '../../util/services.js';
import { getBasename, getFolderName, getRelative } from './pathHelpers.js';

export const loadingTitleWrapper = (item: React.ReactNode): React.ReactNode => {
  return (
    <span className="void-flex void-items-center void-flex-nowrap">
			{item}
			<IconLoading className="void-w-3 void-text-sm" />
		</span>);

};

export const titleOfBuiltinToolName = {
  read_file: {
    done: "Read file",
    proposed: "Read file",
    running: loadingTitleWrapper("Reading file")
  },
  ls_dir: {
    done: "Inspected folder",
    proposed: "Inspect folder",
    running: loadingTitleWrapper("Inspecting folder")
  },
  get_dir_tree: {
    done: "Inspected folder tree",
    proposed: "Inspect folder tree",
    running: loadingTitleWrapper("Inspecting folder tree")
  },
  search_pathnames_only: {
    done: "Searched by file name",
    proposed: "Search by file name",
    running: loadingTitleWrapper("Searching by file name")
  },
  search_for_files: {
    done: "Searched",
    proposed: "Search",
    running: loadingTitleWrapper("Searching")
  },
  create_file_or_folder: {
    done: `Created`,
    proposed: `Create`,
    running: loadingTitleWrapper(`Creating`)
  },
  delete_file_or_folder: {
    done: `Deleted`,
    proposed: `Delete`,
    running: loadingTitleWrapper(`Deleting`)
  },
  edit_file: {
    done: `Edited file`,
    proposed: "Edit file",
    running: loadingTitleWrapper("Editing file")
  },
  rewrite_file: {
    done: `Wrote file`,
    proposed: "Write file",
    running: loadingTitleWrapper("Writing file")
  },
  run_command: {
    done: `Ran terminal`,
    proposed: "Run terminal",
    running: loadingTitleWrapper("Running terminal")
  },
  run_persistent_command: {
    done: `Ran terminal`,
    proposed: "Run terminal",
    running: loadingTitleWrapper("Running terminal")
  },
  open_persistent_terminal: {
    done: `Opened terminal`,
    proposed: "Open terminal",
    running: loadingTitleWrapper("Opening terminal")
  },
  kill_persistent_terminal: {
    done: `Killed terminal`,
    proposed: "Kill terminal",
    running: loadingTitleWrapper("Killing terminal")
  },
  read_lint_errors: {
    done: `Read lint errors`,
    proposed: "Read lint errors",
    running: loadingTitleWrapper("Reading lint errors")
  },
  search_in_file: {
    done: "Searched in file",
    proposed: "Search in file",
    running: loadingTitleWrapper("Searching in file")
  },
  rag_index_document: {
    done: "Indexed document",
    proposed: "Index document",
    running: loadingTitleWrapper("Indexing document")
  },
  rag_search_reference: {
    done: "Searched core references",
    proposed: "Search core references",
    running: loadingTitleWrapper("Searching core references")
  },
  rag_search_workspace: {
    done: "Searched workspace",
    proposed: "Search workspace",
    running: loadingTitleWrapper("Searching workspace")
  },
  rag_get_stats: {
    done: "Got stats",
    proposed: "Get stats",
    running: loadingTitleWrapper("Getting stats")
  },
  edit_document: {
    done: "Edited document",
    proposed: "Edit document",
    running: loadingTitleWrapper("Editing document")
  },
  rag_search_all: {
    done: "Searched all sources",
    proposed: "Search all sources",
    running: loadingTitleWrapper("Searching all sources")
  },
  web_search: {
    done: "Searched web",
    proposed: "Search web",
    running: loadingTitleWrapper("Searching web")
  },
  multi_link_search: {
    done: "Fetched multiple links",
    proposed: "Fetch multiple links",
    running: loadingTitleWrapper("Fetching multiple links")
  },
  timeline_add_event: {
    done: "Added timeline event",
    proposed: "Add timeline event",
    running: loadingTitleWrapper("Adding timeline event")
  },
  timeline_update_event: {
    done: "Updated timeline event",
    proposed: "Update timeline event",
    running: loadingTitleWrapper("Updating timeline event")
  },
  timeline_delete_event: {
    done: "Deleted timeline event",
    proposed: "Delete timeline event",
    running: loadingTitleWrapper("Deleting timeline event")
  },
  timeline_get_events: {
    done: "Got timeline events",
    proposed: "Get timeline events",
    running: loadingTitleWrapper("Getting timeline events")
  },
  timeline_link_document: {
    done: "Linked document to event",
    proposed: "Link document to event",
    running: loadingTitleWrapper("Linking document to event")
  },
  timeline_get_deadlines: {
    done: "Got deadlines",
    proposed: "Get deadlines",
    running: loadingTitleWrapper("Getting deadlines")
  }
} as const satisfies Record<
  BuiltinToolName,
  {done: any;proposed: any;running: any;}>;


export const getTitle = (
toolMessage: Pick<
  ChatMessage & {role: "tool";},
  "name" | "type" | "mcpServerName">)

: React.ReactNode => {
  const t = toolMessage;

  // non-built-in title
  if (!builtinToolNames.includes(t.name as BuiltinToolName)) {
    // descriptor of Running or Ran etc
    const descriptor =
    t.type === "success" ?
    "Called" :
    t.type === "running_now" ?
    "Calling" :
    t.type === "tool_request" ?
    "Call" :
    t.type === "rejected" ?
    "Call" :
    t.type === "invalid_params" ?
    "Call" :
    t.type === "tool_error" ?
    "Call" :
    "Call";

    const title = `${descriptor} ${toolMessage.mcpServerName || "MCP"}`;
    if (t.type === "running_now" || t.type === "tool_request")
    return loadingTitleWrapper(title);
    return title;
  }

  // built-in title
  else {
    const toolName = t.name as BuiltinToolName;
    if (t.type === "success") return titleOfBuiltinToolName[toolName].done;
    if (t.type === "running_now")
    return titleOfBuiltinToolName[toolName].running;
    return titleOfBuiltinToolName[toolName].proposed;
  }
};

export const toolNameToDesc = (
toolName: BuiltinToolName,
_toolParams: BuiltinToolCallParams[BuiltinToolName] | undefined,
accessor: ReturnType<typeof useAccessor>)
: {
  desc1: React.ReactNode;
  desc1Info?: string;
} => {
  if (!_toolParams) {
    return { desc1: "" };
  }

  const x = {
    read_file: () => {
      const toolParams = _toolParams as BuiltinToolCallParams["read_file"];
      return {
        desc1: getBasename(toolParams.uri.fsPath),
        desc1Info: getRelative(toolParams.uri, accessor)
      };
    },
    ls_dir: () => {
      const toolParams = _toolParams as BuiltinToolCallParams["ls_dir"];
      return {
        desc1: getFolderName(toolParams.uri.fsPath),
        desc1Info: getRelative(toolParams.uri, accessor)
      };
    },
    search_pathnames_only: () => {
      const toolParams =
      _toolParams as BuiltinToolCallParams["search_pathnames_only"];
      return {
        desc1: `"${toolParams.query}"`
      };
    },
    search_for_files: () => {
      const toolParams =
      _toolParams as BuiltinToolCallParams["search_for_files"];
      return {
        desc1: `"${toolParams.query}"`
      };
    },
    search_in_file: () => {
      const toolParams = _toolParams as BuiltinToolCallParams["search_in_file"];
      return {
        desc1: `"${toolParams.query}"`,
        desc1Info: getRelative(toolParams.uri, accessor)
      };
    },
    create_file_or_folder: () => {
      const toolParams =
      _toolParams as BuiltinToolCallParams["create_file_or_folder"];
      return {
        desc1: toolParams.isFolder ?
        getFolderName(toolParams.uri.fsPath) ?? "/" :
        getBasename(toolParams.uri.fsPath),
        desc1Info: getRelative(toolParams.uri, accessor)
      };
    },
    delete_file_or_folder: () => {
      const toolParams =
      _toolParams as BuiltinToolCallParams["delete_file_or_folder"];
      return {
        desc1: toolParams.isFolder ?
        getFolderName(toolParams.uri.fsPath) ?? "/" :
        getBasename(toolParams.uri.fsPath),
        desc1Info: getRelative(toolParams.uri, accessor)
      };
    },
    rewrite_file: () => {
      const toolParams = _toolParams as BuiltinToolCallParams["rewrite_file"];
      return {
        desc1: getBasename(toolParams.uri.fsPath),
        desc1Info: getRelative(toolParams.uri, accessor)
      };
    },
    edit_file: () => {
      const toolParams = _toolParams as BuiltinToolCallParams["edit_file"];
      return {
        desc1: getBasename(toolParams.uri.fsPath),
        desc1Info: getRelative(toolParams.uri, accessor)
      };
    },
    run_command: () => {
      const toolParams = _toolParams as BuiltinToolCallParams["run_command"];
      return {
        desc1: `"${toolParams.command}"`
      };
    },
    run_persistent_command: () => {
      const toolParams =
      _toolParams as BuiltinToolCallParams["run_persistent_command"];
      return {
        desc1: `"${toolParams.command}"`
      };
    },
    open_persistent_terminal: () => {
      return { desc1: "" };
    },
    kill_persistent_terminal: () => {
      const toolParams =
      _toolParams as BuiltinToolCallParams["kill_persistent_terminal"];
      return { desc1: toolParams.persistentTerminalId };
    },
    get_dir_tree: () => {
      const toolParams = _toolParams as BuiltinToolCallParams["get_dir_tree"];
      return {
        desc1: getFolderName(toolParams.uri.fsPath) ?? "/",
        desc1Info: getRelative(toolParams.uri, accessor)
      };
    },
    read_lint_errors: () => {
      const toolParams =
      _toolParams as BuiltinToolCallParams["read_lint_errors"];
      return {
        desc1: getBasename(toolParams.uri.fsPath),
        desc1Info: getRelative(toolParams.uri, accessor)
      };
    },
    rag_index_document: () => {
      const toolParams =
      _toolParams as BuiltinToolCallParams["rag_index_document"];
      return {
        desc1: getBasename(toolParams.uri.fsPath),
        desc1Info: getRelative(toolParams.uri, accessor)
      };
    },
    rag_search_reference: () => {
      const toolParams =
      _toolParams as BuiltinToolCallParams["rag_search_reference"];
      return {
        desc1: `"${toolParams.query}"`
      };
    },
    rag_search_workspace: () => {
      const toolParams =
      _toolParams as BuiltinToolCallParams["rag_search_workspace"];
      return {
        desc1: `"${toolParams.query}"`
      };
    },
    rag_get_stats: () => {
      return {
        desc1: ""
      };
    },
    edit_document: () => {
      const toolParams = _toolParams as BuiltinToolCallParams["edit_document"];
      return {
        desc1: getBasename(toolParams.uri.fsPath),
        desc1Info: getRelative(toolParams.uri, accessor)
      };
    },
    rag_search_all: () => {
      const toolParams = _toolParams as BuiltinToolCallParams["rag_search_all"];
      return {
        desc1: `"${toolParams.query}"`
      };
    },
    web_search: () => {
      const toolParams = _toolParams as BuiltinToolCallParams["web_search"];
      return {
        desc1: `"${toolParams.query}"`
      };
    },
    multi_link_search: () => {
      const toolParams = _toolParams as BuiltinToolCallParams["multi_link_search"];
      return {
        desc1: `${toolParams.urls?.length ?? 0} URLs`
      };
    },
    timeline_add_event: () => {
      const toolParams = _toolParams as BuiltinToolCallParams["timeline_add_event"];
      return {
        desc1: toolParams.title ?? "New event"
      };
    },
    timeline_update_event: () => {
      const toolParams = _toolParams as BuiltinToolCallParams["timeline_update_event"];
      return {
        desc1: toolParams.eventId ?? "Event"
      };
    },
    timeline_delete_event: () => {
      const toolParams = _toolParams as BuiltinToolCallParams["timeline_delete_event"];
      return {
        desc1: toolParams.eventId ?? "Event"
      };
    },
    timeline_get_events: () => {
      return {
        desc1: ""
      };
    },
    timeline_link_document: () => {
      const toolParams = _toolParams as BuiltinToolCallParams["timeline_link_document"];
      return {
        desc1: toolParams.eventId ?? "Event"
      };
    },
    timeline_get_deadlines: () => {
      return {
        desc1: ""
      };
    }
  };

  try {
    return x[toolName]?.() || { desc1: "" };
  } catch {
    return { desc1: "" };
  }
};