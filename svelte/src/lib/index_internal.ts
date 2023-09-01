import type {
	DataWithFormatVersion,
	InputMessageData,
	OutputMessageData,
	ResumableState,
	ResumableStateCallback,
	UpdatePriority,
	VWRequestMode,
	WorkerInfo,
	WorkerV1Info
} from "internal-adapter/worker";
import type {
	VWCustomMessageEvent
} from "internal-adapter/internal/exported-by-svelte-module";
import type { BeforeNavigate } from "@sveltejs/kit";

import { internalState, skipIfWaiting } from "$lib/internal.js"; 
import {
	link,
	getNavigationDestURL,
	timeoutPromise,
	waitForEventWithTimeout,
	ExposedPromise
} from "$lib/util.js";
import {
	VIRTUAL_FETCH_PREFIX
} from "internal-adapter/worker/util";
import { ENABLE_QUICK_FETCH } from "internal-adapter/runtime-constants";

import { beforeNavigate } from "$app/navigation";
import { writable } from "svelte/store";

export type Nullable<T> = T | null;
export type MaybePromise<T> = T | Promise<T>;
export type MaybeArray<T> = T | T[];

/**
 * The type of the `detail` property of the `ServiceWorker` component's `"fail"` event.
 */
export interface WorkerRegistrationFailEvent {
	/**
	 * The reason the registration failed.
	 */
	reason: WorkerRegistrationFailReason
}
/**
 * The string union representing the reason why the service worker failed to be registered.
 */
export type WorkerRegistrationFailReason = "unsupported" | "error" | "dev";
/**
 * The type of the `detail` property of the `ServiceWorker` component's `"updatecheck"` event.
 */
export interface WorkerUpdateCheckEvent {
	/**
	 * If the update check succeeded or not.
	 */
	succeeded: boolean,
	/**
	 * If an update is available or not.
	 * 
	 * @note The update is likely still installing at this point.
	 * @note It could be the same update that set this to `true` in the last event.
	 * 
	 * @see `isNew` to check if the update is different to the one from the previous event
	 * @see `ServiceWorker` (the component)'s `updateready` event for waiting until the update is installed
	 */
	updateAvailable: boolean,
	/**
	 * If the update is new compared to the one from the previous event.
	 * 
	 * @note This will be `false` if the update was found before or during the page load.
	 */
	isNew: boolean
}
export type { VWCustomMessageEvent } // Defined in exportedBySvelteModule.ts


/**
 * Fetches a `Response` that was preloaded by the service worker. If it hasn't been preloaded, the worker will fetch the it normally.
 * 
 * @param url The absolute URL or absolute path to fetch. Use `link` if you want to use a path relative to your base URL.
 * @param init The `RequestInit` to use. It's the same as the second argument to `fetch`.
 * @returns A promise for a response.
 * 
 * @note If you keep getting error responses, it could be because you've set `"enableQuickFetch"` in your adapter config to `false` and you aren't using the manfiest plugin.
 * @note This can fetch URLs that aren't in the cache list. It can also be used for `POST` and other types of requests, although since `init.body` isn't used when checking for matches in the worker, you might need to add a header with some kind of hash in these situations.
 * @note Like `fetch`, this will throw if there's a network error.
 * 
 * @see `preloadQuickFetch` for how to preload the resource in the worker
 * @see `AdapterConfig.enableQuickFetch` to re-enable or disable the feature
 * @see `link` in the module `"sveltekit-adapter-versioned-worker/svelte/util"` for a function to convert relative paths to absolute ones
 * @see `summarizeRequest` and `SummarizedRequest` in the module `"sveltekit-adapter-versioned-worker/worker/util"` for more information on how requests are compared
 */
let quickFetchDisabledWarnedAlready = false;
export async function quickFetch(url: string, init?: RequestInit): Promise<Response> {
	const enabled = ENABLE_QUICK_FETCH !== false; // Assume it's ok if it's null
	if (! enabled) {
		if (! quickFetchDisabledWarnedAlready) {
			console.warn(`Versioned Worker quick fetch: since you've disabled the feature in your adapter config, "quickFetch" will just fetch normally. This warning won't reappear until the next page load.`);
			quickFetchDisabledWarnedAlready = true;
		}
	}

	if (enabled && isWorkerActive()) {
		let specifiedHeaders: string[] = [...new Headers(init?.headers).keys()];

		const response = await virtualFetch("quick-fetch", init, {
			url,
			specified: JSON.stringify(specifiedHeaders)
		});
		if (response) return response;
	}

	return await fetch(url, init);
}
/**
 * Fetches a `relativePath` while ensuring it's handled and not sent over the network*.
 * 
 * \*If you set `useVirtualPrefix` to `false`, you'll need to set the `VWRequestMode` to `"handle-only"`, either by using a header or search parameter.
 * 
 * @param relativePath The path relative to the base URL to virtual fetch.
 * @param init The `RequestInit` to use. It's the same as the second argument to `fetch`.
 * @param searchParams The search parameters to include in the URL.
 * @param useVirtualPrefix If the `VIRTUAL_FETCH_PREFIX` should also be added to the URL.
 * @returns A promise for a `Response` or `null`.
 * 
 * @note The returned promise will resolve to `null` if the worker isn't activated.
 * 
 * @see `VIRTUAL_FETCH_PREFIX` in the module `"sveltekit-adapter-versioned-worker/worker/util"` for more information on how the worker handles virtual fetches
 * @see `HandleFetchHook` in the module `"sveltekit-adapter-versioned-worker/worker"` for how to handle these requests in the worker
 * @see `isWorkerActive` or checking if it's activated yet
 * @see `VWRequestMode` in the module `"sveltekit-adapter-versioned-worker/worker"` for more information on request modes
 * @see `ServiceWorker` component's `"activate"` event for waiting until it's activated, if it ever will be
 * @see `ServiceWorker` component's `"fail"` for listening for registration errors
 */
export async function virtualFetch(
	relativePath: string, init?: RequestInit,
	searchParams?: Record<string, string>,
	useVirtualPrefix = true
): Promise<Nullable<Response>> {
	if (! isWorkerActive()) return null;

	relativePath = link(useVirtualPrefix?
		(VIRTUAL_FETCH_PREFIX + relativePath)
		: relativePath
	);
	if (searchParams) {
		const urlObj = new URL(relativePath, location.origin);
		Object.entries(searchParams).forEach(([key, value]) => urlObj.searchParams.set(key, value));
		
		relativePath = urlObj.toString();
	}

	return await fetch(relativePath, init);
}

/**
 * @returns `true` if a service worker is active.
 */
export function isWorkerActive(): boolean {
	return !!navigator.serviceWorker?.controller;
}

/**
 * @returns A `WorkerV1Info` object from the active service worker, if it's been received yet by this client. Otherwise `null`.
 */
export function getActiveWorkerInfo(): Nullable<WorkerV1Info> {
	return internalState.activeWorkerInfo;
}
/**
 * @returns A `WorkerInfo` object from the waiting service worker, if it's been received yet by this client. Otherwise `null`.
 * 
 * @note Since there usually won't be a waiting service worker, this will usually return `null`.
 */
export function getWaitingWorkerInfo(): Nullable<WorkerInfo> {
	return internalState.waitingWorkerInfo;
}

/**
 * Sends a custom message to the active service worker.
 * 
 * @param message The data to send.
 * @returns `true` if the worker exists, otherwise `false.
 * 
 * @see `HandleCustomMessageHook` in the module `"sveltekit-adapter-versioned-worker/worker"` for how to receive it in the worker
 */
export function messageActiveWorker(message: unknown): boolean {
	return customMessageWorkerInternal(message, true);
}
/**
 * Sends a custom message to the waiting service worker.
 * 
 * @param message The data to send, wrapped in a `DataWithFormatVersion` object.
 * @returns `true` if the worker exists, otherwise `false.
 * 
 * @see `HandleCustomMessageHook` in the module `"sveltekit-adapter-versioned-worker/worker"` for how to receive it in the worker
 */
export function messageWaitingWorker(message: DataWithFormatVersion): boolean {
	return customMessageWorkerInternal(message, false);
}
function customMessageWorkerInternal(message: unknown, targetIsTheActive: boolean): boolean {
	const reg = internalState.registration;
	const worker = targetIsTheActive? reg?.active : reg?.waiting;
	if (! worker) return false;

	worker.postMessage({
		type: "vw-custom",
		isFromDifferentVersion: ! targetIsTheActive,
		data: message
	} as InputMessageData);

	return true;
}

/**
 * Checks the status of a resource in the cache list.
 * 
 * @param relativePath The path of the resource to stat relative to the base URL.
 * @returns A promise resolving to a `ResourceInfo` object, or `null` if it isn't cached.
 * 
 * @note If the resource isn't cached, the promise will resolve to `null`.
 * @note If the service worker isn't active, the promise will again resolve to `null`.
 */
export async function statResource(relativePath: string): Promise<Nullable<ResourceInfo>> {
	let res: Nullable<Response>;
	try {
		res = await virtualFetch(relativePath, {
			method: "HEAD",
			headers: {
				"vw-mode": "no-network" satisfies VWRequestMode
			}
		}, undefined, false);
	}
	catch {
		return null;
	}
	if (res == null) return null;

	const version = parseInt(res.headers.get("vw-version") as string);
	const age = parseInt(res.headers.get("vw-age") as string);

	return {
		version,
		age
	};
}
/**
 * The type of the object returned from `statResource`.
 */
export interface ResourceInfo {
	/**
	 * The version the resource is from.
	 * 
	 * @note This number will still increase with new app versions even if the resource hasn't changed.
	 * 
	 * @see `FileSortMode` in the module `"sveltekit-adapter-versioned-worker"` to find out about the different update behaviours of resources
	 */
	version: number,
	/**
	 * The number of revisions the resource is behind by. If it's up-to-date, this will be `0`.
	 * 
	 * @note If the resource is updated infrequently, there will be a big disparity between this and `VERSION - resourceInfo.version`. For example, the app's version might be `25` and the resource might be the latest as of version `2`, but since it was only updated twice between those versions, its age would only be `2`. This is all assuming the resource's mode allows it to become stale though.
	 * 
	 * @see `FileSortMode` in the module `"sveltekit-adapter-versioned-worker"` to find out about the different update behaviours of resources
	 */
	age: number
}

/**
 * The name of the `SessionStorage` item that remembers if there was any resumable state.
 * 
 * @note This is mostly only intended to be used internally.
 */
export const RESUMABLE_STATE_NAME: string = "vw-hasResumableState";
/**
 * The timeout in milliseconds for the `resumeState` function when the `RESUMABLE_STATE_NAME` item in `SessionStorage` indicates there's some `ResumableState` to request. If this timeout is exceeded, `resumeState`'s returned promise will resolve to `null`.
 */
export const RESUMABLE_STATE_TIMEOUT: number = 5000;
/**
 * The timeout for seeing if the service worker will request the `ResumableState`.
 */
export const REQUEST_RESUMABLE_STATE_TIMEOUT: number = 500;

/**
 * Tells Versioned Worker that it's ok to reload the page for an update now.
 * 
 * @param navigateTo An optional URL to navigate to as part of the reload. You can also pass a `BeforeNavigate` object to use its destination URL.
 * @param resumableState An optional `ResumableState` object. If creating it uses significant resources, provide a `ResumableStateCallback` instead as it will only be called if there's an update and it's possible to install it.
 * @returns A promise that resolves to `false` if the page won't be reloaded. If a reload is triggered by this function, the promise will resolve to `true`, though the page might reload before that.
 * 
 * @note This works independently to `isReloadOnNavigateAllowed`, as when that's `true` it essentially just calls this function automatically.
 * @note If you're calling this within a `beforeNavigate`, make sure you pass the `BeforeNavigate` object as the first argument. If you choose to pass a URL instead as part of a navigation, make sure `navigation.willUnload` is `false` before you call this function.
 */
export async function reloadOpportunity(navigateTo?: string | BeforeNavigate, resumableState?: ResumableState | ResumableStateCallback): Promise<boolean> {
	if (navigateTo && typeof navigateTo !== "string") {
		if (navigateTo.willUnload) return false;
	}
	if (internalState.reloading) {
		internalState.skipReloadCountdownPromise.resolve(true);
		internalState.skipReloadCountdownPromise = new ExposedPromise();
		return true;
	}
	if (internalState.registration == null) return false;

	internalState.navigatingTo = navigateTo?
		(typeof navigateTo === "string"? navigateTo : getNavigationDestURL(navigateTo))
		: null
	;
	const isWorkerWaiting = skipIfWaiting(resumableState? true : null); // Always request a callback if there's ResumableState to avoid unnecessarily setting and clearing SessionStorage
	if (! isWorkerWaiting) return false;

	while (true) {
		const event = await Promise.race([
			waitForEventWithTimeout(
				navigator.serviceWorker,
				"message" satisfies keyof ServiceWorkerContainerEventMap,
				REQUEST_RESUMABLE_STATE_TIMEOUT
			) as Promise<Nullable<MessageEvent>>,
			internalState.reloadingPromise
		]);
		if (event == null) return false; // The state wasn't requested, so there won't be a reload
		if (event === true) return true; // The reload has already been triggered

		const { data } = <{ data: OutputMessageData }>(event);
		if (data.type === "vw-reload") return true;
		if (data.type === "vw-skipFailed") return false;

		if (data.type === "vw-updateWithResumable") {
			if (typeof resumableState === "function") resumableState = await resumableState();

			sessionStorage.setItem(RESUMABLE_STATE_NAME, "1");
			skipIfWaiting(resumableState?? null);
		}
	}		
}
/**
 * Sets the `displayedUpdatePriority` store to `0`, hiding the update prompt if it was being shown.
 */
export function dismissUpdateMessage() {
	displayedUpdatePriority.set(0);
}
/**
 * Checks to see if there's a new service worker. If there is, the update will be downloaded and could result in an update prompt, depending on its priority.
 */
export function checkForUpdates() {
	internalState.commandForComponentPromise.resolve({ type: "updateCheck" });
	internalState.commandForComponentPromise = new ExposedPromise();
}


/**
 * Checks if there's any resumable state, but since it doesn't return it, you can find out if there's any a little quicker.
 * 
 * @note This function uses a `SessionStorage` call, which are synchronous.
 * 
 * @see `resumeState` if you want to get the actual `ResumableState` object
 */
export function checkIfResumableState(): boolean {
	return sessionStorage.getItem(RESUMABLE_STATE_NAME) === "1";
}
/**
 * Gets the `ResumableState` if there is any. Use this to put the app back in a similar state to how it was before it reloaded for an update.
 * 
 * @param guaranteeState Set this to `true` if you've already ensured there's some resumable state as this prevents a second `SessionStorage` call, which are synchronous. Otherwise leave it at its default of `false`.
 * @returns A promise resolving to a `ResumableState` object or `null` if there was no state.
 * 
 * @see `reloadOpportunity` for where the object originates from
 */
export async function resumeState(guaranteeState = false): Promise<Nullable<ResumableState>> {
	const waitingState = internalState.waitingResumableState;
	if (waitingState) {
		internalState.waitingResumableState = null;
		return waitingState;
	}
	if (! internalState.registration) return null;
	if (! (guaranteeState || checkIfResumableState())) return null;

	return await Promise.race([
		internalState.resumableStatePromise,
		timeoutPromise(RESUMABLE_STATE_TIMEOUT) // Resolves to null if it times out
	]);
}

/**
 * If Versioned Worker is allowed to reload the page for the next navigation. Use `allowReloadForNextNavigation`, `dontAllowReloadForNextNavigation`, `allowReloadOnNavigateWhileMounted` or `dontAllowReloadOnNavigateWhileMounted` to modify its value.
 * 
 * @default false
 * @note You'll likely only need to read this for debugging.
 */
export let isReloadOnNavigateAllowed = false;

/**
 * Allows Versioned Worker to reload the page for the next navigation. If used correctly, this allows the PWA to update unobtrusively.
 * 
 * @note If any state needs to be preserved, you should instead call `reloadOpportunity` with it using SvelteKit's `beforeNavigate` method. If preserving state is impractical, you should make sure `isReloadOnNavigateAllowed` is `false`, which it is by default.
 */
export function allowReloadForNextNavigation() {
	isReloadOnNavigateAllowed = true;
}

/**
 * Stops Versioned Worker from reloading the page for the next navigation. Use this when `isReloadOnNavigateAllowed` would otherwise be `true` and you could have state that you need to preserve.
 * 
 * @note `isReloadOnNavigateAllowed` is `false` by default. This method is mostly only used for overriding a layout's call of `allowReloadOnNavigateWhileMounted` for a specific route.
 * @note Using this in a `beforeNavigate` will only affect the *next* navigation. If you're trying to prevent a reload when there's state that needs to be preserved, you should instead ensure `isReloadOnNavigateAllowed` is `false` and call `reloadOpportunity` yourself.
 * @note For overriding at a layout rather than page level, use `dontAllowReloadOnNavigateWhileMounted` instead. This is because top level code in layouts isn't rerun by SvelteKit for navigations within the layout.
 * 
 * @example
 * // src/routes/+layout.svelte
 * <script>
 *   // ... 
 *   import { allowReloadOnNavigateWhileMounted } from "sveltekit-adapter-versioned-worker/svelte";
 * 
 *   allowReloadOnNavigateWhileMounted(); // Because this is in the top +layout.svelte file, this allows reloading for all routes by default
 *   // ...
 * </script>
 * 
 * // src/routes/no-update-reload/+page.svelte
 * <script>
 *   // ...
 *   import { dontAllowReloadForNextNavigation } from "sveltekit-adapter-versioned-worker/svelte";
 * 
 *   dontAllowReloadForNextNavigation(); // Override the +layout.svelte file for this specific route
 *   // ...
 * </script>
 */
export function dontAllowReloadForNextNavigation() {
	isReloadOnNavigateAllowed = false;
}

/**
 * Allows Versioned Worker to reload the page between navigations while this component, layout or page is mounted. If used correctly, this allows the PWA to update unobtrusively.
 * 
 * @note If any state needs to be preserved, you should instead call `reloadOpportunity` with it using SvelteKit's `beforeNavigate` method. If preserving state is impractical, you should make sure `isReloadOnNavigateAllowed` is `false`, which it is by default.
 */
export function allowReloadOnNavigateWhileMounted() {
	allowReloadForNextNavigation();
	
	beforeNavigate(allowReloadForNextNavigation);
}

/**
 * Stops Versioned Worker from reloading the page between navigations while this component, layout or page is mounted. Use this when `isReloadOnNavigateAllowed` would otherwise be `true` and you could have state that you need to preserve.
 * 
 * @note `isReloadOnNavigateAllowed` is `false` by default. This method is mostly only used for overriding a layout's call of `allowReloadOnNavigateWhileMounted` for a more specific layout.
 * @note For overriding at a page rather than layout level, you might want to use `dontAllowReloadForNextNavigation` instead as a slight optimisation.
 * 
 * @example
 * // src/routes/+layout.svelte
 * <script>
 *   // ... 
 *   import { allowReloadOnNavigateWhileMounted } from "sveltekit-adapter-versioned-worker/svelte";
 * 
 *   allowReloadOnNavigateWhileMounted(); // Because this is in the top +layout.svelte file, this allows reloading for all routes by default
 *   // ...
 * </script>
 * 
 * // src/routes/no-update-reload-routes/+layout.svelte
 * <script>
 *   // ...
 *   import { dontAllowReloadOnNavigateWhileMounted } from "sveltekit-adapter-versioned-worker/svelte";
 * 
 *   dontAllowReloadOnNavigateWhileMounted(); // Override the top level +layout.svelte file for this more specific layout
 *   // ...
 * </script>
 */
export function dontAllowReloadOnNavigateWhileMounted() {
	dontAllowReloadForNextNavigation();

	beforeNavigate(dontAllowReloadForNextNavigation);
}

/**
 * The messages that the `DefaultUpdatePrompt` component uses.
 */
export const UPDATE_PROMPT_MESSAGES = [
	null, // None
	null, // Patch
	"Minor update ready", // Elevated patch
	"Update ready", // Major
	"An important update is ready" // Critical
] as const;
/**
 * The names of the different update priorities that the `DefaultUpdatePrompt` component uses.
 */
export const UPDATE_PRIORITY_NAMES = [
	null,
	"patch",
	"elevated patch",
	"major update",
	"critical update"
] as const;
/**
 * How long the `ServiceWorker` and `DefaultUpdatePrompt` components wait after triggering a reload before considering it to have failed.
 */
export const RELOAD_TIMEOUT: number = 7500;
/**
 * How long the `ServiceWorker` and `DefaultUpdatePrompt` components wait after a reload timeout before retrying.
 * 
 * @see `RELOAD_TIMEOUT` for how long the reload timeout is
 */
export const RELOAD_RETRY_TIME: number = 10000;

/**
 * A writable store containing the `UpdatePriority` that's currently being displayed. It determines what, if any, update prompt is displayed.
 * 
 * @note This should only really be modified for debugging purposes.
 * 
 * @see `UpdatePriority` in the module `"sveltekit-adapter-versioned-worker/worker`" for more information on update priorities
 */
export const displayedUpdatePriority = writable<UpdatePriority>(0);