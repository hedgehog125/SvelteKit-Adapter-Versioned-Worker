<script lang="ts">
    import type { UpdatePriority } from "internal-adapter/worker";

	import { UPDATE_PROMPT_MESSAGES } from "$lib/index_internal.js";
	import closeIcon from "$img/close.svg";

	import { fly, fade } from "svelte/transition";

	export let priority: UpdatePriority;

	$: message = UPDATE_PROMPT_MESSAGES[priority];
</script>

{#if message != null}
	{#if priority === 4}
		<div class="popup" transition:fade|global={{ duration: 250 }}>
			<p>
				{message}
			</p>
		</div>
	{:else}
		<div class="side" transition:fly|global={{
			y: 75,
			duration: 750
		}}>
			<span>
				{message}
			</span>
			<div>
				<button type="button">Reload</button>
				<button type="button">
					<img src={closeIcon} alt="Close popup" width=16 height=16>
				</button>
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
	}

	.side {
		position: fixed;
		left: 50%;
		bottom: 25px;
		transform: translateX(-50%);

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
		box-shadow: 2px 2px 4px #000000A0
	}
	@media only screen and (max-width: 450px) {
		.side {
			left: 0;
			right: 0;
			bottom: 0;

			transform: unset;
			border-radius: 0;
			box-shadow: none;
		}
	}
	span {
		display: inline-block;
		margin: 10px;
		margin-right: 50px;

		font-size: 17px;
		color: #ddd;
	}
	.side > div {
		display: flex;
		align-items: center;
	}
	.side > div > button {
		background: none;
		border: none;

		font-weight: bold;
		font-size: 17px;
		color: rgb(204, 195, 245);

		margin-left: 12.5px;
	}
	button > img {
		display: block;
		max-height: 100%;
		width: auto;
	}

	.popup {
		--border-radius: min(12.5vw, 12.5vh);

		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 99;

		--base-margin: min(2.5vw, 22.5vh);
		margin: var(--base-margin);
		margin-top: calc(var(--base-margin) + 50px);

		background-color: rgb(200, 200, 200);
		border-radius: var(--border-radius);
		border-style: none;

		font-weight: bold;

		display: flex;
		justify-content: center;
		align-items: center;
	}
	p {
		font-size: 25px;
		font-weight: bold;
		text-align: center;

		padding-left: 10px;
		padding-right: 10px;
		max-width: 500px;
	}
</style>