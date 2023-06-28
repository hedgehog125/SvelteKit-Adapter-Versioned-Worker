<script lang="ts">
	let isEven: typeof import("virtual-is-even").default;

	async function loadModule() {
		isEven = (await import("virtual-is-even")).default;
	}

	let numberToCheck: number = 42;
	let output: boolean;
	function onSubmit() {
		output = isEven(numberToCheck);
	}
</script>

<main>
	<p>
		Since calculating if a number is even requires a very long lookup table /s, you'll need to download it first.
	</p>
	<button on:click={loadModule}>Load module</button> <br>

	<p>
		In all seriousness, this page just dynamically imports an overly long module to check how the "strict-lazy" mode works.
	</p> <br>
	
	<br>
	<form on:submit|preventDefault={onSubmit}>
		<label>
			Number:
			<input type="number" bind:value={numberToCheck}>
		</label> <br>
		<button type="submit" disabled={isEven == null}>Is it even?</button> <br>
		{#if output != null}
			{output? "Yes" : "No"}
		{/if}
	</form>
</main>