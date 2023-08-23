<script lang="ts">
    import type { V1SentWorkerMessage } from "../../demo.js";

    import { messageActiveWorker } from "$lib/index_internal.js";

	let succeeded: boolean | null = null;
	function handleMessageWorker() {
		succeeded = messageActiveWorker({ type: "sayHi" } satisfies V1SentWorkerMessage);
	};
</script>

<main>
	<button type="button" on:click={handleMessageWorker}>Ask the worker to say hi</button>
	{#if succeeded != null}
		<br><br>
		<p>
			{#if succeeded}
				You should have got an alert. The code for receiving it is in the top level layout file.
			{:else}
				No active worker.
			{/if}
		</p>
	{/if}
</main>