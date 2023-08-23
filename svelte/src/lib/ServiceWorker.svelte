<script lang="ts">
	import type { InputMessageData, OutputMessageData, UpdatePriority } from "internal-adapter/worker";
	import type { VWCustomMessageEvent, WorkerRegistrationFailEvent, WorkerUpdateCheckEvent } from "$lib/index_internal.js";

	import {
		RESUMABLE_STATE_NAME,
		checkIfResumableState,
		dontAllowReloadForNextNavigation,
		isReloadOnNavigateAllowed,

        isWorkerActivated,
		displayedUpdatePriority,

        RELOAD_TIMEOUT,

        RELOAD_RETRY_TIME
	} from "$lib/index_internal.js";
    import {
		ExposedPromise,
		getNavigationDestURL,
		link,
		timeoutPromise,
		waitForEvent
	} from "$lib/util.js";
	import {
		internalState,
		skipWaiting,
		skipIfWaiting,

		OUTPUT_WORKER_FILE_NAME,
		ENABLE_SECOND_UPDATE_PRIORITY_ELEVATION,
        CHECK_FOR_UPDATES_INTERVAL
	} from "$lib/internal.js";
    import DefaultUpdatePrompt from "./DefaultUpdatePrompt.svelte";

	import { createEventDispatcher, onMount } from "svelte";
	import { dev, browser } from "$app/environment";
    import { beforeNavigate } from "$app/navigation";

	const dispatch = createEventDispatcher<{
		/**
		 * Called when the service worker is first activated. Or on mount if it is already.
		 */
		activate: void,
		/**
		 * Called on mount if service workers are unsupported by the browser or if you're using the development server. Otherwise, called if and when a service worker errors while being registered.
		 */
		fail: WorkerRegistrationFailEvent,
		/**
		 * TODO: only runs when beforeunload prevents default
		*/
		reloadfail: void,
		/**
		 * TODO
		*/
		updatecheck: WorkerUpdateCheckEvent,
		/**
		 * TODO
		 */
		updateready: void,
		/**
		 * TODO
		 */
		message: VWCustomMessageEvent
	}>();

	let activateEventSent = false;
	let pageLoadTimestamp: number;
	onMount(async () => {
		if (dev) {
			dispatch("fail", {
				reason: "dev"
			});
			return;
		}
		if (! ("serviceWorker" in navigator)) {
			dispatch("fail", {
				reason: "unsupported"
			});
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
			registration = await navigator.serviceWorker.register(link(OUTPUT_WORKER_FILE_NAME?? "sw.js"));
		}
		catch {
			dispatch("fail", {
				reason: "error"
			});
		}
		if (registration == null) return;

		internalState.registration = registration;
		let workerThatTriggeredLastEvent = registration.installing || registration.waiting;
		if (CHECK_FOR_UPDATES_INTERVAL !== false) {
			setInterval(checkForUpdatesInternal, CHECK_FOR_UPDATES_INTERVAL?? 86400_000);
		}

		if (checkIfResumableState()) {
			registration.active?.postMessage({ type: "resume" } satisfies InputMessageData);
		}
		registration.active?.postMessage({ type: "getInfo" } satisfies InputMessageData);


		(async () => {
			while (true) {
				const command = await internalState.commandForComponentPromise;

				if (command.type === "updateCheck") checkForUpdatesInternal();
			}
		})();
		while (true) {
			await waitForWorkerStateChangeIfNotNull(registration.installing);

			registration.waiting?.postMessage({ type: "getInfo" } satisfies InputMessageData);
			if (registration.waiting && registration.active) { // If there's no active worker, the waiting will become the active on its own
				await internalState.waitingWorkerInfoPromise;
				handleWaitingWorker(registration.waiting);
			}
			await waitForEvent(registration, "updatefound" satisfies keyof ServiceWorkerRegistrationEventMap);
			internalState.waitingWorkerInfo = null;
		}

		async function checkForUpdatesInternal() {
			let succeeded = true;
			try {
				await registration!.update();
			}
			catch {
				succeeded = false;
			}

			const currentWaitingOrInstalled = registration!.installing || registration!.waiting;
			const isNew = workerThatTriggeredLastEvent !== currentWaitingOrInstalled;
			workerThatTriggeredLastEvent = currentWaitingOrInstalled;

			dispatch("updatecheck", {
				succeeded,
				updateAvailable: currentWaitingOrInstalled != null,
				isNew
			});
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
	async function onSWMessage(messageEvent: MessageEvent) {
		const data = messageEvent.data as OutputMessageData;
		const isFromActiveWorker = (messageEvent.source as ServiceWorker).state === "activated";

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
		else if (data.type === "vw-info") {
			if (isFromActiveWorker) {
				internalState.activeWorkerInfo = data.info;
			}
			else {
				internalState.waitingWorkerInfo = data.info;
			}

			internalState.waitingWorkerInfoPromise.resolve();
			internalState.waitingWorkerInfoPromise = new ExposedPromise();
		}
		else if (data.type === "vw-skipFailed") {
			const waitingWorker = internalState.registration!.waiting;
			if (waitingWorker) {
				waitingWorker.postMessage({ type: "getInfo" } satisfies InputMessageData);
				await internalState.waitingWorkerInfoPromise;
			}

			// If a skip is attempted when the page loads but it fails, the update message should be displayed
			$displayedUpdatePriority = getUpdatePriority();
			dispatch("updateready");
		}
		else if (data.type === "custom") {
			dispatch("message", {
				isFromDifferentVersion: data.isFromDifferentVersion,
				data: data.data,
				event: messageEvent
			} as VWCustomMessageEvent);
		}
	}

	async function reloadOnce() {
		if (internalState.reloading) return;
		internalState.reloading = true;

		internalState.reloadingPromise.resolve(true);
		internalState.reloadingPromise = new ExposedPromise();
		await timeoutPromise(0);

		while (true) {
			if (internalState.navigatingTo) {
				location.href = internalState.navigatingTo;
			}
			else {
				location.reload();
			}
	
			const skippedCountdown = await Promise.race([
				timeoutPromise(RELOAD_TIMEOUT),
				internalState.skipReloadCountdownPromise
			]);
			dispatch("reloadfail");
			if (! skippedCountdown) {
				await Promise.race([
					timeoutPromise(RELOAD_RETRY_TIME),
					internalState.skipReloadCountdownPromise
				]);
			}
		}
	}

	beforeNavigate(navigation => {
		internalState.navigatingTo = null;
		if (! isReloadOnNavigateAllowed) return;
		if (! navigation.willUnload) { // Can cause issues with multiple tabs as the client count often has reduced by the time the worker checks
			skipIfWaiting(null);
			internalState.navigatingTo = getNavigationDestURL(navigation);
		}

		dontAllowReloadForNextNavigation();
	});

	async function waitForWorkerStateChangeIfNotNull(worker: ServiceWorker | null) {
		if (worker == null) return;

		await waitForEvent(worker, "statechange" satisfies keyof ServiceWorkerEventMap); // Installing to installed
		return;
	}

	function handleWaitingWorker(waitingWorker: ServiceWorker) {
		if (Date.now() - pageLoadTimestamp < 300) {
			skipWaiting(waitingWorker, null);
		}
		else {
			$displayedUpdatePriority = getUpdatePriority();
			dispatch("updateready");
		}
	}

	function getUpdatePriority(): UpdatePriority {
		const info = internalState.waitingWorkerInfo;
		if (info == null || info.majorFormatVersion !== 1) return 2;

		if (info.updatePriority === 1) {
			const daysAgo = Math.floor((Date.now() - info.timeInstalled) / 86400000);
			if (
				(ENABLE_SECOND_UPDATE_PRIORITY_ELEVATION !== false && daysAgo > 2)
				|| (daysAgo > 0 && info.blockedInstallCount > 1)
			) {
				return 2; // Increase the priority so the user is prompted
			}
		}
		return info.updatePriority;
	}
</script>

<main>
	{#if $displayedUpdatePriority !== 0}
		<slot name="updatePrompt" priority={$displayedUpdatePriority}>
			<DefaultUpdatePrompt priority={$displayedUpdatePriority}></DefaultUpdatePrompt>
		</slot>
	{/if}
</main>