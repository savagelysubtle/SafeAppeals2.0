/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const {
	ADDON_FILENAME,
	loadRagCore,
	expectedNativeBindingPath,
	resolveNativeBindingPath,
} = require('./nativeLoader');

const loaded = loadRagCore(__dirname);

const isNativeAvailable = loaded.ok;

function getLoadError() {
	return loaded.ok ? undefined : loaded.error;
}

function getNative() {
	return loaded.ok ? loaded.native : undefined;
}

function requireNative() {
	if (!loaded.ok) {
		throw new Error(loaded.error);
	}
	return loaded.native;
}

function ping() {
	return requireNative().ping();
}

function version() {
	return requireNative().version();
}

function capabilities() {
	return requireNative().capabilities();
}

function openWorkspace(rootDir, dekBytes, preferSecondary) {
	if (!loaded.ok) {
		return { ok: false, error: loaded.error };
	}
	return loaded.native.openWorkspace(rootDir, dekBytes, preferSecondary);
}

function closeWorkspace() {
	if (!loaded.ok) {
		return { ok: false, error: loaded.error };
	}
	return loaded.native.closeWorkspace();
}

function stats() {
	return requireNative().stats();
}

function getDocument(docId) {
	if (!loaded.ok) {
		return undefined;
	}
	return loaded.native.getDocument(docId);
}

function chunkDocument(input) {
	return requireNative().chunkDocument(input);
}

function embedBatch(texts) {
	return requireNative().embedBatch(texts);
}

function indexChunks(doc, chunks) {
	if (!loaded.ok) {
		return { ok: false, error: loaded.error };
	}
	return loaded.native.indexChunks(doc, chunks);
}

function removeDoc(docId) {
	if (!loaded.ok) {
		return { ok: false, error: loaded.error };
	}
	return loaded.native.removeDoc(docId);
}

function search(query, opts) {
	if (!loaded.ok) {
		return { ok: false, error: loaded.error, results: [] };
	}
	return loaded.native.search(query, opts);
}

function ensureEmbedderLoaded() {
	if (!loaded.ok) {
		return { ok: false, error: loaded.error, loaded: false };
	}
	return loaded.native.ensureEmbedderLoaded();
}

function clearEmbedder() {
	if (!loaded.ok) {
		return { ok: false, error: loaded.error };
	}
	return loaded.native.clearEmbedder();
}

function clearReranker() {
	if (!loaded.ok) {
		return { ok: false, error: loaded.error };
	}
	return loaded.native.clearReranker();
}

module.exports = {
	ADDON_FILENAME,
	loadRagCore,
	expectedNativeBindingPath,
	resolveNativeBindingPath,
	isNativeAvailable,
	getLoadError,
	getNative,
	ping,
	version,
	capabilities,
	openWorkspace,
	closeWorkspace,
	stats,
	getDocument,
	chunkDocument,
	embedBatch,
	indexChunks,
	removeDoc,
	search,
	ensureEmbedderLoaded,
	clearEmbedder,
	clearReranker,
};
