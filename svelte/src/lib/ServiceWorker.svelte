<script lang="ts">
	import type { InputMessageData, OutputMessageData } from "internal-adapter/worker";
	import { onMount } from "svelte";
	import { dev, browser } from "$app/environment";
    import { link, waitForEvent } from "./util.js";

	let pageLoadTimestamp: number;
	onMount(async () => {
		if (dev) return;
		if (! ("serviceWorker" in navigator)) return;
		pageLoadTimestamp = Date.now();

		navigator.serviceWorker.addEventListener("message", onSWMessage);
		const registration = await navigator.serviceWorker.register(link("sw.js"));		
		while (true) {
			await waitForWorkerStateChangeIfNotNull(registration.installing);

			if (registration.waiting) handleWaitingWorker(registration.waiting);
			await waitForEvent(registration, "updatefound" satisfies keyof ServiceWorkerRegistrationEventMap);
		}
	});

	if (browser && navigator.serviceWorker) {
		navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
	}

	function onControllerChange() {
		reloadOnce(); // TODO: don't reload if there wasn't a worker before
	}
	function onSWMessage(e: MessageEvent) {
		const data = e.data as OutputMessageData;
		
		if (data.type === "vw-reload") {
			reloadOnce();
		}
	}
	let reloading = false;
	function reloadOnce() {
		if (reloading) return;
		reloading = true;
		location.reload();
	}

	async function waitForWorkerStateChangeIfNotNull(worker: ServiceWorker | null): Promise<void> {
		if (worker == null) return;

		await waitForEvent(worker, "statechange" satisfies keyof ServiceWorkerEventMap);
		return;
	}

	function handleWaitingWorker(waitingWorker: ServiceWorker) {
		if (Date.now() - pageLoadTimestamp < 300) {
			console.log("In time", waitingWorker); // TODO
			waitingWorker.postMessage({ type: "conditionalSkipWaiting" } as InputMessageData);
		}
		else {
			console.log("TODO: Prompt");
			// TODO: prompt to reload
		}
	}
</script>