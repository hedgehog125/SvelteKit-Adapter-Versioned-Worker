/*
Some of the Svelte module exports need to be used by the adapter or worker, those go here. They are then re-exported by svelte/src/lib/index.ts or util.ts.
*/

/**
 * TODO
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