export const VERSION_FILE_BATCH_SIZE = 25;
export const MAX_VERSION_FILES = 5;
export const V2_VERSION_FILE_BATCH_SIZE = 10;
export const V2_PREV_MAX_VERSION_FILES = 10;

export const CURRENT_VERSION_FILENAME = "version.txt";
export const WORKER_MAIN_FILENAME = "sw.js"; // Contains most of the worker, as opposed to the entry which imports it
export const INFO_FILENAME = "versionedWorker.json";
export const DEFAULT_STORAGE_NAME = "VersionedWorkerStorage";