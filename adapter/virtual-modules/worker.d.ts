/* Build constants */

/**
 * The tag of the `versionedWorker.json` file. This is mostly only intended to be used internally.
 */
export const TAG: string;
/**
 * The current version of the worker.
 * 
 * In the active worker, this will match the equivalent in `"sveltekit-adapter-versioned-worker/runtime-constants"`.
 * 
 * In the waiting worker, this value will be higher than the equivalent (except sometimes when the wrong info file is used for a build).
 */
export const VERSION: number;
/**
 * A set containing the paths of all the route files.
 * 
 * @note The base URL has been removed from each and the starting slash.
 */
export const ROUTES: Set<string>;

/**
 * A set containing the paths of all the files sorted as `"pre-cache"`.
 * 
 * @note The base URL has been removed from each and the starting slash.
 * 
 * @see `FileSortMode` in the module `"sveltekit-adapter-versioned-worker"` for more information on the different file sort modes
 */
export const PRECACHE: Set<string>;
/**
 * A set containing the paths of all the files sorted as `"lax-lazy"`.
 * 
 * @note The base URL has been removed from each and the starting slash.
 * 
 * @see `FileSortMode` in the module `"sveltekit-adapter-versioned-worker"` for more information on the different file sort modes
 */
export const LAX_LAZY: Set<string>;
/**
 * A set containing the paths of all the files sorted as `"stale-lazy"`.
 * 
 * @note The base URL has been removed from each and the starting slash.
 * 
 * @see `FileSortMode` in the module `"sveltekit-adapter-versioned-worker"` for more information on the different file sort modes
 */
export const STALE_LAZY: Set<string>;
/**
 * A set containing the paths of all the files sorted as `"strict-lazy"`.
 * 
 * @note The base URL has been removed from each and the starting slash.
 * 
 * @see `FileSortMode` in the module `"sveltekit-adapter-versioned-worker"` for more information on the different file sort modes
 */
export const STRICT_LAZY: Set<string>;
/**
 * A set containing the paths of all the files sorted as `"semi-lazy"`.
 * 
 * @note The base URL has been removed from each and the starting slash.
 * 
 * @see `FileSortMode` in the module `"sveltekit-adapter-versioned-worker"` for more information on the different file sort modes
 */
export const SEMI_LAZY: Set<string>;

/**
 * The filename that was set in the adapter config for the folder that contains the version files.
 * 
 * @see `AdapterConfig.outputVersionDir` for more information
 */
export const VERSION_FOLDER: string;
/**
 * How many version files are in a batch. This is mostly only intended to be used internally.
 */
export const VERSION_FILE_BATCH_SIZE: number;
/**
 * The maximum number of version files. This is mostly only intended to be used internally.
 */
export const MAX_VERSION_FILES: number;
/**
 * The base URL that was set to be used in the SvelteKit config.
 * 
 * @see
 * https://kit.svelte.dev/docs/configuration#paths
 */
export const BASE_URL: string;
/**
 * The storage prefix the worker is set to use in the adapter config.
 * 
 * @see `AdapterConfig.cacheStorageName` for more information
 */
export const STORAGE_PREFIX: string;

/* Config */

/**
 * If trailing slashes are set to be redirected in the adapter config.
 * 
 * @see `AdapterConfig.redirectTrailingSlash` for more information
 */
export const REDIRECT_TRAILING_SLASH: boolean;
/**
 * If passthrough is enabled in the adapter config.
 * 
 * @see `AdapterConfig.enablePassthrough` for more information
 */
export const ENABLE_PASSTHROUGH: boolean;
/**
 * If cross origin requests are set to be passthrough-ed by default in the adapter config.
 * 
 * @see `AdapterConfig.autoPassthroughCrossOriginRequests` for more information
 */
export const AUTO_PASSTHROUGH_CROSS_ORIGIN_REQUESTS: boolean;
/**
 * If the service worker is set in the adapter config to include the code necessary to use the `"quickFetch"` function.
 * 
 * @see `AdapterConfig.enableQuickFetch` for more information
 * @see `quickFetch` in the module `"sveltekit-adapter-versioned-worker/svelte"`
 */
export const ENABLE_QUICK_FETCH: boolean;
// No ENABLE_SECOND_UPDATE_PRIORITY_ELEVATION
/**
 * If the HTTP cache is set in the adapter config to be used for updating or initially downloading resources.
 * 
 * @see `AdapterConfig.useHTTPCache` for more information
 */
export const USE_HTTP_CACHE: boolean;

/* End of build constants */


export * from "../build/src/worker/staticVirtual.js";