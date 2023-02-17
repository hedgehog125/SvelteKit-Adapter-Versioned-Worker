import type { Logger } from "vite"

// Complex types are inlined in the config objects so you can read them properly, since there's no TypeScript in the config files

export interface AdapterConfig {
	/* Required */
	/**
	 * TODO
	 */
	lastInfo(): Promise<Nullable<string>> | Nullable<string>,

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
	 * @default "manifest.webmanifest" // (and also .json)
	 */
	src?: string,

	/**
	 * Where to output the file in the build folder/the route on the development server
	 * 
	 * @note
	 * Either extension can be used here (one is required though), but ".webmanifest" is the official standard (compared to .json)
	 * 
	 * @default "manifest.webmanifest"
	 */
	outputFile?: string
};

export type ResolvedAdapterConfig = Required<AdapterConfig>;
export type ResolvedManifestPluginConfig = Required<ManifestPluginConfig>;

export type Nullable<T> = T | null;

export interface VersionedWorkerLogger { // Copied from SvelteKit's files since I feel like that's better than importing an internal type
	success(msg: string): void,
	error(msg: string): void,
	warn(msg: string): void,
	minor(msg: string): void,
	info(msg: string): void,
	message(msg: string): void
};

export interface InfoFile {
	formatVersion: number,
	version: number,
	versions: InfoFileVersion[],
	hashes: Record<string, string>
};

export interface InfoFileVersion {
	// TODO
};