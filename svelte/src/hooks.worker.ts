import type { IDBPDatabase } from "idb";
import type { HandleFetchHook } from "internal-adapter/worker";
// @ts-ignore - Complicated to fix and doesn't affect the packaged version
import { preloadQuickFetch } from "sveltekit-adapter-versioned-worker/worker";

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

// Not async so null can be returned synchronously
export const handleFetch = (({ href, isPage, isCrossOrigin }) => {
	if (isCrossOrigin) return null;
	if (isPage) {
		if (href === "hidden-page") return hiddenPage();
		if (href === "quick-fetch/") {
			quickFetchBackgroundTask();
		}
	}

	// return new Promise(resolve => resolve(null));
	return null;
}) satisfies HandleFetchHook;

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