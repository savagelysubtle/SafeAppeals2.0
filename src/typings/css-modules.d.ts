/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Allow importing CSS files as side effects
// This declaration works for both absolute and relative CSS imports
declare module '*.css';

// Also allow .css.js imports (used with moduleResolution: "nodenext")
declare module '*.css.js';

