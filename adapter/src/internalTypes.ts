import { RollupError } from "rollup";
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
	tag: string,
	version: number,
	versions: InfoFileV3VersionBatch[],

	elevatedPatchUpdateValue: number,
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

export interface WorkerConstants {
	TAG: string,
	VERSION: number,
	ROUTES: Set<string>,
	
	PRECACHE: Set<string>,
	LAX_LAZY: Set<string>,
	STALE_LAZY: Set<string>,
	STRICT_LAZY: Set<string>,
	SEMI_LAZY: Set<string>,

	VERSION_FOLDER: string,
	VERSION_FILE_BATCH_SIZE: number,
	MAX_VERSION_FILES: number,
	BASE_URL: string,
	STORAGE_PREFIX: string,

	REDIRECT_TRAILING_SLASH: boolean,
	ENABLE_PASSTHROUGH: boolean,
	AUTO_PASSTHROUGH_CROSS_ORIGIN_REQUESTS: boolean,
	ENABLE_QUICK_FETCH: boolean,
	USE_HTTP_CACHE: boolean
}

/**
 * First item is the constants.
 */
export type VirtualModuleSources = [string];

/**
 * So the key properties of both Rollup errors and warnings can be passed around more easily.
 */
export interface WrappedRollupError {
	loc: RollupError["loc"],
	frame: RollupError["frame"],
	message: string,
	stack: RollupError["stack"]
}