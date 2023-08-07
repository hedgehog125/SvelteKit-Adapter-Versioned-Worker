/**
 * The current version of the PWA. The same as the equivalent in sveltekit-adapter-versioned-worker/worker.
 * 
 * @note
 * This property requires the manifest plugin to be used. It only works during the build (and not in the prerender). If you try to read the property in other situations, it will always be `null`.
 */
export const VERSION: number | null;
/**
 * If trailing slashes are set to be redirected in the adapter config.
 * 
 * @note This property requires the manifest plugin to be used. It only works during the build (and not in the prerender). If you try to read the property in other situations, it will always be `null`.
 * 
 * @see `AdapterConfig.redirectTrailingSlash` for more information.
 */
export const REDIRECT_TRAILING_SLASH: boolean | null;
/**
 * If passthrough is enabled in the adapter config.
 * 
 * @note
 * This property requires the manifest plugin to be used. It only works during the build (and not in the prerender). If you try to read the property in other situations, it will always be `null`.
 * 
 * @see `AdapterConfig.enablePassthrough` for more information.
 */
export const ENABLE_PASSTHROUGH: boolean | null;
/**
 * If cross origin requests are set to be passthrough-ed by default in the adapter config.
 * 
 * @note
 * This property requires the manifest plugin to be used. It only works during the build (and not in the prerender). If you try to read the property in other situations, it will always be `null`.
 * 
 * @see `AdapterConfig.autoPassthroughCrossOriginRequests` for more information.
 */
export const AUTO_PASSTHROUGH_CROSS_ORIGIN_REQUESTS: boolean | null;
/**
 * If the service worker is set in the adapter config to include the code necessary to use the `"quickFetch"` function.
 * 
 * @note
 * This property requires the manifest plugin to be used. It only works during the build (and not in the prerender). If you try to read the property in other situations, it will always be `null`.
 * 
 * @see `AdapterConfig.enableQuickFetch` for more information.
 * @see `quickFetch` in the module `"sveltekit-adapter-versioned-worker/svelte"`.
 */
export const ENABLE_QUICK_FETCH: boolean | null;