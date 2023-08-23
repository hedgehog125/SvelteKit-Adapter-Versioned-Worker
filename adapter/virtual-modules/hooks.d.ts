type Nullable<T> = T | null;

export const handleFetch: Nullable<import("./worker.js").HandleFetchHook>;
export const handleCustomMessage: Nullable<import("./worker.js").HandleCustomMessageHook>;