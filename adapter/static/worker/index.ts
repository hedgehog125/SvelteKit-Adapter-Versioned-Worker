import {
	InstallEvent,
	ActivateEvent,
	FetchEvent,

	clients,
	registration,
	skipWaiting
} from "./builtInTypes.js";
import type { VersionFile } from "sveltekit-adapter-versioned-worker/worker";


import {
	ROUTES,
	PRECACHE,
	LAZY_CACHE,
	STORAGE_PREFIX,
	VERSION,
	VERSION_FOLDER,
	VERSION_FILE_BATCH_SIZE,
	MAX_VERSION_FILES,
	BASE_URL,
} from "sveltekit-adapter-versioned-worker/worker";
import * as hooks from "sveltekit-adapter-versioned-worker/internal/hooks";

export type Nullable<T> = T | null;

const currentStorageName = STORAGE_PREFIX + VERSION;
const COMPLETE_CACHE_LIST = new Set<string>();
{
	addToCacheList(ROUTES);
	addToCacheList(PRECACHE);
	addToCacheList(LAZY_CACHE);

	function addToCacheList(hrefs: string[]) {
		for (const href of hrefs) {
			COMPLETE_CACHE_LIST.add(href);
		}
	};
}

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
			const toCopy: [string, Cache][] = [];
			if (! doCleanInstall) { // A clean install just means that old caches aren't reused
				const cacheNames = await caches.keys();
				for (const cacheName of cacheNames) {
					if (! cacheName.startsWith(STORAGE_PREFIX)) continue;
					if (cacheName === currentStorageName) continue;
					
					const cache = await caches.open(cacheName);
					const existsList: [string, boolean][] = await Promise.all([...toDownload].map(async (href: string) => { // Maps to an array of promises
						return [href, (await cache.match(href)) !== undefined];
					}));

					for (const [href, exists] of existsList) {
						if (exists && (! (updated.has(href) || ROUTES.includes(href)))) {
							toCopy.push([href, cache]);
							toDownload.delete(href);
						}
					}
				}
			}

			const cache = await caches.open(currentStorageName);
			await Promise.all([
				cache.addAll(toDownload),
				...toCopy.map(async ([href, oldCache]) => {
					await cache.put(href, (await oldCache.match(href)) as Response); // It was already found in the cache, unless it's been deleted since then
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
				if (activeClients.length <= 1) {
					registration.waiting.postMessage({ type: "skipWaiting" });
					return new Response("", { headers: { Refresh: "0" } }); // Send an empty response but with a refresh header so it reloads instantly
				}
			}

			let cache = await caches.open(currentStorageName);
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
					if (COMPLETE_CACHE_LIST.has(path)) {
						console.error(`Couldn't fetch or serve file from cache: ${path}`);
					}
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
addEventListener("message", ({ data }) => {
	if (data === "skipWaiting") data = { type: "skipWaiting" }; // Backwards compatibility shenanigans

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
};
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
};
async function getUpdated(installedVersions: number[]): Promise< Nullable<Set<string> > > {
	if (installedVersions.length === 0) return null; // Clean install
	const newestInstalled = Math.max(...installedVersions);
	
	// Fetch all the version files between the versions
	let versionFiles = [];
	const rangeToDownload = [
		Math.floor((newestInstalled + 1) / VERSION_FILE_BATCH_SIZE), // +1 because we don't need this version file if the installed version is the last one in it
		Math.floor(VERSION / VERSION_FILE_BATCH_SIZE)
	];
	const numberToDownload = (rangeToDownload[1] - rangeToDownload[0]) + 1;
	if (numberToDownload > MAX_VERSION_FILES) return null; // Clean install
	
	for (let versionFileID = rangeToDownload[0]; versionFileID <= rangeToDownload[1]; versionFileID++) {
		versionFiles.push(fetch(`${VERSION_FOLDER}/${versionFileID}.txt`));
	}

	versionFiles = await Promise.all(versionFiles);
	versionFiles = await Promise.all(versionFiles.map(res => res.text()));
	versionFiles = versionFiles.map(parseUpdatedList);
	if (versionFiles.find(versionFile => versionFile.formatVersion === -1)) return null; // Unknown format version, so do a clean install

	const fileIdOfInstalled = Math.floor(newestInstalled / VERSION_FILE_BATCH_SIZE); // Note no +1
	let updated = new Set<string>();
	for (let i = 0; i < versionFiles.length; i++) {
		const versionFileID = rangeToDownload[0] + i;
		const versionFile = versionFiles[i];

		let startIndex = 0;
		if (versionFileID === fileIdOfInstalled) { // This is used instead of checking if this is the first iteration as if the installed version is the last of its file, this logic shouldn't run
			startIndex = (newestInstalled + 1) % VERSION_FILE_BATCH_SIZE; // Ignore the files changed in the previous versions
		}

		for (let versionInFile = startIndex; versionInFile < versionFile.updated.length; versionInFile++) { // versionInFile is a version that's been modulus divided by the max per file
			for (const href of versionFile.updated[versionInFile]) {
				updated.add(href);
			}
		}
	}
	return updated;
};