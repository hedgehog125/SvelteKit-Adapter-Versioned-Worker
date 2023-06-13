import { VersionedWorkerError } from "./build/src/helper.js";
throw new VersionedWorkerError("This module can't be used outside of the worker hooks file.");