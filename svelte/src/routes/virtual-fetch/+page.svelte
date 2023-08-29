<script lang="ts">
    import { isWorkerActive, virtualFetch } from "$lib/index_internal.js";
    import { loadOnMount } from "$lib/util.js";

	const loadPromise = loadOnMount(async () => {
		const response = await virtualFetch("virtual-hello");
		if (response == null) throw "WorkerNotActivated";

		return await response.text();
	});
</script>

<main>
	{#await loadPromise}
		<p>
			Virtual fetching...
		</p>
	{:then responseText}
		<p>
			Got response from virtual fetch: {responseText}
		</p>
	{:catch error}
		<p>
			{#if error === "WorkerNotActivated"}
				The service worker isn't activated.
			{:else}
				An unknown error occurred.
			{/if}
		</p>
	{/await}
</main>