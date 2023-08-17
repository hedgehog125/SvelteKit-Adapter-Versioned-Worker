<script lang="ts">
    import type { UpdatePriority } from "internal-adapter/worker";

	import { RELOAD_RETRY_TIME, RELOAD_TIMEOUT, UPDATE_PROMPT_MESSAGES, dismissUpdateMessage, reloadOpportunity } from "$lib/index_internal.js";
	import closeIcon from "$img/close.svg";

	import { fly, fade } from "svelte/transition";
    import { timeoutPromise } from "$util";
    import { onMount } from "svelte";

	let destroyed = false;
	onMount(() => {
		return () => {
			destroyed = true;
		};
	});

	export let priority: UpdatePriority;

	let displayMultiTabMessage = false;
	let countdownInSeconds: number | null = null;
	$: message = determineMessage(displayMultiTabMessage, priority, countdownInSeconds);

	function determineMessage(displayMultiTabMessage: boolean, priority: UpdatePriority, countdownInSeconds: number | null): string | null {
		if (displayMultiTabMessage) {
			return "Please close all other windows and tabs of this app";
		}
		else {
			if (countdownInSeconds == null) {
				return UPDATE_PROMPT_MESSAGES[priority];
			}
			else {
				return `Reloading in ${countdownInSeconds}s`;
			}
		}
	}
	async function handleReload() {
		const succeeded = await reloadOpportunity();
		if (destroyed) return;
		if (succeeded) {
			await timeoutPromise(RELOAD_TIMEOUT);
			if (destroyed) return;
			// Hasn't reloaded

			timerDuration = RELOAD_RETRY_TIME / 1000;
			timerStartTime = document.timeline.currentTime as number;
			timerTick(timerStartTime);
		}
		else {
			displayMultiTabMessage = true;
			setTimeout(handleReload, 100);
		}
	}

	function handleTimedReload() {
		timerStartTime = document.timeline.currentTime as number;
		timerTick(timerStartTime);
	}

	// Credit: adapted from https://gist.github.com/jakearchibald/cb03f15670817001b1157e62a076fe95
	let timerStartTime: number;
	let timerDuration = 60;
	const TIMER_DELAY = 1000;
	function timerTick(time: number) {
		if (destroyed) return;

		const elapsed = time - timerStartTime;
		let elapsedInSeconds = Math.round(elapsed / TIMER_DELAY);
		const roundedElapsed = elapsedInSeconds * TIMER_DELAY;

		countdownInSeconds = Math.max(timerDuration - elapsedInSeconds, 0);
		if (countdownInSeconds === 0) {
			handleReload();
			return;
		}

		const targetNext = timerStartTime + roundedElapsed + TIMER_DELAY;
		const delay = targetNext - performance.now();
		setTimeout(() => requestAnimationFrame(timerTick), delay);
	}
</script>

{#if message != null}
	{#if priority === 4 && countdownInSeconds == null}
		<div class="popup" transition:fade|global={{ duration: 500 }}>
			<div>
				<p>
					{message}
				</p>
				<div>
					<div>
						<button type="button" on:click={handleReload}>Reload</button>
						<button type="button" on:click={handleTimedReload}>Reload in 60 seconds</button>
					</div>
				</div>
			</div>
		</div>
	{:else}
		<div class="side" transition:fly|global={{
			y: 75,
			duration: 750
		}}>
			<p>
				{message}
			</p>
			<div>
				<button type="button" on:click={handleReload}>Reload</button>
				{#if countdownInSeconds == null}
					<button type="button" on:click={() => dismissUpdateMessage()}>
						<img src={closeIcon} alt="Close popup" width=16 height=16>
					</button>
				{/if}
			</div>
		</div>
	{/if}
{/if}

<style>
	div {
		font-family: sans-serif;
	}
	button {
		cursor: pointer;

		background: none;
		border: none;

		font-weight: bold;
		font-size: 17px;
	}

	.side {
		position: fixed;
		left: 50%;
		bottom: 25px;
		transform: translateX(-50%);
		max-width: 90%;

		display: flex;
		justify-content: space-between;
		align-items: center;
		z-index: 99;
		background-color: #2c2c30;
		padding-left: 25px;
		padding-right: 12.5px;
		white-space: nowrap;

		border: 1px solid #2c2c30;
		border-radius: 5px;
		box-shadow: 2px 2px 4px #000000A0;
	}
	@media only screen and (max-width: 550px) {
		.side {
			left: 0;
			right: 0;
			bottom: 0;

			transform: unset;
			border-radius: 0;
			box-shadow: none;
		}
	}
	.side > p {
		margin: 10px;
		margin-right: 50px;

		font-size: 17px;
		text-align: center;
		color: #ddd;
		white-space: normal;
		inline-size: max-content;
	}
	.side > div {
		display: flex;
		align-items: center;
	}
	.side > div > button {
		margin-left: 12.5px;
		color: rgb(204, 195, 245);
	}
	button > img {
		display: block;
		max-height: 100%;
		width: auto;
	}


	.popup {
		position: fixed;
		left: 0;
		right: 0;
		top: 0;
		bottom: 0;

		z-index: 99;
		display: flex;
		justify-content: center;
		align-items: center;
		background-color: #2c2c30CC;
	}
	.popup > div {
		--border-radius: min(5vw, 5vh);
		--size: max(min(50vw, 50vh), min(550px, 95vw, 95vh));

		position: relative;

		min-width: var(--size);
		min-height: var(--size);

		background-color: rgb(221, 227, 230);
		border-radius: var(--border-radius);
		border-style: none;
		box-shadow: 2px 2px 4px #000000A0;

		font-weight: bold;

		display: flex;
		justify-content: center;
		align-items: center;
		overflow: hidden;
	}
	.popup > div > p {
		font-size: 25px;
		font-weight: bold;
		text-align: center;

		padding-left: 10px;
		padding-right: 10px;
		max-width: 500px;
	}
	.popup > div > div {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;

		display: flex;
		justify-content: center;
		align-items: center;

		background-color: #ffffffe5;
	}
	.popup > div > div > div {
		display: flex;
		justify-content: center;
		gap: 10%;
		align-items: center;
	}
	.popup > div > div > div > button {
		margin-top: 25px;
		margin-bottom: 25px;
		
		white-space: nowrap;

		color: rgb(37, 95, 172);
	}
</style>