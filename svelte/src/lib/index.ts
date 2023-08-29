// Exporting the components from what's now index_internal created some issues with the dev server, so those are now exported here instead

export * from "./index_internal.js";

// @ts-ignore
export { default as ServiceWorker } from "./ServiceWorker.svelte";

// @ts-ignore
export { default as DefaultUpdatePrompt } from "./DefaultUpdatePrompt.svelte";