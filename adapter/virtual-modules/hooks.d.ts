type Nullable<T> = T | null;

export const handleFetch: Nullable<import("./worker.js").HandleFetchHook>;