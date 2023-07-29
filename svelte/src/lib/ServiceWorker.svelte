<script lang="ts">
	import type { InputMessageData, OutputMessageData } from "internal-adapter/worker";

	import { onMount } from "svelte";
	import { dev, browser } from "$app/environment";
    import { link, waitForEvent } from "$lib/util.js";
    import { beforeNavigate } from "$app/navigation";
    import { dontAllowReloadForNextNavigation, isReloadOnNavigateAllowed } from "$lib/index.js";
	import { internalState, skipWaiting, skipIfWaiting } from "$lib/internal.js";

	let pageLoadTimestamp: number;
	onMount(async () => {
		if (dev) return;
		if (! ("serviceWorker" in navigator)) return;
		pageLoadTimestamp = Date.now();

		navigator.serviceWorker.addEventListener("message", onSWMessage);
		const registration = await navigator.serviceWorker.register(link("sw.js"));
		internalState.registration = registration;

		while (true) {
			await waitForWorkerStateChangeIfNotNull(registration.installing);

			if (registration.waiting && registration.active) { // If there's no active worker, the waiting will become the active on its own
				handleWaitingWorker(registration.waiting);
			}
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
	let navigatingTo: string | null = null;
	function reloadOnce() {
		if (reloading) return;
		reloading = true;

		if (navigatingTo) {
			location.href = navigatingTo;
		}
		else {
			location.reload();
		}
	}

	beforeNavigate(navigation => {
		console.log(isReloadOnNavigateAllowed);
		navigatingTo = null;
		if (! isReloadOnNavigateAllowed) return;
		skipIfWaiting();
		navigatingTo = navigation.to?.url.toString()?? null;

		dontAllowReloadForNextNavigation();
	});

	async function waitForWorkerStateChangeIfNotNull(worker: ServiceWorker | null): Promise<void> {
		if (worker == null) return;

		await waitForEvent(worker, "statechange" satisfies keyof ServiceWorkerEventMap);
		return;
	}

	function handleWaitingWorker(waitingWorker: ServiceWorker) {
		if (Date.now() - pageLoadTimestamp < 300) {
			console.log("In time", waitingWorker); // TODO
			skipWaiting(waitingWorker);
		}
		else {
			console.log("TODO: Prompt");
			// TODO: prompt to reload
		}
	}
</script>