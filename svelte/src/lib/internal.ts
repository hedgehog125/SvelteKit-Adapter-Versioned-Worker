import type { InputMessageData } from "internal-adapter/worker";

export interface InternalState {
	registration?: ServiceWorkerRegistration
}

export const internalState: InternalState = {};


export function skipIfWaiting() {
	console.log(internalState.registration?.waiting); // TODO
	if (internalState.registration?.waiting) {
		skipWaiting(internalState.registration.waiting);
	}
}
export function skipWaiting(waitingWorker: ServiceWorker) {
	console.log("Skipped"); // TODO
	waitingWorker.postMessage({ type: "conditionalSkipWaiting" } satisfies InputMessageData);
}