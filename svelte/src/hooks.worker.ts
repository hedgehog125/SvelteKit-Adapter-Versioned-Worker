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

export const handle = (async (path, isPage, fetchEvent) => {
	if (isPage) {
		if (path === "hidden-page") {
			await initTask;
	
			const count = await db.get("misc", "counter") as number;
			await db.put("misc", count + 1, "counter");
			return new Response(count.toString(), {
				headers: {
					"Cross-Origin-Opener-Policy": "same-origin",
					"Cross-Origin-Embedder-Policy": "require-corp"
				}
			});
		}
	}
	return null;
}) satisfies HandleHook;