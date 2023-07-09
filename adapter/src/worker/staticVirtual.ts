// This is appended to the constants exported from the worker module, so it's only accessible in the service worker
// Note: This file is transpiled to JavaScript before the build
// Note: This is then re-exported by the worker.d.ts file

import { workerState } from "sveltekit-adapter-versioned-worker/internal/worker-shared"; 
import { summarizeRequest } from "sveltekit-adapter-versioned-worker/internal/worker-util-alias";

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

	const fetchPromise = fetch(request);
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