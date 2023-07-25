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

		const registration = await navigator.serviceWorker.register(link("sw.js"));
		if ((! registration.active)) return; // If there's no active worker then this one will become active automatically
		
		{
			console.log("A");
			// If a worker is installing, wait for it to finish
			if (registration.installing == null && registration.waiting == null) {
				while (true) {
					console.log("B");
					const { data } = <{ data: OutputMessageData }>((await waitForEvent(navigator.serviceWorker, "message" satisfies keyof ServiceWorkerContainerEventMap)) as MessageEvent);
					// Assuming the messages from the worker are valid

					if (data.type === "vw-waiting") break;
				}
			}
			
			let installingWorker = registration.installing; // Shouldn't be null now
			console.log("C", installingWorker);
			if (installingWorker) await waitForEvent(installingWorker, "statechange" satisfies keyof ServiceWorkerEventMap);
		}

		if (Date.now() - pageLoadTimestamp < 300) {
			const waitingWorker = registration.waiting;
			console.log("In time", waitingWorker); // TODO
			if (waitingWorker) {
				waitingWorker.postMessage({ type: "conditionalSkipWaiting" } as InputMessageData);
			}
		}
		else {
			console.log("TODO: Prompt");
			// TODO: prompt to reload
		}
	});

	if (browser && navigator.serviceWorker) {
		navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
	}

	let reloading = false;
	function onControllerChange() {
		if (reloading) return;
		location.reload();
	}
</script>