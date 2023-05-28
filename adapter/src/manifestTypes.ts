import type { WebAppManifest as CoreWebAppManifest } from "web-app-manifest";

export interface WebAppManifest extends CoreWebAppManifest {
	/**
	 * TODO
	 */
	file_handlers: FileHandler[],
	/**
	 * TODO
	 */
	launch_handler: LaunchHandler,
	/**
	 * TODO
	 */
	protocol_handlers: ProtocolHandler[],
	/**
	 * TODO
	 * 
	 * Non standard
	 */
	serviceworker: any,
	/**
	 * TODO
	 */
	share_target: ShareTarget
};
/**
 * TODO
 */
export interface FileHandler {
	action: string,
	accept: { [mimeType: string]: string[] }
};

/**
 * TODO
 */
export interface LaunchHandler {
	client_mode: ClientMode | ClientMode[]
};
/**
 * TODO
 */
export type ClientMode = string | "auto" | "focus-existing" | "navigate-existing" | "navigate-new";

/**
 * TODO
 */
export interface ProtocolHandler {
	protocol: string,
	url: string
};
/**
 * TODO
 */
export interface ShareTarget {
	action: string,
	enctype?: string,
	method?: "POST" | "GET",
	params?: ShareTargetOptions
};
/**
 * TODO
 */
export interface ShareTargetOptions {
	title?: string,
	text?: string,
	url?: string,
	files?: ShareFile | ShareFile[]
};
/**
 * TODO
 */
export interface ShareFile {
	name: string,
	accept: string | string[]
};