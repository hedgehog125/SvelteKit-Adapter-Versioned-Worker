import fs from "fs/promises";
import { copy, ensureDir } from "fs-extra";
import path from "path";

export async function makeOutputDir(folderPath) {
	try {
		await fs.rm(folderPath, { recursive: true });
	}
	catch {}

	await fs.mkdir(folderPath);
}
export async function copyFiles(copyList, outDir) {
	await Promise.all(copyList.map(async ([from, to]) => {
		const toPath = path.join(outDir, to);

		await copy(path.join("../", from), toPath);
	}));
}