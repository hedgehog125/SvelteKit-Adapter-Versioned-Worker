<script lang="ts">
	import { onMount } from "svelte";
	import { dev } from "$app/environment";
	import { base } from "$app/paths";

	onMount(() => {
		if (dev) return;
		if (! ("serviceWorker" in navigator)) return;

		navigator.serviceWorker.register(base + "/sw.js");
	});
</script>