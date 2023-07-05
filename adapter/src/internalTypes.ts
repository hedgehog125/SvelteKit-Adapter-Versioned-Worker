import type { Nullable } from "./types.js";

interface InfoFileBase {
	formatVersion: number,
	version: number,
	versions: InfoFileVersionBatch[],
	hashes: Record<string, string> | Map<string, string>
}
export interface UnprocessedInfoFile extends InfoFileBase {
	hashes: Record<string, string>
}
export interface InfoFile extends InfoFileBase {
	hashes: Map<string, string>
}

export interface InfoFileVersionBatch {
	formatVersion: number,
	updated: string[][]
}

/**
 * The first tuple is if each extension exists or not (ts followed by js).
 * The second tuple is the contents of each extension (webmanifest followed by json), or null if it doesn't exist. 
 * 
 * @note
 * The second tuple will be null if the manifest plugin isn't being used or if it's disabled.
 */
export type InputFilesContents = [[boolean, boolean], Nullable<[Nullable<string>, Nullable<string>]>];
export interface InputFiles {
	hooksFileName: Nullable<string>,
	hooksIsTS: boolean,

	manifestSource: Nullable<string>
}

export interface CategorizedBuildFiles {
	precache: string[],
	laxLazy: string[],
	staleLazy: string[],
	strictLazy: string[],
	semiLazy: string[],

	completeList: string[]
	// never-cache just isn't included
}
export type ProcessedBuild = [categorizedBuildFiles: CategorizedBuildFiles, routeFiles: Set<string>, staticFileHashes: Map<string, string>, fileSizes: Map<string, number>];

export interface WorkerConstants {
	ROUTES: string[],
	
	PRECACHE: string[],
	LAX_LAZY: string[],
	STALE_LAZY: string[],
	STRICT_LAZY: string[],
	SEMI_LAZY: string[],

	STORAGE_PREFIX: string,
	VERSION: number,
	VERSION_FOLDER: string,
	VERSION_FILE_BATCH_SIZE: number,
	MAX_VERSION_FILES: number,
	BASE_URL: string,

	ENABLE_PASSTHROUGH: boolean
}

/**
 * First item is the constants.
 */
export type VirtualModuleSources = [string];