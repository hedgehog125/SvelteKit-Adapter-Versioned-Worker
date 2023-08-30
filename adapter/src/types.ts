import type { Builder } from "@sveltejs/kit";
import type { ResolvedConfig } from "vite";
import type { OutputAsset, OutputBundle, OutputChunk, OutputOptions } from "rollup";
import type { UpdatePriority } from "./worker/staticVirtual.js";
import type { RollupTypescriptOptions } from "@rollup/plugin-typescript";
import { WebAppManifest } from "./manifestTypes.js";

export type Nullable<T> = T | null;
export type MaybePromise<T> = T | Promise<T>;
export type MaybeArray<T> = T | T[];

// To make things a bit less confusing
/**
 * An alias for SvelteKit's config.
 * 
 * @see
 * https://kit.svelte.dev/docs/configuration
 */
export type SvelteConfig = Builder["config"];
/**
 * An alias for Vite's config.
 * 
 * @see
 * https://vitejs.dev/config/
 */
export type ViteConfig = ResolvedConfig;
/**
 * An alias for `@rollup/plugin-typescript`'s config.
 * 
 * @see
 * https://vitejs.dev/config/
 */
export type TypescriptConfig = RollupTypescriptOptions;

/**
 * The type of the unresolved config the adapter.
 */
export interface AdapterConfig {
	/* Required */
	/**
	 * The `LastInfoProvider` to use.
	 * 
	 * @tip This can be defined in your Vite config as `"lastInfo"`. See `shareValueWithSvelteConfig` for how to do this.
	 * 
	 * @see `standardGetLast` for a function returning a `LastInfoProvider` that's good for most use cases
	 * @see `LastInfoProvider` for how to write your own
	 */
	lastInfo: LastInfoProvider,


	/* Optional */
	/**
	 * The path to your hooks file, relative to your `"src"` folder.
	 * 
	 * @see `HandleFetchHook`, `HandleCustomMessageHook` and `HandleResponseHook` in the module `"sveltekit-adapter-versioned-worker/worker"` for more information on the different hooks you can export from this file
	 * 
	 * @default "hooks.worker.ts" // (which also means hooks.worker.js)
	 */
	hooksFile?: string,
	/**
	 * The `FileSorter`(s) to use.
	 * 
	 * The `FileSorter`s will be called in order for each build file, stopping once one returns a `FileSortMode`. If none return (or if no `FileSorter`s are provided), the resource's mode will default to `"pre-cache"`.
	 * 
	 * @note Routes always use the `"pre-cache"` mode without calling this function.
	 * @note Some other files are always set to `"never-cache"`, again without calling this function.
	 * @tip This can be defined in your Vite config as `"sortFile"`. See `shareValueWithSvelteConfig` for how to do this.
	 * 
	 * @see `FileSorter` for more information on its arguments and return values
	 * @see `FileSortMode` for more information on the different modes resources can use
	 */
	sortFile?: MaybeArray<Nullable<FileSorter> | undefined | false>,
	/**
	 * An optional `WorkerTypeScriptConfigHook` to use.
	 * 
	 * @tip This can be defined in your Vite config as `"configureWorkerTypescript"`. See `shareValueWithSvelteConfig` for how to do this.
	 * 
	 * @see `WorkerTypeScriptConfigHook` for more information
	 */
	configureWorkerTypescript?: Nullable<WorkerTypeScriptConfigHook>,
	/**
	 * The optional `BuildFinishHook` to use.
	 * 
	 * @tip This can be defined in your Vite config as `"onFinish"`. See `shareValueWithSvelteConfig` for how to do this.
	 * 
	 * @see `BuildFinishHook` for more information
	 */
	onFinish?: Nullable<BuildFinishHook>,
	/**
	 * Where the whole build should be written to. This includes both what SvelteKit generates and the files the adapter adds.
	 * 
	 * @default "build"
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
	 * What sourcemaps, if any, should be outputted for the service worker. Set it to `true` to output it as a separate file, `"inline"` to put it in the js file itself or `false` to not output one.
	 * 
	 * @note Setting this to `"inline"` will set `useWorkerScriptImport` to `false` if it's unspecified.
	 * @note You should avoid using `"inline"` for production builds as it massively increases the worker's file size.
	 * @see https://rollupjs.org/configuration-options/#output-sourcemap
	 */
	outputWorkerSourceMap?: OutputOptions["sourcemap"],
	/**
	 * If the service worker should import its contents from another file or if it should just be put in directly.
	 * 
	 * Normally it's beneficial for this to be `true` so the browser only has to redownload the small importer to check for updates. However, you may find it makes your sourcemaps more annoying.
	 * 
	 * @note This will default to `false` if `outputWorkerSourceMap` is set to `"inline"`, otherwise it defaults to `true`.
	 */
	useWorkerScriptImport?: boolean,
	/**
	 * The filename of the folder in the build that contains the version files and a few other generated assets.
	 * 
	 * @default "sw" // This will be made in your build folder
	 */
	outputVersionDir?: string,
	/**
	 * The base name for the cache storage. The name used will be `"{this config property}-{appVersion}"`.
	 * 
	 * Defaults to the base URL if one is being used or to `"VersionedWorkerCache"` otherwise.
	 */
	cacheStorageName?: Nullable<string>,

	/**
	 * If the service worker should redirect trailing slashes to match how SvelteKit outputted the routes.
	 * 
	 * @note Since requests of unknown resources using the default `VWRequestMode` automatically try the network, and your server likely sends redirects, there's generally little reason to disable this. If you do, make sure it behaves the same online and offline and that your server isn't acting as a replacement for this feature.
	 * @note This will only redirect `GET` and `HEAD` requests for routes. It will redirect these for fetches and not just navigations.
	 * 
	 * @see `VWRequestMode` in the module `"sveltekit-adapter-versioned-worker/worker"` for more information on request modes
	 * 
	 * @default true
	 */
	redirectTrailingSlash?: boolean,
	/**
	 * Enables passthrough requests, which is disabled by default. Not to be confused with `autoPassthroughCrossOriginRequests` which sets the `VWRequestMode` of cross origin requests to `"force-passthrough"` and works independently of this option.
	 * 
	 * **TLDR**: enabling this probably isn't worth the extra headaches it can create. Although it can have some benefits in specific situations.
	 * 
	 * By default, the worker will call `FetchEvent.respondWith` for all requests unless their `VWRequestMode` is set to `"force-passthrough"`. This means that if a resource isn't cached or handled, it will `fetch` from the network and send the response (depending on the `VWRequestMode` and if it doesn't start with `VIRTUAL_FETCH_PREFIX`). This makes sense to do for resources in the cache list as they can then save the response. However, the fact that it prevents `AbortSignal`s from working correctly* and adds a tiny bit of extra latency (< 1ms) isn't ideal for everything else. Normally, you can avoid these problems with `AdapterConfig.autoPassthroughCrossOriginRequests` for cross origin requests or by setting the `VWRequestMode` to `"force-passthrough"`. In situations where you can't use these though, read on...
	 * 
	 * When this option is enabled, requests will be passthroughed (`FetchEvent.respondWith` won't be called) if these conditions are met:
	 * * `undefined` was returned by your `HandleFetchHook` and **not** `Promise<undefined>`. Or you haven't exported  one.
	 * * The path isn't in the cache list, meaning its mode was set to `"never-cache"` or it wasn't outputted by SvelteKit.
	 * * The `VWRequestMode` isn't `"handle-only"` and doesn't have the `VIRTUAL_FETCH_PREFIX`.
	 * 
	 * \*Service workers currently don't receive the signals in any of the major browsers. This doesn't mix well with media playback in particular as that relies on cancelling requests and sending new requests with new ranges.
	 * 
	 * @see `VWRequestMode` in the module `"sveltekit-adapter-versioned-worker/worker"` for more information on request modes
	 * @see `VIRTUAL_FETCH_PREFIX` in the module `"sveltekit-adapter-versioned-worker/worker/util"` for more information on the virtual fetch prefix
	 * @see `HandleFetchHook` in the module `"sveltekit-adapter-versioned-worker/worker"` for more information on the `handleFetch` hook
	 * 
	 * 
	 * @default false
	 */
	enablePassthrough?: boolean,
	/**
	 * If the `VWRequestMode` of cross origin requests should be set to `"force-passthrough"` if it's unspecified.
	 * 
	 * @see `VWRequestMode` in the module `"sveltekit-adapter-versioned-worker/worker"` for more information on request modes
	 * 
	 * @default true
	 */
	autoPassthroughCrossOriginRequests?: boolean,
	/**
	 * Enables and disables the service worker code necessary for the `quickFetch` function to work. If you're not using the feature, you should be able to get a slightly smaller worker build by disabling this.
	 * 
	 * @see `quickFetch` in the module `"sveltekit-adapter-versioned-worker/svelte"` to see how to use the feature
	 * 
	 * @default true
	 */
	enableQuickFetch?: boolean,
	/**
	 * Enables the second part of the update priority elevation.
	 * 
	 * When a patch update (priority `1`) is downloaded by a client, it won't prompt the user to reload and will instead wait for `reloadOpportunity` to be called. If 2 or more reload opportunities are blocked though and the update was installed a day or more ago, the update priority becomes an elevated patch (priority `2`), resulting in a prompt. This option enables and disables a second part of this: when a downloaded patch update is more than 3 days old, the user is prompted even if no reload opportunities were blocked.
	 * 
	 * If you think your app has enough reload opportunities, it might be worth disabling this behaviour. That way your users can get a more seamless experience while your app still stays relatively up-to-date.
	 * 
	 * @note "Update is *x* days old" in this context refers to how long it's been since the update was downloaded, not how long it's been since it was released.
	 * 
	 * @note This option requires the use of the manifest plugin.
	 * 
	 * @see `UpdatePriority` in the module `"sveltekit-adapter-versioned-worker/worker"` for more information on update priorities
	 * @see `reloadOpportunity` in the module `"sveltekit-adapter-versioned-worker/svelte"` for more information on reload opportunities
	 */
	enableSecondUpdatePriorityElevation?: boolean,
	/**
	 * If the service worker should use the HTTP cache for downloading updates.
	 * 
	 * @note It's used in a very limited way since getting a stale response creates a whole bunch of problems. When this is enabled, the HTTP cache mode `"no-cache"` will be used for downloading resources instead of `"no-store"`. This means that if the server confirms that the version of the resource in the HTTP cache is up-to-date, that cached version will be stored instead. This is mainly only beneficial for the initial page load as it can prevent downloading some resources twice. However, it can create broken installs if your server doesn't send the correct headers. If you find your assets sometimes 404 after an install, you should probably disable this option.
	 * 
	 * @default true
	 */
	useHTTPCache?: boolean,
	/**
	 * How often, in milliseconds, the `ServiceWorker` component should check for updates.
	 * 
	 * @note Setting this to `false` will disable this periodic checking.
	 * @note In addition to this, the browser also checks for updates for every full page load.
	 * 
	 * @default 86400_000 // Once every 24h
	 */
	checkForUpdatesInterval?: number | false,

	/**
	 * If this update you're publishing is an elevated patch or not.
	 * 
	 * You might find it best to use a number for this, as it means only 1 update will be marked with this priority. Doing so will mean the update will only be this priority if this value is different to what it was in the previous update, and also isn't now `0`.
	 * 
	 * @note If the update is set to be multiple priorities, the highest will be used.
	 * @note If no priority is set, the update will be a patch (priority `1`).
	 * 
	 * @see `UpdatePriority` in the module `"sveltekit-adapter-versioned-worker/worker"` for more information about update priorities
	 * 
	 * @example
	 * // Value in previous version | Value in this version | Result
	 * // 0 -> 1 = Update is this priority
	 * // 5 -> 4 = Update is this priority
	 * // 5 -> 0 = Update isn't this priority
	 * // 5 -> 5 = Update isn't this priority
	 * 
	 * @default 0 // Meaning the update isn't this priority
	 */
	isElevatedPatchUpdate?: number | boolean,
	/**
	 * If this update you're publishing is a major update or not.
	 * 
	 * You might find it best to use a number for this, as it means only 1 update will be marked with this priority. Doing so will mean the update will only be this priority if this value is different to what it was in the previous update, and also isn't now `0`.
	 * 
	 * @note If the update is set to be multiple priorities, the highest will be used.
	 * @note If no priority is set, the update will be a patch (priority `1`).
	 * 
	 * @see `UpdatePriority` in the module `"sveltekit-adapter-versioned-worker/worker"` for more information about update priorities
	 * 
	 * @example
	 * // Value in previous version | Value in this version | Result
	 * // 0 -> 1 = Update is this priority
	 * // 5 -> 4 = Update is this priority
	 * // 5 -> 0 = Update isn't this priority
	 * // 5 -> 5 = Update isn't this priority
	 * 
	 * @default 0 // Meaning the update isn't this priority
	 */
	isMajorUpdate?: number | boolean,
	/**
	 * If this update you're publishing is a critical update or not.
	 * 
	 * You might find it best to use a number for this, as it means only 1 update will be marked with this priority. Doing so will mean the update will only be this priority if this value is different to what it was in the previous update, and also isn't now `0`.
	 * 
	 * @note If the update is set to be multiple priorities, the highest will be used.
	 * @note If no priority is set, the update will be a patch (priority `1`).
	 * 
	 * @see `UpdatePriority` in the module `"sveltekit-adapter-versioned-worker/worker"` for more information about update priorities
	 * 
	 * @example
	 * // Value in previous version | Value in this version | Result
	 * // 0 -> 1 = Update is this priority
	 * // 5 -> 4 = Update is this priority
	 * // 5 -> 0 = Update isn't this priority
	 * // 5 -> 5 = Update isn't this priority
	 * 
	 * @default 0 // Meaning the update isn't this priority
	 */
	isCriticalUpdate?: number | boolean,

	/**
	 * Enables and disables the warning for when the Vite config can't be resolved due to the manifest generator plugin being missing.
	 * 
	 * @note
	 * If you don't want to use the manifest plugin for whatever reason, I'd strongly suggest setting its `enable` option to `false` instead of removing it from your Vite plugins. This way it'll still be able to improve how the adapter works.
	 * 
	 * @default true
	 */
	warnOnViteConfigUnresolved?: boolean,
	/**
	 * How much should be logged during the build.
	 * 
	 * At the moment, this only affects the file sortings that are logged after the build is complete. When set to `"normal"`, the resources set to `"pre-cache"` aren't listed as most of your resources likely use that mode. Setting this to `"verbose"` will cause them to all be listed.
	 * 
	 * @default "normal"
	 */
	logLevel?: LogLevel
}
/**
 * The type of the unresolved config for the manifest Vite plugin.
 */
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
	 * The `ManifestProcessor` to use.
	 * 
	 * @see `ManifestProcessor` for more information on writing your own
	 * @see `defaultManifestProcessor` for more info on the default one
	 * 
	 * @default defaultManifestProcessor()
	 */
	process?: ManifestProcessor
}

export type ResolvedAdapterConfig = Required<AdapterConfig>;
export type ResolvedManifestPluginConfig = Required<ManifestPluginConfig>;

/**
 * The type of `valuesFromViteConfig`.
 * 
 * @see `valuesFromViteConfig` for how to access shared values
 * @see `shareValueWithSvelteConfig` for how to share values
 */
export interface ValuesFromViteConfig {
	lastInfo?: LastInfoProvider,
	sortFile?: MaybeArray<Nullable<FileSorter> | undefined | false>,
	configureWorkerTypescript?: WorkerTypeScriptConfigHook,
	onFinish?: BuildFinishHook,
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

/**
 * The type of a function that provides the contents of the `versionedWorker.json` file from the last build.
 * 
 * It should return a promise that resolves to the contents of the `versionedWorker.json` file, or `null` if there isn't one. Generally, you should emit a warning using the `warn` method on the provided `VersionedWorkerLogger` in this case, unless you have some way of verifying that this is the first build (both the built-in methods don't). You can also immediately return the contents or `null`, rather than returning a promise for it.
 * 
 * @see `standardGetLast` for a function returning a `LastInfoProvider` that's good for most use cases
 */
export type LastInfoProvider = (log: VersionedWorkerLogger, configs: LastInfoProviderConfigs) => MaybePromise<Nullable<string>>;
/**
 * The type of the configs object provided to `LastInfoProvider`s.
 * 
 * @note The `viteConfig` will be `null` if the manifest plugin isn't being used.
 * @note The `manifestPluginConfig` will be `null` if the manifest plugin isn't being used.
 * @note Unlike `AllConfigs`, this doesn't contain the Svelte config as SvelteKit likely hasn't called the adapter at this point in the build.
 * 
 * @see `LastInfoProvider` for the type of the function that's called with this
 */
export interface LastInfoProviderConfigs {
	viteConfig: Nullable<ViteConfig>,
	minimalViteConfig: MinimalViteConfig,
	adapterConfig: ResolvedAdapterConfig,
	manifestPluginConfig: Nullable<ResolvedManifestPluginConfig>
}

/**
 * The type of a function that returns a `FileSortMode` or a promise for it. The function can also return `undefined`.
 * 
 * @tip `fileInfo` contains a `addBuildMessage` and a `addBuildWarning` function.
 * 
 * @see `FileSortMode` for more information on the different resource modes
 * @see `AdapterConfig.sortFile` for how `undefined` returns are handled
 * @see `VWBuildFile`, `BuildInfo` and `AllConfigs` for more information on the data provided to this function
 */
export type FileSorter = (fileInfo: VWBuildFile, overallInfo: BuildInfo, configs: AllConfigs) => MaybePromise<FileSortMode | undefined | null | void>;
/**
 * A type representing the information Versioned Worker provides about a build file.
 */
export interface VWBuildFile {
	/**
	 * The href of the file.
	 * 
	 * @note This has the base URL removed and doesn't start with "/" or "./".
	 */
	href: string,
	/**
	 * The absolute path to the file on this computer.
	 * 
	 * @note Use `href` instead of this for categorising files based on paths.
	 */
	localFilePath: string,
	/**
	 * The MIME type associated with the file's extension. Provided by mime-types.
	 * 
	 * @note If mime-types doesn't recognise the extension, the value will be `null`.
	 */
	mimeType: Nullable<string>,
	/**
	 * If the file is static or not. `true` if the file is in the static folder. Otherwise it's based on if `viteInfo` has `name` defined.
	 * 
	 * @note This will be `null` if the manifest plugin isn't being used and the file isn't in the static folder.
	 */
	isStatic: Nullable<boolean>,
	/**
	 * The size of this file in bytes.
	 * 
	 * @note Due to compression, the resource might take significantly less data to download than this.
	 */
	size: number,
	/**
	 * The ID of the file in the array of build files.
	 * 
	 * @note The build files aren't sorted and could be in any order.
	 * @note Due to some files being sorted without calling the `FileSorter` (like routes), this will skip numbers.
	 */
	fileID: number,
	/**
	 * The `OutputAsset` or `OutputChunk` provided by Vite.
	 * 
	 * @note This will be null if there's no corresponding item in the bundle or if the manifest plugin isn't being used.
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
/**
 * A type representing the information Versioned Worker provides about the SvelteKit build.
 */
export interface BuildInfo {
	/**
	 * The whole Vite bundle. The key is the filename and the value is the `OutputAsset` or `OutputChunk`.
	 * 
	 * @note This will be `null` if the manifest plugin isn't being used.
	 * @note Some files might not have a corresponding item in the bundle.
	 */
	viteBundle: Nullable<OutputBundle>,
	/**
	 * All of the file paths of the build files, relative to the build directory.
	 * 
	 * @note They are normalised to be UNIX like (`"/"` instead of `"\"` on Windows).
	 * @note They **don't** start with `"./"`.
	 */
	fullFileList: Set<string>,
	/**
	 * All of the route file paths, relative to the build directory.
	 * 
	 * @note They are normalised to be UNIX like (`"/"` instead of `"\"` on Windows).
	 * @note They **don't** start with `"./"`.
	 */
	routeFiles: Set<string>,
	/**
	 * All of `fullFileList` mapped to each's size in bytes.
	 * 
	 * @note Due to compression, some files might take significantly less data to download than this number.
	 */
	fileSizes: Map<string, number>
}

/**
 * The type of a function that modifies the service worker's TypeScript config. It can either modify the provided `typescriptConfig` or return a new `TypescriptConfig`.
 * 
 * @note `configs` is unrelated to the TypeScript config and instead contains the Vite, Svelte, adapter and manifest plugin configs.
 * 
 * @see `AdapterConfig.configureWorkerTypescript` for its corresponding config item
 * @see
 * https://www.typescriptlang.org/tsconfig
 */
export type WorkerTypeScriptConfigHook = (typescriptConfig: TypescriptConfig, configs: AllConfigs) => MaybePromise<TypescriptConfig | void | undefined>;
/**
 * The type of a function that runs once the whole build is finished.
 * 
 * @see `AdapterConfig.onFinish` for its corresponding config item
 */
export type BuildFinishHook = (workerBuildSucceeded: boolean, processedBuild: ProcessedBuild, configs: AllConfigs) => void | Promise<void>;
/**
 * An interface representing the information Versioned Worker collected after sorting the build's files and gathering some more information.
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
 * A type representing how the build files were sorted.
 * 
 * @note Files whose mode was set to `"never-cache"` will only be in the `completeList`.
 * 
 * @see `FileSortMode` for more information on the different resource modes
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
/**
 * A map containing `FileSorterMessage`s, where the key is the file's path in the build.
 * 
 * @see FileSorterMessage for more information on messages logged by `FileSorter`s
 * @see `FileSorter` for more information on file sorters
 */
export type FileSorterMessages = Map<string, FileSorterMessage[]>;
/**
 * The type of a message logged by a `FileSorter`. The message can either be a regular message or a warning.
 * 
 * @see `FileSorter` for more information on file sorters
 */
export interface FileSorterMessage {
	isMessage: boolean,
	message: string
}


/**
 * The type of a function that takes a parsed web app manifest file and returns a new or modified one.
 * 
 * @note The provided `WebAppManifest` isn't validated, though it likely isn't worth checking it.
 * @note If you change the format of it, you'll need to cast `parsed` to a different type, possibly via `unknown`.
 */
export type ManifestProcessor = (parsed: WebAppManifest, configs: ManifestProcessorConfigs) => MaybePromise<string | WebAppManifest>;
/**
 * The type of the configs object provided to `ManifestProcessor`s.
 * 
 * @note `adapterConfig` will be `null` if the adapter isn't being used for some reason. You might just want to put a guard error clause at the top of your `ManifestProcessor` function to handle this.
 * 
 * @see `ManifestProcessor` for the type of the function that's called with this
 */
export interface ManifestProcessorConfigs {
	viteConfig: ViteConfig,
	minimalViteConfig: MinimalViteConfig,
	adapterConfig: Nullable<ResolvedAdapterConfig>,
	manifestPluginConfig: ResolvedManifestPluginConfig
}

/**
 * A string enum representing how a file should be handled. Generally, most files should use the default mode: `"pre-cache"`.
 * 
 * Note that a new version has to be released for Versioned Worker to detect a file as outdated. If you want more control for some files, you may need to set their modes to `"never-cache"` and implement the caching yourself.
 * 
 * The different modes are:
 * * `"pre-cache"` resources should always be available as they're downloaded during the worker install. They're also updated with the new worker if they've changed and will always be from the same version as each other.
 * * `"lax-lazy"` only downloads and caches the resource when it's requested. If the latest version is cached, that will be sent. Otherwise it'll try and fetch the resource from the network, if that fails, the worker will send a stale version. The fetch will only fail if the user is offline and there's no version of the resource in the cache.
 * * `"stale-lazy"` (stale while revalidate) is similar to `"lax-lazy"` but serves stale responses before downloading the current version. If and when this current version is downloaded, it's stored in the cache for next time. Like with `"lax-lazy"`, it won't use the network if the resource is up-to-date.
 * * `"strict-lazy"` is also similar to "lax-lazy" but will fail instead of sending stale responses. Resources using this mode are deleted from the cache if and when they become outdated, but not until the whole app has updated first.
 * * `"semi-lazy"` is a hybrid between `"pre-cache"` and `"lax-lazy"`. Once the resource has been accessed and cached once, it'll be kept updated when new versions are installed. It's mostly only useful for web app manifest icons.
 * * And `"never-cache"` always gets the resource using the network and doesn't cache the responses at all.
 */
export type FileSortMode = "pre-cache" | "lax-lazy" | "stale-lazy" | "strict-lazy" | "semi-lazy" | "never-cache";
/**
 * An interface of an object that contains a number of different configs.
 */
export interface AllConfigs extends LastInfoProviderConfigs {
	svelteConfig: SvelteConfig
}

/**
 * An interface containing the 2 most important values for Versioned Worker in the Vite config: the `"root"` and the `"manifest"` options.
 * 
 * @note If the manifest plugin isn't being used, `root` will be `process.cwd()` and `manifest` will be `"vite-manifest.json".
 */
export interface MinimalViteConfig {
	root: string,
	manifest: string | boolean
}

/**
 * The type of `AdapterConfig.logLevel`.
 * 
 * @see `AdapterConfig.logLevel` for more information
 */
export type LogLevel = "normal" | "verbose";