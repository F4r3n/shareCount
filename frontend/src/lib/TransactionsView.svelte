<script lang="ts">
    import { onMount } from "svelte";
    import type { Debt, Transaction } from "$lib/types";
    import TransactionView from "$lib/TransactionView.svelte";
    import {updateTransaction} from "$lib/shareCountAPI"
    let {
        transactions,
        main_currency,
        members,
        token
    }: {
        transactions: Transaction[];
        main_currency: string | undefined;
        members: string[];
        token : string | null
    } = $props();
    let creating_transaction: Transaction | null = null;
    onMount(async () => {});
    let creating: boolean = $state(false);
</script>

<div class="flex flex-col h-dvh">
    <div class="transactions">
        <div class="flex flex-col w-full md:w-8/12">
            {#each transactions as transaction}
                <TransactionView {transaction} {members} onSave={async (newTransaction : Transaction)=>{
                    try
                    {
                        await updateTransaction(token??"", newTransaction);
                    }
                    catch(e) {
                        console.log(e);
                    }
                }}></TransactionView>
            {/each}
        </div>
    </div>

    <button
        class="btn btn-accent md:w-1/3 mx-auto add-button mt-5"
        onclick={() => {
            creating = true;
            creating_transaction = {
                id: -1,
                amount: "0",
                currency: main_currency ?? "USD",
                created_at: new Date().getTime(),
                debtors: [] as Debt[],
                description: "",
                paid_by: "",
            };
        }}
    >
        Add transaction
    </button>
</div>

<style>
    .transactions {
        display: flex;
        width: 100%;
        justify-content: center;
        overflow-y: auto;
    }

    .add-button {
        position: sticky;
        bottom: 0;
        z-index: 10;
    }
</style>
