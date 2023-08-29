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

/* Hooks */

/**
 * The type of the optional export `handleFetch` in your `"hooks.worker.ts"` file. The function is called when a network request is made by a client and the `VWRequestMode` isn't `"force-passthrough"`.
 * 
 * @note By default, Versioned Worker will set the mode of cross origin requests to `"force-passthrough"`, in which case they won't cause any of your hooks be called. To handle them anyway, you'll need to set the `VWRequestMode` back to `"default"` or another value. Alternatively, you can disable this behaviour by setting `autoPassthroughCrossOriginRequests` in your adapter config to `false`.
 * @note Generally you should only handle requests with the `VIRTUAL_FETCH_PREFIX`.
 * 
 * @see `virtualRoutes`, `combineFetchHandlers` and `ignoreCrossOriginFetches` as they are utility functions that you might find helpful
 * @see `virtualFetch` in the module `"sveltekit-adapter-versioned-worker/svelte"` for sending requests while ensuring the worker is running
 * @see `VIRTUAL_FETCH_PREFIX` in the module `"sveltekit-adapter-versioned-worker/worker/util"` for information on the virtual prefix
 * @see `VWRequestMode` for more information on request modes
 * 
 * @example
 * // hooks.worker.ts
 * 
 * // ...
 * import type { HandleFetchHook } from "sveltekit-adapter-versioned-worker/worker";
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
 * 
 *   console.log("Since nothing was returned, Versioned Worker will handle the request.");
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
	 * The href of the request, minus the base URL.
	 * 
	 * @note This doesn't start with a slash.
	 * @note This doesn't include search parameters.
	 * 
	 * @see `fullHref` for the href with the base URL
	 */
	href: string,
	/**
	 * The full href of the request.
	 * 
	 * @note As this is affected by the base URL, generally you should use `href` instead.
	 * @note This will always start with a slash.
	 * @note This doesn't include search parameters.
	 * 
	 * @see `href` for this without the base URL
	 */
	fullHref: string,
	/**
	 * The href of the virtual request.
	 * 
	 * @note This doesn't start with a slash or the virtual prefix.
	 * @note This will be `null` if the request doesn't have the virtual prefix.
	 * @note If the request is cross origin, this will always be `null`.
	 */
	virtualHref: Nullable<string>,
	/**
	 * The search parameters of the request.
	 */
	searchParams: URLSearchParams,
	/**
	 * A `URL` object constructed from `request.url`.
	 */
	urlObj: URL,

	/**
	 * If `request.mode` is `"navigate"` and it's a `GET` request.
	 */
	isPage: boolean,
	/**
	 * If the request is cross origin or not.
	 * 
	 * @note By default, Versioned Worker will set the mode of cross origin requests to `"force-passthrough"`, in which case they won't cause any of your hooks be called. To handle them anyway, you'll need to set the `VWRequestMode` back to `"default"` or another value. Alternatively, you can disable this behaviour by setting `autoPassthroughCrossOriginRequests` in your adapter config to `false`.
	 * 
	 * @see `VWRequestMode` for more information on request modes
	 */
	isCrossOrigin: boolean,
	/**
	 * The `VWRequestMode` of the request.
	 * 
	 * @see `VWRequestMode` for more information on Versioned Worker request modes
	 */
	vwMode: VWRequestMode,
	/**
	 * If the resource is in the cache list.
	 * 
	 * @note This will always be `false` if the request is cross origin
	 * @note This will always be `false` if the request isn't a `GET` or `HEAD` request
	 * @note Resources that were sorted as `"never-cache"` aren't included in the cache list
	 * 
	 * @see `isCrossOrigin` for checking if a request is cross origin
	 * @see `FileSortMode` in the module `"sveltekit-adapter-versioned-worker"` for more information on file sort modes
	 */
	inCacheList: boolean

	/**
	 * The underlying `Request` object given to the service worker as part of the `FetchEvent`.
	 * 
	 * @note You should make sure to use its `clone` method to create a copy if your `HandleFetchHook` consumes its body without returning a `Response`.
	 */
	request: Request,
	/**
	 * The underlying `FetchEvent` that Versioned Worker intercepted.
	 */
	event: FetchEvent
}
/**
 * A string union type representing the Versioned Worker mode of a request made by a client. To set the mode of a request, set the `vw-mode` header or search parameter to it.
 * 
 * Each causes the service worker to handle the request differently:
 * * `"default"` requests will call the `HandleFetchHook` and send its response to the client if it returns one. If it doesn't, Versioned Worker checks if it's been cached. If it's up-to-date or the resource's mode is `"stale-lazy"`, it's sent. If it was stale, it's updated in the background. If a response hasn't been sent, Versioned Worker tries to fetch it from the network. If that fails, or `response.ok` is `false`, an outdated version will be sent if available, otherwise an error response. Outdated `"strict-lazy"` resources can't be sent in this case, as they are removed from the cache once they become outdated.  
 * * `"no-network"` is similar to `"default"` except instead of trying the network, it will be treated as if it failed.
 * * `"handle-only"` will return an error response if the `HandleFetchHook` doesn't return a response.
 * * `"force-passthrough"` will stop Versioned Worker from handling the request and instead let the browser use its default behaviour.
 * 
 * @note Not to be confused by `Request`'s `"mode"` property.
 * 
 * @see `createURLWithVWMode` if you need to use a search parameter rather than a header for this
 * @see `FileSortMode` in the module `"sveltekit-adapter-versioned-worker"` for more information on file sort modes
 * @see `HandleFetchHook` for more information on handling fetches
 */
export type VWRequestMode = "default" | "no-network" | "handle-only" | "force-passthrough";

/**
 * The type of the optional export `handleCustomMessage` in your `"hooks.worker.ts"` file. The function is called when a client calls `messageActiveWorker` or `messageWaitingWorker`.
 * 
 * Currently you can't send a specific reply but you can use `broadcast` to trigger the `ServiceWorker` component's `"message"` event on all clients.
 * 
 * @note If you return a `Promise` or use an `async` function, Versioned Worker will request that the browser doesn't kill the service worker until the promise resolves.
 * 
 * @example
 * // hooks.worker.ts
 * 
 * // ...
 * import type { HandleCustomMessageHook } from "sveltekit-adapter-versioned-worker/worker";
 * // ...
 * import { broadcast } from "sveltekit-adapter-versioned-worker/worker";
 * // ...
 * 
 * type V1MessageToWorker = V1HiMessage | V1UnusedMessage; // Sent by clients
 * interface V1HiMessage {
 *   type: "sayHi"
 * }
 * interface V1UnusedMessage {
 *   type: "unused",
 *   // ^ The "unused" isn't anything Versioned Worker specific, it's just to demonstrate how to handle different types of messages
 *   unusedData: string
 * }
 * export interface V1MessageFromWorker { // Sent by service workers
 *   type: "alert",
 *   message: string
 * }
 * 
 * export const handleCustomMessage = (messageInfo => {
 *   if (messageInfo.isFromDifferentVersion) return;
 * 
 *   const data = messageInfo.data as V1MessageToWorker;
 *   if (data.type === "sayHi") {
 *     // Because of the check, data is now a V1HiMessage, so unusedData can't be accessed
 *     broadcast({
 *       type: "alert",
 *       message: "Hi!"
 *     } satisfies V1MessageFromWorker, false);
 *   }
 * }) satisfies HandleCustomMessageHook;
 */
export type HandleCustomMessageHook = (messageInfo: CustomMessageHookData) => MaybePromise<void>;
/**
 * The type of data provided to a `HandleCustomMessageHook`.
 * 
 * @note Make sure to check the `isFromDifferentVersion` property as the `data` will be wrapped in a `DataWithFormatVersion` object if it's `true`.
 * 
 * @see `CustomMessageData` for the semi-internal wrapper of data that gets directly postmessaged to or from the worker
 */
export type CustomMessageHookData = CustomMessageHookData.CurrentWorker | CustomMessageHookData.WaitingWorker;
export namespace CustomMessageHookData {
	/**
	 * The type of data received in the `HandleCustomMessageHook` of an active service worker.
	 * 
	 * @see `CustomMessageHookData.WaitingWorker` for the version of this that has the data wrapped in a `DataWithFormatVersion` object
	 * @see `CustomMessageData` for the semi-internal wrapper of data that gets directly postmessaged to or from the worker
	 */
	export type CurrentWorker = CustomCurrentWorkerMessageEventLikeData<ExtendableMessageEvent>;
	/**
	 * The type of data received in the `HandleCustomMessageHook` of a waiting service worker.
	 * 
	 * @see `CustomMessageHookData.CurrentWorker` for the version of this that doesn't have the data wrapped in a `DataWithFormatVersion` object
	 * @see `CustomMessageData` for the semi-internal wrapper of data that gets directly postmessaged to or from the worker
	 */
	export type WaitingWorker = CustomWaitingWorkerMessageEventLikeData<ExtendableMessageEvent>;
}

/**
 * The type of the optional export `handleResponse` in your `"hooks.worker.ts"` file. It allows you to modify a response before it's sent.
 * 
 * To modify the response, you can either return a new `Response` or modify the `responseInfo.response` object itself.
 * 
 * @note This won't be called for requests where any of the following are the case:
 * * A response was returned by `handleFetch`
 * * The request's `VWRequestMode` is set to `"force-passthrough"`
 * * The request was auto passthrough-ed, which is a behaviour that's disabled by default
 * 
 * @see `HandleFetchHook` for more information on handling requests
 * @see `AdapterConfig.enablePassthrough` for more information on enabling auto passthrough
 * 
 * @example
 * // hooks.worker.ts
 * 
 * // ...
 * import type { HandleResponseHook } from "sveltekit-adapter-versioned-worker/worker";
 * // ...
 * import { modifyResponseHeaders } from "sveltekit-adapter-versioned-worker/worker";
 * // ...
 * 
 * // Normally you'd use modifyResponseHeadersBeforeSending for this
 * export const handleResponse = ((_, { response }) => {
 *   // Modify all responses since we only know the answer, not the question
 *   return modifyResponseHeaders(response, {
 *     "the-meaning-of-life": "42"
 *   });
 * }) satisfies HandleResponseHook;
 * 
 * // ...
 */
export type HandleResponseHook = (requestInfo: VWRequest, responseInfo: VWResponse) => MaybePromise<Response | undefined | void>;
/**
 * The interface representing the data Versioned Worker provides about a response to a `HandleResponseHook`.
 */
export interface VWResponse {
	/**
	 * The `Response` object that will be sent if a different one isn't returned.
	 * 
	 * @note Make sure you use call `Response.clone()` and use that instead if you consume the response without returning a new one.
	 */
	response: Response,
	/**
	 * If the response was served from Versioned Worker's cache.
	 */
	isFromCache: boolean,
	/**
	 * If the response is outdated.
	 */
	isStale: boolean,
	/**
	 * If Versioned Worker encountered a network error while handling the request.
	 * 
	 * @note This will be `null` if the worker never fetched as part of the request in the first place.
	 * @note It will also be `null` for resources that have their `FileSortMode` set to `"lazy-cache"` unless they haven't been cached yet. This is because they're normally only updated in the background, so it's not known if it'll succeed at this point.
	 * @note This will be `false` if a non `ok` response was received by the client from the server.
	 * 
	 * @see `FileSortMode` in the module `"sveltekit-adapter-versioned-worker"` for more information on file sort modes
	 */
	didNetworkFail: Nullable<boolean>,
	/**
	 * The underlying `FetchEvent` that Versioned Worker intercepted.
	 */
	event: FetchEvent
}


/**
 * A number union representing the different Versioned Worker update priorities.
 * 
 * Each value has a different meaning:
 * * `0` means there's no updates to install.
 * * `1` is a patch update and means Versioned Worker will rely on reload opportunities to install the update, instead of prompting the user. However, an update's priority will be increased to `2` if:
 *     * The update was downloaded a day or more ago and 2 or more reload opportunities were blocked
 *     * Or if the update was downloaded 3 or more days ago, provided `AdapterConfig.enableSecondUpdatePriorityElevation` hasn't been set to `false`
 * * `2` is an elevated patch, and will trigger a dismissible prompt where the update isn't portrayed to be as noteworthy as a priority `3` update.
 * * `3` is a major update and also triggers a dismissible prompt. It's portrayed as being more noteworthy than a priority `2` update.
 * * And `4` is a critical update. Once downloaded, it triggers a fullscreen popup where the user has to choose to either reload immediately or in 60 seconds. This should only really be used if you've fixed an important vulnerability of some kind and you really need everyone to update. It's also worth noting that it currently appears to users that the reload could result in unsaved changes being discarded. This is because the `hasUnsavedChanges` store hasn't yet been implemented into Versioned Worker, meaning it just has to respond to `beforeunload` events stopping the reload and can't anticipate them.
 * 
 * @see `reloadOpportunity` in the module `"sveltekit-adapter-versioned-worker/svelte"` for more information on reload opportunities
 */
export type UpdatePriority = 0 | 1 | 2 | 3 | 4;

/**
 * A type representing a parsed version file in the service worker. This is mostly only intended to be used internally.
 */
export interface VersionFile {
	formatVersion: number,
	updated: string[][],
	updatePriorities: UpdatePriority[]
}


/**
 * The semi-internal type of a message sent to a service worker.
 */
export type InputMessageData = InputMessageVoidData | ConditionalSkipMessageData | CustomMessageData;
/**
 * The semi-internal string union type of `InputMessageData`'s `"type" property.
 */
export type InputMessageType = InputMessageVoidType | ConditionalSkipMessageData["type"] | CustomMessageData["type"];
/**
 * The semi-internal string union type of `InputMessageVoidData`'s `"type" property.
 */
export type InputMessageVoidType = "skipWaiting" | "finish" | "resume" | "getInfo";
/**
 * The semi-internal type of a message sent to a service worker that only contains a type and no other contents.
 */
export interface InputMessageVoidData {
	type: InputMessageVoidType
}
/**
 * The semi-internal type of a conditional skip message sent to a service worker. When sent, it requests that the worker skips waiting, provided there's only 1 client.
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
 * The semi-internal type of a custom message sent to a service worker.
 * 
 * @note Make sure to check the `isFromDifferentVersion` property as the `data` will be wrapped in a `DataWithFormatVersion` object if it's `true`.
 * 
 * @see `CustomMessageHookData` for the type of data received by a `HandleCustomMessageHook`
 * @see `messageActiveWorker` and `messageWaitingWorker` in the module `"sveltekit-adapter-versioned-worker/svelte`" for the functions that send this message
 */
export type CustomMessageData = CustomMessageData.CurrentWorker | CustomMessageData.WaitingWorker;
export namespace CustomMessageData {
	/**
	 * The semi-internal type of a custom message sent to the active service worker.
	 * 
	 * @see `CustomMessageData.WaitingWorker` for the version of this that has the data wrapped in a `DataWithFormatVersion` object
	 * @see `CustomMessageHookData` for the type of data received by a `HandleCustomMessageHook`
	 */
	export interface CurrentWorker extends CustomMessageDataBase {
		isFromDifferentVersion: false,
		/**
		 * The data that was postmessaged.
		 */
		data: unknown
	}
	/**
	 * The semi-internal type of a custom message sent to a waiting service worker.
	 * 
	 * @see `CustomMessageData.CurrentWorker` for the version of this that doesn't have the data wrapped in a `DataWithFormatVersion` object
	 * @see `CustomMessageHookData` for the type of data received by a `HandleCustomMessageHook`
	 */
	export interface WaitingWorker extends CustomMessageDataBase {
		isFromDifferentVersion: true,
		/**
		 * The data that was postmessaged.
		 */
		data: DataWithFormatVersion
	}
	interface CustomMessageDataBase {
		type: "vw-custom", // Since this same type is used for custom messages sent by service workers, it has the prefix
		/**
		 * If `data` comes from a different version or not. If this is `true`, the `data` will be wrapped in a `DataWithFormatVersion` object.
		 */
		isFromDifferentVersion: boolean
	}
}


/**
 * The semi-internal type of a message sent to a client from a service worker.
 */
export type OutputMessageData = OutputMessageVoidData | ResumeMessageData | WorkerInfoMessageData | CustomMessageData;
/**
 *  The semi-internal string union type of `OutputMessageData`'s `"type" property.
 */
export type OutputMessageType = OutputMessageVoidType | ResumeMessageData["type"] | WorkerInfoMessageData["type"] | CustomMessageData["type"];
/**
 * The semi-internal string union type of `OutputMessageVoidData`'s `"type" property.
 * 
 * @note `"vw-updateWithResumable"` is a response to a `"conditionalSkipWaiting"` input. 
 */
export type OutputMessageVoidType = "vw-reload" | "vw-updateWithResumable" | "vw-skipFailed";
/**
 * The semi-internal type of a message sent to a client from a service worker that only contains a type and no other contents.
 */
export interface OutputMessageVoidData {
	type: OutputMessageVoidType
}
/**
 * The semi-internal type of a resume message sent to a client by a service worker. When received by a client, the `data` is used to put the app back in a similar state to how it was before the update.
 * 
 * @see `ResumableState` for more information
 */
export interface ResumeMessageData {
	type: "vw-resume",
	data: Nullable<ResumableState>
}
/**
 * The semi-internal type of a worker info message sent to a client by a service worker. It provides some information about a service worker.
 * 
 * @see `getActiveWorkerInfo` and `getWaitingWorkerInfo` in the module `"sveltekit-adapter-versioned-worker/svelte"` for the more common way to get this information
 */
export interface WorkerInfoMessageData {
	type: "vw-info",
	info: WorkerInfo
}

/**
 * An alias for `DataWithFormatVersion`.
 * 
 * When `reloadOpportunity` is called, you can give it a `ResumableState` object or a `ResumableStateCallback`. This allows your web app to resume from a similar state to how it was before the page reloaded. Do this by `await`ing a call of `resumeState` in an `onMount`. If it resolves to another `ResumableState` object, you can use the data to put the app back into a similar state to before.
 * 
 * @see `reloadOpportunity` and `resumeState` in the module `"sveltekit-adapter-versioned-worker/svelte"` for the methods that use it
 */
export type ResumableState = DataWithFormatVersion;
/**
 * The type of a function that returns a `ResumableState` object or a promise for one.
 * 
 * @see `reloadOpportunity` in the module `"sveltekit-adapter-versioned-worker/svelte"` for the function that uses it
 */
export type ResumableStateCallback = () => MaybePromise<ResumableState>;

/**
 * The type of an information object from a service worker.
 * 
 * @note If the object is from a future service worker, make sure you type narrow using `majorFormatVersion` and possibly `minorFormatVersion`, as the format might have changed.
 * 
 * @see `getActiveWorkerInfo` and `getWaitingWorkerInfo` in the module `"sveltekit-adapter-versioned-worker/svelte"` for how to get this information
 */
export type WorkerInfo = KnownMajorVersionWorkerInfo | UnknownWorkerInfo;
/**
 * The type of an information object from a service worker that uses an unknown `majorFormatVersion`. You likely can't do much with this object as it comes from a future service worker, but your code should have a fail-safe for this situation.
 */
export interface UnknownWorkerInfo {
	/**
	 * The major format version of this worker info. Different values *aren't* backwards or forwards compatible.
	 * 
	 * @note This could be any number other than `KnownMajorVersionWorkerInfo.majorFormatVersion`, but this has to be approximated in TypeScript as the latest known major version + 1.
	 */
	majorFormatVersion: 2
}
/**
 * The type of info data from a service worker that uses the `majorFormatVersion` and `minorFormatVersion` of `1`.
*/
export interface WorkerV1Info extends WorkerMajorV1InfoBase {
	/**
	 * The minor format version of this worker info. Unlike with major versions, this is forwards and backwards compatible. Just note that some properties might only exist in newer minor versions.
	 * 
	 * @note This could be any number other than `WorkerMajorV1KnownMinorInfo.minorFormatVersion`, but this has to be approximated in TypeScript as the latest known minor version + 1.
	 */
	minorFormatVersion: 1
}
/**
 * The type of info data from a service worker that uses the `majorFormatVersion` of `1` and an unknown `minorFormatVersion`.
*/
export interface WorkerMajorV1UnknownMinorInfo extends WorkerMajorV1InfoBase {
	/**
	 * The minor format version of this worker info. Unlike with major versions, this is forwards and backwards compatible. Just note that some properties might only exist in newer minor versions.
	 * 
	 * @note This could be any number other than `WorkerMajorV1KnownMinorInfo.minorFormatVersion`, but this has to be approximated in TypeScript as the latest known minor version + 1.
	 */
	minorFormatVersion: 2
}
interface WorkerMajorV1InfoBase {
	/**
	 * The major format version of this worker info. Different values *aren't* backwards or forwards compatible.
	 * 
	 * @note This could be any number other than `KnownMajorVersionWorkerInfo.majorFormatVersion`, but this has to be approximated in TypeScript as the latest known major version + 1.
	 */
	majorFormatVersion: 1,
	minorFormatVersion: number,
	
	version: number,
	templateVersion: number,
	timeInstalled: number,
	blockedInstallCount: number,
	updatePriority: UpdatePriority
}

/**
 * The type of info data from a service worker that uses the `majorFormatVersion` of `1` any `minorFormatVersion`.
 */
export type KnownMajorVersionWorkerInfo = WorkerMajorV1KnownMinorInfo | WorkerMajorV1UnknownMinorInfo;
/**
 * The type of info data from a service worker that uses the `majorFormatVersion` of `1` a known `minorFormatVersion`.
 */
export type WorkerMajorV1KnownMinorInfo = WorkerV1Info;

/* Worker types */
// Adapted from https://gist.github.com/ithinkihaveacat/227bfe8aa81328c5d64ec48f4e4df8e5 by Tiernan Cridland under ISC license

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
export interface ExtendableMessageEvent<T = unknown> extends ExtendableEvent {
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
 * // In an ambient d.ts file or, so you don't affect your other files, in your hooks.worker.ts file. You may prefer to use a static import for the second case.
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
 * // In an ambient d.ts file or, so you don't affect your other files, in your hooks.worker.ts file. You may prefer to use a static import for the second case.
 * declare var registration: ServiceWorkerRegistration; // Or import("sveltekit-adapter-versioned-worker/worker").Registration
 */
export type Registration = ServiceWorkerRegistration;

/**
 * @note This is just a type. To access the variable in the worker, you need to declare it as a variable.
 * 
 * @example
 * // In an ambient d.ts file or, so you don't affect your other files, in your hooks.worker.ts file. You may prefer to use a static import for the second case.
 * declare var skipWaiting: import("sveltekit-adapter-versioned-worker/worker").SkipWaiting;
 */
export type SkipWaiting = () => Promise<void>;

/**
 * @note This is just a type. To access the variable in the worker, you need to declare it as a variable.
 * 
 * @example
 * // In an ambient d.ts file or, so you don't affect your other files, in your hooks.worker.ts file. You may prefer to use a static import for the second case.
 * declare var addEventListener: import("sveltekit-adapter-versioned-worker/worker").AddEventListener;
 */
export type AddEventListener = <K extends keyof ServiceWorkerGlobalScopeEventMap>(type: K, listener: ((this: typeof globalThis, event: ServiceWorkerGlobalScopeEventMap[K]) => any)) => void;
export interface ServiceWorkerGlobalScopeEventMap {
	install: InstallEvent,
	activate: ActivateEvent,
	fetch: FetchEvent,
	message: ExtendableMessageEvent,

	notificationclick: NotificationEvent,
	notificationclose: NotificationEvent,
	push: PushEvent,
	sync: SyncEvent
}


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
 * @see `VWRequestMode` for more information on request modes
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
 * A function returning a `HandleResponseHook` that modifies the service worker's responses before they're sent.
 * 
 * @param newHeaders The headers to change. Set the value to `null` to remove a header.
 * @param conditionCallback A callback that returns `true` if the response should be modified, otherwise it'll be left unchanged.
 * @returns A `HandleResponseHook` that modifies the service worker's responses before they're sent.
 */
export function modifyResponseHeadersBeforeSending(newHeaders: Record<string, Nullable<string>>, conditionCallback: (requestInfo: VWRequest, responseInfo: VWResponse) => MaybePromise<boolean>): HandleResponseHook {
	return async (requestInfo, responseInfo) => {
		if (! (await conditionCallback(requestInfo, responseInfo))) return;

		return modifyResponseHeaders(responseInfo.response, newHeaders);
	};
}
/**
 * A function returning a `HandleResponseHook` that makes the site cross origin isolated. You might find this useful if you can't change the headers your server sends.
 * 
 * @returns A `HandleResponseHook` that makes the site cross origin isolated.
 * 
 * @see
 * https://web.dev/cross-origin-isolation-guide/
 */
export function modifyResponsesToCrossOriginIsolateApp(): HandleResponseHook {
	return modifyResponseHeadersBeforeSending({
		"Cross-Origin-Opener-Policy": "same-origin",
		"Cross-Origin-Embedder-Policy": "require-corp"
	}, ({ isPage }) => isPage);
}

/**
 * Sends a custom message to all clients* which can be received via the `"message"` event on the `ServiceWorker` component.
 * 
 * \*At least all *controlled* clients. You can include uncontrolled clients by passing `true` as the 2nd parameter.
 * 
 * @param message The message to send. If `includeUncontrolled` is `true`, this must be wrapped in a `DataWithFormatVersion` object.
 * @param includeUncontrolled If uncontrolled clients should be included. Set this to `true` if you're sending from a waiting worker.
 * @returns A void promise.
 * 
 * @note Generally the returned promise should be ignored as it doesn't indicate when the message is received. However, it does indicate when postmessage has been called on all the `Client`s.
 * 
 * @see `ServiceWorker`'s events in the module `"sveltekit-adapter-versioned-worker/svelte"` for more information on receiving these messages
 */
export async function broadcast(message: DataWithFormatVersion, includeUncontrolled: true): Promise<void>;
/**
 * Sends a custom message to all clients* which can be received via the `"message"` event on the `ServiceWorker` component.
 * 
 * \*At least all *controlled* clients. You can include uncontrolled clients by passing `true` as the 2nd parameter.
 * 
 * @param message The message to send. If `includeUncontrolled` is `true`, this must be wrapped in a `DataWithFormatVersion` object.
 * @param includeUncontrolled If uncontrolled clients should be included. Set this to `true` if you're sending from a waiting worker.
 * @returns A void promise.
 * 
 * @note Generally the returned promise should be ignored as it doesn't indicate when the message is received. However, it does indicate when postmessage has been called on all the `Client`s.
 * 
 * @see `ServiceWorker`'s events in the module `"sveltekit-adapter-versioned-worker/svelte"` for more information on receiving these messages
 */
export async function broadcast(message: unknown, includeUncontrolled: false): Promise<void>;
/**
 * Sends a custom message to all clients* which can be received via the `"message"` event on the `ServiceWorker` component.
 * 
 * \*At least all *controlled* clients. You can include uncontrolled clients by passing `true` as the 2nd parameter.
 * 
 * @param message The message to send. If `includeUncontrolled` is `true`, this must be wrapped in a `DataWithFormatVersion` object.
 * @param includeUncontrolled If uncontrolled clients should be included. Set this to `true` if you're sending from a waiting worker.
 * @returns A void promise.
 * 
 * @note Generally the returned promise should be ignored as it doesn't indicate when the message is received. However, it does indicate when postmessage has been called on all the `Client`s.
 * 
 * @see `ServiceWorker`'s events in the module `"sveltekit-adapter-versioned-worker/svelte"` for more information on receiving these messages
 */
export async function broadcast(message: unknown, includeUncontrolled: boolean) {
	broadcastInternal((await clients.matchAll({ includeUncontrolled })) as WindowClient[], {
		type: "vw-custom",
		isFromDifferentVersion: includeUncontrolled,
		data: message
	} as CustomMessageData);
}