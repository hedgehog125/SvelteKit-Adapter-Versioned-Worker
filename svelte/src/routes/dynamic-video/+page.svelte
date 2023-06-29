<script lang="ts">
    import { onMount } from "svelte";

	let showVideo = false;

	onMount(async () => {
		console.trace((await import("/src/testVideo.mp4")).default);
	});
</script>

<main>
	{#if showVideo}
		<!-- svelte-ignore a11y-media-has-caption -->
		<span>Credit: </span> <a href="https://www.bigbuckbunny.org/">Big Buck Bunny</a>
		<video muted controls>
			<source src="movie.mp4" type="video/mp4">
		</video>
	{/if}
</main>