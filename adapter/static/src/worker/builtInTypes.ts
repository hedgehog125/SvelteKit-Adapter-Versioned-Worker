// Credit: Tiernan Cridland under ISC license: https://gist.github.com/ithinkihaveacat/227bfe8aa81328c5d64ec48f4e4df8e5
// I just removed some types that are now built-in, and adapted it to a d.ts file

declare interface ExtendableEvent extends Event {
	waitUntil(fn: Promise<any>): void;
};
declare interface ServiceWorkerNotificationOptions {
	tag?: string;
};
declare interface CacheStorageOptions {
	cacheName?: string;
	ignoreMethod?: boolean;
	ignoreSearch?: boolean;
	ignoreVary?: boolean;
};
declare interface Client {
	frameType: ClientFrameType;
	id: string;
	url: string;
};
declare interface Clients {
	claim(): Promise<any>;
	get(id: string): Promise<Client>;
	matchAll(options?: ClientMatchOptions): Promise<Array<Client>>;
	openWindow(url: string): Promise<WindowClient>;
};
declare interface ClientMatchOptions {
	includeUncontrolled?: boolean;
	type?: ClientMatchTypes;
};
declare interface WindowClient {
	focused: boolean;
	visibilityState: WindowClientState;
	focus(): Promise<WindowClient>;
	navigate(url: string): Promise<WindowClient>;
}

declare type ClientFrameType = "auxiliary" | "top-level" | "nested" | "none";
declare type ClientMatchTypes = "window" | "worker" | "sharedworker" | "all";
declare type WindowClientState = "hidden" | "visible" | "prerender" | "unloaded";

declare interface FetchEvent extends ExtendableEvent { // Slight fix I made: extends ExtendableEvent rather than just Event
	request: Request;
	respondWith(response: Promise<Response>|Response): Promise<Response>;
};
declare interface InstallEvent extends ExtendableEvent {
	activeWorker: ServiceWorker
};
declare interface ActivateEvent extends ExtendableEvent { };

declare interface NotificationEvent {
	action: string;
	notification: Notification;
};
declare interface PushMessageData {
	arrayBuffer(): ArrayBuffer;
	blob(): Blob;
	json(): any;
	text(): string;
};
interface PushEvent extends ExtendableEvent {
	data: PushMessageData;
};
declare interface SyncEvent extends Event {
	lastChance: boolean;
	tag: string;
};

declare var clients: Clients;
declare var onactivate: (event?: ExtendableEvent) => any;
declare var onfetch: (event?: FetchEvent) => any;
declare var oninstall: (event?: ExtendableEvent) => any;
declare var onnotificationclick: (event?: NotificationEvent) => any;
declare var onnotificationclose: (event?: NotificationEvent) => any;
declare var onpush: (event?: PushEvent) => any;
declare var onsync: (event?: SyncEvent) => any;
declare var registration: ServiceWorkerRegistration;
declare function skipWaiting(): void;