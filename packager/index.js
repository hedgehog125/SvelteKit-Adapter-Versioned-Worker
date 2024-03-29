const OUTPUT_DIR = "dist";

/**
 * From is relative to up one folder
 * To is relative to packager/dist
 */
const COPY_LIST = [
	["adapter/src", "src"],
	["adapter/build", "build"],
	["adapter/static/src", "static/src"],
	["adapter/static/jsBuild", "static/jsBuild"],
	["adapter/virtual-modules", "virtual-modules"],
	["adapter/index.ts", "index.ts"],


	["svelte/dist", "svelte"],
	["packager/static", ""],

	["README.md", "README.md"],
	["LICENSE.md", "LICENSE.md"],
	["COPYING.txt", "COPYING.txt"],
	["COPYING.LESSER.txt", "COPYING.LESSER.txt"]
];

import { makeOutputDir, copyFiles } from "./src/subFunctions.js";

async function main() {
	console.log("Packaging the last adapter and Svelte builds...");

	await makeOutputDir(OUTPUT_DIR);
	await copyFiles(COPY_LIST, OUTPUT_DIR);

	console.log("Done");
}
main();