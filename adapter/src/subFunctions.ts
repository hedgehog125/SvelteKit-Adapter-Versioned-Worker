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
import type { LoggingFunction, OutputBundle, RollupLog } from "rollup";
import type { Builder } from "@sveltejs/kit";
import pluginVirtualPromises from "./pluginVirtualPromises.js";
import type { RollupTypescriptOptions } from "@rollup/plugin-typescript";

import {
	VersionedWorkerError,

	adapterFilesPath,
	createInitialInfo,
	createSuffixes,
	fileExists,
	hash,
	findUniqueFileName,
	createConstantsModule,
	removeNulls
} from "./helper.js";
import { log } from "./globals.js";
import {
	VERSION_FILE_BATCH_SIZE, MAX_VERSION_FILES,
	CURRENT_VERSION_FILENAME, INFO_FILENAME, DEFAULT_STORAGE_NAME,
	WORKER_MAIN_FILENAME
} from "./constants.js";

import * as fs from "fs/promises";
import * as path from "path";
import { normalizePath } from "vite";
import { lookup } from "mime-types";
import rReadDir from "recursive-readdir";
import makeDir from "make-dir";

import { rollup } from "rollup";
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
}
export function updateInfoFileIfNeeded(infoFile: UnprocessedInfoFile) {
	let formatVersion = infoFile.formatVersion;
	if (formatVersion !== 3) {
		if (formatVersion === 1) {
			throw new VersionedWorkerError("Please release an update using the previous SvelteKit-Plugin-Versioned-Worker before using this adapter, as only that supports upgrading info files from version 1 to 2.");
		}
		else if (formatVersion === 2) {
			// Trim the versions over 100, removing the oldest first
			if (infoFile.versions.length > MAX_VERSION_FILES) { // The version files are stored in batches, so this isn't multiplied by VERSION_FILE_BATCH_SIZE
				infoFile.versions.splice(0, infoFile.versions.length - MAX_VERSION_FILES);
			}

			formatVersion = 3;
			infoFile.formatVersion = formatVersion;
		}
		else {
			throw new VersionedWorkerError(`Unsupported version ${formatVersion} in the info file from the last build.`);
		}
	}
}
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
}

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
	}
}
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
}
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
}

export async function listAllBuildFiles(configs: AllConfigs): Promise<string[]> {
	const { minimalViteConfig, adapterConfig } = configs;

	const buildDirPath = path.join(minimalViteConfig.root, adapterConfig.outputDir);
	const list = await rReadDir(buildDirPath);	

	return (list
		.filter(fullFilePath => ! path.basename(fullFilePath).startsWith("."))
		.map(fullFilePath => normalizePath(path.relative(buildDirPath, fullFilePath)))
	);
}
export async function listStaticFolderFiles(configs: AllConfigs): Promise<string[]> {
	const { svelteConfig } = configs;

	const staticDirPath = path.join(svelteConfig.kit.files.assets);
	const list = await rReadDir(staticDirPath);	

	return (list
		.filter(fullFilePath => ! path.basename(fullFilePath).startsWith("."))
		.map(fullFilePath => normalizePath(path.relative(staticDirPath, fullFilePath)))
	);
}
export async function categorizeFilesIntoModes(
	completeFileList: string[], staticFolderFileList: string[],
	routeFiles: Set<string>, fileSizes: Map<string, number>,
	viteBundle: Nullable<OutputBundle>, configs: AllConfigs
): Promise<CategorizedBuildFiles> {
	const { minimalViteConfig, adapterConfig } = configs;
	const buildDirPath = path.join(minimalViteConfig.root, adapterConfig.outputDir);

	const fullFileListAsSet = new Set(completeFileList);
	const staticFolderFileListAsSet = new Set(staticFolderFileList);

	const fileModes = await Promise.all(completeFileList.map(async (filePath, fileID): Promise<FileSortMode> => {
		const mimeType = lookup(filePath) || null;
		
		if (routeFiles.has(filePath)) return "never-cache"; // Routes are stored separately
		if (filePath === minimalViteConfig.manifest) return "never-cache";
		if (filePath === "robots.txt") return "never-cache";

		if (adapterConfig.sortFile == null) return "pre-cache";


		const viteInfo = viteBundle?.[filePath]?? null;
		let isStatic: Nullable<boolean> = null;
		if (staticFolderFileListAsSet.has(filePath)) {
			isStatic = true;
		}
		else if (viteInfo) {
			isStatic = viteInfo?.name == null;
		}

		return await adapterConfig.sortFile({
			href: filePath,
			localFilePath: path.join(buildDirPath, filePath),
			mimeType,
			isStatic,
			size: fileSizes.get(filePath) as number,
			fileID,
			viteInfo,

			addBuildMessage(message) {
				// TODO
			},
			addBuildWarning(message) {
				// TODO
			}
		}, {
			viteBundle,
			fullFileList: fullFileListAsSet,
			routeFiles,
			fileSizes
		}, configs);
	}));

	let precache: string[] = [];
	let laxLazy: string[] = [];
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
		else if (fileMode === "lax-lazy") laxLazy.push(fileName);
		else if (fileMode === "stale-lazy") staleLazy.push(fileName);
		else if (fileMode === "strict-lazy") strictLazy.push(fileName);
		else if (fileMode === "semi-lazy") semiLazy.push(fileName);
	}

	return {
		precache,
		laxLazy,
		staleLazy,
		strictLazy,
		semiLazy,

		completeList
	};
}
export async function hashFiles(
	filteredFileList: string[], routeFiles: Set<string>,
	viteBundle: Nullable<OutputBundle>, configs: AllConfigs
): Promise<Map<string, string>> {
	const { minimalViteConfig, adapterConfig } = configs;
	const buildDirPath = path.join(minimalViteConfig.root, adapterConfig.outputDir);
	
	return new Map(removeNulls(await Promise.all(filteredFileList.map(async (filePath): Promise<Nullable<string>> => {
		if (routeFiles.has(filePath)) return null; // They're assumed to have changed

		const bundleInfo = viteBundle?.[filePath];
		if (bundleInfo?.name) return null; // Has a hash in its filename

		const contents = bundleInfo?
			(bundleInfo?.type === "chunk"? bundleInfo.code : bundleInfo.source)
			: await fs.readFile(path.join(buildDirPath, filePath))
		;
		return hash(contents);
	}))).map((fileHash, fileIndex) => [filteredFileList[fileIndex], fileHash]));
}
export async function getFileSizes(
	filteredFileList: string[], viteBundle: Nullable<OutputBundle>,
	configs: AllConfigs
): Promise<Map<string, number>> {
	const { minimalViteConfig, adapterConfig } = configs;
	const buildDirPath = path.join(minimalViteConfig.root, adapterConfig.outputDir);
	
	return new Map((await Promise.all(filteredFileList.map(async (filePath): Promise<number> => {
		const bundleInfo = viteBundle?.[filePath];

		const inMemoryContents = bundleInfo?
			(bundleInfo?.type === "chunk"? bundleInfo.code : bundleInfo.source)
			: null
		;
		const size = inMemoryContents == null?
			(await fs.stat(path.join(buildDirPath, filePath))).size
			: Buffer.byteLength(inMemoryContents)
		;

		return size;
	}))).map((size, fileIndex) => [filteredFileList[fileIndex], size]));
}

export async function createWorkerFolder({ minimalViteConfig, adapterConfig }: AllConfigs) {
	const versionPath = path.join(minimalViteConfig.root, adapterConfig.outputDir, adapterConfig.outputVersionDir);
	await makeDir(versionPath);
}

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
}
export function createWorkerConstants(
	categorizedBuildFiles: CategorizedBuildFiles, builder: Builder,
	lastInfo: InfoFile, configs: AllConfigs
): WorkerConstants {
	const { adapterConfig, svelteConfig } = configs;

	let baseURL = svelteConfig.kit.paths.base + "/";
	const routes = Array.from(builder.prerendered.pages).map(([ href ]) => href.slice(baseURL.length));

	let storagePrefix = adapterConfig.cacheStorageName;
	if (storagePrefix == null) {
		const base = svelteConfig.kit.paths.base;
		storagePrefix = base == ""? DEFAULT_STORAGE_NAME : base.slice(1); // Remove the starting slash
	}
	storagePrefix += "-";

	return {
		ROUTES: routes,

		PRECACHE: categorizedBuildFiles.precache,
		LAX_LAZY: categorizedBuildFiles.laxLazy,
		STALE_LAZY: categorizedBuildFiles.staleLazy,
		STRICT_LAZY: categorizedBuildFiles.strictLazy,
		SEMI_LAZY: categorizedBuildFiles.semiLazy,

		STORAGE_PREFIX: storagePrefix,
		VERSION: lastInfo.version + 1,
		VERSION_FOLDER: adapterConfig.outputVersionDir,
		VERSION_FILE_BATCH_SIZE,
		MAX_VERSION_FILES,
		BASE_URL: baseURL,

		ENABLE_PASSTHROUGH: adapterConfig.enablePassthrough
	};
}
export function generateVirtualModules(workerConstants: WorkerConstants): VirtualModuleSources {
	const staticVirtualModulePath = path.join(adapterFilesPath, "build/src/worker/staticVirtual.js");
	return [
		`${createConstantsModule(workerConstants)}\nexport * from ${JSON.stringify(staticVirtualModulePath)};`
	];
}
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
}
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
	let aliases = [
		{
			find: "sveltekit-adapter-versioned-worker/internal/worker-util-alias",
			replacement: path.join(adapterFilesPath, "build/src/worker/util.js")
		},
		{
			find: "sveltekit-adapter-versioned-worker/internal/worker-shared",
			replacement: path.join(adapterFilesPath, "build/src/worker/shared.js")
		}
	];

	let hooksPath: Nullable<string>;
	if (inputFiles.hooksFileName == null) { // Replace it with an empty module if it doesn't exist
		virtualModules["sveltekit-adapter-versioned-worker/internal/hooks"] = "export {};";
	}
	else {
		hooksPath = path.join(minimalViteConfig.root, "src", inputFiles.hooksFileName);
		aliases.push({
			find: "sveltekit-adapter-versioned-worker/internal/hooks",
			replacement: hooksPath
		});
	}

	const outputFileName = path.join(
		minimalViteConfig.root, adapterConfig.outputDir,
		adapterConfig.outputVersionDir, adapterConfig.outputWorkerFileName
	);
	const bundle = await rollup({
		input: entryFilePath,
		plugins: [
			pluginVirtualPromises(virtualModules),
			pluginAlias({
				entries: aliases
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

		onwarn(warning: RollupLog, warn: LoggingFunction) {
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
		file: outputFileName,
		format: "iife"
	});
	await bundle.close();

	return null;
}
/**
 * Writes a small file to the build that just runs the main script. Doing so reduces network usage.
 * 
 * @note
 * Not to be confused with writeWorkerEntry which refers to the entry during the build.
 */
export async function writeWorkerImporter(currentVersion: number, { adapterConfig, minimalViteConfig }: AllConfigs) {
	const contents = `importScripts(${JSON.stringify(
		`${adapterConfig.outputVersionDir}/${WORKER_MAIN_FILENAME}?v=${currentVersion}`
	)})`;
	const entryPath = path.join(
		minimalViteConfig.root, adapterConfig.outputDir,
		adapterConfig.outputWorkerFileName
	);

	await fs.writeFile(entryPath, contents, { encoding: "utf-8" });
}

export function addNewVersionToInfoFile(infoFile: InfoFile, staticFileHashes: Map<string, string>) {
	infoFile.version++;

	const isNewBatch = infoFile.version % VERSION_FILE_BATCH_SIZE === 0;
	const lastVersion = isNewBatch?
		null
		: infoFile.versions[infoFile.versions.length - 1]
	;
	let updated = new Set<string>();
	for (const [fileName, hash] of infoFile.hashes) { // This doesn't loop over any files that were added this version, so they can't be added to updated
		if (! staticFileHashes.has(fileName)) continue; // File removed in this version

		if (staticFileHashes.get(fileName) !== hash) {
			updated.add(fileName);
		}
	}

	const index = isNewBatch?
		infoFile.versions.length
		: infoFile.versions.length - 1
	;
	infoFile.versions[index] = {
		formatVersion: 2,
		updated: [ // The second isn't spread because this is a nested array
			...(lastVersion == null? [] : lastVersion.updated),
			Array.from(updated)
		]
	};
	if (infoFile.versions.length > MAX_VERSION_FILES) {
		infoFile.versions.splice(0, infoFile.versions.length - MAX_VERSION_FILES);
	}

	infoFile.hashes = staticFileHashes;
}
export async function writeVersionFiles(infoFile: InfoFile, { adapterConfig, minimalViteConfig }: AllConfigs) {
	const versionPath = path.join(minimalViteConfig.root, adapterConfig.outputDir, adapterConfig.outputVersionDir);

	await Promise.all([
		Promise.all(infoFile.versions.map(async (versionBatch, batchID) => {
			const fileBody = versionBatch.updated
				.map(updatedInVersion => updatedInVersion.join("\n"))
				.join("\n\n")
			;
			const contents = `${versionBatch.formatVersion}\n${fileBody}`;

			await fs.writeFile(path.join(versionPath, `${batchID}.txt`), contents, { encoding: "utf-8" });
		})),
		fs.writeFile(path.join(versionPath, CURRENT_VERSION_FILENAME), infoFile.version.toString(), { encoding: "utf-8" })
	]);
}

export async function writeInfoFile(infoFile: InfoFile, { minimalViteConfig, adapterConfig }: AllConfigs) {
	const infoFilePath = path.join(minimalViteConfig.root, adapterConfig.outputDir, INFO_FILENAME);
	const contents = JSON.stringify(infoFile, (_, value) => {
		if (value instanceof Map) return Object.fromEntries(value);

		return value;
	});
	await fs.writeFile(infoFilePath, contents, { encoding: "utf-8" });
}


export function createRuntimeConstantsModule(
	adapterConfig: ResolvedAdapterConfig, lastInfo: InfoFile
): string {
	return createConstantsModule({
		VERSION: lastInfo.version + 1,
		ENABLE_PASSTHROUGH: adapterConfig.enablePassthrough
	});
}
export function createPlaceholderRuntimeConstantsModule(): string {
	return createConstantsModule({
		VERSION: null,
		ENABLE_PASSTHROUGH: null
	});
}

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
}
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
}
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
}