/**
 * The current version of the PWA. The same as the equivalent in sveltekit-adapter-versioned-worker/worker.
 * 
 * @note
 * This property requires the manifest plugin to be used. It only works during the build (and not in the prerender). If you try to read the property in other situations, it will always be -1.
 */
export const VERSION: number;