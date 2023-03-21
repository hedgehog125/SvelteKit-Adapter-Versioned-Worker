import type { Nullable } from "./types.js";

interface InfoFileBase {
	formatVersion: number,
	version: number,
	versions: InfoFileVersion[],
	hashes: Record<string, string> | Map<string, string>
};
export interface UnprocessedInfoFile extends InfoFileBase {
	hashes: Record<string, string>
};
export interface InfoFile extends InfoFileBase {
	hashes: Map<string, string>
};

export interface InfoFileVersion {
	formatVersion: number,
	updated: string[][]
};

export type FilesToStat = [[string, string], Nullable<[string, string]>];
/**
 * The first tuple is for the hooks file, the second is for the manifest file. Each item of each is a filename.
 * 
 * @note
 * The second tuple will be null if the manifest plugin isn't being used or if it's disabled.
 */
export type InputFilesContents = [[Nullable<string>, Nullable<string>], Nullable<[Nullable<string>, Nullable<string>]>];
export interface InputFiles {
	hooksIsTS: boolean,
	hooksSource: Nullable<string>,

	manifestSource: Nullable<string>
};

export interface CategorizedBuildFiles {
	precache: string[],
	lazy: string[],
	staleLazy: string[],
	strictLazy: string[],
	semiLazy: string[],

	completeList: string[]
	// never-cache just isn't included
};

export interface WorkerConstants {
	ROUTES: string[],
	
	PRECACHE: string[],
	LAZY_CACHE: string[],
	STALE_LAZY: string[],
	STRICT_LAZY: string[],
	SEMI_LAZY: string[],

	STORAGE_PREFIX: string,
	VERSION: number,
	VERSION_FOLDER: string,
	VERSION_FILE_BATCH_SIZE: number,
	MAX_VERSION_FILES: number,
	BASE_URL: string
};

/**
 * First item is the constants and the second is the hooks file.
 */
export type VirtualModuleSources = [string, string];