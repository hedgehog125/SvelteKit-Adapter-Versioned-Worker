import type { DBSchema, IDBPDatabase } from "idb";
import { openDB } from "idb";

export interface SettingsDB extends DBSchema {
	misc: {
		key: "enableQuickFetch", // A union of all the keys
		value: unknown
	}
}
export async function openSettingsDB(): Promise<IDBPDatabase<SettingsDB>> {
	return openDB<SettingsDB>("settings", 1, {
		upgrade(db, oldVersion, newVersion, transaction) {
			db.createObjectStore("misc");
			transaction.objectStore("misc").put(true, "enableQuickFetch");
		}
	});
}