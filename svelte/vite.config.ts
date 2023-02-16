import { sveltekit } from "@sveltejs/kit/vite";
import { manifestGenerator } from "internal-adapter";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		sveltekit(),
		manifestGenerator()
	]
});