import { sveltekit } from "@sveltejs/kit/vite";
import { manifestGeneratorPlugin, shareValueWithSvelteConfig } from "internal-adapter";
import virtualPlugin from "@rollup/plugin-virtual";
import { defineConfig } from "vite";

shareValueWithSvelteConfig("sortFile", ({ href, size, viteInfo, isStatic }) => {
	if (href === "ping.txt") return "never-cache";
	if (isStatic) {
		if (size > 100_000) return "lax-lazy";
	}
	if (viteInfo) {
		if (viteInfo.type === "chunk") {
			if (viteInfo.isDynamicEntry && (! viteInfo.isEntry) && size > 5000) {
				return "strict-lazy";
			}
		}
		/*
		else {
			if (viteInfo.name) {
				if (viteInfo.name === "close.svg") {
					return "lax-lazy";
				}
			}
		}
		*/
	}

	return "pre-cache";
});

export default defineConfig({
	plugins: [
		// TODO: fix the dependency issue with the development setup

		sveltekit() as any,
		manifestGeneratorPlugin() as any,
		virtualPlugin({
			"virtual-is-even": (() => {
				const initialIf = "if (number === 0) return true;";
				const elseStatements = Array.from(new Array(1000), (_, index) => `else if (number === ${index + 1}) return ${(index + 1) % 2 === 0};`).join("\n");
				return `export default function isEven(number) {\n${initialIf}\n${elseStatements}\n}`;
			})()
		})
	]
});