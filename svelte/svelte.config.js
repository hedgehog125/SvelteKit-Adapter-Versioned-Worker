const URL_PREFIX = "SvelteKit-Adapter-Versioned-Worker"; // <-- Set this to the repository name if you're hosting on GitHub Pages (unless it's your homepage site), as all the URLs will need to be prefixed with it. If you don't want a prefix, set it to an empty string

import { adapter, standardGetLast, valuesFromViteConfig } from "internal-adapter";
import { vitePreprocess } from "@sveltejs/kit/vite";
 
const isDev = process.env.NODE_ENV !== "production";
const disableBaseURL = isDev || (process.env.DISABLE_BASE_URL == null? false : process.env.DISABLE_BASE_URL === "true");
const baseURL = (
	disableBaseURL
	|| URL_PREFIX === ""
)? "" : `/${URL_PREFIX}`;

/** @type {import("@sveltejs/kit").Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		appDir: "app",
		paths: {
			base: baseURL
		},
		alias: {
			$util: "src/lib/util",
			$set: "src/lib/settings",
			$sub: "src/lib/subcomponents",
			$img: "src/lib/imgs",
			$snd: "src/lib/snds",
			$vid: "src/lib/vids",

			...(isDev? {} : {"internal-adapter/runtime-constants": "sveltekit-adapter-versioned-worker/runtime-constants"})
		},

		adapter: adapter({
			isElevatedPatchUpdate: 0,
			isMajorUpdate: 0,
			isCriticalUpdate: 0,
			
			lastInfo: standardGetLast("https://hedgehog125.github.io/SvelteKit-Plugin-Versioned-Worker/versionedWorker.json", disableBaseURL),
			sortFile: valuesFromViteConfig.sortFile,
			outputWorkerSourceMap: disableBaseURL? "inline" : false,
			useHTTPCache: disableBaseURL? false : true // http-server seems to send incorrect cache headers
		})
	}
};

export default config;