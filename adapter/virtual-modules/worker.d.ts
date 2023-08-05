/* Build constants */

export const ROUTES: string[];
	
export const PRECACHE: string[];
export const LAX_LAZY: string[];
export const STALE_LAZY: string[];
export const STRICT_LAZY: string[];
export const SEMI_LAZY: string[];

export const STORAGE_PREFIX: string;
export const VERSION: number;
export const VERSION_FOLDER: string;
export const VERSION_FILE_BATCH_SIZE: number;
export const MAX_VERSION_FILES: number;
export const BASE_URL: string;

// Config
export const ENABLE_PASSTHROUGH: boolean;

/* End of build constants */


export * from "../build/src/worker/staticVirtual.js";