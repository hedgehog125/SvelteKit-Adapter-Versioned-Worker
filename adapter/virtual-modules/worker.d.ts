export type HandleHook = (path: string, isPage: boolean, e: FetchEvent, fullPath: string) => Promise<Response | null> | Response | null;

export const ROUTES: string[];
	
export const PRECACHE: string[];
export const LAX_LAZY: string[];
export const STALE_LAZY: string[];
export const STRICT_LAZY: string[];
export const SEMI_LAZY: string[];

export const STORAGE_PREFIX: string;
export const VERSION: number;
export const VERSION_FOLDER: string;
export const VERSION_FILE_BATCH_SIZE: number;
export const MAX_VERSION_FILES: number;
export const BASE_URL: string;

export interface VersionFile {
	formatVersion: number,
	updated: string[][]
}

export interface MessageEventData {
	type: string,
	[property: string]: unknown
}
export interface MessageEventWithTypeProp extends MessageEvent {
	data: MessageEventData
}


/* Worker types */
// Adapted from https://gist.github.com/ithinkihaveacat/227bfe8aa81328c5d64ec48f4e4df8e5 by Tiernan Cridland under ISC license:

// Events
export interface ExtendableEvent extends Event {
	waitUntil(fn: Promise<any>): void;
}
export interface FetchEvent extends ExtendableEvent {
	request: Request;
	respondWith(response: Promise<Response>|Response): Promise<Response>;
}
export interface InstallEvent extends ExtendableEvent {
	activeWorker: ServiceWorker
}
export interface ActivateEvent extends ExtendableEvent { }
export interface NotificationEvent {
	action: string;
	notification: Notification;
}
export interface PushEvent extends ExtendableEvent {
	data: PushMessageData;
}
export interface SyncEvent extends Event {
	lastChance: boolean;
	tag: string;
}

export interface PushMessageData {
	arrayBuffer(): ArrayBuffer;
	blob(): Blob;
	json(): unknown;
	text(): string;
}


// Misc
export interface ServiceWorkerNotificationOptions {
	tag?: string;
}
export interface CacheStorageOptions {
	cacheName?: string;
	ignoreMethod?: boolean;
	ignoreSearch?: boolean;
	ignoreVary?: boolean;
}

export interface Client {
	frameType: ClientFrameType;
	id: string;
	url: string;

	// Based off the built-in lib.dom.d.ts
    postMessage(message: any, transfer?: Transferable[]): void;
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
	claim(): Promise<void>;
	get(id: string): Promise<Client>;
	matchAll(options?: ClientMatchOptions): Promise<Array<Client>>;
	openWindow(url: string): Promise<WindowClient>;
}
export interface ClientMatchOptions {
	includeUncontrolled?: boolean;
	type?: ClientMatchTypes;
}
export interface WindowClient {
	focused: boolean;
	visibilityState: WindowClientState;
	focus(): Promise<WindowClient>;
	navigate(url: string): Promise<WindowClient>;
}

export type ClientFrameType = "auxiliary" | "top-level" | "nested" | "none";
export type ClientMatchTypes = "window" | "worker" | "sharedworker" | "all";
export type WindowClientState = "hidden" | "visible" | "prerender" | "unloaded";

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
export type SkipWaiting = () => void;