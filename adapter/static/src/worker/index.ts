import type {
	InstallEvent,
	ActivateEvent,
	FetchEvent,
	Clients,
	Registration,
	SkipWaiting,

	VersionFile,
	VWRequestMode,
	HandleFetchHook,
	InputMessageData,
	WindowClient,
	OutputMessageData,
	ResumableState,
	ExtendableMessageEvent,
	WorkerV1Info,
	UpdatePriority
} from "sveltekit-adapter-versioned-worker/worker";
declare var clients: Clients;
declare var registration: Registration;
declare var skipWaiting: SkipWaiting;

import {
	ROUTES,
	PRECACHE,
	LAX_LAZY,
	STALE_LAZY,
	STRICT_LAZY,
	SEMI_LAZY,

	STORAGE_PREFIX,
	VERSION,
	VERSION_FOLDER,
	VERSION_FILE_BATCH_SIZE,
	MAX_VERSION_FILES,
	BASE_URL,

	REDIRECT_TRAILING_SLASH,
	ENABLE_PASSTHROUGH,
	AUTO_PASSTHROUGH_CROSS_ORIGIN_REQUESTS,
	ENABLE_QUICK_FETCH,
	USE_HTTP_CACHE
} from "sveltekit-adapter-versioned-worker/worker";

import {
	VIRTUAL_FETCH_PREFIX,
	INFO_STORAGE_PATH,

	modifyRequestHeaders,
	modifyResponseHeaders,
	isResponseTheDefault,
	summarizeRequest
} from "sveltekit-adapter-versioned-worker/internal/worker-util-alias";
import { ExposedPromise } from "sveltekit-adapter-versioned-worker/internal/exported-by-svelte-module";
import {
	workerState,
	wrappedFetch,
	INLINED_RELOAD_PAGE
} from "sveltekit-adapter-versioned-worker/internal/worker-shared";
import * as hooks from "sveltekit-adapter-versioned-worker/internal/hooks";

type Nullable<T> = T | null;
type MaybePromise<T> = Promise<T> | T;

const httpCacheMode: RequestCache = USE_HTTP_CACHE? "no-cache" : "reload";
const currentStorageName = STORAGE_PREFIX + VERSION;
const COMPLETE_CACHE_LIST = new Set<string>([
	...ROUTES,
	...PRECACHE,
	...LAX_LAZY,
	...STALE_LAZY,
	...STRICT_LAZY,
	...SEMI_LAZY
]);
const REUSABLE_BETWEEN_VERSIONS = new Set<string>([
	...LAX_LAZY,
	...STALE_LAZY
]);
/**
 * This will be `false` if there's only an index route.
 */
const TRAILING_SLASH = ROUTES.find(pathWithoutBase => pathWithoutBase !== "")?.slice(-1) === "/";
const infoHref = VIRTUAL_FETCH_PREFIX + INFO_STORAGE_PATH;

const cachePromise = caches.open(currentStorageName);
let finished = false; // When the message "finish" is received, this worker will only send the blank reload page. Used for updates
let resumableState: Nullable<ResumableState> = null;
let resumableStateUsedPromise = new ExposedPromise(); // Awaited in a waituntil so the worker doesn't stop while it has ResumableState
let lastBlockedReloadCountIncrement = -Infinity;

/* Optional functions */
// The code referencing them might be unreachable depending on the config, so some of these might not be in the build

const handleQuickFetch = (async ({ searchParams, request }) => {
	const unwrappedURL = searchParams.get("url");
	const specifiedHeadersRaw = searchParams.get("specified");
	if (unwrappedURL == null || specifiedHeadersRaw == null) {
		console.error("Versioned Worker quick fetch: invalid request.");
		return Response.error();
	}

	const unwrappedRequest = new Request(unwrappedURL, request);
	const stringRequest = JSON.stringify(summarizeRequest(unwrappedRequest, JSON.parse(specifiedHeadersRaw)));
	const fetchPromise = workerState.quickFetchPromises.get(stringRequest);

	if (fetchPromise) {
		workerState.quickFetchPromises.delete(stringRequest);
		return await fetchPromise; // It's already wrapped
	}
	else {
		return await wrappedFetch(unwrappedRequest);
	}
}) satisfies HandleFetchHook;

/* End of optional functions */

addEventListener("install", e => {
    (e as InstallEvent).waitUntil(
		(async () => {
			const installedVersions = await getInstalled();
			const [whenResourcesUpdated, updatePriority] = await getWhenEachResourceUpdated(installedVersions);

			const toDownload = new Set<string>([
				...ROUTES,
				...PRECACHE
			]);
			const toCopy = new Map<string, [containingCache: Cache, firstUpdatedInVersion: [number, number] | undefined, fromVersion: number]>(); // The key is the path
			if (whenResourcesUpdated) { // Don't reuse anything if it's a clean install
				const cacheNames = await caches.keys();
				for (const cacheName of cacheNames) {
					if (! cacheName.startsWith(STORAGE_PREFIX)) continue;
					if (cacheName === currentStorageName) continue;
					
					const cache = await caches.open(cacheName);
					const pathsInCache = (await cache.keys()).map(req => new URL(req.url).pathname.slice(BASE_URL.length));
					const cacheVersion = parseInt(cacheName.slice(STORAGE_PREFIX.length));
					for (const path of pathsInCache) {
						const isRoute = ROUTES.includes(path);
						const firstUpdatedInVersion = isRoute?
							undefined
							: whenResourcesUpdated.get(path)
						;
						const changed = ! (isRoute || firstUpdatedInVersion == null);
						
						if (PRECACHE.includes(path)) {
							if (toDownload.has(path) && (! changed)) {
								toDownload.delete(path);
		
								addToToCopyIfNewer();
							}
						}
						else if (SEMI_LAZY.includes(path)) {
							if (changed) {
								toDownload.add(path);
							}
							else {
								addToToCopyIfNewer();
							}
						}
						else if (COMPLETE_CACHE_LIST.has(path)) {
							const staleAndAcceptable = changed && REUSABLE_BETWEEN_VERSIONS.has(path); // Don't check if it's in REUSABLE_BETWEEN_VERSIONS if it's unchanged
							const reusable = (! changed) || staleAndAcceptable;

							if (reusable) addToToCopyIfNewer(); // If it's reusable and has changed then it's stale
						}


						function addToToCopyIfNewer() {
							const itemInToCopy = toCopy.get(path);
							if (itemInToCopy == null || cacheVersion > itemInToCopy[2]) { // Make sure the resource isn't already in it or is newer
								toCopy.set(path, [cache, firstUpdatedInVersion, cacheVersion]);
							}
						}
					}
				}
			}
			else {
				if (installedVersions.length != 0) {
					console.warn("Versioned Worker: Performing clean install");
				}
			}

			const cache = await cachePromise;
			await Promise.all([
				...[...toDownload].map(async path => {
					if (path === "") path = BASE_URL; // Otherwise it'll point to sw.js
					const res = addVWHeaders(await fetch(path, { cache: httpCacheMode }));
					if (! isResponseUsable(res)) throw "";

					await cache.put(path, res);
				}),
				...[...toCopy].map(async ([path, [oldCache, whenResourceUpdated]]) => {
					if (path === "") path = BASE_URL; // Otherwise it'll point to sw.js
					const existing = (await oldCache.match(path)) as Response; // It was already found in the cache before
					// Set its version to the version before it was first updated

					let age = parseInt(existing.headers.get("vw-age") as string);
					if (isNaN(age)) age = 0;

					let version : number | undefined;
					if (whenResourceUpdated) {
						const [firstUpdatedInVersion, revisions] = whenResourceUpdated;
						version = firstUpdatedInVersion - 1;

						age += revisions;
					}
					else {
						const previousVersionHeader = parseInt(existing.headers.get("vw-version") as string);
						if (! isNaN(previousVersionHeader)) {
							if (age !== 0) {
								version = previousVersionHeader;
							}
						}
					}

					
					const withUpdatedVersionHeader = addVWHeaders(
						existing,
						version,
						age
					);

					await cache.put(path, withUpdatedVersionHeader);
				})
			]);

			await createInfoResource(updatePriority);
		})()
	);
});

addEventListener("activate", e => {
	(e as ActivateEvent).waitUntil(
		(async () => {
			const claimTask = clients.claim();

			// Clean up
			const cacheNames = await caches.keys();
			for (const cacheName of cacheNames) {
				const hasAnOldName = cacheName.startsWith("VersionedWorkerStorage-") || cacheName.startsWith("VersionedWorkerCache-");
				if (! (cacheName.startsWith(STORAGE_PREFIX) || hasAnOldName)) continue;
				if (cacheName === currentStorageName) continue;

				await caches.delete(cacheName); // There'll probably only be 1 anyway so it's not worth doing in parallel
			}

			await claimTask;
		})()
	);
});
addEventListener("fetch", e => {
	const fetchEvent = e as FetchEvent;
	const req = fetchEvent.request;
	const urlObj = new URL(req.url);
	const fullPath = urlObj.pathname;
	const pathWithoutBase = fullPath.slice(BASE_URL.length);
	const isCrossOrigin = urlObj.origin !== location.origin;
	const hasVirtualPrefix = (! isCrossOrigin) && pathWithoutBase.startsWith(VIRTUAL_FETCH_PREFIX);
	const searchParams = urlObj.searchParams;
	const vwMode = getVWRequestMode(req, hasVirtualPrefix, isCrossOrigin, searchParams);
	if (vwMode === "force-passthrough") return;

	const isGetRequest = req.method === "GET";
	const isHeadRequest = req.method === "HEAD";
	const isPage = req.mode === "navigate" && isGetRequest;
	if (REDIRECT_TRAILING_SLASH) {
		if (
			(isGetRequest || isHeadRequest)
			&& (pathWithoutBase.slice(-1) === "/") !== TRAILING_SLASH
		) {
			// Non route files will also reach here
			const withCorrectTrailingSlash = fixTrailingSlash(pathWithoutBase);
			if (ROUTES.includes(withCorrectTrailingSlash)) {
				fetchEvent.respondWith(Response.redirect(fixTrailingSlash(req.url)));
				return;
			}
		}
	}
	const inCacheList = (! isCrossOrigin) && (isGetRequest || isHeadRequest) && COMPLETE_CACHE_LIST.has(pathWithoutBase);

	const virtualHref = hasVirtualPrefix? pathWithoutBase.slice(VIRTUAL_FETCH_PREFIX.length) : null;
	const fetchHandler = selectHandleFetchFunction(virtualHref, isCrossOrigin);
	let handleOutput: MaybePromise<Response | undefined | void>;
	if (fetchHandler) {
		handleOutput = fetchHandler({
			href: pathWithoutBase,
			fullHref: fullPath,
			virtualHref,
			searchParams,
			urlObj,
			isPage,
			isCrossOrigin,
			vwMode,
			inCacheList,
			request: req,
			event: fetchEvent
		});

		if (ENABLE_PASSTHROUGH) {
			if (handleOutput == null && (! inCacheList) && vwMode !== "handle-only") return;
		}
	}

    fetchEvent.respondWith(
        (async (): Promise<Response> => {
			if (isPage && (registration.waiting || finished)) { // Based on https://redfin.engineering/how-to-fix-the-refresh-button-when-using-service-workers-a8e27af6df68
				const activeClients = await clients.matchAll();
				if (activeClients.length < 2) {
					finished = false; // Prevent an endless refresh loop if something goes wrong changing workers
					return new Response(INLINED_RELOAD_PAGE, { headers: { "content-type": "text/html" } });
					// ^ The conditional skip is sent as part of this page rather than here. This is because newly opened tabs aren't included in activeClients, which can result in unsafe reloads
				}
			}

			if (handleOutput) {
				handleOutput = await handleOutput;
				if (handleOutput != null) return handleOutput;
			}
			if (vwMode === "handle-only") return Response.error();

			if (isCrossOrigin || (! (isGetRequest || isHeadRequest))) { // Sort of passthrough: no headers are added
				return await wrappedFetch(req);
			}

			const cache = await cachePromise;
			if (inCacheList) {
				const modifiedRequest = modifyRequestForCaching(req);
				let cached = await cache.match(modifiedRequest);
				if (cached) {
					const stale = parseInt(cached.headers.get("vw-version") as string) !== VERSION;
					if (! stale) return handleHeadRequest(cached, isHeadRequest);

					if (vwMode === "no-network" || STALE_LAZY.includes(pathWithoutBase)) {
						if (vwMode !== "no-network") updateResourceInBackground(modifiedRequest, cache, fetchEvent);
						return handleHeadRequest(cached, isHeadRequest); // The outdated version
					}
					else { // Must be a lax-lazy resource
						const [resource, isError] = await fetchResource(pathWithoutBase, modifiedRequest, isPage);
						if (isError) return handleHeadRequest(cached, isHeadRequest);

						updateResourceInBackground(modifiedRequest, cache, fetchEvent, resource.clone());
						return handleHeadRequest(resource, isHeadRequest);
					}
				}
			}

			/* The response won't already be in the cache if this point is reached (but could be in the cache list) */
			if (vwMode === "no-network") return Response.error();

			const modifiedRequest = modifyRequestForCaching(req, false); // Could be a HEAD request
			const [resource, isError] = await fetchResource(pathWithoutBase, modifiedRequest, isPage);
			if (isError || isHeadRequest) return resource; // Send the error response or send the HEAD response from the server if applicable, as it can't be cached

			if (inCacheList) updateResourceInBackground(modifiedRequest, cache, fetchEvent, resource.clone());
			return handleHeadRequest(resource, isHeadRequest);
        })()
    );
});
// The type of addEventListener is based off of the window one which is incorrect, hence this cast
type AddMessageListener = (type: "message", listener: ((this: typeof globalThis, event: ExtendableMessageEvent) => any)) => void;
(addEventListener as unknown as AddMessageListener)("message", messageEvent => {
	const backwardCompatibleData = messageEvent.data as InputMessageData | "skipWaiting";
	// We're going to assume that invalid data will never be post-messaged here

	let data: InputMessageData;
	if (backwardCompatibleData === "skipWaiting") {
		data = { type: "skipWaiting" };
	}
	else {
		data = backwardCompatibleData;
	}

	if (data.type === "skipWaiting") {
		skipWaiting();
	}
	else if (data.type === "conditionalSkipWaiting") {
		messageEvent.waitUntil((async () => {
			const activeClients = (await clients.matchAll({ includeUncontrolled: true })) as WindowClient[];
			if (activeClients.length < 2) {
				if (data.resumableState === true) {
					// Now the clients check has passed, get the client to send the message again with the actual state
					broadcast(activeClients, { type: "vw-updateWithResumable" });
				}
				else {
					resumableState = data.resumableState;
					
					const timedOut = await Promise.race([
						skipWaiting(),
						new Promise<boolean>(resolve => setTimeout(() => resolve(true), 100))
					]);
					if (timedOut) {
						registration.active?.postMessage({ type: "finish" } satisfies InputMessageData);
					}
					broadcast(activeClients, { type: "vw-reload" });

					if (resumableState) await resumableStateUsedPromise; // resumableState is used rather than data.resumableState so if it's somehow already consumed, it doesn't await indefinitely
				}
			}
			else {
				broadcast(activeClients, { type: "vw-skipFailed" });

				const now = performance.now();
				const elapsed = now - lastBlockedReloadCountIncrement;
				lastBlockedReloadCountIncrement = now;
				if (elapsed > 5000) { // If it's called back to back a bunch of times, only count the first
					const workerInfo = await getWorkerInfo();
					workerInfo.blockedInstallCount++;
					await putWorkerInfo(workerInfo);
				}
			}
		})());
	}
	else if (data.type === "finish") {
		finished = true;
	}
	else if (data.type === "resume") {
		messageEvent.waitUntil((async () => {
			const activeClients = (await clients.matchAll({ includeUncontrolled: true })) as WindowClient[];
			broadcast(activeClients, {
				type: "vw-resume",
				data: resumableState
			}); // Should only be 1 client

			resumableState = null;
			resumableStateUsedPromise.resolve();
			resumableStateUsedPromise = new ExposedPromise();
		})());
	}
	else if (data.type === "getInfo") {
		messageEvent.waitUntil((async () => {
			const activeClients = (await clients.matchAll({ includeUncontrolled: true })) as WindowClient[];
			
			broadcast(activeClients, {
				type: "vw-info",
				info: await getWorkerInfo()
			})
		})());
	}
});

function parseUpdatedList(contents: string): VersionFile {
	contents = contents.split("\r\n").join("\n");

	const splitPoint = contents.indexOf("\n");
	const version = contents.slice(0, splitPoint);
	const formatSupported = version === "3";
	
	let updated: string[][] = [];
	let updatePriorities: UpdatePriority[] = [];
	if (formatSupported) {
		const splitContents = contents.slice(splitPoint + 1).split("\n\n");
		updated = splitContents.map((versionInfoBody) => {
			let parsed = versionInfoBody.slice(1).split("\n");
			if (parsed[0] === "") return [];
			else return parsed;
		});
		updatePriorities = splitContents.map((versionInfoBody) => {
			const updatePriority = parseInt(versionInfoBody[0]) as UpdatePriority;

			let parsed = versionInfoBody.slice(1).split("\n");
			if (parsed[0] === "") return updatePriority;
			else return updatePriority;
		});
	}

	return {
		formatVersion: formatSupported? 3 : -1,
		updated,
		updatePriorities
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
/**
 * Returns `[null, 2]` if a clean install should be performed.
 * 
 * The key is the href (excluding the base) of a resource that was updated. The value is the version where it was first updated since the installed version.
 */
async function getWhenEachResourceUpdated(installedVersions: number[]): Promise<[
	Nullable<Map<string, [versionWhenUpdated: number, revisions: number]>>,
	UpdatePriority
]> {
	const cleanInstallReturnValue = [null, 2] satisfies Awaited<ReturnType<typeof getWhenEachResourceUpdated>>;

	if (installedVersions.length === 0) return cleanInstallReturnValue; // Clean install
	const newestInstalled = Math.max(...installedVersions);
	if (newestInstalled >= VERSION) return cleanInstallReturnValue; // The version number has gone down for some reason, so clean install
	
	/* Fetch all the version files between the versions */

	// Once the number of version files reaches MAX_VERSION_FILES, the version files are shifted down by 1
	// + 1 and ceil so v100 gives an offset of -1 and <= -2 starts at 110 
	const batchOffset = Math.min(MAX_VERSION_FILES - Math.ceil((VERSION + 1) / VERSION_FILE_BATCH_SIZE), 0); // Always <= 0

	const rangeToDownload = [
		Math.floor((newestInstalled + 1) / VERSION_FILE_BATCH_SIZE) + batchOffset, // +1 because we don't need this version file if the installed version is the last one in it
		Math.floor(VERSION / VERSION_FILE_BATCH_SIZE) + batchOffset
	];
	if (rangeToDownload[0] < 0) return cleanInstallReturnValue; // The current installed version is too old, do a clean install

	const idInBatchOfOneAfterInstalled = (newestInstalled + 1) % VERSION_FILE_BATCH_SIZE;
	const installedInDownloadRange = idInBatchOfOneAfterInstalled !== 0; // If it's the last version in the batch, it won't be
	const numberToDownload = (rangeToDownload[1] - rangeToDownload[0]) + 1;
	
	let versionFiles = await Promise.all(
		Array.from(new Array(numberToDownload), async (_, offset): Promise<VersionFile> => {
			let fileID = offset + rangeToDownload[0];
			const res = await fetch(`${VERSION_FOLDER}/${fileID}.txt`, { cache: httpCacheMode });
			if (! isResponseUsable(res)) throw ""; // Fail the install

			return parseUpdatedList(await res.text());
		})
	);

	if (versionFiles.some(versionFile => versionFile.formatVersion === -1)) return cleanInstallReturnValue; // Unknown format version or not ok status, so do a clean install

	let whenResourcesUpdated = new Map<string, [number, number]>();
	let currentVersion = newestInstalled + 1;
	let updatePriority: UpdatePriority = 1;
	for (let i = 0; i < versionFiles.length; i++) {
		const versionFile = versionFiles[i];

		// If the installed version is the last of its file, its batch won't be iterated over in this containing loop
		const startIndex = installedInDownloadRange && i === 0? idInBatchOfOneAfterInstalled : 0;
		// ^ Ignore the files changed in versions before the installed

		for (let versionInFile = startIndex; versionInFile < versionFile.updated.length; versionInFile++) {
			const currentPriority = versionFile.updatePriorities[versionInFile];
			if (currentPriority > updatePriority) updatePriority = currentPriority;
			
			for (const href of versionFile.updated[versionInFile]) {
				const existing = whenResourcesUpdated.get(href);

				if (existing) {
					existing[1]++;
				}
				else {
					whenResourcesUpdated.set(href, [currentVersion, 1]);
				}
			}
			currentVersion++;
		}
	}
	return [whenResourcesUpdated, updatePriority];
}

const vwRequestModes = new Set<VWRequestMode>([
	"default", // Included so the unspecified behaviour can be overridden, as it won't always result in the mode being "default"
	"force-passthrough",
	"handle-only",
	"no-network"
]);
function getVWRequestMode(
	request: Request, hasVirtualPrefix: boolean,
	isCrossOrigin: boolean, searchParams: URLSearchParams
): VWRequestMode {
	const headerValue = request.headers.get("vw-mode") as VWRequestMode | null; // Or also any other string
	if (vwRequestModes.has(headerValue as VWRequestMode)) return headerValue as VWRequestMode;
	const searchParamValue = searchParams.get("vw-mode");
	if (vwRequestModes.has(searchParamValue as VWRequestMode)) return searchParamValue as VWRequestMode; 

	return (isCrossOrigin && AUTO_PASSTHROUGH_CROSS_ORIGIN_REQUESTS)?
		"force-passthrough"
		: (hasVirtualPrefix? "handle-only" : "default")
	;
}
/**
 * @note This consumes `response`
 * @note This assumes the response is from the latest version if `version` isn't specified
 */
function addVWHeaders(response: Response, version?: number, age = 0): Response {
	return modifyResponseHeaders(response, {
		"vw-version": (version?? VERSION).toString(),
		"vw-age": age.toString()
	});
}
/**
 * Removes the `Range` and `VW-Mode` headers, sets the method to `"GET"` and the cache mode to `httpCacheMode`.
 */
function modifyRequestForCaching(request: Request, enforceGetRequest: boolean = true) {
	return modifyRequestHeaders(request, {
		range: null,
		"vw-mode": null
	}, {
		method: enforceGetRequest? "GET" : request.method,
		cache: httpCacheMode
	});
}

const acceptableResponseTypes = new Set([
	"default",
	"basic"
]);
/**
 * Also adds the Versioned Worker headers
 */
async function fetchResource(
	pathWithoutBase: string, modifiedRequest: Request, isPage: boolean
): Promise<[response: Response, isError: boolean]> {
	let resource: Response;
	try {
		resource = await fetch(modifiedRequest);
	}
	catch {
		if (ROUTES.includes(pathWithoutBase) && isPage) {
			return [new Response("Something went wrong. Please connect to the internet and try again."), true];
		}
		else {
			return [Response.error(), true];
		}
	}

	if (acceptableResponseTypes.has(resource.type)) { // Other types are errors or redirects
		resource = addVWHeaders(resource);
	}
	return [resource, false];
}
/**
 * @note This consumes `resource`, if provided
 */
function updateResourceInBackground(
	modifiedRequest: Request, cache: Cache,
	fetchEvent: FetchEvent, resource?: Response
) {
	fetchEvent.waitUntil(
		(async () => {
			if (resource == null) resource = addVWHeaders(await fetch(modifiedRequest));
			
			if (isResponseUsable(resource)) {
				if (isResponseTheDefault(modifiedRequest, resource) && resource.status !== 206) { // Also checks that it's a GET request
					cache.put(modifiedRequest, resource); // Update it in the background
				}
			}
		})()
	);
}

function handleHeadRequest(response: Response, isHeadRequest: boolean): Response {
	if ((! isHeadRequest) || response.body == null) return response;

	response.body.cancel(); // This doesn't seem to be needed in Chrome or Firefox but it seems like a good idea to explicitly do this
	return new Response(null, {
		headers: response.headers
	});
}

function isResponseUsable(response: Response): boolean {
	if (! acceptableResponseTypes.has(response.type)) return false;
	const codeRange = Math.floor(response.status / 100);
	if (codeRange === 4 || codeRange === 5) return false;

	return true;
}

/**
 * Returns a built-in function if applicable, otherwise returns the user provided one
 */
function selectHandleFetchFunction(virtualHref: string | null, isCrossOrigin: boolean): Nullable<HandleFetchHook> {
	if (isCrossOrigin) return hooks.handleFetch;
	if (ENABLE_QUICK_FETCH && virtualHref === "quick-fetch") return handleQuickFetch;

	return hooks.handleFetch;
}

function broadcast(activeClients: WindowClient[], data: OutputMessageData) {
	activeClients.forEach(client => client.postMessage(data));
}

function fixTrailingSlash(urlOrPath: string): string {
	return TRAILING_SLASH?
		(urlOrPath + "/")
		: urlOrPath.slice(0, -1)
	;
}

/**
 * Creates a `WorkerInfo` and saves it to `infoHref`.
 */
async function createInfoResource(updatePriority: UpdatePriority = 0): Promise<WorkerV1Info> {
	const workerInfo = {
		majorFormatVersion: 1,
		minorFormatVersion: 1,

		version: VERSION,
		templateVersion: 1,
		timeInstalled: Date.now(),
		blockedInstallCount: 0,
		updatePriority
	} satisfies WorkerV1Info;

	await putWorkerInfo(workerInfo);
	return workerInfo;
}

/**
 * @note If the info resource doesn't exist, it will be created.
 */
async function getWorkerInfo(): Promise<WorkerV1Info> {
	const cache = await cachePromise;

	let res = await cache.match(infoHref);
	if (! res) return await createInfoResource();

	return await res.json();
}

async function putWorkerInfo(workerInfo: WorkerV1Info) {
	const cache = await cachePromise;
	await cache.put(infoHref, new Response(
		JSON.stringify(workerInfo),
		{ headers: { "content-type": "application/json" } }
	));
}