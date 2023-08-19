import type {
	InputMessageData,
	ResumableState,
	WorkerInfo
} from "internal-adapter/worker";

import { ExposedPromise } from "$util";
export { ENABLE_SECOND_UPDATE_PRIORITY_ELEVATION } from "internal-adapter/runtime-constants";

type Nullable<T> = T | null;

export interface InternalState {
	registration?: ServiceWorkerRegistration,
	navigatingTo: Nullable<string>,

	resumableStatePromise: ExposedPromise<Nullable<ResumableState>>,
	/**
	 * When the `resumableState` promise resolves, it will be set to another promise. This variable stores what it resolved to until the state is read as part of the function `resumeState` and set back to `null`.
	 */
	waitingResumableState: Nullable<ResumableState>,

	activeWorkerInfo: Nullable<WorkerInfo>,
	waitingWorkerInfo: Nullable<WorkerInfo>,
	waitingWorkerInfoPromise: ExposedPromise<void>,

	reloading: boolean,
	reloadingPromise: ExposedPromise<true>,
	skipReloadCountdownPromise: ExposedPromise<true>
}

export const internalState: InternalState = {
	navigatingTo: null,

	resumableStatePromise: new ExposedPromise(),
	waitingResumableState: null,

	activeWorkerInfo: null,
	waitingWorkerInfo: null,
	waitingWorkerInfoPromise: new ExposedPromise(),

	reloading: false,
	reloadingPromise: new ExposedPromise(),
	skipReloadCountdownPromise: new ExposedPromise()
};


export function skipIfWaiting(resumableState: Nullable<ResumableState> | true): boolean {
	if (internalState.registration?.waiting) {
		skipWaiting(internalState.registration.waiting, resumableState);
		return true;
	}
	return false;
}
export function skipWaiting(
	waitingWorker: ServiceWorker,
	resumableState: Nullable<ResumableState> | true
) {
	waitingWorker.postMessage({
		type: "conditionalSkipWaiting",
		resumableState
	} satisfies InputMessageData);
}