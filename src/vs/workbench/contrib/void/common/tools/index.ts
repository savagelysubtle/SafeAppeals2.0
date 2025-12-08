/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// Re-export all tool types and utilities from common/tools/

export {
	TerminalResolveReason,
	LintErrorItem,
	ShallowDirectoryItem,
	approvalTypeOfBuiltinToolName,
	ToolApprovalType,
	toolApprovalTypes,
	BuiltinToolCallParams,
	BuiltinToolResultType,
	ToolCallParams,
	ToolResult,
	BuiltinToolName,
	BuiltinToolParamName,
	ToolName,
	ToolParamName,
} from './toolsServiceTypes.js';

export {
	ValidationError,
	ValidationResult,
	ParamType,
	ParamConstraint,
	ToolSchema,
	CompiledValidator,
	ToolSchemaValidator,
	createSchemaFromToolInfo,
} from './toolSchemaValidator.js';



