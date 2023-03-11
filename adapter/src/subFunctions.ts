import type {
	ResolvedAdapterConfig,
	ResolvedManifestPluginConfig,
	MinimalViteConfig,
	
	VersionedWorkerLogger,
	LastInfoProviderConfigs,

	FileSortMode,

	Nullable,
	FileSorterConfigs,
} from "./types.js";
import type {
	UnprocessedInfoFile,
	InfoFile,

	InputFiles,
	CategorizedBuildFiles
} from "./internalTypes.js";
import type { OutputBundle } from "rollup";
import type { Builder } from "@sveltejs/kit";

import {
	VersionedWorkerError,

	createInitialInfo,
	getFileNamesToStat,
	fileExists,
	hash
} from "./helper.js";
import { log } from "./globals.js";

import * as fs from "fs/promises";
import * as path from "path";
import { normalizePath } from "vite";
import { lookup } from "mime-types";
import rReadDir from "recursive-readdir";


export async function getLastInfo(configs: LastInfoProviderConfigs): Promise<UnprocessedInfoFile> {
	let fileContents = await configs.adapterConfig.lastInfo(log, configs);
	if (fileContents == null) return createInitialInfo();

	let parsed: UnprocessedInfoFile;
	try {
		parsed = JSON.parse(fileContents);
	}
	catch {
		throw new VersionedWorkerError(`Couldn't parse the info file from the last build. Contents:\n${fileContents}`);
	}
	return parsed;
};
export function checkInfoFile(infoFile: UnprocessedInfoFile) {
	if (infoFile.formatVersion !== 2) {
		if (infoFile.formatVersion === 1) {
			throw new VersionedWorkerError("Please release an update using the previous SvelteKit-Plugin-Versioned-Worker before using this adapter, as only that supports upgrading info files from version 1 to 2.");
		}
		else {
			throw new VersionedWorkerError(`Unsupported version ${infoFile.formatVersion} in the info file from the last build.`);
		}
	}
};
export function processInfoFile(infoFile: UnprocessedInfoFile): InfoFile {
	const {
		formatVersion,
		version,
		versions,
		hashes
	} = infoFile;
	
	return {
		formatVersion,
		version,
		versions,
		hashes: new Map(Object.entries(hashes))
	};
};

export async function getInputFiles(
	adapterConfig: ResolvedAdapterConfig, manifestConfig: Nullable<ResolvedManifestPluginConfig>,
	viteConfig: MinimalViteConfig
): Promise<Nullable<string>[][]> {
	const nestedFileNames = getFileNamesToStat(adapterConfig.hooksFile, manifestConfig?.src);

	// I don't really want to flatten these so this is a bit overly complicated
	return await Promise.all(nestedFileNames.map(fileList => readGroup(fileList)));

	function readGroup(fileList: string[]): Promise<Nullable<string>[]> {
		return Promise.all(fileList.map(async (fileName): Promise<Nullable<string>> => {
			// The contents for each file is loaded asynchronously, so they're unwrapped and rewrapped into a single promise with Promise.all
			const filePath = path.join(viteConfig.root, "src", fileName);
			if (! (await fileExists(filePath))) return null;

			return await fs.readFile(filePath, { encoding: "utf8" });
		}));
	};
};
export function checkInputFiles(hooksFilesContents: Nullable<string>[], manifestFilesContents: Nullable<string>[]) {
	if (! (hooksFilesContents[0] == null && hooksFilesContents[1] == null)) {
		throw new VersionedWorkerError("You can only have 1 hooks file. Please delete either the .js or .ts one.");
	}
	if (! (manifestFilesContents[0] == null && manifestFilesContents[1] == null)) {
		throw new VersionedWorkerError("You can only have 1 input web manifest file. Please delete either the .json or .webmanifest one.");
	}
};
export function getInputFilesConfiguration(hooksFilesContents: Nullable<string>[], manifestFilesContents: Nullable<string>[]): InputFiles {
	const handlerIsTS = hooksFilesContents[0] != null;
	const manifestJSONExtUsed = manifestFilesContents[1] != null;

	return {
		handlerIsTS,
		handlerSource: handlerIsTS? hooksFilesContents[0] : hooksFilesContents[1],

		manifestSource: manifestJSONExtUsed? hooksFilesContents[1] : hooksFilesContents[0]
	};
};

export async function listAllBuildFiles(configs: FileSorterConfigs): Promise<string[]> {
	const { minimalViteConfig, adapterConfig } = configs;

	const buildDirPath = path.join(minimalViteConfig.root, adapterConfig.outDir);
	const list = await rReadDir(buildDirPath);	

	return list.map(fullFilePath => normalizePath(path.relative(buildDirPath, fullFilePath)));
};
export async function categorizeFilesIntoModes(completeFileList: string[], configs: FileSorterConfigs): Promise<CategorizedBuildFiles> {
	const { minimalViteConfig, adapterConfig } = configs;

	const fileModes = await Promise.all(completeFileList.map(async (filePath: string): Promise<FileSortMode> => {
		const mimeType = lookup(filePath) || null;

		if (path.basename(filePath).startsWith(".")) return "never-cache";
		if (filePath === minimalViteConfig.manifest) return "never-cache";
		// if (filePath === svelteConfig.kit.appDir + "/version.json") return "never-cache"; // TODO: can this be excluded?
		if (filePath === "robots.txt") return "never-cache";

		if (adapterConfig.sortFile == null) return "pre-cache";

		return await adapterConfig.sortFile(filePath, mimeType, configs);
	}));

	let precache: string[] = [];
	let lazy: string[] = [];
	let staleLazy: string[] = [];
	let strictLazy: string[] = [];
	let semiLazy: string[] = [];
	let completeList: string[] = [];
	for (let fileID = 0; fileID < completeFileList.length; fileID++) {
		const fileName = completeFileList[fileID];
		const fileMode = fileModes[fileID];

		if (fileMode === "never-cache") continue;
		
		completeList.push(fileName);
		if (fileMode === "pre-cache") precache.push(fileName);
		else if (fileMode === "lazy") lazy.push(fileName);
		else if (fileMode === "stale-lazy") staleLazy.push(fileName);
		else if (fileMode === "strict-lazy") strictLazy.push(fileName);
		else if (fileMode === "semi-lazy") semiLazy.push(fileName);
	}

	return {
		precache,
		lazy,
		staleLazy,
		strictLazy,
		semiLazy,

		completeList
	};
};
export async function hashFiles(filteredFileList: string[], viteBundle: Nullable<OutputBundle>, builder: Builder, configs: FileSorterConfigs): Promise<Map<string, string>> {
	const { minimalViteConfig, adapterConfig } = configs;
	const buildDirPath = path.join(minimalViteConfig.root, adapterConfig.outDir);
	
	const routeFiles = new Set(Array.from(builder.prerendered.pages).map(([, { file }]) => file));
	const fileHashes = await Promise.all(filteredFileList.map(async (filePath): Promise<Nullable<string>> => {
		if (routeFiles.has(filePath)) return null; // They're assumed to have changed

		const bundleInfo = viteBundle?.[filePath];
		if (bundleInfo?.name) return null; // Has a hash in its filename

		const contents = bundleInfo?.type === "chunk"? bundleInfo.code : await fs.readFile(path.join(buildDirPath, filePath));
		return hash(contents);
	}));

	let asMap = new Map<string, string>();
	for (let fileID = 0; fileID < filteredFileList.length; fileID++) {
		const fileName = filteredFileList[fileID];
		const fileHash = fileHashes[fileID];
		if (fileHash == null) continue;

		asMap.set(fileName, fileHash);
	}
	return asMap;
};