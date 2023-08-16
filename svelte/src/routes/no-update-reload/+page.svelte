<script lang="ts">
	import { link } from "$lib/util.js";
    import { dontAllowReloadForNextNavigation } from "$lib/index_internal.js";

	dontAllowReloadForNextNavigation();
</script>

<main>
	<p>
		When you navigate away from this page, there won't ever be a reload for an update.
	</p> <br>

	<a href={link("")}>Back</a>
</main>