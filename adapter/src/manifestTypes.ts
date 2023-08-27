import type { MaybeArray } from "./types.js";
import type { WebAppManifest as CoreWebAppManifest } from "web-app-manifest";

export interface WebAppManifest extends CoreWebAppManifest {
	/**
	 * Options related to the types of files this PWA can handle.
	 * 
	 * @see
	 * https://developer.mozilla.org/en-US/docs/Web/Manifest/file_handlers
	 */
	file_handlers?: FileHandler[],
	/**
	 * Contains options related to how the PWA launches.
	 * 
	 * @see
	 * https://developer.mozilla.org/en-US/docs/Web/Manifest/launch_handler
	 */
	launch_handler?: LaunchHandler,
	/**
	 * Options about the protocols the PWA can handle.
	 * 
	 * @see
	 * https://developer.mozilla.org/en-US/docs/Web/Manifest/protocol_handlers
	 */
	protocol_handlers?: ProtocolHandler[],
	/**
	 * Specifies a service worker that handles payments.
	 * 
	 * @note This is a non-standard property
	 * @see https://developer.mozilla.org/en-US/docs/Web/Manifest/serviceworker
	 */
	serviceworker?: unknown,
	/**
	 * Enables things to be shared to the PWA.
	 * 
	 * @see
	 * https://developer.mozilla.org/en-US/docs/Web/Manifest/share_target 
	 */
	share_target?: ShareTarget
}
/**
 * The type of a PWA file handler. It specifies what MIME types will be accepted and what href should be opened to handle the file.
 * 
 * @see `WebAppManifest.file_handlers` for its item in the manifest
 * @see
 * https://developer.mozilla.org/en-US/docs/Web/Manifest/file_handlers
 */
export interface FileHandler {
	action: string,
	accept: { [mimeType: string]: string[] }
}

/**
 * The type of a PWA launch handler. It contains options related to how the PWA launches.
 * 
 * @see `WebAppManifest.launch_handler` for its item in the manifest
 * @see
 * https://developer.mozilla.org/en-US/docs/Web/Manifest/launch_handler
 */
export interface LaunchHandler {
	/**
	 * @note The string or strings in the array can contain multiple items within them, separated by commas. To do this in TypeScript, you'll need to cast the string to a `ClientMode`.
	 */
	client_mode: MaybeArray<ClientMode>
}
/**
 * The context the PWA should be opened in.
 * 
 * @see `WebAppManifest.launch_handler` for its item in the manifest
 * @see
 * https://developer.mozilla.org/en-US/docs/Web/Manifest/launch_handler
 */
export type ClientMode = "auto" | "focus-existing" | "navigate-existing" | "navigate-new";

/**
 * The type of a PWA protocol handler. It's how you specify what protocols your PWA can handle.
 * 
 * @see `WebAppManifest.protocol_handlers` for its item in the manifest
 * @see
 * https://developer.mozilla.org/en-US/docs/Web/Manifest/protocol_handlers
 */
export interface ProtocolHandler {
	protocol: string,
	url: string
}
/**
 * The type describing how things can be shared to the PWA.
 * 
 * @see `WebAppManifest.share_target` for its item in the manifest
 * @see
 * https://developer.mozilla.org/en-US/docs/Web/Manifest/share_target
 */
export interface ShareTarget {
	action: string,
	enctype?: string,
	method?: "POST" | "GET",
	params?: ShareTargetOptions
}
/**
 * The type of the options for a PWA `ShareTarget`.
 * 
 * @see `WebAppManifest.share_target` for its item in the manifest
 * @see `ShareTarget` for the type of its item
 * @see
 * https://developer.mozilla.org/en-US/docs/Web/Manifest/share_target
 */
export interface ShareTargetOptions {
	title?: string,
	text?: string,
	url?: string,
	files?: MaybeArray<ShareFile>
}
/**
 * The type of the `"files"` property of `ShareTargetOptions`. It's used to specify how files should be received by the PWA.
 * 
 * @see `WebAppManifest.share_target` for its item in the manifest
 * @see `ShareTarget` for the type of its item
 * @see `ShareTargetOptions` for where this type is used
 * @see
 * https://developer.mozilla.org/en-US/docs/Web/Manifest/share_target 
 */
export interface ShareFile {
	name: string,
	accept: MaybeArray<string>
}