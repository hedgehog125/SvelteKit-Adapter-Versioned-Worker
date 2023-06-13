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

export const handle = (async path => {
	if (path === "hidden-page") {
		await initTask;

		const count: number = await db.get("misc", "counter");
		await db.put("misc", count + 1, "counter");
		return new Response(count.toString());
	}
	return null;
}) satisfies HandleHook;