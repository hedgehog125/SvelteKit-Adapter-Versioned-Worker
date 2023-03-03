// Credit: Tiernan Cridland under ISC license: https://gist.github.com/ithinkihaveacat/227bfe8aa81328c5d64ec48f4e4df8e5
// I just removed some types that are now built-in

export interface ExtendableEvent extends Event {
	waitUntil(fn: Promise<any>): void;
};
export interface ServiceWorkerNotificationOptions {
	tag?: string;
};
export type ServiceWorkerState = "installing" | "installed" | "activating" | "activated" | "redundant";
export interface CacheStorageOptions {
	cacheName?: string;
	ignoreMethod?: boolean;
	ignoreSearch?: boolean;
	ignoreVary?: boolean;
};
export interface Client {
	frameType: ClientFrameType;
	id: string;
	url: string;
};
export interface Clients {
	claim(): Promise<any>;
	get(id: string): Promise<Client>;
	matchAll(options?: ClientMatchOptions): Promise<Array<Client>>;
	openWindow(url: string): Promise<WindowClient>;
};
export interface ClientMatchOptions {
	includeUncontrolled?: boolean;
	type?: ClientMatchTypes;
};
export interface WindowClient {
	focused: boolean;
	visibilityState: WindowClientState;
	focus(): Promise<WindowClient>;
	navigate(url: string): Promise<WindowClient>;
}

export type ClientFrameType = "auxiliary" | "top-level" | "nested" | "none";
export type ClientMatchTypes = "window" | "worker" | "sharedworker" | "all";
export type WindowClientState = "hidden" | "visible" | "prerender" | "unloaded";

export interface FetchEvent extends ExtendableEvent { // Slight fix I made: extends ExtendableEvent rather than just Event
	request: Request;
	respondWith(response: Promise<Response>|Response): Promise<Response>;
};
export interface InstallEvent extends ExtendableEvent {
	activeWorker: ServiceWorker
};
export interface ActivateEvent extends ExtendableEvent { };

export type ReferrerPolicy = "" | "no-referrer" | "no-referrer-when-downgrade" | "origin-only" | "origin-when-cross-origin" | "unsafe-url";
export type RequestCache = "default" | "no-store" | "reload" | "no-cache" | "force-cache";
export type RequestCredentials = "omit" | "same-origin" | "include";
export type RequestMode = "cors" | "no-cors" | "same-origin" | "navigate";
export type RequestRedirect = "follow" | "error" | "manual";
export type ResponseType = "basic" | "cores" | "error" | "opaque";

export interface NotificationEvent {
	action: string;
	notification: Notification;
};
export interface PushMessageData {
	arrayBuffer(): ArrayBuffer;
	blob(): Blob;
	json(): any;
	text(): string;
};
interface PushEvent extends ExtendableEvent {
	data: PushMessageData;
};
export interface SyncEvent extends Event {
	lastChance: boolean;
	tag: string;
};

export declare var clients: Clients;
export declare var onactivate: (event?: ExtendableEvent) => any;
export declare var onfetch: (event?: FetchEvent) => any;
export declare var oninstall: (event?: ExtendableEvent) => any;
export declare var onmessage: (event: MessageEvent) => any;
export declare var onnotificationclick: (event?: NotificationEvent) => any;
export declare var onnotificationclose: (event?: NotificationEvent) => any;
export declare var onpush: (event?: PushEvent) => any;
export declare var onsync: (event?: SyncEvent) => any;
export declare var registration: ServiceWorkerRegistration;
export declare function skipWaiting(): void;