<script lang="ts">
    import { link } from "$lib/util.js";
    import { onMount } from "svelte";

	let showVideo = false;

	onMount(async () => {
		showVideo = true;
	});
</script>

<main>
	{#if showVideo}
		<!-- svelte-ignore a11y-media-has-caption -->
		<span>Credit: </span> <a href="https://www.bigbuckbunny.org/">Big Buck Bunny</a> <br>
		<video muted controls>
			<source src={link("testVideo.mp4")} type="video/mp4">
		</video>
	{/if}
</main>