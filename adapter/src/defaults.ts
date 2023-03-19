import type {
	AdapterConfig,
	ResolvedAdapterConfig,
	ManifestPluginConfig,
	ResolvedManifestPluginConfig
} from "./types.js";
import { requiredProperty } from "./helper.js";

export function applyAdapterConfigDefaults(config: AdapterConfig): ResolvedAdapterConfig {
	return applyDefaults<AdapterConfig>(config, {
		lastInfo: requiredProperty(),

		sortFile: null,
		hooksFile: "hooks.worker.ts",
		outputDir: "build",
		workerDir: "sw",
		workerFile: "sw.js",
		warnOnViteConfigUnresolved: true
	}) as ResolvedAdapterConfig;
};
export function applyManifestPluginConfigDefaults(config: ManifestPluginConfig): ResolvedManifestPluginConfig {
	return applyDefaults<ManifestPluginConfig>(config, {
		enable: true,
		src: "manifest.webmanifest",
		outputFile: "manifest.webmanifest"
	}) as ResolvedManifestPluginConfig;
};

function applyDefaults<T>(source: T, defaults: Required<T>): Required<T> {
	const obj = source as Record<string, any>;
	for (const [key, defaultValue] of Object.entries(defaults)) {
		if (obj[key] === undefined) obj[key] = defaultValue;
	}

	return obj as Required<T>;
};