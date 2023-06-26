<script lang="ts">
	import { VERSION } from "internal-adapter/runtime-constants";
    import { link } from "$lib/util.js";
    import { onMount } from "svelte";

	const requestCount = 15; // 10000;
	let totalTime = 0;
	let requestsCompleted = 0;
	async function fetchTest() {
		for (let i = 0; i < requestCount; i++) {
			const start = performance.now();
			await fetch(link("ping.txt"), { cache: "no-store" });

			const fetchTime = (performance.now() - start) / 1000;
			totalTime += fetchTime;
			requestsCompleted++;
		}
	}
	onMount(fetchTest);
</script>

<main>
	<h1>Welcome to your library project</h1>
	<p>Create your package using @sveltejs/package and preview/showcase your work with SvelteKit</p>
	<p>Visit <a href="https://kit.svelte.dev">kit.svelte.dev</a> to read the documentation</p>

	<p>
		Current version: {VERSION} <br>
	</p>

	<br>
	<h2>Fetch performance test</h2>
	<span class="bold">Overall time</span>: {totalTime}s <br>
	<span>Requests completed: {requestsCompleted}/{requestCount}</span>


	<h3>Typical times</h3>
	<p>(for 10,000 requests)</p>

	<h4>Running locally</h4> <br>
	<span>Without passthrough</span>: 43 seconds ({"<"}1s variance) <br>
	<span>With</span>: 37 seconds ({"<"}1s variance) <br>

	<br>
	<h4>LAN over WiFi with a good connection</h4> <br>
	<span>Without passthrough</span>: _ seconds (~_s variance) <br>
	<span>With</span>: _ seconds (~_s variance) <br>

	<h4>LAN over WiFi with worse connection</h4> <br>
	<span>Without passthrough</span>: _ seconds <br>
	<span>With</span>: _ seconds <br>
</main>

<style>
	.bold {
		font-weight: bold;
	}
</style>