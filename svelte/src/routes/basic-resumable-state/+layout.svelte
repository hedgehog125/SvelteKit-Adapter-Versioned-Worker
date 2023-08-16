<script lang="ts">
    import { dontAllowReloadOnNavigateWhileMounted } from "$lib/index_internal.js";

	dontAllowReloadOnNavigateWhileMounted();
</script>

<slot></slot>