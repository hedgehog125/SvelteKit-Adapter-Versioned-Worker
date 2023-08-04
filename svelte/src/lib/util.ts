import type { VWRequestMode } from "internal-adapter/worker";
import type { BeforeNavigate } from "@sveltejs/kit";

import { onMount } from "svelte";
import { base } from "$app/paths";
import { VIRTUAL_FETCH_PREFIX } from "internal-adapter/worker/util";

export {
	VIRTUAL_FETCH_PREFIX
};

type Nullable<T> = T | null;

/**
 * TODO
 * 
 * @param relativePath TODO. It shouldn't start with a slash but it should end with one, if it's a page and you've enabled trailing slashes in your SvelteKit config.
 * @returns 
 */
export function link(relativePath: string): string {
	return `${base}/${relativePath}`;
}
/**
 * TODO
 */
export function getNavigationDestURL(navigation: BeforeNavigate): Nullable<string> {
	return navigation.to?.url.toString()?? null;
}
/**
 * TODO
 */
export class ExposedPromise<T = void> extends Promise<T> {
	public resolve: ExposedPromise.ResolveCallback<T>;
	public reject: ExposedPromise.RejectCallback;

	constructor() {
		let _resolve!: ExposedPromise.ResolveCallback<T>, _reject!: ExposedPromise.RejectCallback;
		super((__resolve, __reject) => {
			_resolve = __resolve;
			_reject = __reject;
		});

		this.resolve = _resolve;
		this.reject = _reject;	
	}
}
export namespace ExposedPromise {
	export type ResolveCallback<T> = (value: T | PromiseLike<T>) => void;
	export type RejectCallback = (reason?: any) => void;
}

/**
 * TODO
 * 
 * @param url 
 * @param init 
 * @returns 
 */
export async function quickFetch(url: string, init?: RequestInit): Promise<Response> {
	if (navigator.serviceWorker?.controller) {
		let specifiedHeaders: string[] = [...new Headers(init?.headers).keys()];

		// TODO: error if it's disabled
		const modifiedURL = new URL(link(`${VIRTUAL_FETCH_PREFIX}quick-fetch`), location.origin);
		modifiedURL.searchParams.set("url", url);
		modifiedURL.searchParams.set("specified", JSON.stringify(specifiedHeaders));

		url = modifiedURL.toString();
	}

	return await fetch(url, init);
}

/**
 * TODO
 * 
 * @param callback 
 * @returns 
 */
export function loadOnMount<T>(callback: () => Promise<T> | T): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		onMount(async () => {
			try {
				resolve(await callback());
			}
			catch (error) {
				reject(error);
			}
		});
	});
}

/**
 * TODO
 * 
 * @param url 
 * @param searchParams 
 * @returns 
 */
export function createURLWithSearchParams(url: string, searchParams: Record<string, string>): URL {
	const urlObject = new URL(url);
	Object.entries(searchParams).forEach(([name, value]) => {
		urlObject.searchParams.set(name, value);
	});
	return urlObject;
}

/**
 * TODO
 * 
 * @param url 
 * @param vwMode 
 * @returns 
 */
export function createURLWithVWMode(url: string, vwMode: VWRequestMode): string {
	return createURLWithSearchParams(url, { "vw-mode": vwMode }).toString();
}

interface Listenable {
	addEventListener: typeof addEventListener,
	removeEventListener: typeof removeEventListener
}
/**
 * TODO
 * 
 * @param listenable 
 * @param eventName 
 * @param signal 
 */
export function waitForEvent(listenable: Listenable, eventName: string, signal?: AbortSignal): Promise<Event> {
	return new Promise((resolve, reject) => {
		signal?.addEventListener("abort", () => {
			listenable.removeEventListener(eventName, resolve);
			reject(new Error("AbortError"));
		});

		listenable.addEventListener(eventName, resolve, {
			once: true
		});
	});
}

/**
 * TODO
 * 
 * @note The promise will resolve to `null` if the listener times out. Make sure you check for it before casting to a more specific event.
 */
export async function waitForEventWithTimeout(listenable: Listenable, eventName: string, timeout: number): Promise<Nullable<Event>> {
	const abortController = new AbortController();
	const timeoutTask = setTimeout(() => abortController.abort(), timeout);

	let event: Event;
	try {
		event = await waitForEvent(listenable, eventName, abortController.signal);
	}
	catch {
		return null;
	}

	clearTimeout(timeoutTask);
	return event;
};

/**
 * TODO
 */
export function timeoutPromise(delay: number): Promise<null> {
	return new Promise(resolve => {
		setTimeout(() => resolve(null), delay);
	});
}