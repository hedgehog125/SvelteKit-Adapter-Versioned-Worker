import type {
	ActivateEvent,
	FetchEvent,

	VersionFile, MessageEventData, InstallEvent
} from "sveltekit-adapter-versioned-worker/worker";

import {
	ROUTES,
	PRECACHE,
	LAZY_CACHE,
	STALE_LAZY,
	STRICT_LAZY,
	SEMI_LAZY,

	STORAGE_PREFIX,
	VERSION,
	VERSION_FOLDER,
	VERSION_FILE_BATCH_SIZE,
	MAX_VERSION_FILES,
	BASE_URL
} from "sveltekit-adapter-versioned-worker/worker";

import { modifyResponseHeaders, isRequestDefault } from "sveltekit-adapter-versioned-worker/internal/worker-util-alias";
import * as hooks from "sveltekit-adapter-versioned-worker/internal/hooks";

type Nullable<T> = T | null;

const currentStorageName = STORAGE_PREFIX + VERSION;
const COMPLETE_CACHE_LIST = new Set<string>([
	...ROUTES,
	...PRECACHE,
	...LAZY_CACHE,
	...STALE_LAZY,
	...STRICT_LAZY,
	...SEMI_LAZY
]);
const REUSABLE_BETWEEN_VERSIONS = new Set<string>([
	...LAZY_CACHE,
	...STALE_LAZY
]);
const cachePromise = caches.open(currentStorageName);

addEventListener("install", e => {
    (e as InstallEvent).waitUntil(
		(async () => {
			const installedVersions = await getInstalled();
			const updatedList = await getUpdated(installedVersions);

			const toDownload = new Set<string>([
				...ROUTES,
				...PRECACHE
			]);
			const toCopy = new Map<string, [containingCache: Cache, isStale: boolean, fromVersion: number]>(); // The key is the path
			if (updatedList) { // Don't reuse anything if it's a clean install
				const cacheNames = await caches.keys();
				for (const cacheName of cacheNames) {
					if (! cacheName.startsWith(STORAGE_PREFIX)) continue;
					if (cacheName === currentStorageName) continue;
					
					const cache = await caches.open(cacheName);
					const pathsInCache = (await cache.keys()).map(req => new URL(req.url).pathname.slice(BASE_URL.length));
					const cacheVersion = parseInt(cacheName.slice(STORAGE_PREFIX.length));
					for (const path of pathsInCache) {
						const changed = updatedList.has(path) || ROUTES.includes(path);
						if (PRECACHE.includes(path)) {
							if (toDownload.has(path) && (! changed)) {
								toDownload.delete(path);
		
								addToToCopyIfNewer(false);
							}
						}
						else if (SEMI_LAZY.includes(path) && changed) {
							toDownload.add(path);
						}
						else if (COMPLETE_CACHE_LIST.has(path)) {
							const staleAndAcceptable = changed && REUSABLE_BETWEEN_VERSIONS.has(path); // Don't check if it's in REUSABLE_BETWEEN_VERSIONS if it's unchanged
							const reusable = (! changed) || staleAndAcceptable;

							if (reusable) addToToCopyIfNewer(changed); // If it's reusable and has changed then it's stale
						}


						function addToToCopyIfNewer(isStale: boolean) {
							const itemInToCopy = toCopy.get(path);
							const valueToPut: [Cache, boolean, number] = [cache, isStale, cacheVersion];
							if (itemInToCopy) {
								if (cacheVersion > itemInToCopy[2]) { // This assset is newer, use it instead
									toCopy.set(path, valueToPut);
								}
							}
							else {
								toCopy.set(path, valueToPut);
							}
						}
					}
				}	
			}

			const cache = await cachePromise;
			await Promise.all([
				...[...toDownload].map(async path => {
					if (path === "") path = BASE_URL; // Otherwise it'll point to sw.js
					const res = addVWHeaders(await fetch(path, { cache: "no-store" }));

					await cache.put(path, res);
				}),
				...[...toCopy].map(async ([path, [oldCache, isStale]]) => {
					const existing = (await oldCache.match(path)) as Response; // It was already found in the cache before
					const withUpdatedVersionHeader = isStale?
						existing
						: addVWHeaders(existing)
					;

					await cache.put(path, withUpdatedVersionHeader);
				})
			]);
		})()
	);
});

addEventListener("activate", e => {
	(e as ActivateEvent).waitUntil(
		(async () => {
			await clients.claim();

			// Clean up
			const cacheNames = await caches.keys();
			for (const cacheName of cacheNames) {
				const hasAnOldName = cacheName.startsWith("VersionedWorkerStorage-") || cacheName.startsWith("VersionedWorkerCache-");
				if (! (cacheName.startsWith(STORAGE_PREFIX) || hasAnOldName)) continue;
				if (cacheName === currentStorageName) continue;

				await caches.delete(cacheName); // There'll probably only be 1 anyway so it's not worth doing in parallel
			}
		})()
	);
});
addEventListener("fetch", e => {
	const fetchEvent = e as FetchEvent;
	const isPage = fetchEvent.request.mode === "navigate" && fetchEvent.request.method === "GET";
	const fullPath = new URL(fetchEvent.request.url).pathname;
	const pathWithoutBase = fullPath.slice(BASE_URL.length);
	const inCacheList = COMPLETE_CACHE_LIST.has(pathWithoutBase);

	let handleOutput: Promise<Nullable<Response>> | Nullable<Response> = null;
	if (hooks.handle) {
		handleOutput = hooks.handle(pathWithoutBase, isPage, fetchEvent, fullPath);

		if (handleOutput == null && (! inCacheList)) { // Passthrough
			return;
		} 
	}

    fetchEvent.respondWith(
        (async (): Promise<Response> => {
			if (isPage && registration.waiting) { // Based on https://redfin.engineering/how-to-fix-the-refresh-button-when-using-service-workers-a8e27af6df68
				const activeClients = await clients.matchAll();
				if (activeClients.length > 1) {
					activeClients.forEach(client => client.postMessage({ type: "vw-waiting" }));
				}
				else {
					registration.waiting.postMessage({ type: "skipWaiting" });
					return new Response("", { headers: { Refresh: "0" } }); // Send an empty response but with a refresh header so it reloads instantly
				}
			}

			if (handleOutput) {
				handleOutput = await handleOutput;
				if (handleOutput != null) return handleOutput;
			}

			const cache = await cachePromise;
			let cached = await cache.match(fetchEvent.request);
			if (cached) return cached;
		
			let resource;
			try {
				resource = await fetch(fetchEvent.request);
			}
			catch {
				if (ROUTES.includes(pathWithoutBase) && isPage) {
					return new Response("Something went wrong. Please connect to the internet and try again.");
				}
				else {
					return Response.error();
				}
			}

			resource = addVWHeaders(resource);
			if (inCacheList && fetchEvent.request.method === "GET") {
				if (isRequestDefault(fetchEvent.request)) {
					fetchEvent.waitUntil(cache.put(fetchEvent.request, resource.clone())); // Update it in the background
				}
			}
			return resource;
        })()
    );
});
interface MessageEventWithTypePropBase extends MessageEvent {
	data: MessageEventData | string
}
addEventListener("message", ({ data }: MessageEventWithTypePropBase) => {
	if (typeof data === "string") {
		if (data === "skipWaiting") data = { type: "skipWaiting" }; // Backwards compatibility shenanigans
		else return; // Invalid
	}

	if (data.type === "skipWaiting") skipWaiting();
});

function parseUpdatedList(contents: string): VersionFile {
	contents = contents.split("\r\n").join("\n");

	const splitPoint = contents.indexOf("\n");
	const version = contents.slice(0, splitPoint);
	const formatSupported = version === "2";
	
	let updated: string[][] = [];
	if (formatSupported) {
		updated = contents.slice(splitPoint + 1)
			.split("\n\n")
			.map(updatedList => {
				let parsed = updatedList.split("\n");
				if (parsed[0] === "") return [];
				else return parsed;
			})
		;
	}

	return {
		formatVersion: formatSupported? 2 : -1,
		updated: updated
	};
}
async function getInstalled(): Promise<number[]> {
	let installedVersions = [];

	const cacheNames = await caches.keys();
	for (const cacheName of cacheNames) {
		if (! cacheName.startsWith(STORAGE_PREFIX)) continue;
		if (cacheName === currentStorageName) continue;

		installedVersions.push(
			parseInt(cacheName.slice(STORAGE_PREFIX.length))
		);
	}
	
	installedVersions = installedVersions.sort((n1, n2) => n2 - n1); // Newest (highest) first
	return installedVersions;
}
async function getUpdated(installedVersions: number[]): Promise< Nullable<Set<string>> > {
	if (installedVersions.length === 0) return null; // Clean install
	const newestInstalled = Math.max(...installedVersions);
	
	// Fetch all the version files between the versions
	const rangeToDownload = [
		Math.floor((newestInstalled + 1) / VERSION_FILE_BATCH_SIZE), // +1 because we don't need this version file if the installed version is the last one in it
		Math.floor(VERSION / VERSION_FILE_BATCH_SIZE)
	];
	const idInBatchOfOneAfterInstalled = (newestInstalled + 1) % VERSION_FILE_BATCH_SIZE;
	const installedInDownloadRange = idInBatchOfOneAfterInstalled !== 0; // If it's the last version in the batch, it won't be
	const numberToDownload = (rangeToDownload[1] - rangeToDownload[0]) + 1;
	if (numberToDownload > MAX_VERSION_FILES) return null; // Clean install
	
	let versionFiles = await Promise.all(
		new Array(numberToDownload).fill(null).map(async (_, offset) => {
			let fileID = offset + rangeToDownload[0];
			const res = await fetch(`${VERSION_FOLDER}/${fileID}.txt`, { cache: "no-store" });
			return parseUpdatedList(await res.text());
		})
	);

	if (versionFiles.find(versionFile => versionFile.formatVersion === -1)) return null; // Unknown format version, so do a clean install

	let updated = new Set<string>();
	for (let i = 0; i < versionFiles.length; i++) {
		const versionFile = versionFiles[i];

		// If the installed version is the last of its file, its batch won't be iterated over in this containing loop
		const startIndex = installedInDownloadRange && i === 0? idInBatchOfOneAfterInstalled : 0;
		// ^ Ignore the files changed in versions before the installed

		for (let versionInFile = startIndex; versionInFile < versionFile.updated.length; versionInFile++) {
			versionFile.updated[versionInFile].forEach(href => updated.add(href));
		}
	}
	return updated;
}

/**
 * @note This consumes the original response
 * @note This assumes the response is from the latest version
 */
function addVWHeaders(response: Response): Response {
	return modifyResponseHeaders(response, {
		"VW-VERSION": VERSION.toString()
	});
}