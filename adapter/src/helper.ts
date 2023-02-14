import * as fs from "fs/promises";
import * as path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";

export async function fileExists(filePath: string): Promise<boolean> {
	try {
		await fs.stat(filePath);
	}
	catch {
		return false;
	}
	return true;
};

export const adapterFilesPath = path.join(dirname(fileURLToPath(import.meta.url)), "../../");