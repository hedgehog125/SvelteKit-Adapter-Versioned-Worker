import type {
	AdapterConfig,
	ResolvedAdapterConfig,
	ManifestPluginConfig,
	ResolvedManifestPluginConfig
} from "./types.js";
import { requiredProperty } from "./helper.js";
import { defaultManifestProcessor } from "./subFunctions.js";

export function applyAdapterConfigDefaults(config: AdapterConfig): ResolvedAdapterConfig {
	return applyDefaults<AdapterConfig>(config, {
		lastInfo: requiredProperty(),

		sortFile: null,
		configureWorkerTypescript: null,
		onFinish: null,
		hooksFile: "hooks.worker.ts",
		outputDir: "build",
		outputVersionDir: "sw",
		outputWorkerFileName: "sw.js",
		outputWorkerSourceMap: false,
		useWorkerScriptImport: config.outputWorkerSourceMap !== "inline",
		cacheStorageName: null,

		redirectTrailingSlash: true,
		enablePassthrough: false,
		autoPassthroughCrossOriginRequests: true,
		enableQuickFetch: true,
		enableSecondUpdatePriorityElevation: true,
		useHTTPCache: true,
		checkForUpdatesInterval: 86400_000, // Once every 24h
		
		isElevatedPatchUpdate: 0,
		isMajorUpdate: 0,
		isCriticalUpdate: 0,

		warnOnViteConfigUnresolved: true,
		logLevel: "minimal"
	});
}
export function applyManifestPluginConfigDefaults(config: ManifestPluginConfig): ResolvedManifestPluginConfig {
	return applyDefaults<ManifestPluginConfig>(config, {
		enable: true,
		src: "manifest.webmanifest",
		outputFileName: "manifest.webmanifest",
		process: defaultManifestProcessor()
	});
}

function applyDefaults<T>(source: T, defaults: Required<T>): Required<T> {
	const obj = source as Record<string, any>;
	for (const [key, defaultValue] of Object.entries(defaults)) {
		if (obj[key] === undefined) obj[key] = defaultValue;
	}

	return obj as Required<T>;
}