<script lang="ts">
	import type { VWCustomMessageEvent } from "$lib/index_internal.js";
    import type { V1MessageFromWorker } from "../demo.js";

	import ServiceWorker from "$lib/ServiceWorker.svelte";
    import { allowReloadOnNavigateWhileMounted } from "$lib/index_internal.js";

	allowReloadOnNavigateWhileMounted();

	function handleMessage({ detail }: CustomEvent<VWCustomMessageEvent>) {
		if (detail.isFromDifferentVersion) return;

		const data = detail.data as V1MessageFromWorker;
		if (data.type === "alert") {
			alert(data.message);
		}
	}
</script>

<ServiceWorker on:message={handleMessage}></ServiceWorker>
<slot></slot>