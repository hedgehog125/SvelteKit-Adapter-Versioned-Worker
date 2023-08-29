/**
 * The current version of the PWA. The same as the equivalent in sveltekit-adapter-versioned-worker/worker.
 * 
 * @note
 * This property requires the manifest plugin to be used. It only works during the build (and not in the prerender or worker build). If you try to read the property in other situations, it will always be `null`.
 */
export const VERSION: number | null;
/**
 * If trailing slashes are set to be redirected in the adapter config.
 * 
 * @note
 * This property requires the manifest plugin to be used. It only works during the build (and not in the prerender or worker build). If you try to read the property in other situations, it will always be `null`.
 * 
 * @see `AdapterConfig.redirectTrailingSlash` for more information
 */
export const REDIRECT_TRAILING_SLASH: boolean | null;
/**
 * If passthrough is enabled in the adapter config.
 * 
 * @note
 * This property requires the manifest plugin to be used. It only works during the build (and not in the prerender or worker build). If you try to read the property in other situations, it will always be `null`.
 * 
 * @see `AdapterConfig.enablePassthrough` for more information
 */
export const ENABLE_PASSTHROUGH: boolean | null;
/**
 * If cross origin requests are set to be passthrough-ed by default in the adapter config.
 * 
 * @note
 * This property requires the manifest plugin to be used. It only works during the build (and not in the prerender or worker build). If you try to read the property in other situations, it will always be `null`.
 * 
 * @see `AdapterConfig.autoPassthroughCrossOriginRequests` for more information
 */
export const AUTO_PASSTHROUGH_CROSS_ORIGIN_REQUESTS: boolean | null;
/**
 * If the service worker is set in the adapter config to include the code necessary to use the `"quickFetch"` function.
 * 
 * @note
 * This property requires the manifest plugin to be used. It only works during the build (and not in the prerender or worker build). If you try to read the property in other situations, it will always be `null`.
 * 
 * @see `AdapterConfig.enableQuickFetch` for more information
 * @see `quickFetch` in the module `"sveltekit-adapter-versioned-worker/svelte"`
 */
export const ENABLE_QUICK_FETCH: boolean | null;
/**
 * If the `ServiceWorker` component is set in the adapter config to increase the priority of a patch update to an elevated patch after 3 days have passed since it was downloaded, regardless of if any reload opportunities were blocked.
 * 
 * @note
 * This property requires the manifest plugin to be used. It only works during the build (and not in the prerender or worker build). If you try to read the property in other situations, it will always be `null`.
 * 
 * @see `AdapterConfig.enableSecondUpdatePriorityElevation` for more information
 * @see `UpdatePriority` in the module `"sveltekit-adapter-versioned-worker/worker"` for more information about update priorities
 */
export const ENABLE_SECOND_UPDATE_PRIORITY_ELEVATION: boolean | null;
/**
 * If the HTTP cache is set in the adapter config to be used for updating or initially downloading resources.
 * 
 * @note
 * This property requires the manifest plugin to be used. It only works during the build (and not in the prerender or worker build). If you try to read the property in other situations, it will always be `null`.
 * 
 * @see `AdapterConfig.useHTTPCache` for more information
 */
export const USE_HTTP_CACHE: boolean | null;
/**
 * How often, in milliseconds, the `ServiceWorker` component is set in the adapter config to check for updates.
 * 
 * @note
 * This property requires the manifest plugin to be used. It only works during the build (and not in the prerender or worker build). If you try to read the property in other situations, it will always be `null`.
 * 
 * @see `AdapterConfig.checkForUpdatesInterval` for more information
 */
export const CHECK_FOR_UPDATES_INTERVAL: number | null | false;
/**
 * The filename that the service worker was set to be outputted as in the adapter config.
 * 
 * @note
 * This property requires the manifest plugin to be used. It only works during the build (and not in the prerender or worker build). If you try to read the property in other situations, it will always be `null`.
 * 
 * @see `AdapterConfig.outputWorkerFileName` for more information
 */
export const OUTPUT_WORKER_FILE_NAME: string | null;