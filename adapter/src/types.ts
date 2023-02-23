import type { Logger } from "vite"

// Complex types are inlined in the config objects so you can read them properly, since there's no TypeScript in the config files

export interface AdapterConfig {
	/* Required */
	/**
	 * Provides the contents of the versionedWorker.json file from the last build
	 * 
	 * Most of the time, you can import and call "fetchLast" or "readLast" to return a function for this property. But you can also make a custom one by returning a promise that resolves to the contents of the versionedWorker.json file, or null if there isn't one. Generally, you should emit a warning using the "warn" method on the provided VersionedWorkerLogger in this case, unless you have some way of verifying that this is the first build (both the built-in methods don't). You can also immediately return the contents or null, rather than returning a promise for one.
	 */
	lastInfo(log: VersionedWorkerLogger): Promise<Nullable<string>> | Nullable<string>,

	/**
	 * Enables and disables the warning when the Vite config can't be resolved due to the manifest generator plugin being missing 
	 * 
	 * @note
	 * If you don't want to use the manifest plugin for whatever reason, you can probably disable this warning. However, if the current working directory doesn't match Vite's route or if Vite's manifest filename is different to the SvelteKit default (vite-manifest.json), you'll need to provide one with the "getViteManifest" config argument instead.
	 * 
	 * @default true
	 */
	warnOnViteConfigUnresolved?: boolean
};
export interface ManifestPluginConfig {
	/**
	 * The path to the input web app manifest file, relative to "src" folder
	 * 
	 * @note
	 * Ending the path with .json/.webmanifest extension is optional. The file is looked for with both extensions
	 * 
	 * @example
	 * TODO
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
	outputFile?: string
};

export type ResolvedAdapterConfig = Required<AdapterConfig>;
export type ResolvedManifestPluginConfig = Required<ManifestPluginConfig>;

export type Nullable<T> = T | null;

export interface VersionedWorkerLogger {
	message(msg: string): void,
	success(msg: string): void,
	error(msg: string): void,
	warn(msg: string): void,

	minor(msg: string): void,
	info(msg: string): void,
	blankLine(): void,
	verbose: boolean
};

interface InfoFileBase {
	formatVersion: number,
	version: number,
	versions: InfoFileVersion[],
	hashes: Record<string, string> | Map<string, string>
};
export interface UnprocessedInfoFile extends InfoFileBase {
	hashes: Record<string, string>
};
export interface InfoFile extends InfoFileBase {
	hashes: Map<string, string>
};

export interface InfoFileVersion {
	formatVersion: number,
	updated: string[][]
};