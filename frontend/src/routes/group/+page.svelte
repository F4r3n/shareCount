<script lang="ts">
    import { onMount } from "svelte";
    import { page } from "$app/state";
    import type { Transaction, Group } from "../../lib/types";
    import TransactionsView from "$lib/TransactionsView.svelte";

    import { getGroup, getTransactions } from "$lib/shareCountAPI";
    import { group_name } from "$lib/store";

    let current_token = page.url.searchParams.get("id");
    const cat = $derived(page.url.searchParams.get("cat") ?? "Transactions");

    let transactions: Transaction[] = $state([]);
    let group_info: Group | null = $state(null);
    onMount(async () => {
        if (current_token) {
            try {
                group_info = await getGroup(current_token);
                transactions = await getTransactions(current_token);
                group_name.set(group_info.name);
            } catch (error) {}
        }
    });
</script>

{#if cat === "Transactions"}
    <TransactionsView {transactions}></TransactionsView>
{/if}

<style>
</style>
