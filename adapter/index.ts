import type { Adapter, Builder } from "@sveltejs/kit";
import type {
	AdapterConfig,
	ResolvedAdapterConfig,
	ManifestPluginConfig,
	ResolvedManifestPluginConfig,
	MinimalViteConfig,
	ValuesFromViteConfig,
	
	VersionedWorkerLogger,
	LastInfoProvider,
	FileSorter,
	FileSortMode,
	VWBuildFile,
	BuildInfo,
	BuildFinishHook,
	ManifestProcessor,
	LastInfoProviderConfigs,
	ManifestProcessorConfigs,

	ProcessedBuild,
	CategorizedBuildFiles,

	AllConfigs,
	ViteConfig,

	TypescriptConfig,
	Nullable,
	MaybePromise
} from "./src/types.js";
import { WebAppManifest } from "./src/manifestTypes.js";
import type {
	InputFiles,
	InfoFileV3,
	WrappedRollupError
} from "./src/internalTypes.js";
import type { Plugin } from "vite"; 
import type { OutputOptions, OutputBundle } from "rollup";

import { INFO_FILENAME } from "./src/constants.js";
import { log } from "./src/globals.js";
import {
	VersionedWorkerError,
	timePromise
} from "./src/helper.js";
import {
	getLastInfo,
	updateInfoFileIfNeeded,
	processInfoFile,

	getInputFiles,
	checkInputFiles,
	getInputFilesConfiguration,

	listAllBuildFiles,
	listStaticFolderFiles,
	getFileSizes,
	categorizeFilesIntoModes,
	hashFiles,
	getUpdatePriority,

	writeWorkerEntry,
	createWorkerConstants,
	generateVirtualModules,
	configureTypescript,
	createWorkerFolder,
	rollupBuild,
	writeWorkerImporter,
	
	addNewVersionToInfoFile,
	writeVersionFiles,

	writeInfoFile,
	callFinishHook,
	logOverallBuildInfo,
	logFileSorterMessages,
	logWorkerBuildErrors,

	createRuntimeConstantsModule,
	createPlaceholderRuntimeConstantsModule,
	getManifestSource,
	processManifest,
	defaultManifestProcessor
} from "./src/subFunctions.js";
import {
	applyAdapterConfigDefaults,
	applyManifestPluginConfigDefaults
} from "./src/defaults.js";
import adapterStatic from "@sveltejs/adapter-static";
import pluginVirtualPromises from "./src/pluginVirtualPromises.js";

import * as path from "path";
import * as fs from "fs/promises";

import { installPolyfills } from "@sveltejs/kit/node/polyfills";
import { UpdatePriority } from "./src/worker/staticVirtual.js";
installPolyfills();

export {
	AdapterConfig,
	ResolvedAdapterConfig,
	ManifestPluginConfig,
	ResolvedManifestPluginConfig,
	MinimalViteConfig,
	
	VersionedWorkerLogger,
	LastInfoProvider,
	FileSorter,
	FileSortMode,
	VWBuildFile,
	BuildInfo,
	BuildFinishHook,
	ProcessedBuild,
	CategorizedBuildFiles,
	ManifestProcessor,

	ManifestProcessorConfigs,
	LastInfoProviderConfigs,
	AllConfigs,

	ValuesFromViteConfig,
	WebAppManifest,
	Nullable,
	MaybePromise,
	TypescriptConfig,

	defaultManifestProcessor
};

let viteConfig: Nullable<ViteConfig> = null; // From manifestGenerator
let viteBundle: Nullable<OutputBundle> = null;

let minimalViteConfig: MinimalViteConfig; 
let adapterConfig: Nullable<ResolvedAdapterConfig> = null;
let manifestPluginConfig: Nullable<ResolvedManifestPluginConfig> = null;

let lastInfo: InfoFileV3;
let inputFiles: InputFiles;
let isSSR: boolean;
let isDev: boolean;


let initTask: Nullable<Promise<void>> = null;
let initTaskDone = false;

/**
 * When called with an `AdapterConfig` object, this function returns a SvelteKit adapter that builds your service worker.
 * 
 * @param inputConfig The required configuration object for this adapter. It should have a `fetchLast` property
 * @returns A SvelteKit adapter that builds your service worker
 */
export function adapter(inputConfig: AdapterConfig): Adapter {
	if (typeof inputConfig !== "object" || typeof inputConfig.lastInfo !== "function") {
		throw new VersionedWorkerError("This adapter requires a configuration object with a \"lastInfo\" function.");
	}
	const config = applyAdapterConfigDefaults(inputConfig);
	adapterConfig = config;

	const adapterInstance = adapterStatic({ pages: adapterConfig.outputDir });

	return {
		name: "adapter-versioned-worker",
		async adapt(builder: Builder) {
			// If readLast is being used, the read can stop the build directory from being cleared, causing adapterInstance.adapt to throw
			if (! initTaskDone) {
				const initRanLate = initTask == null;
				if (initRanLate) initTask = init(config);

				log.message("Waiting for background tasks..." + (initRanLate? " (they were started late due to the manifest plugin not being used)" : ""));
				await initTask;
			}

			const configs = {
				viteConfig,
				svelteConfig: builder.config,
				minimalViteConfig,
				adapterConfig: config,
				manifestPluginConfig
			} satisfies AllConfigs;

			log.message("Running the static adapter...");
			await adapterInstance.adapt(builder);
			log.blankLine();
			
			// I know the different write methods return arrays of files, but I don't feel like maintaining a fork of adapter-static just to do that. So listing the files in the directory it is

			log.message("Processing build...");
			const processedBuild = await processBuild(configs, builder);
			log.message("Building worker...");
			const buildErrors = await buildWorker(processedBuild.categorizedFiles, builder, configs);
			if (buildErrors.length !== 0) {
				log.error("Build failed, details will be logged after the other steps finish.");
			}

			log.message("Creating new version...");
			await createNewVersion(processedBuild.staticFileHashes, processedBuild.updatePriority, configs);
			log.message("Finishing up...");
			await finishUp(buildErrors, processedBuild, configs);
		}
	};
}

/**
 * Call this function, optionally with a `ManifestPluginConfig` object, to get a Vite plugin that manages your web app manifest.
 * 
 * @param inputConfig An optional configuration object for this Vite plugin
 * @returns An array of Vite plugins which generate manifests and improves the adapter
 * 
 * @note
 * You should still use this plugin even if you don't want to use its main feature, as it improves a few things about the adapter. To do this, set the `enable` property in the `inputConfig` to `false`.
 */
export function manifestGenerator(inputConfig: ManifestPluginConfig = {}): Plugin[] {
	manifestPluginConfig = applyManifestPluginConfigDefaults(inputConfig);
	const config = manifestPluginConfig;
	let manifestPlugin: Plugin = null as unknown as Plugin; // It'll be defined by the time its used
	const configResolved = new Promise<void>(resolveConfigPromise => {
		manifestPlugin = {
			name: "vite-plugin-vw2-manifest",
			configResolved(providedViteConfig) {
				viteConfig = providedViteConfig;
				isDev = ! viteConfig.isProduction;
				if (isDev) {
					minimalViteConfig = {
						root: viteConfig.root,
						manifest: viteConfig.build.manifest
					};
				}

				log.verbose = viteConfig.logLevel === "info";
				isSSR = !!viteConfig.build.ssr;

				if (isSSR || isDev) return resolveConfigPromise();
				if (adapterConfig != null) initTask = init(adapterConfig);
				resolveConfigPromise();
			},
			async buildStart() {
				if (isSSR || isDev) return;

				const manifestContents = await generateManifest();
				if (manifestContents != null) {
					this.emitFile({
						type: "asset",
						fileName: config.outputFileName,
						source: manifestContents
					});
				}
			},
			configureServer(server) { // Dev only
				server.middlewares.use(async (req, res, next) => {
					if (req.url != "/" + config.outputFileName) return next();

					const contents = await generateManifest();
					if (contents == null) return next();

					res.setHeader("Content-Type", "application/manifest+json");
					res.end(contents, "utf-8");
				});
			},
			generateBundle(_: OutputOptions, _bundle: OutputBundle) {
				viteBundle = _bundle;
			}
		}
	});

	return [
		{
			...pluginVirtualPromises({
				"sveltekit-adapter-versioned-worker/runtime-constants": (async (): Promise<string> => {
					await configResolved;

					if (adapterConfig == null || initTask == null) return createPlaceholderRuntimeConstantsModule();
					
					await Promise.race([
						initTask,
						timePromise(1500)
					]);
	
					if (! initTaskDone) {
						log.blankLine();
						log.warn("The LastInfoProvider might be delaying the build. If you're using fetchLast, this could be due to your internet connection.");
						await initTask;
					}

					return createRuntimeConstantsModule(adapterConfig, lastInfo);
				})()
			}),
			name: "vite-plugin-vw2-virtual-modules",
			enforce: "pre",
			apply: "build" // The non-virtual module will be used instead in this case
		},
		manifestPlugin
	];
}

/* Adapter */

async function init(config: ResolvedAdapterConfig) { // Not run in dev mode
	minimalViteConfig = viteConfig?
		{
			root: viteConfig.root,
			manifest: viteConfig.build.manifest
		}
		: {
			root: process.cwd(),
			manifest: "vite-manifest.json"
		}
	;
	if (viteConfig == null) {
		if (config.warnOnViteConfigUnresolved) {
			log.warn("Couldn't get Vite's config because you're not using the (built-in) manifest generator plugin. If you don't want to use the manifest plugin for whatever reason, I'd strongly suggest still having the plugin in your Vite config, just with the plugin's \"enabled\" option set to false in its config object. Otherwise you'll likely experience longer build times and generally more funkiness.\n\nIf you like, you can disable this warning by setting \"warnOnViteConfigUnresolved\" in the adapter's config object to false.");
		}
	}

	await Promise.all([
		(async () => {
			let unprocessed = await getLastInfo({
				viteConfig,
				minimalViteConfig,
				adapterConfig: config,
				manifestPluginConfig
			});
			unprocessed = updateInfoFileIfNeeded(unprocessed);
			lastInfo = processInfoFile(unprocessed);
		})(),
		(async () => {
			const inputFileContents = await getInputFiles(config, manifestPluginConfig, minimalViteConfig);
			checkInputFiles(inputFileContents);
			inputFiles = getInputFilesConfiguration(inputFileContents, config);
		})()
	]);

	initTaskDone = true;
}

async function processBuild(configs: AllConfigs, builder: Builder): Promise<ProcessedBuild> {	
	const [fullFileList, staticFolderFileList] = await Promise.all([
		listAllBuildFiles(configs),
		listStaticFolderFiles(configs)
	]);
	const routeFiles = new Set(Array.from(builder.prerendered.pages).map(([, { file }]) => file));

	const fileSizes = await getFileSizes(fullFileList, viteBundle, configs);
	const [categorizedFiles, fileSorterMessages] = await categorizeFilesIntoModes(fullFileList, staticFolderFileList, routeFiles, fileSizes, viteBundle, configs);
	const staticFileHashes = await hashFiles(categorizedFiles.completeList, routeFiles, viteBundle, configs);
	const updatePriority = getUpdatePriority(lastInfo, configs);

	return {
		categorizedFiles,
		fileSorterMessages,
		routeFiles,
		staticFileHashes,
		fileSizes,
		updatePriority
	};
}
async function buildWorker(categorizedFiles: CategorizedBuildFiles, builder: Builder, configs: AllConfigs): Promise<WrappedRollupError[]> {
	const entryFilePath = await writeWorkerEntry(inputFiles, configs);

	const workerConstants = createWorkerConstants(categorizedFiles, builder, lastInfo, configs);
	const virtualModules = generateVirtualModules(workerConstants);
	const typescriptConfig = await configureTypescript(inputFiles, configs);

	await createWorkerFolder(configs);
	const errors = await rollupBuild(entryFilePath, typescriptConfig, virtualModules, inputFiles, configs);
	await fs.rm(entryFilePath);
	if (errors.length !== 0) return errors;

	await writeWorkerImporter(lastInfo.version + 1, configs);
	return [];
}
async function createNewVersion(staticFileHashes: Map<string, string>, updatePriority: UpdatePriority, configs: AllConfigs) {
	addNewVersionToInfoFile(lastInfo, staticFileHashes, updatePriority, configs);
	await writeVersionFiles(lastInfo, configs);
}
async function finishUp(workerBuildErrors: WrappedRollupError[], processedBuild: ProcessedBuild, configs: AllConfigs) {
	await writeInfoFile(lastInfo, configs);
	await callFinishHook(workerBuildErrors == null, processedBuild, configs);
	logOverallBuildInfo(processedBuild, lastInfo, configs);
	logFileSorterMessages(processedBuild);
	logWorkerBuildErrors(workerBuildErrors, configs);
}

/* Manifest Generation */

async function generateManifest(): Promise<Nullable<string>> {
	const configs: ManifestProcessorConfigs = {
		viteConfig: viteConfig!, // It's only null when the plugin isn't being used
		minimalViteConfig,
		adapterConfig,
		manifestPluginConfig: manifestPluginConfig! // Same here
	};

	const source = await getManifestSource(
		inputFiles, manifestPluginConfig!, // And here
		adapterConfig, minimalViteConfig
	);
	if (source == null) return null;

	return await processManifest(source, configs);
}

/**
 * A premade `LastInfoProvider` for use with the `lastInfo` property in the adapter config. Call this function with the URL of your versionedWorker.json file (or the URL of where it *will* be) and then set `lastInfo` to the return value.
 * 
 * @param url The URL of your versionedWorker.json file or where it will be
 * @returns A `LastInfoProvider` that gets your versionedWorker.json file using the Fetch API
 * 
 * @note Most of the time you'll want to use `standardGetLast` instead, as it allows you to test how builds update locally
 * 
 * @example
 * // svelte.config.js
 * import { adapter, fetchLast } from "sveltekit-adapter-versioned-worker";
 * // ...
 * 
 * const config = {
 *   kit: {
 *     // ...
 *     adapter: adapter({
 *       lastInfo: fetchLast("https://hedgehog125.github.io/SvelteKit-Adapter-Versioned-Worker/versionedWorker.json"),
 *       // ...
 *     })
 *     // ...
 *   }
 * };
 * // ...
 */
export function fetchLast(url: string): LastInfoProvider {
	return async (log): Promise<Nullable<string>> => {
		let response;
		try {
			response = await fetch(url);
		}
		catch {
			log.warn("\nCouldn't download the versionedWorker.json file from the last build due a network error. So that this build can finish, this will be treated as the first build. You probably don't want to deploy this.");
			return null;
		}

		if (response.ok) return await response.text();
		else {
			if (response.status === 404) {
				log.warn("\nAssuming this is the first version, as attempting to download the versionedWorker.json file from the last build resulted in a 404.");
				return null;
			}
			else {
				throw new VersionedWorkerError(`Got a ${response.status} HTTP error while trying to download the last versionedWorker.json file.`);
			}
		}
	};
}

/**
 * Another premade `LastInfoProvider` for use with the `lastInfo` property in the adapter config. Unless you're storing the file outside of the build directory, this function doesn't need any arguments.
 * 
 * @param filePath The absolute or relative file path to your versionedWorker.json file, or where it will be.
 * **Default**: `<adapterConfig.outputDir>/versionedWorker.json`.
 * @returns A `LastInfoProvider` that gets your versionedWorker.json file by reading it from the disk.
 * 
 * @note
 * For production builds, you'll probably want to use `fetchLast`, as that will prevent you publishing useless information about test builds (i.e the number of them and the files changed between them). However, this is good to use for test builds, as it means you can check the update behaviour. Because of these pros and cons, it's best to use `standardGetLast` to use the correct one for the type of build.
 * 
 * @example
 * // svelte.config.js
 * import { adapter, readLast } from "sveltekit-adapter-versioned-worker";
 * 
 * // ...
 * 
 * const config = {
 *   kit: {
 *     // ...
 *     adapter: adapter({
 *       lastInfo: readLast(), // This will default to "<adapterConfig.outputDir>/versionedWorker.json"
 *       // ...
 *     })
 *     // ...
 *   }
 * };
 * // ...
 */
export function readLast(filePath?: string): LastInfoProvider {
	return async (log, { minimalViteConfig, adapterConfig }): Promise<Nullable<string>> => {
		if (filePath == null) {
			filePath = path.join(minimalViteConfig.root, adapterConfig.outputDir, INFO_FILENAME);
		}
		else {
			if (! path.isAbsolute(filePath)) filePath = path.join(minimalViteConfig.root, filePath);
		}

		let contents;
		try {
			contents = await fs.readFile(filePath, { encoding: "utf8" });
		}
		catch {
			log.warn("\nAssuming this is the first version as the versionedWorker.json file doesn't exist at that path.");
			return null;
		}

		return contents;
	};
}

/**
 * The `LastInfoProvider` that you want to use most of the time. It uses `readLast` for development builds and `fetchLast` for production ones.
 * 
 * @param url The URL of your versionedWorker.json file or where it will be.
 * @param isDev If this is a development build or not.
 * @param filePath The path to your versionedWorker.json file or where it will be. **Default**: `<adapterConfig.outputDir>/versionedWorker.json`.
 * @returns A `LastInfoProvider` that will either fetch or read your last info file.
 * 
 * @example
 * // svelte.config.js
 * import { adapter, standardGetLast } from "sveltekit-adapter-versioned-worker";
 * 
 * const isDev = process.env.DEV_BUILD === "true";
 * // ...
 * const config = {
 *   kit: {
 *     // ...
 *     adapter: adapter({
 *       lastInfo: standardGetLast(
 *         "https://hedgehog125.github.io/SvelteKit-Adapter-Versioned-Worker/versionedWorker.json",
 *         isDev
 *       ),
 *       // ...
 *     })
 *     // ...
 *   }
 * };
 * // ...
 */
export function standardGetLast(url: string, isDev: boolean, filePath?: string): LastInfoProvider {
	return isDev?
		readLast(filePath)
		: fetchLast(url)
	;
}

/**
 * An object containing the values you shared from the `vite.config.ts` file. This is intended to be used in your `svelte.config.js` file.
 * 
 * @see `shareValueWithSvelteConfig` for how to share a value
 * @example
 * // vite.config.ts
 * // ...
 * import { shareValueWithSvelteConfig } from "sveltekit-adapter-versioned-worker";
 * // ...
 * 
 * shareValueWithSvelteConfig("sortFile", ({ href }) => {
 *   // Since this is a .ts file, you can write this in TypeScript instead of JavaScript
 * });
 * // ^ Since "sortFile" is reserved, there's no need to use "satisfies FileSorter"
 * 
 * // ...
 * 
 * // svelte.config.js
 * import { valuesFromViteConfig } from "sveltekit-adapter-versioned-worker";
 * // ...
 * 
 * const config = {
 *   kit: {
 *     // ...
 *     sortFile: valuesFromViteConfig.sortFile
 *     // ...
 *   }
 * };
 */
export const valuesFromViteConfig: ValuesFromViteConfig = {};
/**
 * Shares a value with your `svelte.config.js` file. Use this in your `vite.config.ts` file.
 * 
 * @param key The key to put the `value` in `valuesFromViteConfig` as
 * @param value The value to share with the `svelte.config.js` file
 * 
 * @note The following `key`s have to use the types they imply:
 * * `"lastInfo"` -> `LastInfoProvider` 
 * * `"sortFile"` -> A `FileSorter` or an array of them (`MaybeArray<Nullable<FileSorter> | undefined | false>`)
 * * `"configureWorkerTypescript"` -> `WorkerTypeScriptConfigHook`
 * * `"onFinish"` -> `BuildFinishHook`
 * 
 * @see `valuesFromViteConfig` for how to use the shared values
 * 
 * @example
 * // vite.config.ts
 * // ...
 * import { shareValueWithSvelteConfig } from "sveltekit-adapter-versioned-worker";
 * // ...
 * 
 * shareValueWithSvelteConfig("sortFile", ({ href }) => {
 *   // Since this is a .ts file, you can write this in TypeScript instead of JavaScript
 * });
 * // ^ Since "sortFile" is reserved, there's no need to use "satisfies FileSorter"
 * 
 * // ...
 * 
 * // svelte.config.js
 * import { valuesFromViteConfig } from "sveltekit-adapter-versioned-worker";
 * // ...
 * 
 * const config = {
 *   kit: {
 *     // ...
 *     sortFile: valuesFromViteConfig.sortFile
 *     // ...
 *   }
 * };
 * 
 */
export function shareValueWithSvelteConfig<TKey extends keyof ValuesFromViteConfig>(key: TKey, value: ValuesFromViteConfig[TKey]) {
	valuesFromViteConfig[key] = value;
}