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
			const updated = await getUpdated(installedVersions);
			const doCleanInstall = updated == null;

			const toDownload = new Set<string>([
				...ROUTES,
				...PRECACHE
			]);
			const toCopy: [href: string, containingCache: Cache, stale: boolean][] = [];
			if (! doCleanInstall) { // A clean install just means that old cache isn't reused
				const cacheNames = await caches.keys();
				for (const cacheName of cacheNames) {
					if (! cacheName.startsWith(STORAGE_PREFIX)) continue;
					if (cacheName === currentStorageName) continue;
					
					const cache = await caches.open(cacheName);
					const existsList: [string, boolean][] = await Promise.all([...toDownload].map(async (href: string) => { // Maps to an array of promises
						return [href, (await cache.match(href)) != null];
					}));

					for (const [href, exists] of existsList) {
						const changed = updated.has(href) || ROUTES.includes(href);
						const staleAndAcceptable = changed && REUSABLE_BETWEEN_VERSIONS.has(href); // Don't check if it's in REUSABLE_BETWEEN_VERSIONS if it's unchanged
						if (exists && ((! changed) || staleAndAcceptable)) {
							toCopy.push([href, cache, staleAndAcceptable]);
							toDownload.delete(href);
						}
					}
				}
			}

			const cache = await cachePromise;
			await Promise.all([
				Promise.all([...toDownload].map(async href => {
					const res = await fetch(href);

					const wrapped = new Response(res.body, {
						status: res.status,
						headers: {
							...Object.fromEntries(res.headers),
							"VW-Version": VERSION.toString()
						}
					});
					await cache.put(href, wrapped);
				})),
				...toCopy.map(async ([href, oldCache]) => {
					const existing = (await oldCache.match(href)) as Response; // It was already found in the cache, unless it's been deleted since then

					await cache.put(href, existing);
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
				if (! cacheName.startsWith(STORAGE_PREFIX)) continue;
				if (cacheName === currentStorageName) continue;

				await caches.delete(cacheName); // There'll probably only be 1 anyway so it's not worth doing in parallel
			}
		})()
	);
});
addEventListener("fetch", e => {
	const fetchEvent = e as FetchEvent;

    fetchEvent.respondWith(
        (async (): Promise<Response> => {
			const isPage = fetchEvent.request.mode === "navigate" && fetchEvent.request.method === "GET";
			const path = new URL(fetchEvent.request.url).pathname;
			if (hooks.handle) {
				const output = await hooks.handle(path.slice(BASE_URL.length), isPage, fetchEvent, path);
				if (output != null) return output;
			}

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

			const cache = await cachePromise;
			let cached = await cache.match(fetchEvent.request);
			if (cached) return cached;
		
			let resource;
			try {
				resource = await fetch(fetchEvent.request);
			}
			catch {
				if (ROUTES.includes(path) && isPage) {
					return new Response("Something went wrong. Please connect to the internet and try again.");
				}
				else {
					return Response.error();
				}
			}
			if (COMPLETE_CACHE_LIST.has(path) && fetchEvent.request.method === "GET") {
				fetchEvent.waitUntil(cache.put(fetchEvent.request, resource.clone())); // Update it in the background
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
			const res = await fetch(`${VERSION_FOLDER}/${fileID}.txt`);
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