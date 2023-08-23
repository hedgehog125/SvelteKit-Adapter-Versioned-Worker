type Nullable<T> = T | null;

export const handleFetch: Nullable<import("./worker.js").HandleFetchHook>;
export const handleCustomMessage: Nullable<import("./worker.js").HandleCustomMessageHook>;
export const handleResponse: Nullable<import("./worker.js").HandleResponseHook>;