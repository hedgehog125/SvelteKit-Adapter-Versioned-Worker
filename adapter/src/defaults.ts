import type {
	AdapterConfig,
	ResolvedAdapterConfig,
	ManifestPluginConfig,
	ResolvedManifestPluginConfig
} from "./types.js";

export function applyAdapterConfigDefaults(config: AdapterConfig): ResolvedAdapterConfig {
	return applyDefaults(config, {
		warnOnViteConfigUnresolved: true
	});
};
export function applyManifestPluginConfigDefaults(config: ManifestPluginConfig): ResolvedManifestPluginConfig {
	return applyDefaults(config, {
		src: "manifest.webmanifest",
		outputFile: "manifest.webmanifest"
	});
};

function applyDefaults(obj: Record<string, any>, defaults: Record<string, any>): any {
	for (const [key, defaultValue] of Object.entries(defaults)) {
		if (obj[key] === undefined) obj[key] = defaultValue;
	}

	return obj;
};