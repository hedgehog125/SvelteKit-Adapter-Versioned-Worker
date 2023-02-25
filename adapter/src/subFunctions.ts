import type {
	ResolvedAdapterConfig,
	ResolvedManifestPluginConfig,
	MinimalViteConfig,
	
	VersionedWorkerLogger,
	LastInfoProviderConfigs
} from "./types.js";
import {
	Nullable,
	UnprocessedInfoFile,
	InfoFile,

	InputFiles
} from "./internalTypes.js";

import {
	VersionedWorkerError,

	createInitialInfo,
	getFileNamesToStat,
	fileExists
} from "./helper.js";
import { log } from "./globals.js";

import * as fs from "fs/promises";
import * as path from "path";


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