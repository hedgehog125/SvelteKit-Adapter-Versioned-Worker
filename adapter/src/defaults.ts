import type {
	AdapterConfig,
	ResolvedAdapterConfig,
	ManifestPluginConfig,
	ResolvedManifestPluginConfig
} from "./types.js";

export function applyAdapterConfigDefaults(config: AdapterConfig): ResolvedAdapterConfig {
	return applyDefaults<AdapterConfig>(config, {
		warnOnViteConfigUnresolved: true
	}) as ResolvedAdapterConfig;
};
export function applyManifestPluginConfigDefaults(config: ManifestPluginConfig): ResolvedManifestPluginConfig {
	return applyDefaults<ManifestPluginConfig>(config, {
		src: "manifest.webmanifest",
		outputFile: "manifest.webmanifest"
	}) as ResolvedManifestPluginConfig;
};

function applyDefaults<T>(source: T, defaults: Record<string, any>): T {
	const obj = source as Record<string, any>;
	for (const [key, defaultValue] of Object.entries(defaults)) {
		if (obj[key] === undefined) obj[key] = defaultValue;
	}

	return obj as T;
};