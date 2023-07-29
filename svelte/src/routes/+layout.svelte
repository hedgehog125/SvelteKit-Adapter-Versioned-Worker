<script lang="ts">
	import ServiceWorker from "$lib/ServiceWorker.svelte";
    import { allowReloadOnNavigateWhileMounted } from "$lib/index.js";

	allowReloadOnNavigateWhileMounted();
</script>

<ServiceWorker></ServiceWorker>
<slot></slot>