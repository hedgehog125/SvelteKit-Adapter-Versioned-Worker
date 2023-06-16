type Nullable<T> = T | null;

declare module "sveltekit-adapter-versioned-worker/internal/hooks" {
	export declare const handle: Nullable<import("../../../../worker.js").HandleHook>;
}