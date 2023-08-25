// This is appended to the constants exported from the worker module, so it's only accessible in the service worker
// Note: This file is transpiled to JavaScript before the build
// Note: This is then re-exported by the worker.d.ts file

import type { CustomCurrentWorkerMessageEventLikeData, CustomWaitingWorkerMessageEventLikeData } from "../exportedBySvelteModule.js";

import { broadcastInternal, workerState, wrappedFetch } from "sveltekit-adapter-versioned-worker/internal/worker-shared"; 
import { modifyResponseHeaders, summarizeRequest } from "sveltekit-adapter-versioned-worker/internal/worker-util-alias";


/* Types */
// These are defined here rather than in the worker.d.ts file so they can be accessed by the code here

type Nullable<T> = T | null;
type MaybePromise<T> = Promise<T> | T;
export interface DataWithFormatVersion {
	formatVersion: number,
	data: unknown
}

/* Hooks /*

/**
 * The type of the optional export `handleFetch` in your `"hooks.worker.ts"` file. The function is called when a network request is made by a client and the `VWRequestMode` isn't `"force-passthrough"`.
 * 
 * @note By default, Versioned Worker will set the mode of cross origin requests to `"force-passthrough"`, in which case they won't cause any of your hooks be called. To handle them anyway, you'll need to set the `VWRequestMode` back to `"default"` or another value. Alternatively, you can disable this behaviour by setting `autoPassthroughCrossOriginRequests` in your adapter config to `false`.
 * @note Generally you should only handle requests with the `VIRTUAL_FETCH_PREFIX`.
 * 
 * @see `virtualRoutes`, `combineFetchHandlers` and `ignoreCrossOriginFetches` as they are utility functions that you might find helpful.
 * @see `virtualFetch` in the module `"sveltekit-adapter-versioned-worker/svelte"` for sending requests while ensuring the worker is running.
 * @see `VIRTUAL_FETCH_PREFIX` in the module `"sveltekit-adapter-versioned-worker/worker/util"` or `"sveltekit-adapter-versioned-worker/svelte/util"` for information on the virtual prefix.
 * @see `VWRequestMode` for more information on request modes.
 * 
 * @example
 * // hooks.worker.ts
 * 
 * // ...
 * import type { HandleFetchHook } from "sveltekit-adapter-versioned-worker";
 * // ...
 * 
 * export const handleFetch = (({ href, fullHref, virtualHref }) => {
 *   console.log(`A request was made to the href ${href}. With the base URL and starting slash, that's ${fullHref}.`);
 *   
 *   if (virtualHref === "prefixed-virtual/") { // These should both end with a slash if you've set trailingSlash in your SvelteKit config to "always"
 *     return new Response("This is a virtual route with the virtual prefix.");
 *   }
 *   else if (href === "unprefixed-virtual/") { // Same here
 *     return new Response("This is a virtual route but without the virtual prefix.");
 *   }
 * }) satisfies HandleFetchHook;
 * 
 * // ...
 */
export type HandleFetchHook = (requestInfo: VWRequest) => MaybePromise<Response | undefined | void>;
/**
 * An interface for an object that represents a Versioned Worker request. It's passed as the 1st argument to `HandleFetchHook` functions.
 */
export interface VWRequest {
	/**
	 * TODO
	 * 
	 * @note This doesn't start with a slash
	 * @note This doesn't include search parameters
	 */
	href: string,
	/**
	 * TODO
	 * 
	 * @note This doesn't include search parameters
	 */
	fullHref: string,
	/**
	 * The href of the virtual request.
	 * 
	 * @note This doesn't start with a slash or the virtual prefix
	 * @note This will be `null` if the request doesn't have the virtual prefix
	 * @note If the request is cross origin, this will always be `null`
	 */
	virtualHref: Nullable<string>,
	/**
	 * TODO
	 */
	searchParams: URLSearchParams,
	/**
	 * TODO
	 */
	urlObj: URL,

	/**
	 * TODO
	 */
	isPage: boolean,
	/**
	 * TODO
	 * 
	 * @note By default, Versioned Worker will set the mode of cross origin requests to `"force-passthrough"`, in which case they won't cause any of your hooks be called. To handle them anyway, you'll need to set the `VWRequestMode` back to `"default"` or another value. Alternatively, you can disable this behaviour by setting `autoPassthroughCrossOriginRequests` in your adapter config to `false`.
	 * 
	 * @see `VWRequestMode` for more information on request modes.
	 */
	isCrossOrigin: boolean,
	/**
	 * TODO
	 */
	vwMode: VWRequestMode,
	/**
	 * TODO
	 */
	inCacheList: boolean

	/**
	 * TODO
	 */
	request: Request,
	/**
	 * TODO
	 */
	event: FetchEvent
}
/**
 * A string union type representing the mode of a request made by a client. To set the mode of a request, set the `vw-mode` header 
 * Each causes the service worker to handle the request differently:
 * TODO
 * 
 * @example 
 * TODO
 */
export type VWRequestMode = "default" | "no-network" | "handle-only" | "force-passthrough";

/**
 * TODO
 */
export type HandleCustomMessageHook = (messageInfo: CustomMessageHookData) => MaybePromise<void>;
/**
 * TODO
 * 
 * @see `CustomMessageData` for the type of data that gets directly postmessaged to or from the worker.
 */
export type CustomMessageHookData = CustomMessageHookData.CurrentWorker | CustomMessageHookData.WaitingWorker;
export namespace CustomMessageHookData {
	/** 
	 * TODO
	 * 
	 * @see `CustomMessageData` for TODO.
	 */
	export type CurrentWorker = CustomCurrentWorkerMessageEventLikeData<ExtendableMessageEvent>;
	/**
	 * TODO
	 * 
	 * @see `CustomMessageData` for TODO.
	 */
	export type WaitingWorker = CustomWaitingWorkerMessageEventLikeData<ExtendableMessageEvent>;
}

/**
 * TODO
 * 
 * @note This won't be called for requests where any of the following are the case:
 * * A response was returned by `handleFetch`
 * * The request's `VWRequestMode` is set to `"force-passthrough"`
 * * The request was auto passthrough-ed, which is a behaviour that's disabled by default
 * 
 * @see `HandleFetchHook` for more information on handling requests
 * @see `AdapterConfig.enablePassthrough` for more information on enabling auto passthrough
 */
export type HandleResponseHook = (requestInfo: VWRequest, responseInfo: VWResponse) => MaybePromise<Response | undefined | void>;
/**
 * TODO
 */
export interface VWResponse {
	/**
	 * TODO
	 */
	response: Response,
	/**
	 * TODO
	 */
	isFromCache: boolean,
	/**
	 * TODO
	 */
	isStale: boolean,
	/**
	 * TODO
	 * 
	 * @note This will be `null` if the worker never fetched as part of the request in the first place.
	 * @note It will also be `null` for resources that have their `FileSortMode` set to `"lazy-cache"` unless they haven't been cached yet. This is because they're normally only updated in the background, so it's not known if it'll succeed at this point.
	 * 
	 * @see `FileSortMode` in the module `"sveltekit-adapter-versioned-worker"` for more information on file sort modes.
	 */
	didNetworkFail: Nullable<boolean>,
	/**
	 * TODO
	 */
	event: FetchEvent
}


/**
 * TODO
 */
export type UpdatePriority = 0 | 1 | 2 | 3 | 4;

/**
 * TODO
 */
export interface VersionFile {
	formatVersion: number,
	updated: string[][],
	updatePriorities: UpdatePriority[]
}

/**
 * TODO
 */
export type InputMessageVoidType = "skipWaiting" | "finish" | "resume" | "getInfo";
/**
 * TODO
 */
export type InputMessageType = InputMessageVoidType | ConditionalSkipMessageData["type"] | CustomMessageData["type"];
/**
 * TODO
 */
export interface InputMessageVoidData {
	type: InputMessageVoidType
}
/**
 * TODO
 */
export interface ConditionalSkipMessageData {
	type: "conditionalSkipWaiting",
	/**
	 * `true` means there's state that should be packaged up before the worker updates, if it can.
	 */
	resumableState: Nullable<ResumableState> | true,
	sendFinish?: boolean
}
/**
 * TODO
 * 
 * @see `CustomMessageHookData` for the type of data received by a `HandleCustomMessageHook`.
 */
export type CustomMessageData = CustomMessageData.CurrentWorker | CustomMessageData.WaitingWorker;
export namespace CustomMessageData {
	/**
	 * TODO
	 * 
	 * @see `VWCustomMessageHookData` for TODO.
	 */
	export interface CurrentWorker extends CustomMessageDataBase {
		isFromDifferentVersion: false,
		/**
		 * TODO
		 */
		data: unknown
	}
	/**
	 * TODO
	 * 
	 * @see `VWCustomMessageHookData` for TODO.
	 */
	export interface WaitingWorker extends CustomMessageDataBase {
		isFromDifferentVersion: true,
		/**
		 * TODO
		 */
		data: DataWithFormatVersion
	}
	interface CustomMessageDataBase {
		type: "custom",
		/**
		 * TODO
		 */
		isFromDifferentVersion: boolean
	}
}

/**
 * TODO
 */
export type InputMessageData = InputMessageVoidData | ConditionalSkipMessageData | CustomMessageData;
/**
 * TODO
 */
export interface InputMessageEvent extends MessageEvent {
	data: InputMessageData
}

/**
 * TODO
 * 
 * @note `"vw-updateWithResumable"` is a response to a `"conditionalSkipWaiting"` input. 
 */
export type OutputMessageVoidType = "vw-reload" | "vw-updateWithResumable" | "vw-skipFailed";
/**
 * TODO
 */
export type OutputMessageType = OutputMessageVoidType | ResumeMessageData["type"] | WorkerInfoMessageData["type"] | CustomMessageData["type"];
/**
 * TODO
 */
export interface OutputMessageVoidData {
	type: OutputMessageVoidType
}
/**
 * TODO
 */
export interface ResumeMessageData {
	type: "vw-resume",
	data: Nullable<ResumableState>
}
/**
 * TODO
 */
export interface WorkerInfoMessageData {
	type: "vw-info",
	info: WorkerInfo
}
/**
 * TODO
 */
export type OutputMessageData = OutputMessageVoidData | ResumeMessageData | WorkerInfoMessageData | CustomMessageData;
/**
 * TODO
 */
export interface OutputMessageEvent extends MessageEvent {
	data: OutputMessageData
}

/**
 * TODO
 */
export type ResumableState = DataWithFormatVersion;
/**
 * TODO
 */
export type ResumableStateCallback = () => MaybePromise<ResumableState>;

/**
 * TODO
 */
export interface UnknownWorkerInfo {
	/**
	 * TODO: this is the latest major version + 1
	 */
	majorFormatVersion: 2
}
/**
 * TODO
*/
export interface WorkerMajorV1UnknownMinorInfo extends WorkerMajorV1InfoBase {
	/**
	 * TODO: this is the latest minor version + 1
	 */
	minorFormatVersion: 2
}
/**
 * TODO
*/
export interface WorkerV1Info extends WorkerMajorV1InfoBase {
	minorFormatVersion: 1,
	templateVersion: 1
}
/**
 * TODO
 */
interface WorkerMajorV1InfoBase {
	majorFormatVersion: 1,
	minorFormatVersion: number,
	
	version: number,
	templateVersion: number,
	timeInstalled: number,
	blockedInstallCount: number,
	updatePriority: UpdatePriority
}

/**
 * TODO
 */
export type WorkerInfo = KnownMajorVersionWorkerInfo | UnknownWorkerInfo;
/**
 * TODO
 */
export type KnownMajorVersionWorkerInfo = WorkerMajorV1KnownMinorInfo | WorkerMajorV1UnknownMinorInfo;
/**
 * TODO
 */
export type WorkerMajorV1KnownMinorInfo = WorkerV1Info;

/* Worker types */
// Adapted from https://gist.github.com/ithinkihaveacat/227bfe8aa81328c5d64ec48f4e4df8e5 by Tiernan Cridland under ISC license:

// Events
export interface ExtendableEvent extends Event {
	waitUntil(fn: Promise<any>): void;
}
export interface FetchEvent extends ExtendableEvent {
	clientId: string,
	handled: Promise<void>,
	preloadResponse: Promise<Response | undefined>
	replacesClientId: string,
	resultingClientId: string,
	request: Request,
	respondWith(response: MaybePromise<Response>): void
}
export interface InstallEvent extends ExtendableEvent {
	activeWorker: ServiceWorker
}
export interface ActivateEvent extends ExtendableEvent { }
export interface ExtendableMessageEvent<T = any> extends ExtendableEvent {
	data: T,
	origin: string,
	lastEventId: string,
	source: Client | ServiceWorker | MessagePort,
	ports: MessagePort[]
}
export interface NotificationEvent {
	action: string,
	notification: Notification
}
export interface PushEvent extends ExtendableEvent {
	data: PushMessageData
}
export interface SyncEvent extends Event {
	lastChance: boolean,
	tag: string
}

export interface PushMessageData {
	arrayBuffer(): ArrayBuffer,
	blob(): Blob,
	json(): unknown,
	text(): string;
}


// Misc
export interface ServiceWorkerNotificationOptions {
	tag?: string
}
export interface CacheStorageOptions {
	cacheName?: string,
	ignoreMethod?: boolean,
	ignoreSearch?: boolean,
	ignoreVary?: boolean
}

export interface Client {
	frameType: ClientFrameType,
	id: string,
	url: string,

	// Based off the built-in lib.dom.d.ts
    postMessage(message: any, transfer?: Transferable[]): void
}

/**
 * @note This is just a type. To access the variable in the worker, you need to declare it as a variable.
 * 
 * @example
 * // In an ambient d.ts file or, so you don't your global scope, in your hooks.worker.ts file. You may prefer to use a static import for the second case.
 * declare var clients: import("sveltekit-adapter-versioned-worker/worker").Clients;
 * 
 */
export interface Clients {
	claim(): Promise<void>,
	get(id: string): Promise<Client>,
	matchAll(options?: ClientMatchOptions): Promise<Client[]>,
	openWindow(url: string): Promise<WindowClient>
}
export interface ClientMatchOptions {
	includeUncontrolled?: boolean,
	type?: ClientMatchTypes,
}
export interface WindowClient extends Client {
	focused: boolean,
	visibilityState: WindowClientState,
	focus(): Promise<WindowClient>,
	navigate(url: string): Promise<WindowClient>
}

export type ClientFrameType = "auxiliary" | "top-level" | "nested" | "none";
export type ClientMatchTypes = "window" | "worker" | "sharedworker" | "all";
export type WindowClientState = "hidden" | "visible";

/**
 * Shorthand for ServiceWorkerRegistration.
 * 
 * @note This is just a type. To access the variable in the worker, you need to declare it as a variable.
 * 
 * @example
 * // In an ambient d.ts file or, so you don't your global scope, in your hooks.worker.ts file
 * declare var registration: ServiceWorkerRegistration; // Or import("sveltekit-adapter-versioned-worker/worker").Registration
 */
export type Registration = ServiceWorkerRegistration;

/**
 * @note This is just a type. To access the variable in the worker, you need to declare it as a variable.
 * 
 * @example
 * // In an ambient d.ts file or, so you don't your global scope, in your hooks.worker.ts file. You may prefer to use a static import for the second case.
 * declare var skipWaiting: import("sveltekit-adapter-versioned-worker/worker").SkipWaiting;
 */
export type SkipWaiting = () => Promise<void>;


/* Code */
declare var clients: Clients;
declare var registration: Registration;
declare var skipWaiting: SkipWaiting;

/**
 * Fetches and preloads a resource so the main thread can more quickly fetch it in a few seconds' time.
 * 
 * @param url The url to prefetch
 * @param init The second argument to the `fetch` function call
 * @returns `false` if it's already being prefetched, else `true`
 */
export function preloadQuickFetch(url: string, init?: RequestInit): boolean {
	const request = new Request(url, init);
	const stringRequest = JSON.stringify(summarizeRequest(request));
	if (workerState.quickFetchPromises.has(stringRequest)) return false; // Already being prefetched

	const fetchPromise = wrappedFetch(request);
	fetchPromise.then(() => {
		setTimeout(() => {
			if (workerState.quickFetchPromises.delete(stringRequest)) {
				console.warn(`Versioned Worker quick fetch: The SummarizedRequest ${stringRequest} wasn't requested within 30 seconds. Do your worker and page requests match?`);
			}
		}, 30000);
	});

	workerState.quickFetchPromises.set(stringRequest, fetchPromise);
	return true;
}

/**
 * A fetch handler utility that runs an array of `HandleFetchHook` functions in order until one resolves to a `Response`.
 * 
 * @param handlers An array of `HandleFetchHook` functions to call.
 * @returns A new `HandleFetchHook` that calls each of your `handlers` in turn until one of them resolves to a `Response`.
 * 
 * @note Since the returned `HandleFetchHook` always returns a promise, you cannot use automatic passthrough with this utility.
 * 
 * @example
 * // src/hooks.worker.ts
 * 
 * // ...
 * import { combineFetchHandlers } from "sveltekit-adapter-versioned-worker/worker";
 * // ...
 * 
 * // Note: since this example is simple, it can be more easily implemented using the virtualRoutes utility function
 * export const handleFetch = combineFetchHandlers([
 *   ({ isCrossOrigin, href }) => {
 *     if (isCrossOrigin) return; // For the sake of the example, I didn't just wrap the combineFetchHandlers call in a ignoreCrossOriginFetches call
 * 
 *     if (href === "virtual") {
 *       return new Response("Content");
 *     }
 *   },
 *   ({ isCrossOrigin, href }) => {
 *     if (isCrossOrigin) return;
 * 
 *     if (href === "virtual-2") {
 *       return new Response("Content 2");
 *     }
 *   }
 * ]);
 * 
 * // ...
 */
export function combineFetchHandlers(handlers: HandleFetchHook[]): HandleFetchHook {
	return async requestInfo => {
		for (const handler of handlers) {
			const output = await handler(requestInfo);
			if (output !== undefined) return output;
		}
	};
}
/**
 * A fetch handler utility that makes your `HandleFetchHook` callback ignore cross origin requests.
 * 
 * @param handler The `HandleFetchHook` function to call if the request is same origin.
 * @returns A `HandleFetchHook` that only calls `handler` if the request is same origin.
 * 
 * @note By default, Versioned Worker will set the mode of cross origin requests to `"force-passthrough"`, in which case they won't cause any of your hooks be called. Without using this utility, they will however be called if you either:
 * * Set the `VWRequestMode` back to `"default"` or another value
 * * Disable this behaviour by setting `autoPassthroughCrossOriginRequests` in your adapter config to `false`
 * 
 * @see `VWRequestMode` for more information on request modes.
 * 
 * @example
 * // src/hooks.worker.ts
 * 
 * // ...
 * import { ignoreCrossOriginFetches } from "sveltekit-adapter-versioned-worker/worker";
 * // ...
 * 
 * export const handleFetch = ignoreCrossOriginFetches(({ isCrossOrigin }) => {
 *   console.log(`The request is ${isCrossOrigin? "" : "not "}cross origin.`); // isCrossOrigin will always be false, otherwise this function won't be called
 * });
 * 
 * // ...
 */
export function ignoreCrossOriginFetches(handler: HandleFetchHook): HandleFetchHook {
	return requestInfo => {
		if (! requestInfo.isCrossOrigin) return handler(requestInfo);
	};
}
/**
 * A fetch handler utility that calls a different `HandleFetchHook` function depending on the request's `virtualHref` or `href`. 
 * 
 * @param handlers An object where the key is the `href` and the value is the `HandleFetchHook` function to call if it matches.
 * @param ignoreCrossOriginFetches If cross origin requests should be ignored. If you set this to `false`, make sure you check the `request.origin` property in each of your `handlers`. **Default**: `true`.
 * @returns A `HandleFetchHook` that calls a different one of your `handlers` depending on the request's `virtualHref` or `href`.
 * 
 * @note Whether or not each `href` starts with a slash is significant. If it does, the function will be called if the `href` matches it. If it doesn't, it's called based on the `virtualHref` instead. Generally, you should take the second approach.
 * @note `href`s that start with the slash still work off the `href` property rather than the `fullHref` property. This means they are unaffected by your base URL.
 * @note `href`s that start with a slash and are the same as a page should match the Svelte's `"trailingSlash"` option.
 * @note The returned `HandleFetchHook` will return `undefined` if there's no match. This will cause the default behaviour for the `VWRequestMode`.
 * 
 * @example
 * // src/hooks.worker.ts
 * 
 * // ...
 * import { virtualRoutes } from "sveltekit-adapter-versioned-worker/worker";
 * // ...
 * 
 * export const handleFetch = virtualRoutes({
 *   "prefixed-virtual": () => { // A fetch to /<base url>/<virtual prefix>/ won't call this as the trailing slash isn't removed
 *     return new Response("This is a virtual route with the virtual prefix.");
 *   },
 *   "/unprefixed-virtual": () => { // Same applies here
 *     return new Response("This is a virtual route but without the virtual prefix.");
 *   },
 *   // Since this is also a normal route, it needs to have a trailing slash to match the Svelte option "trailingSlash"'s value of "always" in this example
 *   "/settings/": () => {
 *     console.log("The user accessed the settings page.");
 *   },
 *   // Because of this, this won't ever run in this example:
 *   "/settings": () => {
 *     console.log(`Presumably "trailingSlash" has been set to "never" or "ignore".`);
 *   }
 * });
 */
export function virtualRoutes(handlers: { [href: string]: HandleFetchHook }, ignoreCrossOriginFetches = true): HandleFetchHook {
	const handlerMap = new Map<string, [hasVirtualPrefix: boolean, handler: HandleFetchHook]>(
		Object.entries(handlers).map(([href, handler]) => {
			if (href.startsWith("/")) return [href.slice(1), [false, handler]];

			return [href, [true, handler]];
		})
	);

	return requestInfo => {
		if (! (ignoreCrossOriginFetches && requestInfo.isCrossOrigin)) {
			const hasVirtualPrefix = requestInfo.virtualHref != null;
			const href = requestInfo.virtualHref?? requestInfo.href;
			const handler = handlerMap.get(href);
			if (! handler) return;
			if (handler[0] !== hasVirtualPrefix) return;

			return handler[1](requestInfo);
		}
	};
}

/**
 * TODO
 */
export function modifyResponseHeadersBeforeSending(newHeaders: Record<string, Nullable<string>>, conditionCallback: (requestInfo: VWRequest, responseInfo: VWResponse) => MaybePromise<boolean>): HandleResponseHook {
	return async (requestInfo, responseInfo) => {
		if (! (await conditionCallback(requestInfo, responseInfo))) return;

		return modifyResponseHeaders(responseInfo.response, newHeaders);
	};
}
/**
 * TODO
 */
export function modifyResponsesToCrossOriginIsolateApp(): HandleResponseHook {
	return modifyResponseHeadersBeforeSending({
		"Cross-Origin-Opener-Policy": "same-origin",
		"Cross-Origin-Embedder-Policy": "require-corp"
	}, ({ isPage }) => isPage);
}

/**
 * TODO
 * 
 * @note The returned promise should be ignored as it doesn't indicate when the message is received.
 */
export async function broadcast(message: DataWithFormatVersion, includeUncontrolled: true): Promise<void>;
/**
 * TODO
 * 
 * @note The returned promise should be ignored as it doesn't indicate when the message is received.
 */
export async function broadcast(message: unknown, includeUncontrolled: false): Promise<void>;
/**
 * TODO
 * 
 * @note The returned promise should be ignored as it doesn't indicate when the message is received.
 */
export async function broadcast(message: unknown, includeUncontrolled: boolean) {
	broadcastInternal((await clients.matchAll({ includeUncontrolled })) as WindowClient[], {
		type: "custom",
		isFromDifferentVersion: includeUncontrolled,
		data: message
	} as CustomMessageData);
}