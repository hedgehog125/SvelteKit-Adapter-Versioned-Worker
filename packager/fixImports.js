import { Parser } from "acorn";
import tsPlugin from "acorn-typescript";
import rReadDir from "recursive-readdir";
import fs from "fs/promises";
import path from "path";

const SVELTE_OUTPUT_DIR = "../svelte/dist";
const MUST_BE_REPLACED_PREFIX = "internal-adapter";

// Relative to packager/dist
const replacements = {
	"internal-adapter": "build/index.js",
	"internal-adapter/worker": "virtual-modules/worker.js",
	"internal-adapter/worker/util": "build/src/worker/util.js"
};

async function main() {
	const files = (await rReadDir(SVELTE_OUTPUT_DIR)).filter(filePath => ! path.basename(filePath).startsWith("."));

	await Promise.all(files.map(async (filePath) => {
		const isJs = filePath.endsWith(".js");
		const isDTs = filePath.endsWith(".d.ts");
		if (! (isJs || isDTs)) return;

		let contents = await fs.readFile(filePath, { encoding: "utf8" });

		// Credit: based on https://github.com/iambumblehead/replace-imports/blob/master/replace-imports.js by bumblehead on GitHub
		let parsed;
		let length = null;
		let i = 0;
		do {
			if (parsed == null) {
				const CustomParser = isJs? Parser : Parser.extend(tsPlugin({ dts: true }));
				parsed = CustomParser.parse(contents, {
					ecmaVersion: "latest",
					sourceType: "module",
					locations: true
				});
				length = parsed.body.length;
			}

			const node = parsed.body[i];
			if (node.type === "ImportDeclaration") {
				const modulePath = node.source.value;
				const newRawPath = replacements[modulePath];
				if (newRawPath == null) {
					if (modulePath.startsWith(MUST_BE_REPLACED_PREFIX)) {
						throw new Error(`${modulePath} doesn't have a replacement.`);
					}
					i++;
					continue;
				}

				const normalizedImporterDirPath = path.dirname(path.relative(SVELTE_OUTPUT_DIR, filePath)).replaceAll(path.sep, "/");
				const importerDepth = normalizedImporterDirPath.split("/").length - 1;
				const newPath = `../${"../".repeat(importerDepth)}${newRawPath}`;
				const replacement = JSON.stringify(newPath); // Put it in quotes
				contents = `${contents.slice(0, node.source.start)}${replacement}${contents.slice(node.source.end)}`;
				parsed = null; // I know it's inefficient to have to re-parse every time but the efficiency of this script doesn't matter too much

				if (isJs) {
					console.log(`Replaced JS import ${modulePath}`);
				}
			}
			i++;
		} while (i < length);

		await fs.writeFile(filePath, contents, { encoding: "utf8" });
	}));	
}
main();