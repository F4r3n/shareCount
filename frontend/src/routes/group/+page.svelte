<script lang="ts">
    import { onMount } from "svelte";
    import { page } from '$app/state';
    let current_token = $state("");
    onMount(async () => {
        const params = new URLSearchParams({ id: 'tailwind', sort: 'desc' });
        current_token = page.url.searchParams.get("id") ?? "";
        console.log("TOKEN " +page.url.searchParams.get("id"));
    });
</script>

<main>

</main>

<style>

</style>
