<script lang="ts">
    import { onMount } from "svelte";
    import { page } from "$app/state";
    import type { Transaction, Group } from "../../lib/types";
    import TransactionView from "$lib/TransactionView.svelte";
    import { getGroup, getTransactions } from "$lib/shareCountAPI";
    let current_token = page.url.searchParams.get("id");
    const cat = $derived(page.url.searchParams.get("cat") ?? "Transactions");

    let transactions: Transaction[] = $state([]);
    let group_info: Group | null = $state(null);
    onMount(async () => {
        console.log(page.url.searchParams);
        if (current_token) {
            try {
                group_info = await getGroup(current_token);
                transactions = await getTransactions(current_token);
            } catch (error) {}
        }
    });
</script>

{#if cat === "Transactions"}
    <div class="transactions">
        <div class="flex flex-col justify-center w-full md:w-8/12">
            {#each transactions as transaction}
                <TransactionView {transaction}></TransactionView>
            {/each}
        </div>
    </div>
{/if}

<style>
    .transactions {
        display: flex;
        width: 100%;
        justify-content: center;
    }
</style>
