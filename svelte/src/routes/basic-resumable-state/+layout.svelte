<script lang="ts">
    import { dontAllowReloadOnNavigateWhileMounted } from "$lib";

	dontAllowReloadOnNavigateWhileMounted();
</script>

<slot></slot>