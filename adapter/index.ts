import type { Adapter, Builder } from "@sveltejs/kit";
import type {
	AdapterConfig,
	ResolvedAdapterConfig,
	ManifestPluginConfig,
	ResolvedManifestPluginConfig,
	MinimalViteConfig,
	
	VersionedWorkerLogger,
	LastInfoProvider,
	LastInfoProviderConfigs,

	FileSorterConfigs,

	Nullable,
	ViteConfig,
	SvelteConfig
} from "./src/types.js";
import type {
	InfoFile,
	InputFiles,
	CategorizedBuildFiles
} from "./src/internalTypes.js";
import type { Plugin } from "vite"; 
import type { OutputOptions, OutputBundle } from "rollup";

import { log } from "./src/globals.js";
import {
	VersionedWorkerError
} from "./src/helper.js";
import {
	getLastInfo,
	checkInfoFile,
	processInfoFile,

	getInputFiles,
	checkInputFiles,
	getInputFilesConfiguration,

	listAllBuildFiles,
	categorizeFilesIntoModes,
	hashFiles
} from "./src/subFunctions.js";
import {
	applyAdapterConfigDefaults,
	applyManifestPluginConfigDefaults
} from "./src/defaults.js";
import adapterStatic from "@sveltejs/adapter-static";
import * as path from "path";
import * as fs from "fs/promises";

import { installPolyfills } from "@sveltejs/kit/node/polyfills";
installPolyfills();

export {
	AdapterConfig,
	ResolvedAdapterConfig,
	ManifestPluginConfig,
	ResolvedManifestPluginConfig,
	MinimalViteConfig,
	
	VersionedWorkerLogger,
	LastInfoProvider,
	LastInfoProviderConfigs,
	FileSorterConfigs,

	Nullable
};

let viteConfig: Nullable<ViteConfig> = null; // From manifestGenerator
let viteBundle: Nullable<OutputBundle> = null;

let minimalViteConfig: MinimalViteConfig; 
let adapterConfig: Nullable<ResolvedAdapterConfig> = null;
let manifestPluginConfig: Nullable<ResolvedManifestPluginConfig> = null;

let lastInfo: InfoFile;
let inputFiles: InputFiles;
let isSSR: boolean;
let isDev: boolean;


let usingManifestPlugin = false;
let initTask: Nullable<Promise<void>> = null;
let initTaskDone = false;

/**
 * When called with an `AdapterConfig` object, this function returns a SvelteKit adapter that builds your service worker
 * 
 * @param inputConfig The required configuration object for this adapter. It should have a `fetchLast` property
 * @returns A SvelteKit adapter that builds your service worker
 */
export function adapter(inputConfig: AdapterConfig) : Adapter {
	if (typeof inputConfig !== "object" || typeof inputConfig.lastInfo !== "function") {
		throw new VersionedWorkerError("This adapter requires a configuration object with a \"lastInfo\" function.");
	}
	const config = applyAdapterConfigDefaults(inputConfig);
	adapterConfig = config;

	const adapterInstance = adapterStatic({ pages: adapterConfig.outDir });

	return {
		name: "adapter-versioned-worker",
		async adapt(builder: Builder) {
			const initRanLate = initTask == null;
			if (initRanLate) initTask = init(config);

			log.message("Running the static adapter...");
			await adapterInstance.adapt(builder);
			log.blankLine();

			if (! initTaskDone) {
				log.message("Waiting for background tasks..." + (initRanLate? " (they were started late due to the manifest plugin not being used)" : ""));
				await initTask;
			}
			
			// I know the different write methods return arrays of files, but I don't feel like maintaining a fork of adapter-static just to do that. So listing the files in the directory it is

			log.message("Processing build...");
			const [categorizedFiles, staticFileHashes] =  await processBuild(config, builder);
			log.message("Building worker...");
			await buildWorker();
			log.message("Finishing up...");
			await finishUp();
		}
	};
};

/**
 * Call this function, optionally with a `ManifestPluginConfig` object, to get a Vite plugin that manages your web app manifest (and also improves the usability of the adapter, even when `enabled` is set to false)
 * 
 * @param inputConfig An optional configuration object for this Vite plugin
 * @returns A Vite manifest generator plugin
 */
export function manifestGenerator(inputConfig: ManifestPluginConfig = {}): Plugin {
	usingManifestPlugin = true;

	manifestPluginConfig = applyManifestPluginConfigDefaults(inputConfig);

	return {
		name: "vite-plugin-vw-manifest",
		configResolved(providedViteConfig) {
			viteConfig = providedViteConfig;

			log.verbose = viteConfig.logLevel === "info";
			isSSR = !!viteConfig.build.ssr;
			if (isSSR) return;
			isDev = ! viteConfig.isProduction;
		},
		async buildStart() {
			if (isSSR) return;
			if (isDev) return;

			if (adapterConfig != null) initTask = init(adapterConfig);
		},
		generateBundle(_: OutputOptions, _bundle: OutputBundle) {
			viteBundle = _bundle;
		}
	};
};

async function init(config: ResolvedAdapterConfig) {
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
			checkInfoFile(unprocessed);
			lastInfo = processInfoFile(unprocessed);
		})(),
		(async () => {
			const [hooksFilesContents, manifestFilesContents] = await getInputFiles(config, manifestPluginConfig, minimalViteConfig);
			checkInputFiles(hooksFilesContents, manifestFilesContents);
			inputFiles = getInputFilesConfiguration(hooksFilesContents, manifestFilesContents);
		})()
	]);

	initTaskDone = true;
};
async function processBuild(config: ResolvedAdapterConfig, builder: Builder): Promise<[CategorizedBuildFiles, Map<string, string>]> {
	const svelteConfig = builder.config;
	const configs = {
		viteConfig,
		svelteConfig,
		minimalViteConfig,
		adapterConfig: config,
		manifestPluginConfig
	};

	const fullFileList = await listAllBuildFiles(configs);
	const categorizedFiles = await categorizeFilesIntoModes(fullFileList, configs);
	const staticFileHashes = await hashFiles(categorizedFiles.completeList, viteBundle, builder, configs);

	return [categorizedFiles, staticFileHashes];
};
async function buildWorker() {
	
};
async function finishUp() {

};

/**
 * A premade `LastInfoProvider` for use with the `lastInfo` property in the adapter config. Call this function with the URL of your versionedWorker.json file (or the URL of where it *will* be) and then set `lastInfo` to the return value
 * 
 * @param url The URL of your versionedWorker.json file (or where it *will* be)
 * @returns A `LastInfoProvider` that gets your versionedWorker.json file using the Fetch API
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
 *       lastInfo: fetchLast("https://hedgehog125.github.io/SvelteKit-Plugin-Versioned-Worker/versionedWorker.json"),
 *       // ...
 *     })
 *     // ...
 *   }
 * };
 * // ...
 */
export function fetchLast(url: string): LastInfoProvider {
	return async (log: VersionedWorkerLogger): Promise<Nullable<string>> => {
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
			if (response.status == 404) {
				log.warn("\nAssuming this is the first version, as attempting to download the versionedWorker.json file from the last build resulted in a 404.");
				return null;
			}
			else {
				throw new VersionedWorkerError(`Got a ${response.status} HTTP error while trying to download the last versionedWorker.json file.`);
			}
		}
	};
};

/**
 * Another premade `LastInfoProvider` for use with the `lastInfo` property in the adapter config. Call this function with absolute or relative file path to your versionedWorker.json (or where it *will* be) file and then set `lastInfo` to the return value. Or, you can call with no arguments if your build directory is the default of "build"
 * 
 * @note
 * For production builds, you'll probably want to use `fetchLast`, as that will prevent you publishing useless information about test builds (i.e the number of them and the files changed between them). However, this is good to use for test builds, as it means you can check the update behaviour
 * 
 * @param filePath The absolute or relative file path to your versionedWorker.json file (or where it *will* be). **Default**: "build/versionedWorker.json"
 * @returns A `LastInfoProvider` that gets your versionedWorker.json file by reading it from the disk
 * 
 * @example
 * // svelte.config.js
 * import { adapter, readLast, fetchLast } from "sveltekit-adapter-versioned-worker";
 * 
 * const isDev = process.env.NODE_ENV != "production";
 * // ...
 * 
 * const config = {
 *   kit: {
 *     // ...
 *     adapter: adapter({
 *       lastInfo: isDev?
 *         readLast() // The default is "build/versionedWorker.json"
 *         : fetchLast("https://hedgehog125.github.io/SvelteKit-Plugin-Versioned-Worker/versionedWorker.json"),
 *       // ...
 *     })
 *     // ...
 *   }
 * };
 * // ...
 */
export function readLast(filePath: string = "build/versionedWorker.json"): LastInfoProvider {
	return async (log: VersionedWorkerLogger, { minimalViteConfig }): Promise<Nullable<string>> => {
		if (! path.isAbsolute(filePath)) filePath = path.join(minimalViteConfig.root, filePath);

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
};