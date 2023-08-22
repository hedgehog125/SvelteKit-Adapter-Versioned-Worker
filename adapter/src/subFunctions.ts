import type {
	ResolvedAdapterConfig,
	ResolvedManifestPluginConfig,
	MinimalViteConfig,
	ManifestProcessorConfigs,
	LastInfoProviderConfigs,
	AllConfigs,

	Nullable,
	FileSortMode,
	CategorizedBuildFiles,
	ProcessedBuild,
	TypescriptConfig
} from "./types.js";
import type { WebAppManifest } from "./manifestTypes.js";
import type {
	UnprocessedInfoFile,
	UnprocessedV3InfoFile,
	InfoFileV3VersionBatch,
	InfoFileV2VersionBatch,

	InputFilesContents,
	InputFiles,

	VirtualModuleSources,
	WorkerConstants,
	InfoFileV3,
	WrappedRollupError
} from "./internalTypes.js";
import type { UpdatePriority } from "./worker/staticVirtual.js";

import type { LoggingFunction, OutputBundle, RollupBuild, RollupError, RollupLog, RollupWarning } from "rollup";
import type { Builder } from "@sveltejs/kit";


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
import pluginAlias from "@rollup/plugin-alias";
import pluginTypescript from "@rollup/plugin-typescript";
import pluginVirtualPromises from "./pluginVirtualPromises.js";
import ts from "typescript";


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
/**
 * @note This may modify `infoFile` in a way that means that it shouldn't be used.
 */
export function updateInfoFileIfNeeded(infoFile: UnprocessedInfoFile): UnprocessedV3InfoFile {
	if (infoFile.formatVersion !== 3) {
		if (infoFile.formatVersion === 1) {
			throw new VersionedWorkerError("Please release an update using the previous SvelteKit-Plugin-Versioned-Worker before using this adapter, as only that supports upgrading info files from version 1 to 2.");
		}
		else if (infoFile.formatVersion === 2) {
			let newVersions: (InfoFileV2VersionBatch | InfoFileV3VersionBatch)[] = infoFile.versions;
			// Trim the versions over 100, removing the oldest first
			if (newVersions.length > MAX_VERSION_FILES) {
				// ^ The version files are stored in batches, so this isn't multiplied by VERSION_FILE_BATCH_SIZE
				newVersions.splice(0, newVersions.length - MAX_VERSION_FILES);
			}

			newVersions = newVersions.map(batch => {
				const updatePriorities: UpdatePriority[] = Array.from(new Array(batch.updated.length), () => 2);

				return {
					formatVersion: 3,
					updated: batch.updated,
					updatePriorities
				} satisfies InfoFileV3VersionBatch;
			});

			return {
				formatVersion: 3,
				version: infoFile.version,
				versions: newVersions as InfoFileV3VersionBatch[],
				hashes: infoFile.hashes,
				majorUpdateValue: 0,
				criticalUpdateValue: 0
			};
		}
		else {
			throw new VersionedWorkerError(`Unsupported version ${infoFile.formatVersion} in the info file from the last build.`);
		}
	}

	return infoFile;
}
export function processInfoFile(infoFile: UnprocessedV3InfoFile): InfoFileV3 {
	const {
		formatVersion,
		version,
		versions,
		hashes,
		majorUpdateValue,
		criticalUpdateValue
	} = infoFile;
	
	return {
		formatVersion,
		version,
		versions,
		hashes: new Map(Object.entries(hashes)),
		majorUpdateValue,
		criticalUpdateValue
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
export function getUpdatePriority(lastInfo: InfoFileV3, { adapterConfig }: AllConfigs): UpdatePriority {
	const { isCriticalUpdate, isMajorUpdate } = adapterConfig;
	if (isCriticalUpdate === true) return 4;
	if (isMajorUpdate === true) return 3;

	// Neither of these will return if the value is false or 0
	if (isCriticalUpdate && isCriticalUpdate !== lastInfo.criticalUpdateValue) return 4;
	if (isMajorUpdate && isMajorUpdate !== lastInfo.majorUpdateValue) return 3;

	return 1;
}

export async function createWorkerFolder({ minimalViteConfig, adapterConfig }: AllConfigs) {
	const versionPath = path.join(minimalViteConfig.root, adapterConfig.outputDir, adapterConfig.outputVersionDir);
	await makeDir(versionPath);
}

/**
 * @note The returned path is absolute.
 */
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
	lastInfo: InfoFileV3, configs: AllConfigs
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

		REDIRECT_TRAILING_SLASH: adapterConfig.redirectTrailingSlash,
		ENABLE_PASSTHROUGH: adapterConfig.enablePassthrough,
		AUTO_PASSTHROUGH_CROSS_ORIGIN_REQUESTS: adapterConfig.autoPassthroughCrossOriginRequests,
		ENABLE_QUICK_FETCH: adapterConfig.enableQuickFetch,
		USE_HTTP_CACHE: adapterConfig.useHTTPCache
	};
}
export function generateVirtualModules(workerConstants: WorkerConstants): VirtualModuleSources {
	const staticVirtualModulePath = path.join(adapterFilesPath, "build/src/worker/staticVirtual.js");
	return [
		`${createConstantsModule(workerConstants)}\nexport * from ${JSON.stringify(staticVirtualModulePath)};`
	];
}
export async function configureTypescript(inputFiles: InputFiles, configs: AllConfigs): Promise<TypescriptConfig> {
	let tsConfig: TypescriptConfig = {
		include: [
			path.join(configs.minimalViteConfig.root, "src", "**")
		],
		paths: Object.fromEntries([
			["sveltekit-adapter-versioned-worker/worker", "../virtual-modules/worker"],
			["sveltekit-adapter-versioned-worker/internal/hooks", "../virtual-modules/hooks"],
			["sveltekit-adapter-versioned-worker/internal/worker-util-alias", "../build/src/worker/util"],
			["sveltekit-adapter-versioned-worker/internal/worker-shared", "../build/src/worker/shared"],
			["sveltekit-adapter-versioned-worker/internal/exported-by-svelte-module", "../build/src/exportedBySvelteModule"],
		].map(([moduleName, relativePath]) => [
			moduleName,
			[path.join(path.join(adapterFilesPath, "static", relativePath))]
		])),
		allowJs: ! inputFiles.hooksIsTS,
		rootDir: path.join(configs.minimalViteConfig.root, "src"),
		target: ts.ScriptTarget.ES2020,
		forceConsistentCasingInFileNames: true,
		strict: true,
		skipLibCheck: true,
		declaration: false,
		declarationMap: false
	} satisfies TypescriptConfig;

	if (inputFiles.hooksIsTS) {
		const output = await configs.adapterConfig.configureWorkerTypescript?.(tsConfig, configs);

		if (output) tsConfig = output;
	}

	return tsConfig;
}
export async function rollupBuild(
	entryFilePath: string, typescriptConfig: TypescriptConfig,
	virtualModulesSources: VirtualModuleSources, inputFiles: InputFiles, configs: AllConfigs
): Promise<WrappedRollupError[]> {
	const { adapterConfig, minimalViteConfig } = configs;

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
		},
		{
			find: "sveltekit-adapter-versioned-worker/internal/exported-by-svelte-module",
			replacement: path.join(adapterFilesPath, "build/src/exportedBySvelteModule.js")
		}
	];

	let hooksPath: Nullable<string>;
	if (inputFiles.hooksFileName == null) { // Replace it with an empty module if it doesn't exist
		virtualModules["sveltekit-adapter-versioned-worker/internal/hooks"] = "export {}";
	}
	else {
		hooksPath = path.join(minimalViteConfig.root, "src", inputFiles.hooksFileName);
		aliases.push({
			find: "sveltekit-adapter-versioned-worker/internal/hooks",
			replacement: hooksPath
		});
	}

	const outputPath = path.join(
		minimalViteConfig.root, adapterConfig.outputDir,
		...(adapterConfig.useWorkerScriptImport? [adapterConfig.outputVersionDir] : []), adapterConfig.outputWorkerFileName
	);
	let bundle: RollupBuild;
	let errors: WrappedRollupError[] = [];
	try {
		bundle = await rollup({
			input: entryFilePath,
			plugins: [
				pluginTypescript({
					...typescriptConfig,
					tsconfig: false,
					noEmitOnError: false // Setting this to true creates issues, so instead the warnings are collected and displayed as errors
				}),
				pluginVirtualPromises(virtualModules),
				pluginAlias({
					entries: aliases
				}),
				nodeResolve({
					browser: true
				}),
				// esbuild({ // TODO
				// 	minify: true,
				// 	sourceMap: false,
				// 	target: "es2020",
				// 	tsconfig: false
				// })
			],
	
			onwarn(warning, warn) {
				if (warning.code === "MISSING_EXPORT") {
					const isHooksModule = (
						warning.exporter === "virtual:sveltekit-adapter-versioned-worker/internal/hooks"
						|| (inputFiles.hooksFileName && warning.exporter === hooksPath)
					);
	
					if (isHooksModule) return; // There's a null check so missing exports are fine
				}
				if (warning.plugin === "typescript") {
					const { loc, frame, message, stack } = warning;
					errors.push({
						loc,
						frame,
						message,
						stack
					});
					return;
				}
	
				warn(warning);
			}
		});
	}
	catch (error: unknown) {
		const { loc, frame, message, stack } = error as RollupError;
		return [{
			loc,
			frame,
			message,
			stack
		}];
	}
	const posixWatchFiles = bundle.watchFiles.map(filePath => filePath.replaceAll(path.sep, "/"));
	errors = errors.filter(({ loc }) => loc?.file? posixWatchFiles.includes(loc.file) : true);

	await bundle.write({
		file: outputPath,
		sourcemap: adapterConfig.outputWorkerSourceMap,
		format: "iife"
	});
	await bundle.close();

	return errors;
}
/**
 * Writes a small file to the build that just runs the main script. Doing so reduces network usage.
 * 
 * @note
 * Not to be confused with writeWorkerEntry which refers to the entry during the build.
 */
export async function writeWorkerImporter(currentVersion: number, { adapterConfig, minimalViteConfig }: AllConfigs) {
	if (! adapterConfig.useWorkerScriptImport) return;

	const contents = `importScripts(${JSON.stringify(
		`${adapterConfig.outputVersionDir}/${WORKER_MAIN_FILENAME}?v=${currentVersion}`
	)})`;
	const entryPath = path.join(
		minimalViteConfig.root, adapterConfig.outputDir,
		adapterConfig.outputWorkerFileName
	);

	await fs.writeFile(entryPath, contents, { encoding: "utf-8" });
}

export function addNewVersionToInfoFile(
	infoFile: InfoFileV3, staticFileHashes: Map<string, string>,
	updatePriority: UpdatePriority, { adapterConfig }: AllConfigs
) {
	infoFile.version++;
	infoFile.majorUpdateValue = typeof adapterConfig.isMajorUpdate === "boolean"? 0 : adapterConfig.isMajorUpdate;
	infoFile.criticalUpdateValue = typeof adapterConfig.isCriticalUpdate === "boolean"? 0 : adapterConfig.isCriticalUpdate;


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
		formatVersion: 3,
		updated: [
			// The second isn't spread because this is a nested array
			...(lastVersion == null? [] : lastVersion.updated),
			Array.from(updated)
		],
		updatePriorities: [
			...(lastVersion == null? [] : lastVersion.updatePriorities),
			updatePriority
		]
	};
	if (infoFile.versions.length > MAX_VERSION_FILES) {
		infoFile.versions.splice(0, infoFile.versions.length - MAX_VERSION_FILES);
	}

	infoFile.hashes = staticFileHashes;
}
export async function writeVersionFiles(infoFile: InfoFileV3, { adapterConfig, minimalViteConfig }: AllConfigs) {
	const versionPath = path.join(minimalViteConfig.root, adapterConfig.outputDir, adapterConfig.outputVersionDir);

	await Promise.all([
		Promise.all(infoFile.versions.map(async (versionBatch, batchID) => {
			const fileBody = versionBatch.updated
				.map((updatedInVersion, index) => versionBatch.updatePriorities[index] + updatedInVersion.join("\n"))
				.join("\n\n")
			;
			const contents = `${versionBatch.formatVersion}\n${fileBody}`;

			await fs.writeFile(path.join(versionPath, `${batchID}.txt`), contents, { encoding: "utf-8" });
		})),
		fs.writeFile(path.join(versionPath, CURRENT_VERSION_FILENAME), infoFile.version.toString(), { encoding: "utf-8" })
	]);
}

export async function writeInfoFile(infoFile: InfoFileV3, { minimalViteConfig, adapterConfig }: AllConfigs) {
	const infoFilePath = path.join(minimalViteConfig.root, adapterConfig.outputDir, INFO_FILENAME);
	const contents = JSON.stringify(infoFile, (_, value) => {
		if (value instanceof Map) return Object.fromEntries(value);

		return value;
	});
	await fs.writeFile(infoFilePath, contents, { encoding: "utf-8" });
}
export async function callFinishHook(workerBuildSucceeded: boolean, processedBuild: ProcessedBuild, configs: AllConfigs) {
	await configs.adapterConfig.onFinish?.(workerBuildSucceeded, processedBuild, configs);
}
export function logInfoAndErrors(workerBuildErrors: WrappedRollupError[], { minimalViteConfig }: AllConfigs) {
	if (workerBuildErrors.length !== 0) {
		log.blankLine();
		log.blankLine();
		log.error(`Service worker failed to build. Reason${workerBuildErrors.length === 1? "" : "s"}:`);
		for (const workerBuildError of workerBuildErrors) {
			const { loc, frame, message, stack } = workerBuildError;
			const errorPositionInFile = loc? `On line ${loc.line}, column ${loc.column}` : "In an unknown position";
			const callStack = stack? `\nCall stack:\n${stack}\n` : "";
			const errorPosition = `${errorPositionInFile} in ${loc?.file? `the file "${normalizePath(path.relative(minimalViteConfig.root, loc.file))}"` : "an unknown file"}.`;
	
			log.error(`\n${message}\n${errorPosition}\n\n${frame?? ""}${callStack}`, false);
		}
	}
}


export function createRuntimeConstantsModule(
	adapterConfig: ResolvedAdapterConfig, lastInfo: InfoFileV3
): string {
	return createConstantsModule({
		VERSION: lastInfo.version + 1,
		REDIRECT_TRAILING_SLASH: adapterConfig.redirectTrailingSlash,
		ENABLE_PASSTHROUGH: adapterConfig.enablePassthrough,
		AUTO_PASSTHROUGH_CROSS_ORIGIN_REQUESTS: adapterConfig.autoPassthroughCrossOriginRequests,
		ENABLE_QUICK_FETCH: adapterConfig.enableQuickFetch,
		ENABLE_SECOND_UPDATE_PRIORITY_ELEVATION: adapterConfig.enableSecondUpdatePriorityElevation,
		USE_HTTP_CACHE: adapterConfig.useHTTPCache,
		CHECK_FOR_UPDATES_INTERVAL: adapterConfig.checkForUpdatesInterval
	});
}
export function createPlaceholderRuntimeConstantsModule(): string {
	return createConstantsModule(
		Object.fromEntries([
			"VERSION",
			"REDIRECT_TRAILING_SLASH",
			"ENABLE_PASSTHROUGH",
			"AUTO_PASSTHROUGH_CROSS_ORIGIN_REQUESTS",
			"ENABLE_QUICK_FETCH",
			"ENABLE_SECOND_UPDATE_PRIORITY_ELEVATION",
			"USE_HTTP_CACHE",
			"CHECK_FOR_UPDATES_INTERVAL"
		].map(key => [key, null]))
	);
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