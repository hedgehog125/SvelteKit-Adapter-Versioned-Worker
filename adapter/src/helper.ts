import type { VersionedWorkerLogger } from "./types.js";
import type { UnprocessedInfoFile } from "./internalTypes.js";

import * as fs from "fs/promises";
import * as path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import * as crypto from "crypto";
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

	function indentAndPrefix(msg: string): string {
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
export function getFileNamesToRead(hooksPath: string, manifestPath?: string): string[][] {
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
export async function findUniqueFileName(dir: string, baseName: string, extension: string): Promise<string> {
	const characters = "abcdefghijklmnopqrstuvwxyz0123456789";

	while (true) {
		const randomCharacters = new Array(5).fill(null).map(() => randomItemOfString(characters)).join("");
		const fileName = `${baseName}-${randomCharacters}.${extension}`;

		if (! (await fileExists(path.join(dir, fileName)))) return fileName;
	}
};
export function randomItemOfString(str: string): string {
	return str[Math.floor(Math.random() * str.length)];
};
export function randomItemOfArray<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
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

/**
 * This is a slightly wacky method that allows you to use undefined where you normally wouldn't be able to. This is mainly used so defaults don't need to be specified for required config properties
 * 
 * @returns undefined casted to the provided type
 */
export function requiredProperty<T>(): T {
	return undefined as any as T;
};

export function hash(data: string | Buffer): string {
	const hasher = crypto.createHash("md5");
	hasher.update(data);
	return hasher.digest("hex");
};
export function removeNulls<T>(arr: T[]): T[] {
	return arr.filter(item => item != null);	
};