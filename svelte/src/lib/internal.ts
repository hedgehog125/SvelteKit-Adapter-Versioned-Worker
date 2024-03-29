import type {
	InputMessageData,
	ResumableState,
	WorkerInfo,
	WorkerV1Info
} from "internal-adapter/worker";

import { ExposedPromise } from "$util";
export {
	ENABLE_SECOND_UPDATE_PRIORITY_ELEVATION,
	CHECK_FOR_UPDATES_INTERVAL,
	OUTPUT_WORKER_FILE_NAME
} from "internal-adapter/runtime-constants";

type Nullable<T> = T | null;

/**
 * The type for a command for the ServiceWorker component
 */
export interface CommandForComponent {
	type: "updateCheck"
}
export interface InternalState {
	registration?: ServiceWorkerRegistration,
	navigatingTo: Nullable<string>,

	resumableStatePromise: ExposedPromise<Nullable<ResumableState>>,
	/**
	 * When the `resumableState` promise resolves, it will be set to another promise. This variable stores what it resolved to until the state is read as part of the function `resumeState` and set back to `null`.
	 */
	waitingResumableState: Nullable<ResumableState>,

	activeWorkerInfo: Nullable<WorkerV1Info>,
	waitingWorkerInfo: Nullable<WorkerInfo>,
	waitingWorkerInfoPromise: ExposedPromise<void>,

	reloading: boolean,
	reloadingPromise: ExposedPromise<true>,
	skipReloadCountdownPromise: ExposedPromise<true>,

	commandForComponentPromise: ExposedPromise<CommandForComponent>
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
	skipReloadCountdownPromise: new ExposedPromise(),

	commandForComponentPromise: new ExposedPromise()
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
		resumableState,
		sendFinish: true
	} satisfies InputMessageData);
}