// Some data needs to be accessible by the worker module but should be kept private, that data goes here.
export const workerState = {
	quickFetchPromises: new Map<string, Promise<Response>>()
};

// Internal functions that are shared between the entry and the worker virtual module