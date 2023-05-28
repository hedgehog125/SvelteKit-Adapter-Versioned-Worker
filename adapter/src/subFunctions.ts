import type {
	ResolvedAdapterConfig,
	ResolvedManifestPluginConfig,
	MinimalViteConfig,
	
	LastInfoProviderConfigs,

	FileSortMode,

	Nullable,
	AllConfigs,
	ViteConfig,
	AdapterConfig,
	ManifestProcessorConfigs
} from "./types.js";
import type { WebAppManifest } from "./manifestTypes.js";
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
	createSuffixes,
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
import pluginAlias from "@rollup/plugin-alias";


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
	adapterConfig: Nullable<ResolvedAdapterConfig>, manifestConfig: Nullable<ResolvedManifestPluginConfig>,
	viteConfig: MinimalViteConfig
): Promise<InputFilesContents> {
	// I don't really want to flatten these so this is a bit overly complicated
	const asArrays = await Promise.all([
		(async (): Promise<[boolean, boolean]> => {
			if (adapterConfig == null) return [false, false]; // Only the case in dev mode, in which case these values aren't used

			const fileList = createSuffixes(adapterConfig.hooksFile, [".ts", ".js"]);
			const contents = await readGroup(fileList, true);
			return [contents[0] != null, contents[1] != null];
		})(),
		(async (): Promise<Nullable<
			[Nullable<string>, Nullable<string>]
		>> => {
			if (manifestConfig == null) return null;

			const fileList = createSuffixes(manifestConfig.src, [".webmanifest", ".json"]);
			return await readGroup(fileList) as [Nullable<string>, Nullable<string>];
		})()
	]);
	return asArrays;

	function readGroup(fileList: string[], justStat = false): Promise<Nullable<string>[]> {
		return Promise.all(fileList.map(async (fileName): Promise<Nullable<string>> => {
			const filePath = path.join(viteConfig.root, "src", fileName);
			if (! (await fileExists(filePath))) return null;

			if (justStat) return "";
			return await fs.readFile(filePath, { encoding: "utf8" });
		}));
	};
};
export function checkInputFiles(inputFileContents: InputFilesContents) {
	const [existingHooksFiles, manifestFilesContents] = inputFileContents;

	if (! (existingHooksFiles[0] || existingHooksFiles[1])) {
		throw new VersionedWorkerError("You can only have 1 hooks file. Please delete either the .js or .ts one.");
	}
	if (manifestFilesContents) {
		if (! (manifestFilesContents[0] == null || manifestFilesContents[1] == null)) {
			throw new VersionedWorkerError("You can only have 1 input web manifest file. Please delete either the .json or .webmanifest one.");
		}
	}
};
export function getInputFilesConfiguration(
	inputFileContents: InputFilesContents,
	config: Nullable<ResolvedAdapterConfig>
): InputFiles {
	const [existingHooksFiles, manifestFilesContents] = inputFileContents;

	let hooksFileName: Nullable<string> = null;
	const hooksIsTS = existingHooksFiles[0]; // The ts one exists
	if (config) { // The hooks file isn't used in dev mode
		const hooksFileNames = createSuffixes(config.hooksFile, [".ts", ".js"]);
		if (hooksIsTS) {
			hooksFileName = hooksFileNames[0];
		}
		else if (hooksFileNames[1]) hooksFileName = hooksFileNames[1];
	}

	const manifestJSONExtUsed = manifestFilesContents?.[1] != null;
	let manifestSource = null;
	if (manifestFilesContents) { // The plugin is being used
		manifestSource = manifestJSONExtUsed? manifestFilesContents[1] : manifestFilesContents[0];
	}

	return {
		hooksFileName,
		hooksIsTS,

		manifestSource
	};
};

export async function listAllBuildFiles(configs: AllConfigs): Promise<string[]> {
	const { minimalViteConfig, adapterConfig } = configs;

	const buildDirPath = path.join(minimalViteConfig.root, adapterConfig.outputDir);
	const list = await rReadDir(buildDirPath);	

	return (list
		.filter(fullFilePath => ! path.basename(fullFilePath).startsWith("."))
		.map(fullFilePath => normalizePath(path.relative(buildDirPath, fullFilePath)))
	);
};
export async function categorizeFilesIntoModes(completeFileList: string[], routeFiles: Set<string>, configs: AllConfigs): Promise<CategorizedBuildFiles> {
	const { minimalViteConfig, adapterConfig } = configs;

	const fileModes = await Promise.all(completeFileList.map(async (filePath: string): Promise<FileSortMode> => {
		const mimeType = lookup(filePath) || null;
		
		if (routeFiles.has(filePath)) return "never-cache"; // Routes are stored separately
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
export async function hashFiles(
	filteredFileList: string[], routeFiles: Set<string>,
	viteBundle: Nullable<OutputBundle>, configs: AllConfigs
): Promise<Map<string, string>> {
	const { minimalViteConfig, adapterConfig } = configs;
	const buildDirPath = path.join(minimalViteConfig.root, adapterConfig.outputDir);
	
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

	const routes = Array.from(builder.prerendered.pages).map(([ href ]) => href);

	let storagePrefix = "TODO";

	let baseURL = svelteConfig.kit.paths.base;
	if (! baseURL.endsWith("/")) baseURL += "/";

	return {
		ROUTES: routes,

		PRECACHE: addBase(categorizedBuildFiles.precache),
		LAZY_CACHE: addBase(categorizedBuildFiles.lazy),
		STALE_LAZY: addBase(categorizedBuildFiles.staleLazy),
		STRICT_LAZY: addBase(categorizedBuildFiles.strictLazy),
		SEMI_LAZY: addBase(categorizedBuildFiles.semiLazy),

		STORAGE_PREFIX: storagePrefix,
		VERSION: lastInfo.version + 1,
		VERSION_FOLDER: adapterConfig.outputVersionDir,
		VERSION_FILE_BATCH_SIZE,
		MAX_VERSION_FILES,
		BASE_URL: baseURL
	};

	function addBase(filePaths: string[]): string[] {
		return filePaths.map(filePath => `${svelteConfig.kit.paths.base}/${filePath}`);
	};
};
export function generateVirtualModules(workerConstants: WorkerConstants): VirtualModuleSources {
	return [
		Object.entries(workerConstants).map(([name, value]) => `export const ${name} = ${JSON.stringify(value)};`).join("")
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
	virtualModulesSources: VirtualModuleSources, inputFiles: InputFiles, configs: AllConfigs
): Promise<Nullable<string>> {
	// TODO: error handling. Return false if one occurs

	const { adapterConfig, minimalViteConfig } = configs;

	const tsPluginInstance = typescriptConfig? typescriptPlugin(typescriptConfig) : null;
	let virtualModules: Record<string, string> = {
		"sveltekit-adapter-versioned-worker/worker": virtualModulesSources[0]
	};

	let hooksPath: Nullable<string> = null;
	if (inputFiles.hooksFileName == null) { // Replace it with an empty module if it doesn't exist
		virtualModules["sveltekit-adapter-versioned-worker/internal/hooks"] = "export {};";
	}
	else {
		hooksPath = path.join(minimalViteConfig.root, "src", inputFiles.hooksFileName);
	}

	const bundle = await rollup({
		input: entryFilePath,
		plugins: [
			pluginVirtual(virtualModules),
			hooksPath != null && pluginAlias({
				entries: [
					{
						find: "sveltekit-adapter-versioned-worker/internal/hooks",
						replacement: hooksPath
					}
				]
			}),
			nodeResolve({
				browser: true
			}),
			esbuild({
				minify: true,
				sourceMap: false,
				target: "es2020",
				tsconfig: false
			}),
			tsPluginInstance
		],

		onwarn(warning: RollupLog, warn: WarningHandler) {
			if (warning.code === "MISSING_EXPORT") {
				const isHooksModule = (
					warning.exporter === "virtual:sveltekit-adapter-versioned-worker/internal/hooks"
					|| (inputFiles.hooksFileName && warning.exporter === hooksPath)
				);

				if (isHooksModule) return; // There's a null check so missing exports are fine
			}

			warn(warning);
		}
	});
	await bundle.write({
		file: path.join(minimalViteConfig.root, adapterConfig.outputDir, adapterConfig.outputWorkerFileName),
		format: "iife"
	});
	await bundle.close();

	return null;
};

export async function getManifestSource(
	inputFiles: InputFiles, manifestPluginConfig: ResolvedManifestPluginConfig,
	adapterConfig: Nullable<ResolvedAdapterConfig>, viteConfig: MinimalViteConfig
): Promise<Nullable<string>> {
	if (inputFiles == null) { // Dev mode
		const inputFileContents = await getInputFiles(adapterConfig, manifestPluginConfig, viteConfig);
		checkInputFiles(inputFileContents);
		return getInputFilesConfiguration(inputFileContents, adapterConfig).manifestSource;
	}
	else return inputFiles.manifestSource;
};
export async function processManifest(source: string, configs: ManifestProcessorConfigs): Promise<Nullable<string>> {
	let parsed: object;
	try {
		parsed = JSON.parse(source);
	}
	catch (error) {
		log.error(`Couldn't parse web app manifest. Error:\n${error}`);
		return null;
	}

	const processed = await configs.manifestPluginConfig.process(parsed, configs);
	return typeof processed === "string"? processed : JSON.stringify(processed);
};
/**
 * TODO
*/
// Re-exported by index.ts
export function defaultManifestProcessor(parsed: object, _: ManifestProcessorConfigs): object {
	const asManifest = parsed as WebAppManifest;

	/*
		Relative paths are already supported by the browser, so there isn't much to do here.
		They're resolved relative to the manifest
	*/

	if (asManifest.scope == null) asManifest.scope = "";
	if (asManifest.start_url == null) asManifest.start_url = "";


	return asManifest;
};