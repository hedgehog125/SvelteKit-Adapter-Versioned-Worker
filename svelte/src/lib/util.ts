import type { VWRequestMode } from "internal-adapter/worker";

import { onMount } from "svelte";
import { base } from "$app/paths";
import { VIRTUAL_FETCH_PREFIX } from "internal-adapter/worker/util";

export {
	VIRTUAL_FETCH_PREFIX
};

/**
 * TODO
 * 
 * @param relativePath 
 * @returns 
 */
export function link(relativePath: string): string {
	if (base === "") return `/${relativePath}`;
	
	return base + relativePath;
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
 */
export function waitForEvent(listenable: Listenable, eventName: string): Promise<Event> {
	return new Promise(resolve => {
		listenable.addEventListener(eventName, resolve, {
			once: true
		});
	});
}