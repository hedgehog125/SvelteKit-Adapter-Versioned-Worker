import type { DBSchema, IDBPDatabase } from "idb";
import { openDB } from "idb";
import { writable } from "svelte/store";

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

export interface V1MessageFromWorker {
	type: "alert" | "unused",
	message: string
}
export interface V1MessageToWorker {
	type: "sayHi" | "unused"
}

export const counter = writable(0); // TODO: this might cause issues with the worker
export interface V1ResumableState {
	counter: number
}