<script lang="ts">
    import type { UpdatePriority } from "internal-adapter/worker";

	import {
		VERSION,
		REDIRECT_TRAILING_SLASH,
		ENABLE_PASSTHROUGH,
		AUTO_PASSTHROUGH_CROSS_ORIGIN_REQUESTS,
		ENABLE_QUICK_FETCH
	} from "internal-adapter/runtime-constants";
	import { UPDATE_PRIORITY_NAMES, displayedUpdatePriority } from "$lib/index_internal.js";
    import { link, range } from "$lib/util.js";

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

	/**
	 * `priority` is a number rather than a `UpdatePriority` so it works with the range.
	 */
	function simulateUpdate(priority: number) {
		$displayedUpdatePriority = priority as UpdatePriority;
	}
</script>

<main>
	<h2>
		Test update prompts
	</h2>
	{#each range(5, 1) as index} <!-- 0 is for when there isn't an update -->
		<button type="button" on:click={() => simulateUpdate(index)}>
			Simulate {UPDATE_PRIORITY_NAMES[index]}
		</button>
	{/each}

	<p>
		Current version: {VERSION} <br>
		Redirect trailing slash: {REDIRECT_TRAILING_SLASH} <br>
		Enable passthrough: {ENABLE_PASSTHROUGH} <br>
		Auto passthrough cross origin requests: {AUTO_PASSTHROUGH_CROSS_ORIGIN_REQUESTS} <br>
		Enable quick fetch: {ENABLE_QUICK_FETCH} <br>
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

	<br><br>
	<h2>Links</h2> <br>
	<a href={link("is-even/")}>Is Even</a> <br>
	<a href={link("quick-fetch/")}>Quick Fetch</a> <br>
	<a href={link("dynamic-video/")}>Dynamic Video</a> <br>
	<a href={link("stat-video/")}>Stat Video</a> <br>
	<a href={link("blank-page/")}>Blank Page</a> <br>
	<a href={link("no-update-reload/")}>No Update Reload</a> <br>
	<a href={link("basic-resumable-state/")}>Basic Resumable State</a> <br>
	<a href={link("virtual-fetch/")}>Virtual Fetch</a> <br>
</main>

<style>
	.bold {
		font-weight: bold;
	}
</style>