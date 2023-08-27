import type { MaybePromise } from "$lib/index_internal.js";
import type { VWRequestMode } from "internal-adapter/worker";
import type { BeforeNavigate } from "@sveltejs/kit";

import { onMount } from "svelte";
import { base } from "$app/paths";

type Nullable<T> = T | null;

/**
 * TODO
 * 
 * @param relativePath TODO. It shouldn't start with a slash.
 * @returns 
 * 
 * @note If it's a page and you've enabled trailing slashes in your SvelteKit config, `relativePath` should end with a slash.
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
 * 
 * @param callback 
 * @returns 
 */
export function loadOnMount<T>(callback: () => MaybePromise<T>): Promise<T> {
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
 */
export function range(maxExclusive: number, minInclusive = 0): number[] {
	return Array.from(new Array((maxExclusive - minInclusive)), (_, index) => index + minInclusive);
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

export interface Listenable {
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

export { ExposedPromise } from "internal-adapter/internal/exported-by-svelte-module";