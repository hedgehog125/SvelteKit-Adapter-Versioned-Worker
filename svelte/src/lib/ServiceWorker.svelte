<script lang="ts">
	import type { InputMessageData, OutputMessageData } from "internal-adapter/worker";
	import type { WorkerRegistrationFailedReason } from "$lib";

	import { createEventDispatcher, onMount } from "svelte";
	import { dev, browser } from "$app/environment";
    import {
		ExposedPromise,
		getNavigationDestURL,
		link,
		waitForEvent
	} from "$lib/util.js";
    import { beforeNavigate } from "$app/navigation";
    import {
		RESUMABLE_STATE_NAME,
		checkIfResumableState,
		dontAllowReloadForNextNavigation,
		isReloadOnNavigateAllowed,

        isWorkerActivated

	} from "$lib/index.js";
	import { internalState, skipWaiting, skipIfWaiting } from "$lib/internal.js";

	const dispatch = createEventDispatcher<{
		/**
		 * Called when the service worker is first activated. Or on mount if it is already.
		 */
		activate: null,
		/**
		 * Called on mount if service workers are unsupported by the browser or if you're using the development server. Otherwise, called if and when a service worker errors while being registered.
		 */
		fail: WorkerRegistrationFailedReason
	}>();

	let activateEventSent = false;
	let pageLoadTimestamp: number;
	onMount(async () => {
		if (dev) {
			dispatch("fail", "dev");
			return;
		}
		if (! ("serviceWorker" in navigator)) {
			dispatch("fail", "unsupported");
			return;
		}
		pageLoadTimestamp = Date.now();

		if (isWorkerActivated()) {
			dispatch("activate");
			activateEventSent = true;
		}

		navigator.serviceWorker.addEventListener("message", onSWMessage);
		let registration: ServiceWorkerRegistration | null = null;
		try {
			registration = await navigator.serviceWorker.register(link("sw.js"));
		}
		catch {
			dispatch("fail", "error");
		}
		if (registration == null) return;

		internalState.registration = registration;
		if (checkIfResumableState()) {
			registration.active?.postMessage({ type: "resume" } satisfies InputMessageData);
		}

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
		if (activateEventSent) { // The worker was updated
			reloadOnce();
		}
		else { // Wasn't registered before
			dispatch("activate");
			activateEventSent = true;
		}
	}
	function onSWMessage(e: MessageEvent) {
		const data = e.data as OutputMessageData;

		if (data.type === "vw-reload") {
			reloadOnce();
		}
		else if (data.type === "vw-resume") {
			const innerData = data.data;
			internalState.waitingResumableState = innerData;
			internalState.resumableStatePromise.resolve(innerData);
			internalState.resumableStatePromise = new ExposedPromise();
			sessionStorage.removeItem(RESUMABLE_STATE_NAME);
		}
	}
	let reloading = false;
	function reloadOnce() {
		if (reloading) return;
		reloading = true;

		if (internalState.navigatingTo) {
			location.href = internalState.navigatingTo;
		}
		else {
			location.reload();
		}
	}

	beforeNavigate(navigation => {
		internalState.navigatingTo = null;
		if (! isReloadOnNavigateAllowed) return;
		skipIfWaiting(null);
		internalState.navigatingTo = getNavigationDestURL(navigation);

		dontAllowReloadForNextNavigation();
	});

	async function waitForWorkerStateChangeIfNotNull(worker: ServiceWorker | null): Promise<void> {
		if (worker == null) return;

		await waitForEvent(worker, "statechange" satisfies keyof ServiceWorkerEventMap);
		return;
	}

	function handleWaitingWorker(waitingWorker: ServiceWorker) {
		if (Date.now() - pageLoadTimestamp < 300) {
			skipWaiting(waitingWorker, null);
		}
		else {
			// TODO: prompt to reload
		}
	}
</script>