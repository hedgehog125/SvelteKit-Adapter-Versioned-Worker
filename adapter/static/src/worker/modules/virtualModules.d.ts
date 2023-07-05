type Nullable<T> = T | null;

declare module "sveltekit-adapter-versioned-worker/internal/hooks" {
	export declare const handleFetch: Nullable<import("../../../../virtual-modules/worker.js").HandleFetchHook>;
}