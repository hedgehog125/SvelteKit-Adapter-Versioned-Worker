import type { IDBPDatabase } from "idb";
import type { HandleFetchHook } from "internal-adapter/worker";
// @ts-ignore - Complicated to fix and doesn't affect the packaged version. Use this instead of internal-adapter/worker
import { preloadQuickFetch, virtualRoutes } from "sveltekit-adapter-versioned-worker/worker";

import { openDB } from "idb";
import { openSettingsDB } from "./demo.js";

type Nullable<T> = T | null;

let db: IDBPDatabase;
const initTask = (async () => {
	db = await openDB("test", 1, {
		upgrade(db, oldVersion, newVersion, transaction, event) {
			db.createObjectStore("misc");
			transaction.objectStore("misc").put(0, "counter");
		}
	});
})();

export const handleFetch = virtualRoutes({
	"/hidden-page": hiddenPage,
	"/quick-fetch/": () => {
		quickFetchBackgroundTask();
	},
	"virtual-hello": () => {
		return new Response("Greetings");
	}
});

async function hiddenPage(): Promise<Response> {
	await initTask;
	
	let count = await db.get("misc", "counter") as Nullable<number>;
	if (count == null) count = 0;

	await db.put("misc", count + 1, "counter");
	return new Response(count.toString(), {
		headers: {
			"Cross-Origin-Opener-Policy": "same-origin",
			"Cross-Origin-Embedder-Policy": "require-corp"
		}
	});
}
async function quickFetchBackgroundTask() {
	const db = await openSettingsDB();
	if (await db.get("misc", "enableQuickFetch")) {
		preloadQuickFetch("http://localhost:8081/");
	}
}