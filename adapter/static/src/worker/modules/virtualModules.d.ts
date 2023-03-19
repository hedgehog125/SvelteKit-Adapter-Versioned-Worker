type HandleHook = (path: string, isPage: boolean, e: import("../builtInTypes.js").FetchEvent, fullPath: string) => Promise<Response | null> | Response | null;
type Nullable<T> = T | null;

declare module "sveltekit-adapter-versioned-worker/worker" {
	export declare const ROUTES: string[];
	export declare const PRECACHE: string[];
	export declare const LAZY_CACHE: string[];
	export declare const STORAGE_PREFIX: string;
	export declare const VERSION: number;
	export declare const VERSION_FOLDER: string;
	export declare const VERSION_FILE_BATCH_SIZE: number;
	export declare const MAX_VERSION_FILES: number;
	export declare const BASE_URL: string;

	export * from "./builtInTypes.js";
	export type HandleHook = HandleHook;
	export interface VersionFile {
		formatVersion: number,
		updated: string[][]
	};
};

declare module "sveltekit-adapter-versioned-worker/internal/hooks" {
	export declare const handle: Nullable<HandleHook>;
};