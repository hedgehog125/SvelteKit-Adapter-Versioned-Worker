<script lang="ts">	
	import { loadOnMount } from "$lib/util.js";
    import { statResource } from "$lib/index_internal.js";
	
	
	const loadPromise = loadOnMount(async () => {
		const info = await statResource("testVideo.mp4");
		if (info == null) return -1;

		return info.age;
	});
</script>

<main>
	<p>
		{#await loadPromise}
			Checking video state...
		{:then age}
			{#if age === -1}
				The video hasn't been cached.
			{:else if age === 0}
				The video is up to date.
			{:else}
				The video is stale. It's {age} revisions out of date.
			{/if}
		{/await}
	</p>
</main>