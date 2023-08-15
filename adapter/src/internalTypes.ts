import type { Nullable } from "./types.js";
import type { UpdatePriority } from "./worker/staticVirtual.js";

export interface UnknownInfoFile {
	/**
	 * This is the latest version + 1.
	 */
	formatVersion: 1 | 4
}

interface InfoFileV2Base {
	formatVersion: 2,
	version: number,
	versions: InfoFileV2VersionBatch[]
}
export interface UnprocessedV2InfoFile extends InfoFileV2Base {
	hashes: Record<string, string>
}
export interface InfoFileV2 extends InfoFileV2Base {
	hashes: Map<string, string>
}
export interface InfoFileV2VersionBatch {
	formatVersion: 2,
	updated: string[][]
}

interface InfoFileV3Base {
	formatVersion: 3,
	version: number,
	versions: InfoFileV3VersionBatch[],
	majorUpdateValue: number,
	criticalUpdateValue: number
}
export interface UnprocessedV3InfoFile extends InfoFileV3Base {
	hashes: Record<string, string>
}
export interface InfoFileV3 extends InfoFileV3Base {
	hashes: Map<string, string>
}
export interface InfoFileV3VersionBatch {
	formatVersion: 3,
	updated: string[][],
	updatePriorities: UpdatePriority[]
}

export type KnownVersionFile = InfoFileV2 | InfoFileV3;
export type UnprocessedKnownVersionFile = UnprocessedV2InfoFile | UnprocessedV3InfoFile;
export type InfoFile = KnownVersionFile | UnknownInfoFile;
export type UnprocessedInfoFile = UnprocessedKnownVersionFile | UnknownInfoFile;


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
export type ProcessedBuild = [
	categorizedBuildFiles: CategorizedBuildFiles,
	routeFiles: Set<string>,
	staticFileHashes: Map<string, string>,
	fileSizes: Map<string, number>,
	updatePriority: UpdatePriority
];

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

	REDIRECT_TRAILING_SLASH: boolean,
	ENABLE_PASSTHROUGH: boolean,
	AUTO_PASSTHROUGH_CROSS_ORIGIN_REQUESTS: boolean,
	ENABLE_QUICK_FETCH: boolean
}

/**
 * First item is the constants.
 */
export type VirtualModuleSources = [string];