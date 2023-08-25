import type { Builder } from "@sveltejs/kit";
import type { ResolvedConfig } from "vite";
import type { OutputAsset, OutputBundle, OutputChunk, OutputOptions } from "rollup";
import type { UpdatePriority } from "./worker/staticVirtual.js";
import type { RollupTypescriptOptions } from "@rollup/plugin-typescript";

export type Nullable<T> = T | null;
export type MaybePromise<T> = T | Promise<T>;
export type MaybeArray<T> = T | T[];

// To make things a bit less confusing
export type SvelteConfig = Builder["config"];
export type ViteConfig = ResolvedConfig;
export type TypescriptConfig = RollupTypescriptOptions;

export interface AdapterConfig {
	/* Required */
	/**
	 * Provides the contents of the versionedWorker.json file from the last build.
	 * 
	 * Most of the time, you can import and call `standardGetLast` to return a function for this property. But you can also make a custom one by returning a promise that resolves to the contents of the versionedWorker.json file, or `null` if there isn't one. Generally, you should emit a warning using the `warn` method on the provided `VersionedWorkerLogger` in this case, unless you have some way of verifying that this is the first build (both the built-in methods don't). You can also immediately return the contents or `null`, rather than returning a promise for one.
	 */
	lastInfo: LastInfoProvider,


	/* Optional */
	/**
	 * TODO
	 */
	hooksFile?: string,
	/**
	 * TODO
	 * 
	 * @note Routes always use the `"pre-cache"` mode without calling this function
	 * @note Some other files are always set to `"never-cache"`, again without calling this function
	 */
	sortFile?: MaybeArray<Nullable<FileSorter> | undefined | false>,
	/**
	 * TODO
	 */
	configureWorkerTypescript?: Nullable<WorkerTypeScriptConfigHook>,
	/**
	 * TODO
	 */
	onFinish?: Nullable<BuildFinishHook>,
	/**
	 * TODO
	 */
	outputDir?: string,
	/**
	 * The filename the service worker should be outputted as.
	 * 
	 * @note Changing this from the default requires the manifest plugin to be used.
	 * @default "sw.js"
	 */
	outputWorkerFileName?: string,
	/**
	 * TODO
	 * 
	 * @note setting this to `"inline"` will set `useWorkerScriptImport` to `false` if it's unspecified.
	 */
	outputWorkerSourceMap?: OutputOptions["sourcemap"],
	/**
	 * TODO
	 * 
	 * @note This will default to `true` if `outputWorkerSourceMap` is set to `"inline"`, otherwise it defaults to `false`.
	 */
	useWorkerScriptImport?: boolean,
	/**
	 * TODO
	 */
	outputVersionDir?: string,
	/**
	 * The base name for the cache storage. The name used will be `"{this config property}-{appVersion}"`.
	 * 
	 * Defaults to the base URL if one is being used or to `"VersionedWorkerStorage"` otherwise.
	 */
	cacheStorageName?: Nullable<string>,

	/**
	 * TODO
	 */
	redirectTrailingSlash?: boolean,
	/**
	 * TODO
	 */
	enablePassthrough?: boolean,
	/**
	 * TODO
	 */
	autoPassthroughCrossOriginRequests?: boolean,
	/**
	 * TODO
	 */
	enableQuickFetch?: boolean,
	/**
	 * TODO
	 * 
	 * @note This option requires the use of the manifest plugin.
	 */
	enableSecondUpdatePriorityElevation?: boolean,
	/**
	 * TODO
	 */
	useHTTPCache?: boolean,
	/**
	 * TODO
	 */
	checkForUpdatesInterval?: number | false,

	/**
	 * TODO
	 */
	isElevatedPatchUpdate?: number | boolean,
	/**
	 * TODO
	 */
	isMajorUpdate?: number | boolean,
	/**
	 * TODO
	 */
	isCriticalUpdate?: number | boolean,

	/**
	 * Enables and disables the warning when the Vite config can't be resolved due to the manifest generator plugin being missing.
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
	logLevel?: LogLevel
}
export interface ManifestPluginConfig {
	/**
	 * Enables and disables this manifest generator plugin.
	 * 
	 * @note If you can, it's best to disable the plugin this way as it still helps the adapter work better, even when disabled.
	 * 
	 * @default true
	 */
	enable?: boolean,

	/**
	 * The path to the input web app manifest file, relative to "src" folder.
	 * 
	 * @note
	 * Ending the path with .json/.webmanifest extension is optional. The file is looked for with both extensions.
	 * 
	 * @default "manifest.webmanifest" // (which also means manifest.json)
	 */
	src?: string,

	/**
	 * Where to output the file in the build folder/the route on the development server.
	 * 
	 * @note
	 * Either extension can be used here (one is required though), but `".webmanifest"` is the official standard (compared to the more commonly used `".json"`).
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

export interface ValuesFromViteConfig {
	sortFile?: MaybeArray<Nullable<FileSorter> | undefined | false>,
	onFinish?: BuildFinishHook,
	configureWorkerTypescript?: WorkerTypeScriptConfigHook,
	[otherItemKey: string]: unknown
}

export interface VersionedWorkerLogger {
	message(msg: string, includePrefix?: boolean): void,
	success(msg: string): void,
	error(msg: string, includePrefix?: boolean): void,
	warn(msg: string, includePrefix?: boolean): void,

	minor(msg: string): void,
	info(msg: string): void,
	blankLine(): void,
	verbose: boolean
}

export type LastInfoProvider = (log: VersionedWorkerLogger, configs: LastInfoProviderConfigs) => MaybePromise<Nullable<string>>;
export interface LastInfoProviderConfigs {
	viteConfig: Nullable<ViteConfig>,
	minimalViteConfig: MinimalViteConfig,
	adapterConfig: ResolvedAdapterConfig,
	manifestPluginConfig: Nullable<ResolvedManifestPluginConfig>
}

export type FileSorter = (fileInfo: VWBuildFile, overallInfo: BuildInfo, configs: AllConfigs) => MaybePromise<FileSortMode | undefined | null | void>;
export interface VWBuildFile {
	/**
	 * The href of the file.
	 * 
	 * @note This has the base URL removed and doesn't start with "/" or "./"
	 */
	href: string,
	/**
	 * The absolute path to the file on this computer.
	 * 
	 * @note Use `href` instead of this for categorising files based on paths
	 */
	localFilePath: string,
	/**
	 * The MIME type associated with the file's extension. Provided by mime-types.
	 * 
	 * @note If mime-types doesn't recognise the extension, the value will be `null`
	 */
	mimeType: Nullable<string>,
	/**
	 * If the file is static or not. `true` if the file is in the static folder. Otherwise it's based on if `viteInfo` has `name` defined.
	 * 
	 * @note This will be `null` if the manifest plugin isn't being used and the file isn't in the static folder
	 */
	isStatic: Nullable<boolean>,
	/**
	 * The size of this file in bytes.
	 * 
	 * @note Due to compression, the resource might take significantly less data to download than this 
	 */
	size: number,
	/**
	 * The ID of the file in the array of build files.
	 * 
	 * @note The build files aren't sorted and could be in any order
	 * @note Due to some files being sorted without calling the `FileSorter` (like routes), this will skip numbers
	 */
	fileID: number,
	/**
	 * The `OutputAsset` or `OutputChunk` provided by Vite.
	 * 
	 * @note This will be null if there's no corresponding item in the bundle or if the manifest plugin isn't being used 
	 */
	viteInfo: Nullable<OutputAsset | OutputChunk>,

	/**
	 * Displays a message alongside the filename and other info after the files have been sorted.
	 * 
	 * @param message The message to display
	 */
	addBuildMessage: (message: string) => void,
	/**
	 * Displays a warning alongside the filename and other info after the files have been sorted.
	 * 
	 * @param message The warning message to display
	 */
	addBuildWarning: (message: string) => void
}
export interface BuildInfo {
	/**
	 * The whole Vite bundle. The key is the filename and the value is the `OutputAsset` or `OutputChunk`.
	 * 
	 * @note This will be `null` if the manifest plugin isn't being used
	 * @note Some files might not have a corresponding item in the bundle 
	 */
	viteBundle: Nullable<OutputBundle>,
	/**
	 * All of the file paths of the build files, relative to the build directory.
	 * 
	 * @note They are normalised to be UNIX like (`"/"` instead of `"\"` on Windows)
	 * @note They **don't** start with `"./"`
	 */
	fullFileList: Set<string>,
	/**
	 * All of the route file paths, relative to the build directory.
	 * 
	 * @note They are normalised to be UNIX like (`"/"` instead of `"\"` on Windows)
	 * @note They **don't** start with `"./"`
	 */
	routeFiles: Set<string>,
	/**
	 * All of `fullFileList` mapped to each's size in bytes.
	 * 
	 * @note Due to compression, some files might take significantly less data to download than this number
	 */
	fileSizes: Map<string, number>
}

/**
 * TODO
 */
export type WorkerTypeScriptConfigHook = (typescriptConfig: TypescriptConfig, configs: AllConfigs) => MaybePromise<TypescriptConfig | void | undefined>;
/**
 * TODO
 */
export type BuildFinishHook = (workerBuildSucceeded: boolean, processedBuild: ProcessedBuild, configs: AllConfigs) => void | Promise<void>;
/**
 * TODO
 */
export interface ProcessedBuild {
	categorizedFiles: CategorizedBuildFiles,
	fileSorterMessages: FileSorterMessages,
	routeFiles: Set<string>,
	staticFileHashes: Map<string, string>,
	fileSizes: Map<string, number>,
	updatePriority: UpdatePriority
}
/**
 * TODO
 */
export interface CategorizedBuildFiles {
	precache: string[],
	laxLazy: string[],
	staleLazy: string[],
	strictLazy: string[],
	semiLazy: string[],

	completeList: string[]
	// never-cache just isn't included
}
export type FileSorterMessages = Map<string, FileSorterMessage[]>;
export interface FileSorterMessage {
	isMessage: boolean,
	message: string
}


export type ManifestProcessor = (parsed: object, configs: ManifestProcessorConfigs) => MaybePromise<string | object>;
export interface ManifestProcessorConfigs {
	viteConfig: ViteConfig,
	minimalViteConfig: MinimalViteConfig,
	adapterConfig: Nullable<ResolvedAdapterConfig>,
	manifestPluginConfig: ResolvedManifestPluginConfig
}

/**
 * A string enum representing how a file should be handled. Generally, most files should use the default mode: `"pre-cache"`.
 * 
 * @options
 * Note that a new version has to be released for Versioned Worker to detect a file as outdated. If you want more control for some files, you may need to set their modes to `"never-cache"` and implement the caching yourself.
 * 
 * * `"pre-cache"` resources should always be available as they're downloaded during the worker install. They're also updated with the new worker if they've changed and will always be from the same version as each other.
 * * `"lax-lazy"` only downloads and caches the resource when it's requested. If the latest version is cached, that will be sent. Otherwise it'll try and fetch the resource from the network, if that fails, the worker will send a stale version. The fetch will only fail if the user is offline and there's no version of the resource in the cache.
 * * `"stale-lazy"` (stale while revalidate) is similar to `"lax-lazy"` but serves stale responses before downloading the current version. If and when this current version is downloaded, it's stored in the cache for next time. Like with `"lax-lazy"`, it won't use the network if the resource is up-to-date.
 * * `"strict-lazy"` is also similar to "lax-lazy" but will fail instead of sending stale responses. Resources using this mode are deleted from the cache if and when they become outdated, but not until the whole app has updated first.
 * * `"semi-lazy"` is a hybrid between `"pre-cache"` and `"lax-lazy"`. Once the resource has been accessed and cached once, it'll be kept updated when new versions are installed. It's mostly only useful for web app manifest icons.
 * * And `"never-cache"` always gets the resource using the network and doesn't cache the responses at all.
 */
export type FileSortMode = "pre-cache" | "lax-lazy" | "stale-lazy" | "strict-lazy" | "semi-lazy" | "never-cache";
export interface AllConfigs extends LastInfoProviderConfigs {
	svelteConfig: SvelteConfig
}

export interface MinimalViteConfig {
	root: string,
	manifest: string | boolean
}

export type LogLevel = "minimal" | "verbose";