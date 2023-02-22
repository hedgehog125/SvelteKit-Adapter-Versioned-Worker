import type {
	ResolvedAdapterConfig,
	
	VersionedWorkerLogger,
	UnprocessedInfoFile,
	InfoFile
} from "./types.js";

import { createInitialInfo, VersionedWorkerError } from "./helper.js";
import { log } from "./globals.js";

export async function getLastInfo(config: ResolvedAdapterConfig): Promise<UnprocessedInfoFile> {
	let fileContents = await config.lastInfo(log);
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