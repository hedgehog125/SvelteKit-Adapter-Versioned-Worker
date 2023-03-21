import type {
	ResolvedAdapterConfig,
	ResolvedManifestPluginConfig,
	MinimalViteConfig,
	
	VersionedWorkerLogger,
	LastInfoProviderConfigs,

	FileSortMode,

	Nullable,
	AllConfigs
} from "./types.js";
import type {
	UnprocessedInfoFile,
	InfoFile,

	InputFilesContents,
	InputFiles,

	CategorizedBuildFiles,

	VirtualModuleSources,
	WorkerConstants
} from "./internalTypes.js";
import type { OutputBundle, RollupLog, WarningHandler } from "rollup";
import type { Builder } from "@sveltejs/kit";
import type { RollupTypescriptOptions } from "@rollup/plugin-typescript";

import {
	VersionedWorkerError,

	adapterFilesPath,
	createInitialInfo,
	getFileNamesToStat,
	fileExists,
	hash,
	findUniqueFileName
} from "./helper.js";
import { log } from "./globals.js";
import { VERSION_FILE_BATCH_SIZE, MAX_VERSION_FILES } from "./constants.js";

import * as fs from "fs/promises";
import * as path from "path";
import { normalizePath } from "vite";
import { lookup } from "mime-types";
import rReadDir from "recursive-readdir";
import { rollup } from "rollup";
import pluginVirtual from "@rollup/plugin-virtual";
import nodeResolve from "@rollup/plugin-node-resolve";
import esbuild from "rollup-plugin-esbuild";
import typescriptPlugin from "@rollup/plugin-typescript";
import alias from "@rollup/plugin-alias";


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
): Promise<InputFilesContents> {
	const nestedFileNames = getFileNamesToStat(adapterConfig.hooksFile, manifestConfig?.src);	

	// I don't really want to flatten these so this is a bit overly complicated
	return await Promise.all(nestedFileNames.map(fileList => fileList? readGroup(fileList) : null)) as InputFilesContents;

	function readGroup(fileList: string[]): Promise<Nullable<string>[]> {
		return Promise.all(fileList.map(async (fileName): Promise<Nullable<string>> => {
			const filePath = path.join(viteConfig.root, "src", fileName);
			if (! (await fileExists(filePath))) return null;

			return await fs.readFile(filePath, { encoding: "utf8" });
		}));
	};
};
export function checkInputFiles(inputFileContents: InputFilesContents) {
	const [hooksFilesContents, manifestFilesContents] = inputFileContents;

	if (! (hooksFilesContents[0] == null || hooksFilesContents[1] == null)) {
		throw new VersionedWorkerError("You can only have 1 hooks file. Please delete either the .js or .ts one.");
	}
	if (manifestFilesContents) {
		if (! (manifestFilesContents[0] == null || manifestFilesContents[1] == null)) {
			throw new VersionedWorkerError("You can only have 1 input web manifest file. Please delete either the .json or .webmanifest one.");
		}
	}
};
export function getInputFilesConfiguration(inputFileContents: InputFilesContents): InputFiles {
	const [hooksFilesContents, manifestFilesContents] = inputFileContents;

	const hooksIsTS = hooksFilesContents[0] != null;
	const manifestJSONExtUsed = manifestFilesContents?.[1] != null;

	return {
		hooksIsTS: hooksIsTS,
		hooksSource: hooksIsTS? hooksFilesContents[0] : hooksFilesContents[1],

		manifestSource: manifestFilesContents?
			manifestJSONExtUsed? manifestFilesContents[1] : manifestFilesContents[0]
			: null
	};
};

export async function listAllBuildFiles(configs: AllConfigs): Promise<string[]> {
	const { minimalViteConfig, adapterConfig } = configs;

	const buildDirPath = path.join(minimalViteConfig.root, adapterConfig.outputDir);
	const list = await rReadDir(buildDirPath);	

	return list
		.filter(fullFilePath => ! path.basename(fullFilePath).startsWith("."))
		.map(fullFilePath => normalizePath(path.relative(buildDirPath, fullFilePath)))
	;
};
export async function categorizeFilesIntoModes(completeFileList: string[], configs: AllConfigs): Promise<CategorizedBuildFiles> {
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
export async function hashFiles(filteredFileList: string[], viteBundle: Nullable<OutputBundle>, builder: Builder, configs: AllConfigs): Promise<Map<string, string>> {
	const { minimalViteConfig, adapterConfig } = configs;
	const buildDirPath = path.join(minimalViteConfig.root, adapterConfig.outputDir);
	
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

export async function writeWorkerEntry(inputFiles: InputFiles, configs: AllConfigs): Promise<string> {
	const { minimalViteConfig, adapterConfig } = configs;

	const hooksFolder = path.join(minimalViteConfig.root, "src", path.dirname(adapterConfig.hooksFile));
	const entryFileName = await findUniqueFileName(hooksFolder, "tmp-vw-entry", inputFiles.hooksIsTS? "ts" : "js");
	const entryPath = path.join(hooksFolder, entryFileName);

	const entrySourcePath = path.join(
		adapterFilesPath,
		inputFiles.hooksIsTS? "static/src/worker/index.ts" : "static/jsBuild/worker/index.js"
	);
	await fs.copyFile(entrySourcePath, entryPath);
	return entryPath;
};
export function createWorkerConstants(
	categorizedBuildFiles: CategorizedBuildFiles, builder: Builder,
	lastInfo: InfoFile, configs: AllConfigs
): WorkerConstants {
	const { adapterConfig, svelteConfig } = configs;
	console.log(builder.prerendered.pages);
	let storagePrefix = "TODO";
	let baseURL = svelteConfig.kit.paths.base;
	if (! baseURL.endsWith("/")) baseURL += "/";

	return {
		ROUTES: [],

		PRECACHE: categorizedBuildFiles.precache,
		LAZY_CACHE: categorizedBuildFiles.lazy,
		STALE_LAZY: categorizedBuildFiles.staleLazy,
		STRICT_LAZY: categorizedBuildFiles.strictLazy,
		SEMI_LAZY: categorizedBuildFiles.semiLazy,

		STORAGE_PREFIX: storagePrefix,
		VERSION: lastInfo.version + 1,
		VERSION_FOLDER: adapterConfig.outputVersionDir,
		VERSION_FILE_BATCH_SIZE,
		MAX_VERSION_FILES,
		BASE_URL: baseURL
	};
};
export function generateVirtualModules(inputFiles: InputFiles, workerConstants: WorkerConstants): VirtualModuleSources {
	return [
		Object.entries(workerConstants).map(([name, value]) => `export const ${name} = ${JSON.stringify(value)};`).join(""),
		inputFiles.hooksSource?? ""
	];
};
export async function configureTypescript(configs: AllConfigs): Promise<Nullable<RollupTypescriptOptions>> {
	// TODO: allow asynchronously configuring TypeScript
	return {
		include: [
			path.join(adapterFilesPath, "static/src/worker/modules/virtualModules.d.ts")
		],
		compilerOptions: {
			target: "es2020",
			module: "ESNext",
			moduleResolution: "node",
			forceConsistentCasingInFileNames: true,
			strict: true,
			skipLibCheck: true,
	
			declaration: false,
			declarationMap: false
		},
		tsconfig: false
	};
};
export async function rollupBuild(
	entryFilePath: string, typescriptConfig: Nullable<RollupTypescriptOptions>,
	virtualModules: VirtualModuleSources, configs: AllConfigs
) {
	const { adapterConfig, minimalViteConfig } = configs;

	const tsPluginInstance = typescriptConfig? typescriptPlugin(typescriptConfig) : null;
	const bundle = await rollup({
		input: entryFilePath,
		plugins: [
			pluginVirtual({
				"sveltekit-adapter-versioned-worker/worker": virtualModules[0],
				"sveltekit-adapter-versioned-worker/internal/hooks": virtualModules[1]
			}),
			/*
			alias({
				entries: [
					{
						find: "sveltekit-adapter-versioned-worker/internal/hooks",
						replacement: "TODO"
					}
				]
			}),
			*/
			nodeResolve({
				browser: true
			}),
			esbuild({ minify: true }),
			tsPluginInstance
		],

		onwarn(warning: RollupLog, warn: WarningHandler) {
			if (
				warning.code === "MISSING_EXPORT"
				&& warning.exporter === "virtual:sveltekit-adapter-versioned-worker/internal/hooks"
			) return; // There's a null check so missing exports are fine

			warn(warning);
		}
	});
	await bundle.write({
		file: path.join(minimalViteConfig.root, adapterConfig.outputDir, adapterConfig.outputWorkerFileName),
		format: "iife"
	});
	await bundle.close();
};