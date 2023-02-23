import type { Adapter, Builder } from "@sveltejs/kit";
import type {
	AdapterConfig,
	ResolvedAdapterConfig,
	ManifestPluginConfig,
	ResolvedManifestPluginConfig,
	
	Nullable,
	VersionedWorkerLogger,
	UnprocessedInfoFile,
	InfoFile,
	InfoFileVersion,
} from "./src/types.js";
import type { Plugin, ResolvedConfig } from "vite"; 

import {
	log
} from "./src/globals.js";
import {
	VersionedWorkerError
} from "./src/helper.js";
import {
	getLastInfo,
	checkInfoFile,
	processInfoFile
} from "./src/subFunctions.js";
import {
	applyAdapterConfigDefaults,
	applyManifestPluginConfigDefaults
} from "./src/defaults.js";
import adapterStatic from "@sveltejs/adapter-static";
import * as fs from "fs/promises";

export {
	AdapterConfig,
	ResolvedAdapterConfig,
	ManifestPluginConfig,
	ResolvedManifestPluginConfig,
	VersionedWorkerLogger,
	UnprocessedInfoFile,
	InfoFileVersion
};

let viteConfig: Nullable<ResolvedConfig> = null; // From manifestGenerator
let adapterConfig: Nullable<ResolvedAdapterConfig> = null;
let manifestPluginConfig: Nullable<ResolvedManifestPluginConfig> = null;
let lastInfo: InfoFile;
let isSSR: boolean;
let isDev: boolean;


let usingManifestPlugin = false;
let initTask: Nullable<Promise<void>> = null;
let initTaskDone = false;

export function adapter(inputConfig: AdapterConfig) : Adapter {
	if (typeof inputConfig !== "object" || typeof inputConfig.lastInfo !== "function") {
		throw new VersionedWorkerError("This adapter requires a configuration object with a \"lastInfo\" function.");
	}
	const config = applyAdapterConfigDefaults(inputConfig);
	adapterConfig = config;

	const adapterInstance = adapterStatic();

	return {
		name: "adapter-versioned-worker",
		async adapt(builder: Builder) {
			log.message("Running the static adapter...");
			await adapterInstance.adapt(builder);
			log.blankLine();

			if (initTask == null) {
				log.message("Running background tasks late due to the manifest plugin not being used...");
				await init(config);
			}
			else {
				if (! initTaskDone) {
					log.message("Waiting for background tasks...");
					await initTask;
				}
			}

			const [projectRoute, viteManifestFilename] = viteConfig?
				[viteConfig.root, viteConfig.build.manifest]
				: [process.cwd(), "vite-manifest.json"]
			;
			if (viteConfig == null) { // TODO: don't warn if one was provided
				if (config.warnOnViteConfigUnresolved) {
					log.warn("Couldn't get Vite's config because you're not using the (built-in) manifest generator plugin. If you don't want to use the manifest plugin for whatever reason, you can probably disable this warning. However, if the current working directory doesn't match Vite's route or if Vite's manifest filename is different to the SvelteKit default (vite-manifest.json), you'll need to provide one with the \"getViteManifest\" config argument.");
				}
			}

			
			// I know the different write methods return arrays of files, but I don't feel like maintaining a fork of adapter-static just to do that. So listing the files in the directory it is

			log.message("Building file list...");
		}
	};
};
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
		}
	};
};

async function init(config: ResolvedAdapterConfig) {
	await Promise.all([
		(async () => {
			let unprocessed = await getLastInfo(config);
			checkInfoFile(unprocessed);
			lastInfo = processInfoFile(unprocessed);

			console.log(lastInfo)
		})(),
		(async () => { // TODO: load handler file
			// TODO: once the extension of the handler file is known, load the correct worker file
		})()
	]);

	initTaskDone = true;
};