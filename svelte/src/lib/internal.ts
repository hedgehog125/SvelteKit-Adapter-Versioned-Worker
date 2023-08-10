import { ExposedPromise } from "$util";
import type {
	InputMessageData,
	ResumableState
} from "internal-adapter/worker";

type Nullable<T> = T | null;

export interface InternalState {
	registration?: ServiceWorkerRegistration,
	navigatingTo: Nullable<string>,
	resumableStatePromise: ExposedPromise<Nullable<ResumableState>>,
	/**
	 * When the `resumableState` promise resolves, it will be set to another promise. This variable stores what it resolved to until the state is read as part of the function `resumeState` and set back to `null`.
	 */
	waitingResumableState: Nullable<ResumableState>
}

export const internalState: InternalState = {
	navigatingTo: null,
	resumableStatePromise: new ExposedPromise(),
	waitingResumableState: null
};


export function skipIfWaiting(resumableState: Nullable<ResumableState> | true): boolean {
	if (internalState.registration?.waiting) {
		skipWaiting(internalState.registration.waiting, resumableState);
		return true;
	}
	return false;
}
export function skipWaiting(waitingWorker: ServiceWorker, resumableState: Nullable<ResumableState> | true) {
	waitingWorker.postMessage({
		type: "conditionalSkipWaiting",
		resumableState
	} satisfies InputMessageData);
}