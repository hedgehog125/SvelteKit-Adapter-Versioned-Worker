import { sveltekit } from "@sveltejs/kit/vite";
import { manifestGenerator } from "internal-adapter";
import virtualPlugin from "@rollup/plugin-virtual";

import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		sveltekit(),
		manifestGenerator(),
		virtualPlugin({
			"virtual-is-even": (() => {
				const initialIf = "if (number === 0) return true;";
				const elseStatements = new Array(1000).fill(null).map((_, index) => `else if (number === ${index + 1}) return ${(index + 1) % 2 === 0};`).join("\n");
				return `export default function isEven(number) {\n${initialIf}\n${elseStatements}\n}`;
			})()
		})
	]
});