import type { VersionedWorkerLogger } from "./types.js";
import { createLogger } from "./helper.js";

export const log: VersionedWorkerLogger = createLogger(true);