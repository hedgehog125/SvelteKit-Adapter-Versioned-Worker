<script lang="ts">
    import { onMount } from "svelte";
	import testVideo from "/src/testVideo.mp4";

	let showVideo = false;

	onMount(async () => {
		// TODO: check if cached
		showVideo = true;
	});
</script>

<main>
	{#if showVideo}
		<!-- svelte-ignore a11y-media-has-caption -->
		<span>Credit: </span> <a href="https://www.bigbuckbunny.org/">Big Buck Bunny</a> <br>
		<video muted controls>
			<source src={testVideo} type="video/mp4">
		</video>
	{/if}
</main>