import type { MaybePromise } from "$lib/index_internal.js";
import type { VWRequestMode } from "internal-adapter/worker";
import type { BeforeNavigate } from "@sveltejs/kit";

import { onMount } from "svelte";
import { base } from "$app/paths";

type Nullable<T> = T | null;

/**
 * Takes a `relativePath` and adds the base URL to it.
 * 
 * @param relativePath The relative path to turn into an absolute path. It shouldn't start with a slash.
 * @returns An absolute path.
 * 
 * @note If it's a page and you've enabled trailing slashes in your SvelteKit config, `relativePath` should end with a slash.
 */
export function link(relativePath: string): string {
	return `${base}/${relativePath}`;
}
/**
 * @param navigation The `BeforeNavigate` object to get the destination URL of
 * @returns The destination URL of `navigation`.
 * 
 * @note This function will return `null` if `navigation` doesn't have a destination.
 */
export function getNavigationDestURL(navigation: BeforeNavigate): Nullable<string> {
	return navigation.to?.url.toString()?? null;
}

/**
 * A utility for more easily loading data when a component mounts.
 * 
 * @param callback A, usually `async`, function that's called when your component mounts.
 * @returns A promise that resolves or rejects with what your `callback` does.
 * 
 * @example
 * <script lang="ts">
 *   const loadPromise = loadOnMount(async () => {
 *     const res = await fetch("https://api.example.com/get-something");
 *     return await res.text();
 *   });
 * </script>
 * 
 * <p>
 *   {#await loadPromise}
 *     Loading...
 *   {:then text}
 *     Got: {text}
 *   {:catch}
 *     Failed to fetch.
 *   {/await}
 * </p>
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
 * @param maxExclusive One more than the highest number to include
 * @param minInclusive The lowest number to include in the range
 * @returns An integer array with the specified range.
 */
export function range(maxExclusive: number, minInclusive = 0): number[] {
	return Array.from(new Array((maxExclusive - minInclusive)), (_, index) => index + minInclusive);
}

/**
 * @param url The URL to change the search parameters of
 * @param searchParams The search parameters to add
 * @returns A `URL` object with the provided `searchParams`.
 */
export function createURLWithSearchParams(url: string, searchParams: Record<string, string>): URL {
	const urlObject = new URL(url);
	Object.entries(searchParams).forEach(([name, value]) => {
		urlObject.searchParams.set(name, value);
	});
	return urlObject;
}

/**
 * @param url The URL to modify.
 * @param vwMode The `VWRequestMode` to use
 * @returns A new URL with the search parameter `"vw-mode"` set to `vwMode`.
 * 
 * @note You can also set the HTTP header `"vw-mode"` to a `VWRequestMode` instead of using a search parameter.
 * 
 * @see `VWRequestMode` in the module `"sveltekit-adapter-versioned-worker/worker"` for more information on request modes
 */
export function createURLWithVWMode(url: string, vwMode: VWRequestMode): string {
	return createURLWithSearchParams(url, { "vw-mode": vwMode }).toString();
}

/**
 * The type of something that has `addEventListener` and `removeEventListener` functions.
 */
export interface Listenable {
	addEventListener: typeof addEventListener,
	removeEventListener: typeof removeEventListener
}
/**
 * A utility function for waiting for an `Event`.
 * 
 * @param listenable The thing to wait for it to emit an event with the name of `eventName`
 * @param eventName The name of the event to wait for, e.g `"load"`
 * @param signal An optional signal to use to stop listening
 * @returns A promise resolving with to an `Event` when the `listenable` emits it.
 * 
 * @see `waitForEventWithTimeout` if you want to add a timeout
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
 * 
 * @param listenable The thing to wait for it to emit an event with the name of `eventName`
 * @param eventName The name of the event to wait for, e.g `"load"`
 * @param timeout The maximum number of milliseconds to wait for the event before cancelling it
 * @returns A promise resolving with to an `Event` when the `listenable` emits it.
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
 * @param delay The number of milliseconds before the returned promise should resolve
 * @returns A promise resolving to `null` when `delay` milliseconds have passed.
 */
export function timeoutPromise(delay: number): Promise<null> {
	return new Promise(resolve => {
		setTimeout(() => resolve(null), delay);
	});
}

export { ExposedPromise } from "internal-adapter/internal/exported-by-svelte-module";