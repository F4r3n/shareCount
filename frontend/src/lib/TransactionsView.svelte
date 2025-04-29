<script lang="ts">
    import { onMount } from "svelte";
    import type { Transaction } from "$lib/types";
    import TransactionView from "$lib/TransactionView.svelte";

    let { transactions }: { transactions: Transaction[] } = $props();
    onMount(async () => {});
</script>

<div class="flex flex-col h-dvh">
    <div class="transactions">
        <div class="flex flex-col w-full md:w-8/12">
            {#each transactions as transaction}
                <TransactionView {transaction}></TransactionView>
            {/each}
        </div>
    </div>
    <button class="btn btn-accent md:w-1/3 mx-auto add-button">
        Add transaction
    </button>
</div>

<style>
    .transactions {
        display: flex;
        width: 100%;
        justify-content: center;
        overflow-y: auto;
        flex-grow: 1;
    }

    .add-button {
        position: sticky;
        bottom: 0;
        z-index: 10;
    }
</style>
