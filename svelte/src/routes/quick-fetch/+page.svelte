<script lang="ts">
    import { createURLWithVWMode, loadOnMount, quickFetch } from "$lib/util.js";
	import { openSettingsDB } from "../../demo";

	const quickFetchURL = "http://localhost:8081/";
	const normalFetchURL = createURLWithVWMode(quickFetchURL, "force-passthrough");
	let responseTime: number;
	const loadPromise = loadOnMount(async () => {
		const start = performance.now();

		const db = await openSettingsDB();
		const quickFetchEnabled = (await db.get("misc", "enableQuickFetch")) as boolean;
		const res = await (quickFetchEnabled? quickFetch : fetch)(quickFetchEnabled? quickFetchURL : normalFetchURL, { cache: "no-store" });
		/* ^ "no-store" is used instead of "no-cache" for the sake of this benchmark.
		But I think they have the same effect as the server doesn't send any cache headers? */

		const text = await res.text();

		responseTime = Math.round(performance.now() - start);
		return [text, quickFetchEnabled] as [string, boolean];
	});

	async function toggleQuickFetch() {
		const db = await openSettingsDB();
		const tx = db.transaction("misc", "readwrite");
		const miscStore = tx.objectStore("misc");
		
		miscStore.put(! (await miscStore.get("enableQuickFetch")), "enableQuickFetch");
		await tx.done;
	}
</script>

<main>
	{#await loadPromise}
		<p>
			Loading message from the server...
		</p>
	{:then [serverMessage, quickFetchEnabled]}
		<p>
			Dynamic message from server: {serverMessage} <br>
			In {responseTime}ms <br>
			With quick fetch {quickFetchEnabled? "enabled" : "disabled"}
		</p>
		<button on:click={toggleQuickFetch}>Toggle quick fetch</button> <br>
		<p>Once toggled, reload to fetch again</p>
	{:catch}
		<p>
			An error occurred.
		</p>
	{/await}
</main>