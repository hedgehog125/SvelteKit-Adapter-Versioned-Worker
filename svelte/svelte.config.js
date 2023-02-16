const URL_PREFIX = "SvelteKit-Adapter-Versioned-Worker"; // <-- Set this to the repository name if you're hosting on GitHub Pages (unless it's your homepage site), as all the URLs will need to be prefixed with it. If you don't want a prefix, set it to an empty string


import { adapter } from "internal-adapter";
import { vitePreprocess } from "@sveltejs/kit/vite";

const dev = process.env.NODE_ENV != "production";
const disableBaseURL = process.env.DISABLE_BASE_URL == null? false : process.env.DISABLE_BASE_URL == "true";
const baseURL = (
	dev
	|| disableBaseURL
	|| URL_PREFIX == ""
)? "" : `/${URL_PREFIX}`;

const demoFolder = "src/lib/_demo/";
/** @type {import("@sveltejs/kit").Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		appDir: "app",
		paths: {
			base: baseURL
		},
		alias: {
			$util: demoFolder + "util",
			$set: demoFolder + "settings",
			$sub: demoFolder + "subcomponents",
			$img: demoFolder + "imgs",
			$snd: demoFolder + "snds",
			$vid: demoFolder + "vids"
		},

		adapter: adapter({
			lastInfo: _ => {}
		})
	}
};

export default config;