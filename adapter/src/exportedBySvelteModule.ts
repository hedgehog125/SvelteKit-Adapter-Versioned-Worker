/*
Some of the Svelte module exports need to be used by the adapter or worker, those go here. They are then re-exported by svelte/src/lib/index.ts or util.ts.
*/

import type { DataWithFormatVersion } from "./worker/staticVirtual.js";

/**
 * A class that produces `Promise`-like objects that can be made to resolve or reject externally.
 * 
 * @note `Promise`-like refers to how `ExposedPromise`s have a `then` method, allowing them to be `await`ed.
 * @example
 * let somethingToHappenPromise = new ExposedPromise();
 * 
 * async function doSomething() {
 *   await somethingToHappenPromise;
 *   // Do something now it's done
 * }
 * function makeSomethingHappen() {
 *   // Maybe modify some shared state
 *   somethingToHappenPromise.resolve(); // "Something" has now happened
 *   somethingToHappenPromise = new ExposedPromise(); // So it can be sent again
 * }
 */
export class ExposedPromise<T = void> {
	public resolve: ExposedPromise.Resolve<T>;
	public reject: ExposedPromise.Reject;
	public promise: Promise<T>;

	constructor() {
		let _resolve!: ExposedPromise.Resolve<T>, _reject!: ExposedPromise.Reject;
		this.promise = new Promise((__resolve, __reject) => {
			_resolve = __resolve;
			_reject = __reject;
		});

		this.resolve = _resolve;
		this.reject = _reject;	
	}

	then(onFulfilled: ExposedPromise.ResolveCallback<T>, onRejected: ExposedPromise.RejectCallback) {
		this.promise.then(onFulfilled, onRejected);
	}
}
export namespace ExposedPromise {
	export type Resolve<T> = (value: T | PromiseLike<T>) => void;
	export type Reject = (reason?: any) => void;

	export type ResolveCallback<T> = (value: T) => any;
	export type RejectCallback = (reason?: any) => any;
}

// The parser doesn't like how this is both a type and a namespace
/**
 * The type of the `detail` property of the `ServiceWorker` component's `"message"` event.
 */
export type VWCustomMessageEvent = VWCustomMessageEvent.CurrentWorker | VWCustomMessageEvent.WaitingWorker;
export namespace VWCustomMessageEvent {
	/** 
	 * The type of the `detail` property of the `ServiceWorker` component's `"message"` event when the message was from the active worker.
	 * 
	 * @see `VWCustomMessageEvent.WaitingWorker` for the version of this that has the data wrapped in a `DataWithFormatVersion` object
	 * @see `CustomMessageData` in the module `"sveltekit-adapter-versioned-worker/worker"` for the semi-internal wrapper of data that gets directly postmessaged to or from the worker
	 */
	export type CurrentWorker = CustomCurrentWorkerMessageEventLikeData<MessageEvent<unknown>>;
	/** 
	 * The type of the `detail` property of the `ServiceWorker` component's `"message"` event when the message was from a waiting worker.
	 * 
	 * @see `VWCustomMessageEvent.CurrentWorker` for the version of this that has the data wrapped in a `DataWithFormatVersion` object
	 * @see `CustomMessageData` in the module `"sveltekit-adapter-versioned-worker/worker"` for the semi-internal wrapper of data that gets directly postmessaged to or from the worker
	 */
	export type WaitingWorker = CustomWaitingWorkerMessageEventLikeData<MessageEvent<unknown>>;
}


/* Internal */

export interface CustomCurrentWorkerMessageEventLikeData<TEvent> extends CustomMessageEventLikeBase<TEvent> {
	/**
	 * If `data` comes from a different version or not. If this is `true`, the `data` will be wrapped in a `DataWithFormatVersion` object.
	 */
	isFromDifferentVersion: false,
	/**
	 * The data that was postmessaged.
	 */
	data: unknown
}
export interface CustomWaitingWorkerMessageEventLikeData<TEvent> extends CustomMessageEventLikeBase<TEvent> {
	/**
	 * If `data` comes from a different version or not. If this is `true`, the `data` will be wrapped in a `DataWithFormatVersion` object.
	 */
	isFromDifferentVersion: true,
	/**
	 * The data that was postmessaged.
	 * 
	 * @note You should type narrow this using `isFromDifferentVersion` before casting it to a known type.
	 */
	data: DataWithFormatVersion
}
interface CustomMessageEventLikeBase<TEvent> {
	isFromDifferentVersion: boolean,
	/**
	 * The `MessageEvent` (received by clients) or `ExtendableMessageEvent` (received by service workers) that triggered this event or handler call.
	 */
	event: TEvent
}