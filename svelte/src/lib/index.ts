import type {
	OutputMessageData,
	ResumableState,
	ResumableStateCallback
} from "internal-adapter/worker";

import { beforeNavigate } from "$app/navigation";
import { internalState, skipIfWaiting } from "$lib/internal.js"; 
import { waitForEventWithTimeout } from "$util";

type Nullable<T> = T | null;


/**
 * The name of the `SessionStorage` item that remembers if there was any resumable state.
 * 
 * @note This is mostly only intended to be used internally.
 */
export const RESUMABLE_STATE_NAME = "vw-hasResumableState";
/**
 * TODO
 */
export const RESUMABLE_STATE_TIMEOUT = 10000;

/**
 * Tells Versioned Worker that it's ok to reload the page for an update now.
 * 
 * @param navigateTo An optional URL to navigate to as part of the reload.
 * @param data An optional `ResumableState` object. If creating it uses significant resources, provide a `ResumableStateCallback` instead as it will only be called if there's an update.
 * 
 * @note This works independently to `isReloadOnNavigateAllowed`, as when that's `true` it essentially just calls this function automatically.
 * @note If you're calling this within a `beforeNavigate`, make sure you pass `navigation.to?.url.toString()` as the first argument.
 */
export function reloadOpportunity(navigateTo?: string, data?: ResumableState | ResumableStateCallback) {
	// TODO: use both arguments
	// TODO: keep worker alive using waituntil in activate until the message is posted

	skipIfWaiting();
}

/**
 * TODO
 * 
 * @note This function uses a `SessionStorage` call, which are synchronous.
 */
export function checkIfResumableState(): boolean {
	return sessionStorage.getItem(RESUMABLE_STATE_NAME) === "1";
}
/**
 * TODO
 * 
 * @param guaranteeState Set this to `true` if you've already ensured there's some resumable state as this prevents a second `SessionStorage` call, which are synchronous. Otherwise leave it at its default of `false`.
 * @returns A promise resolving to a `ResumableState` object or `null` if there was no state.
 */
export async function resumeState(guaranteeState = false): Promise<Nullable<ResumableState>> {
	if (! internalState.registration) return null;
	if (! (guaranteeState || checkIfResumableState())) return null;

	while (true) {
		const { data } = <{ data: OutputMessageData }>(await waitForEventWithTimeout(
			internalState.registration,
			"message" satisfies keyof ServiceWorkerContainerEventMap,
			RESUMABLE_STATE_TIMEOUT
		) as MessageEvent);
		
		if (data.type === "vw-resume") {
			sessionStorage.removeItem(RESUMABLE_STATE_NAME);
			return data.data;
		}
	}
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

// @ts-ignore
export { default as ServiceWorker } from "./ServiceWorker.svelte";