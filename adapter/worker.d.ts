export type HandleHook = (path: string, isPage: boolean, e: import("../builtInTypes.js").FetchEvent, fullPath: string) => Promise<Response | null> | Response | null;
export const ROUTES: string[];
	
export const PRECACHE: string[];
export const LAZY_CACHE: string[];
export const STALE_LAZY: string[];
export const STRICT_LAZY: string[];
export const SEMI_LAZY: string[];

export const STORAGE_PREFIX: string;
export const VERSION: number;
export const VERSION_FOLDER: string;
export const VERSION_FILE_BATCH_SIZE: number;
export const MAX_VERSION_FILES: number;
export const BASE_URL: string;

export interface VersionFile {
	formatVersion: number,
	updated: string[][]
}

export interface MessageEventData {
	type: string,
	[property: string]: unknown
}
export interface MessageEventWithTypeProp extends MessageEvent {
	data: MessageEventData
}