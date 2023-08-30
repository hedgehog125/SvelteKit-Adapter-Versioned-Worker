import type { Nullable, VersionedWorkerLogger } from "./types.js";
import type { UnprocessedV3InfoFile } from "./internalTypes.js";

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
}
export function createLogger(verbose: boolean): VersionedWorkerLogger { // Credit: largely adapted from SvelteKit's logger
	return {
		message(msg: string, includePrefix = true) {
			console.log(indentAndPrefix(msg, includePrefix));
		},
		success(msg: string) {
			console.log(colors.green(
				indentAndPrefix(`✔ ${msg}`)
			));
		},
		error(msg: string, includePrefix = true) {
			console.error(colors.bold().red(
				indentAndPrefix(msg, includePrefix)
			));
		},
		warn(msg: string, includePrefix = true) {
			console.warn(colors.bold().yellow(
				indentAndPrefix(msg, includePrefix)
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

	function indentAndPrefix(msg: string, prefix = true): string {
		return `${prefix? `${colors.bold().cyan("Versioned-Worker")}: `: ""}${msg}`.replace(/^/gm, "  "); // Indents each line
	}
}

export async function fileExists(filePath: string): Promise<boolean> {
	try {
		await fs.stat(filePath);
	}
	catch {
		return false;
	}
	return true;
}
export function createSuffixes(inputtedPath: string, suffixes: string[]): string[] {
	let withoutSuffix: string;
	for (let suffix of suffixes) {
		if (inputtedPath.endsWith(suffix)) {
			withoutSuffix = inputtedPath.slice(0, -suffix.length);
			break;
		}
	}

	return suffixes.map(suffix => withoutSuffix + suffix);
}
export async function findUniqueFileName(dir: string, baseName: string, extension: string): Promise<string> {
	while (true) {
		const randomCharacters = randomString(5);
		const fileName = `${baseName}-${randomCharacters}.${extension}`;

		if (! (await fileExists(path.join(dir, fileName)))) return fileName;
	}
}
export function randomString(len: number, characters = "abcdefghijklmnopqrstuvwxyz0123456789"): string {
	return Array.from(new Array(len), () => randomItemOfString(characters)).join("");
}
export function randomItemOfString(str: string): string {
	return str[Math.floor(Math.random() * str.length)];
}
export function randomItemOfArray<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

export const adapterFilesPath = path.join(dirname(fileURLToPath(import.meta.url)), "../../");

export function createInitialInfo(): UnprocessedV3InfoFile {
	return {
		formatVersion: 3,
		tag: createInitialTag(),
		version: -1,
		versions: [],
		hashes: {},

		elevatedPatchUpdateValue: 0,
		majorUpdateValue: 0,
		criticalUpdateValue: 0
	};
}
export function createInitialTag(): string {
	return randomString(16, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_");
}

/**
 * This is a slightly wacky method that allows you to use undefined where you normally wouldn't be able to. This is mainly used so defaults don't need to be specified for required config properties.
 * 
 * @returns undefined casted to the provided type
 */
export function requiredProperty<T>(): T {
	return undefined as unknown as T;
}

export function hash(data: crypto.BinaryLike): string {
	const hasher = crypto.createHash("md5");
	hasher.update(data);
	return hasher.digest("hex");
}
export function removeNulls<T>(arr: T[]): Exclude<T, null>[] {
	return arr.filter(item => item != null) as Exclude<T, null>[];	
}

export function createConstantsModule(constants: Record<string, any>): string {
	return Object.entries(constants).map(([name, value]) => {
		let codeForValue: string;
		if (value instanceof Set) {
			codeForValue = `new Set(${JSON.stringify([...value])})`;
		}
		else if (value instanceof Map) {
			codeForValue = `new Map(Object.entries(${JSON.stringify(Object.fromEntries(value))}))`;
		}
		else {
			codeForValue = JSON.stringify(value);
		}

		return `export const ${name} = ${codeForValue};`;
	}).join("");
}

export function timePromise(duration: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, duration));
}