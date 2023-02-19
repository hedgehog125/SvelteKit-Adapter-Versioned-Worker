import type { Adapter, Builder } from "@sveltejs/kit";
import type {
	AdapterConfig,
	ResolvedAdapterConfig,
	ManifestPluginConfig,
	ResolvedManifestPluginConfig,
	
	Nullable,
	VersionedWorkerLogger,
	InfoFile,
	InfoFileVersion
} from "./src/types.js";
import type { Plugin, ResolvedConfig } from "vite"; 

import {
	fileExists,
	adapterFilesPath,
	getFilesToStat,
	VersionedWorkerError,
	createLogger,
	createInitialInfo
} from "./src/helper.js";
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
	InfoFile,
	InfoFileVersion
};

let viteConfig: Nullable<ResolvedConfig> = null; // From manifestGenerator
let manifestPluginConfig: Nullable<ResolvedManifestPluginConfig> = null;
let lastInfo: InfoFile;

let usingAdapter = false; // Only used to prevent double calling
let usingManifestPlugin = false;

const log = createLogger(true);

export function adapter(inputConfig: AdapterConfig) : Adapter {
	if (usingAdapter) throw new VersionedWorkerError("This adapter can only be called once per build.");
	usingAdapter = true;

	if (typeof inputConfig !== "object" || typeof inputConfig.lastInfo !== "function") {
		throw new VersionedWorkerError("This adapter requires a configuration object with a \"lastInfo\" function.");
	}
	const config = applyAdapterConfigDefaults(inputConfig);

	const adapterInstance = adapterStatic();
	const initTask = init(config);

	return {
		name: "adapter-versioned-worker",
		async adapt(builder: Builder) {
			await adapterInstance.adapt(builder);
			console.log("");
			log.message("Waiting for lastInfo to resolve...");
			await initTask;

			const [projectRoute, viteManifestFilename] = viteConfig?
				[viteConfig.root, viteConfig.build.manifest]
				: [process.cwd(), "vite-manifest.json"]
			;
			if (viteConfig === null) { // TODO: don't warn if one was provided
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
		configResolved(_viteConfig) {
			viteConfig = _viteConfig;

			log.verbose = viteConfig.logLevel === "info";
		}
	};
};

async function init(config: ResolvedAdapterConfig) {
	await Promise.all([
		(async() => {
			let fileContents = await config.lastInfo(log);
			if (fileContents == null) lastInfo = createInitialInfo();
			else {
				let parsed: InfoFile;
				try {
					parsed = JSON.parse(fileContents);
				}
				catch {
					throw new VersionedWorkerError(`Couldn't parse the info file from the last build. Contents:\n${fileContents}`);
				}
				lastInfo = parsed;
			}
		})()
	]);
};