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

export interface InputFiles {
	handlerIsTS: boolean,
	handlerSource: Nullable<string>,

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