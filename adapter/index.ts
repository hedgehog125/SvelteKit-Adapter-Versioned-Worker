import type { Adapter, Builder } from "@sveltejs/kit";

import {
	fileExists,
	adapterFilesPath
} from "./src/helper.js";
import type {
	AdapterConfig,
	ManifestPluginConfig
} from "./src/interfaces.js";
import adapterStatic from "@sveltejs/adapter-static";
import * as fs from "fs/promises";
import type { Plugin } from "vite"; 

export {
	AdapterConfig,
	ManifestPluginConfig
};
export function adapter(config: AdapterConfig) : Adapter {
	const adapterInstance = adapterStatic();

	const initTask = init();

	return {
		name: "adapter-versioned-worker",
		async adapt(builder: Builder) {
			await adapterInstance.adapt(builder);
			await initTask;

			console.log(adapterFilesPath);

			//builder.config.kit.
			// I know the different write methods return arrays of files, but I don't feel like maintaining a fork of adapter-static just to do that. So listing the files in the directory it is
		}
	};
};
export function manifestGenerator(config: ManifestPluginConfig): Plugin {
	return {
		name: "vite-plugin-vw-manifest"
	};
};

async function init() {
	
};