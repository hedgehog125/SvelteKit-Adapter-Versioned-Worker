<script lang="ts">
	import type { V1ResumableState } from "../../demo";

    import { beforeNavigate } from "$app/navigation";
    import { reloadOpportunity, resumeState } from "$lib/index_internal.js";
    import { link } from "$util";
    import { counter } from "../../demo";
    import { onMount } from "svelte";

	onMount(async () => {
		const resumableState = await resumeState();
		if (resumableState == null) return;
		if (resumableState.formatVersion !== 1) return;
		const contents = resumableState.data as V1ResumableState;

		$counter = contents.counter;
	});
	beforeNavigate(navigation => {
		reloadOpportunity(navigation, {
			formatVersion: 1,
			data: {
				counter: $counter
			} satisfies V1ResumableState
		});
	});

	function increaseCounter() {
		$counter++;
	}
</script>

<main>
	<p>
		Counter value: {$counter}
	</p>
	<button on:click={increaseCounter}>Increase counter</button> <br> <br>

	<p>
		If you click <a href={link("basic-resumable-state/subroute/")}>this link</a>, you might notice there can be page reloads while still keeping state. This is done through the second argument of reloadOpportunity, rather than by using IndexedDB or directly putting it in SessionStorage.
	</p>
	<p>
		There should be some sort of message when you leave this part of the demo site since the rest of the site assumes it's ok to reload, but it's irrelevant to this example.
	</p>
</main>