/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const fs = require('fs');

// Complete list of directories where npm should be executed to install node modules
// Document-focused editor: only document extensions and git
const dirs = [
	'',
	'build',
	'extensions',
	'extensions/git',
	'extensions/git-base',
	'extensions/json-language-features',
	'extensions/json-language-features/server',
	'extensions/markdown-language-features',
	'extensions/markdown-math',
	'extensions/markdown-basics',
	'extensions/json',
	'extensions/yaml',
	'extensions/xml',
	'extensions/simple-browser',
	'extensions/merge-conflict',
	'extensions/media-preview',
	'extensions/configuration-editing',
	'extensions/typescript-language-features',
	'extensions/extension-editing',
	'extensions/html-language-features',
	'extensions/html-language-features/server',
	'extensions/ipynb',
	'extensions/emmet',
	'extensions/php-language-features',
	'extensions/npm',
	'extensions/github',
	'extensions/github-authentication',
	'extensions/microsoft-authentication',
	'extensions/open-remote-ssh',
	'extensions/css-language-features',
	'extensions/css-language-features/server',
	'remote',
	'remote/web',
	'test/automation',
	'test/integration/browser',
	'test/monaco',
	'test/smoke',
	'.vscode/extensions/vscode-selfhost-import-aid',
	'.vscode/extensions/vscode-selfhost-test-provider',

];

if (fs.existsSync(`${__dirname}/../../.build/distro/npm`)) {
	dirs.push('.build/distro/npm');
	dirs.push('.build/distro/npm/remote');
	dirs.push('.build/distro/npm/remote/web');
}

exports.dirs = dirs;
