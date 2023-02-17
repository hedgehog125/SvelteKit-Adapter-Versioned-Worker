import type { InfoFile, VersionedWorkerLogger } from "./types.js";

import * as fs from "fs/promises";
import * as path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";

export class VersionedWorkerError extends Error {
	constructor(message: string) {
		super(`VersionedWorkerError: ${message}`);
	}
};
export function wrapLogger(logger: any): VersionedWorkerLogger {
	const prefix = (msg: string) => `Versioned-Worker: ${msg}`;
	const wrapped = {
		success(msg: string) {
			logger.success(prefix(msg));
		},
		info(msg: string) {
			logger.info(prefix(msg));
		},
		error(msg: string) {
			logger.error(prefix(msg));
		},
		warn(msg: string) {
			logger.warn(prefix(msg));
		},
		minor(msg: string) {
			logger.minor(prefix(msg));
		},
		message(msg: string) {
			logger(prefix(msg));
		}
	};
	return wrapped;
};

export async function fileExists(filePath: string): Promise<boolean> {
	try {
		await fs.stat(filePath);
	}
	catch {
		return false;
	}
	return true;
};
export function getFilesToStat(hooksPath: string, manifestPath: string): string[][] {
	return [
		createSuffixes(hooksPath, [".ts", ".js"]),
		createSuffixes(manifestPath, [".webmanifest", ".json"])
	];

	function createSuffixes(inputtedPath: string, suffixes: string[]): string[] {
		let withoutSuffix: string;
		for (let suffix of suffixes) {
			if (inputtedPath.endsWith(suffix)) {
				withoutSuffix = inputtedPath.slice(0, -suffix.length);
				break;
			}
		}

		return suffixes.map(suffix => withoutSuffix + suffix);
	};
};

export const adapterFilesPath = path.join(dirname(fileURLToPath(import.meta.url)), "../../");

export function createInitialInfo(): InfoFile {
	return {
		formatVersion: 2,
		version: -1,
		versions: [],
		hashes: {}
	};
};