import type { IDBPDatabase } from "idb";
import type { HandleHook } from "internal-adapter/worker";

import { openDB } from "idb";

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
export const handle = ((path, isPage, fetchEvent) => {
	if (isPage) {
		if (path === "hidden-page") return hiddenPage();
	}

	// return new Promise(resolve => resolve(null));
	return null;
}) satisfies HandleHook;

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