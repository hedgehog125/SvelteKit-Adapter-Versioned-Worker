<script lang="ts">
	import { onMount } from "svelte";
	import { dev } from "$app/environment";
    import { link } from "./util.js";

	onMount(() => {
		if (dev) return;
		if (! ("serviceWorker" in navigator)) return;

		navigator.serviceWorker.register(link("sw.js"));
	});
</script>