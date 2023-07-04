<script lang="ts">
	import type { VWRequestMode } from "internal-adapter/worker";
	type ResourceState = "updated" | "stale" | "uncached" | "error";

    import { onMount } from "svelte";
	import { link } from "$lib/util.js";
	import { VERSION } from "internal-adapter/runtime-constants";


	let state: ResourceState;
	onMount(async () => {
		let res: Response | null = null;
		try {
			res = await fetch(link("testVideo.mp4"), {
				method: "HEAD",
				headers: {
					"vw-mode": "no-network" satisfies VWRequestMode
				}
			});
		}
		catch {}
		state = determineResourceState(res);		
	});

	function determineResourceState(response: Response | null): ResourceState {
		if (response == null) return "uncached";

		const resourceVersion = parseInt(response.headers.get("vw-version") as string);
		if (isNaN(resourceVersion)) return "error";
		if (resourceVersion < VERSION) return "stale";
		return "updated";
	}
</script>

<main>
	<p>
		{#if state == null}
			Checking video state...
		{:else}
			{#if state === "updated"}
				The video is up to date.
			{:else if state === "stale"}
				The video is stale.
			{:else if state === "uncached"}
				The video hasn't been cached.
			{:else}
				The video has an invalid or missing "VW-Version" header.
			{/if}
		{/if}
	</p>
</main>