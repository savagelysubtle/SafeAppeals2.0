/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

const path = require('path');

module.exports = {
	mode: 'production',
	entry: {
		'tiptapDocxBundle': './src/vs/workbench/contrib/void/browser/documentViewers/docxViewer/media/tiptapBundleEntry.js'
	},
	output: {
		globalObject: 'self',
		filename: '[name].js',
		path: path.resolve(__dirname, 'src/vs/workbench/contrib/void/browser/documentViewers/docxViewer/media'),
		library: {
			name: 'TiptapDocx',
			type: 'window'
		}
	},
	resolve: {
		extensions: ['.ts', '.js'],
		extensionAlias: {
			'.js': ['.js', '.ts'],
		},
		fullySpecified: false, // Disable fully specified rule
		fallback: {
			"buffer": false,
			"stream": false,
			"path": false,
			"fs": false
		}
	},
	module: {
		rules: [
			{
				test: /\.m?js/,
				resolve: {
					fullySpecified: false
				}
			},
			{
				test: /\.ts$/,
				use: 'ts-loader',
				exclude: /node_modules/
			}
		]
	},
	externals: {
		// Nothing external - bundle everything
	},
	optimization: {
		minimize: true
	},
	stats: {
		all: false,
		errors: true,
		warnings: true,
		errorDetails: true
	}
};

