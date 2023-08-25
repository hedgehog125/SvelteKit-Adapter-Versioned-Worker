/* Build constants */

export const ROUTES: Set<string>;
	
export const PRECACHE: Set<string>;
export const LAX_LAZY: Set<string>;
export const STALE_LAZY: Set<string>;
export const STRICT_LAZY: Set<string>;
export const SEMI_LAZY: Set<string>;

export const STORAGE_PREFIX: string;
export const VERSION: number;
export const VERSION_FOLDER: string;
export const VERSION_FILE_BATCH_SIZE: number;
export const MAX_VERSION_FILES: number;
export const BASE_URL: string;

// Config
export const REDIRECT_TRAILING_SLASH: boolean;
export const ENABLE_PASSTHROUGH: boolean;
export const AUTO_PASSTHROUGH_CROSS_ORIGIN_REQUESTS: boolean;
export const ENABLE_QUICK_FETCH: boolean;
// No ENABLE_SECOND_UPDATE_PRIORITY_ELEVATION
export const USE_HTTP_CACHE: boolean;

/* End of build constants */


export * from "../build/src/worker/staticVirtual.js";