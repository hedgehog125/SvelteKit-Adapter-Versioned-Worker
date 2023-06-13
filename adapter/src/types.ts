import type { Builder } from "@sveltejs/kit";
import type { ResolvedConfig } from "vite";
import type { OutputAsset, OutputChunk } from "rollup";

// To make things a bit less confusing
export type SvelteConfig = Builder["config"];
export type ViteConfig = ResolvedConfig;

export type Nullable<T> = T | null;
export interface AdapterConfig {
	/* Required */
	/**
	 * Provides the contents of the versionedWorker.json file from the last build
	 * 
	 * Most of the time, you can import and call `fetchLast` or `readLast` to return a function for this property. But you can also make a custom one by returning a promise that resolves to the contents of the versionedWorker.json file, or null if there isn't one. Generally, you should emit a warning using the `warn` method on the provided `VersionedWorkerLogger` in this case, unless you have some way of verifying that this is the first build (both the built-in methods don't). You can also immediately return the contents or null, rather than returning a promise for one.
	 */
	lastInfo: LastInfoProvider,


	/* Optional */
	/**
	 * TODO
	 */
	hooksFile?: string,

	/**
	 * TODO
	 */
	sortFile?: FileSorter | null,

	/**
	 * TODO
	 */
	outputDir?: string,

	/**
	 * TODO
	 */
	outputWorkerFileName?: string,

	/**
	 * TODO
	 */
	outputVersionDir?: string,

	/**
	 * Enables and disables the warning when the Vite config can't be resolved due to the manifest generator plugin being missing 
	 * 
	 * @note
	 * If you don't want to use the manifest plugin for whatever reason, you can probably disable this warning. However, if the current working directory doesn't match Vite's route or if Vite's manifest filename is different to the SvelteKit default (vite-manifest.json), you'll need to provide one with the `getViteManifest` config argument instead.
	 * 
	 * @default true
	 */
	warnOnViteConfigUnresolved?: boolean,

	/**
	 * TODO
	 */
	redirectTrailingSlash?: boolean
}
export interface ManifestPluginConfig {
	/**
	 * Enables and disables this manifest generator plugin. If you can, it's best to disable the plugin this way as it still helps the adapter work better, even when disabled
	 * 
	 * @default true
	 */
	enable?: boolean,

	/**
	 * The path to the input web app manifest file, relative to "src" folder
	 * 
	 * @note
	 * Ending the path with .json/.webmanifest extension is optional. The file is looked for with both extensions
	 * 
	 * @default "manifest.webmanifest" // (which also means manifest.json)
	 */
	src?: string,

	/**
	 * Where to output the file in the build folder/the route on the development server
	 * 
	 * @note
	 * Either extension can be used here (one is required though), but ".webmanifest" is the official standard (compared to the more commonly used ".json").
	 * 
	 * @default "manifest.webmanifest"
	 */
	outputFileName?: string,

	/**
	 * TODO
	 */
	process?: ManifestProcessor
}

export type ResolvedAdapterConfig = Required<AdapterConfig>;
export type ResolvedManifestPluginConfig = Required<ManifestPluginConfig>;

export interface VersionedWorkerLogger {
	message(msg: string): void,
	success(msg: string): void,
	error(msg: string): void,
	warn(msg: string): void,

	minor(msg: string): void,
	info(msg: string): void,
	blankLine(): void,
	verbose: boolean
}

export type LastInfoProvider = (log: VersionedWorkerLogger, configs: LastInfoProviderConfigs) => Promise<Nullable<string>> | Nullable<string>;
export interface LastInfoProviderConfigs {
	viteConfig: Nullable<ViteConfig>,
	minimalViteConfig: MinimalViteConfig,
	adapterConfig: ResolvedAdapterConfig,
	manifestPluginConfig: Nullable<ResolvedManifestPluginConfig>
}
export type FileSorter = (normalizedFilePath: string, mimeType: Nullable<string>, configs: AllConfigs) => FileSortMode | Promise<FileSortMode>;
export type ManifestProcessor = (parsed: object, configs: ManifestProcessorConfigs) => Promise<string | object> | string | object;
export interface ManifestProcessorConfigs {
	viteConfig: ViteConfig,
	minimalViteConfig: MinimalViteConfig,
	adapterConfig: Nullable<ResolvedAdapterConfig>,
	manifestPluginConfig: ResolvedManifestPluginConfig
}

/**
 * TODO
 * "pre-cache" resources should always be available as they're downloaded during the worker install. They're also updated with the new worker (if they've actually changed).
 * "lazy" tries to get the resource from the network if it's outdated, it'll only send the stale response if the network is unavailable.
 * "stale-lazy" (stale while revalidate) serves the resource from the cache, even if it's outdated, but tried to download it in the background for the next request.
 * "strict-lazy" discards the resource if it becomes out of date, so internet will be required to access them again, but they won't be stale.
 * "semi-lazy-cache" keeps the resource up to date if it had already been requested and cached before. Mostly useful for web app manifest icons. 
 * "never-cache" always gets the resource using the network and doesn't cache the responses at all.
 */
export type FileSortMode = "pre-cache" | "lazy" | "stale-lazy" | "strict-lazy" | "semi-lazy" | "never-cache";
export interface AllConfigs extends LastInfoProviderConfigs {
	svelteConfig: SvelteConfig
}
export interface FileInfo {
	mime: Nullable<string>,
	isStatic: boolean,
	isRoute: boolean,
	viteInfo: OutputAsset | OutputChunk
}

export interface MinimalViteConfig {
	root: string,
	manifest: string | boolean
}