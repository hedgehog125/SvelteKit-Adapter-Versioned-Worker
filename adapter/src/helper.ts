import type { VersionedWorkerLogger } from "./types.js";
import type { UnprocessedInfoFile } from "./internalTypes.js";

import * as fs from "fs/promises";
import * as path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import colors from "kleur";

export class VersionedWorkerError extends Error {
	constructor(message: string) {
		super(`VersionedWorkerError: ${message}`);
	}
};
export function createLogger(verbose: boolean): VersionedWorkerLogger { // Credit: largely adapted from SvelteKit's logger
	return {
		message(msg: string) {
			console.log(indentAndPrefix(msg));
		},
		success(msg: string) {
			console.log(colors.green(
				indentAndPrefix(`✔ ${msg}`)
			));
		},
		error(msg: string) {
			console.error(colors.bold().red(
				indentAndPrefix(msg)
			));
		},
		warn(msg: string) {
			console.warn(colors.bold().yellow(
				indentAndPrefix(msg)
			));
		},

		minor(msg: string) {
			if (! verbose) return;
			console.log(colors.gray(msg));
		},
		info(msg: string) {
			if (! verbose) return;
			console.log(msg);
		},
		blankLine() {
			console.log("");
		},
		verbose
	};

	function indentAndPrefix(msg: string) {
		return `${colors.bold().cyan("Versioned-Worker")}: ${msg}`.replace(/^/gm, "  "); // Indents each line
	};
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
export function getFileNamesToStat(hooksPath: string, manifestPath?: string): string[][] {
	const suffixes = [
		createSuffixes(hooksPath, [".ts", ".js"])
	];
	if (manifestPath != null) suffixes.push(createSuffixes(manifestPath, [".webmanifest", ".json"]));

	return suffixes;

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

export function createInitialInfo(): UnprocessedInfoFile {
	return {
		formatVersion: 2,
		version: -1,
		versions: [],
		hashes: {}
	};
};