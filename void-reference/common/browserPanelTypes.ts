/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export interface BrowserViewBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface BrowserViewNavigationState {
	url: string;
	title: string;
	canGoBack: boolean;
	canGoForward: boolean;
	isLoading: boolean;
}

export interface BrowserViewEvent {
	viewId: string;
}

export interface BrowserViewNavigationEvent extends BrowserViewEvent {
	url: string;
	title: string;
	canGoBack: boolean;
	canGoForward: boolean;
}

export interface BrowserViewLoadingEvent extends BrowserViewEvent {
	isLoading: boolean;
}
