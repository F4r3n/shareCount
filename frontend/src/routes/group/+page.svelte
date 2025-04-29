<script lang="ts">
    import { onMount } from "svelte";
    import { page } from "$app/state";
    import type { Transaction, Group } from "../../lib/types";
    import TransactionsView from "$lib/TransactionsView.svelte";

    import { getGroup, getTransactions } from "$lib/shareCountAPI";
    import { group_name } from "$lib/store";

    const current_token = page.url.searchParams.get("id");
    const cat = $derived(page.url.searchParams.get("cat") ?? "Transactions");

    let transactions: Transaction[] = $state([]);
    let group_info: Group | null = $state(null);
    let current_error : string = $state("");
    onMount(async () => {
        if (current_token) {
            try {
                group_info = await getGroup(current_token);
                transactions = await getTransactions(current_token);
                if(group_info) {
                    group_name.set(group_info.name);
                }
            } catch (error) {
                current_error = error as string;
            }
        }
    });
</script>

{#if current_error}
<div role="alert" class="alert alert-error">
    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span>{current_error}</span>
  </div>
{/if}

{#if cat === "Transactions"}
    <TransactionsView {transactions}></TransactionsView>
{/if}

<style>
</style>
